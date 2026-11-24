import Foundation
import Capacitor
import StoreKit

/// Assinatura NEFESH Premium pela App Store (StoreKit 2).
/// - products: preços e período já no formato e na moeda da conta Apple da pessoa;
/// - purchase: compra (a Apple mostra a confirmação e o período grátis, se houver);
/// - entitlements / restore: assinaturas ativas (restore pede primeiro à Apple que sincronize);
/// - manage: abre a gestão das assinaturas da Apple (cancelar, mudar de plano).
/// Cada transação vai assinada (JWS) para o servidor da NEFESH confirmar com o certificado da Apple.
@objc(NefeshStorePlugin)
public class NefeshStorePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NefeshStorePlugin"
    public let jsName = "NefeshStore"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "products", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "entitlements", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restore", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "manage", returnType: CAPPluginReturnPromise),
    ]

    private var updates: Task<Void, Never>?

    override public func load() {
        // renovações, reembolsos e compras feitas noutro aparelho chegam aqui
        updates = Task.detached { [weak self] in
            for await result in Transaction.updates {
                if case .verified(let t) = result { await t.finish() }
                self?.notifyListeners("transaction", data: NefeshStorePlugin.describe(result))
            }
        }
    }

    deinit { updates?.cancel() }

    static func describe(_ result: VerificationResult<Transaction>) -> [String: Any] {
        var o: [String: Any] = ["jws": result.jwsRepresentation]
        switch result {
        case .verified(let t):
            o["verified"] = true
            o["productId"] = t.productID
            if let e = t.expirationDate { o["expires"] = e.timeIntervalSince1970 * 1000 }
            o["revoked"] = t.revocationDate != nil
        case .unverified(let t, _):
            o["verified"] = false
            o["productId"] = t.productID
        }
        return o
    }

    private static func days(_ p: Product.SubscriptionPeriod) -> Int {
        switch p.unit {
        case .day: return p.value
        case .week: return p.value * 7
        case .month: return p.value * 30
        case .year: return p.value * 365
        @unknown default: return p.value
        }
    }

    @objc func products(_ call: CAPPluginCall) {
        let ids = call.getArray("ids", String.self) ?? []
        Task {
            do {
                let list = try await Product.products(for: ids)
                var out: [[String: Any]] = []
                for p in list {
                    var o: [String: Any] = [
                        "id": p.id,
                        "name": p.displayName,
                        "price": p.displayPrice,
                        "value": NSDecimalNumber(decimal: p.price).doubleValue,
                        "currency": p.priceFormatStyle.currencyCode,
                    ]
                    if let s = p.subscription {
                        o["periodDays"] = NefeshStorePlugin.days(s.subscriptionPeriod)
                        if let intro = s.introductoryOffer, intro.paymentMode == .freeTrial {
                            o["trialDays"] = NefeshStorePlugin.days(intro.period) * intro.periodCount
                        }
                        o["trialEligible"] = await s.isEligibleForIntroOffer
                    }
                    out.append(o)
                }
                call.resolve(["products": out])
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }

    @objc func purchase(_ call: CAPPluginCall) {
        guard let id = call.getString("id") else { return call.reject("Produto em falta.") }
        Task {
            do {
                guard let product = try await Product.products(for: [id]).first else { return call.reject("Plano indisponível de momento.") }
                let result = try await product.purchase()
                switch result {
                case .success(let v):
                    if case .verified(let t) = v { await t.finish() }
                    var o = NefeshStorePlugin.describe(v)
                    o["status"] = "ok"
                    call.resolve(o)
                case .userCancelled:
                    call.resolve(["status": "cancelado"])
                case .pending:
                    call.resolve(["status": "pendente"])
                @unknown default:
                    call.resolve(["status": "cancelado"])
                }
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }

    private func current(_ call: CAPPluginCall) async {
        var list: [[String: Any]] = []
        for await r in Transaction.currentEntitlements { list.append(NefeshStorePlugin.describe(r)) }
        call.resolve(["transactions": list])
    }

    @objc func entitlements(_ call: CAPPluginCall) {
        Task { await self.current(call) }
    }

    @objc func restore(_ call: CAPPluginCall) {
        Task {
            try? await AppStore.sync()
            await self.current(call)
        }
    }

    @objc func manage(_ call: CAPPluginCall) {
        Task { @MainActor in
            if let scene = self.bridge?.viewController?.view.window?.windowScene {
                try? await AppStore.showManageSubscriptions(in: scene)
            }
            call.resolve()
        }
    }
}

/// Ecrã principal da app com os plugins próprios da NEFESH registados.
class NefeshBridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(NefeshStorePlugin())
    }
}
