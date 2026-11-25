/**
 * Ecrã de assinatura NEFESH Premium (abre a partir do Perfil ou de uma funcionalidade Premium).
 * Segue as regras da Apple para assinaturas: preço e período claros, período grátis explicado,
 * renovação automática, como cancelar, Termos e Privacidade, e "Restaurar compras".
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import { FEATURES, canAccess, premiumOf, type Feature } from '../domain/features';
import { PLANS, REF_PRICES, annualDeal, money, premiumFromStore, rememberStoreProof, type Plan } from '../domain/premium';
import { legalUrl } from '../domain/platform';
import { currentLocale } from '../i18n/locale';
import { getAuth, syncPremium } from '../domain/account';
import { storeAvailable, storeBuy, storeManage, storeProducts, storeRedeem, storeRestore, type StoreProduct } from '../native/store';
import { useStore } from '../state/store';

// abrir/fechar a partir de qualquer ecrã
let open = false;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
export const openPaywall = () => { open = true; emit(); };
const closePaywall = () => { open = false; emit(); };
const usePaywallOpen = () => useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => open);

/** O que o Premium inclui hoje (só o que já existe na app). */
const BENEFITS = [
  `NEFESH Voice Assistant sem o limite de ${FEATURES.coach.freeDaily} mensagens por dia, por voz ou por escrito`,
  'Foto do prato: a IA estima os alimentos, as calorias e a proteína',
  'Leitura com IA do plano do seu nutricionista ou personal',
  'Treino completo: séries, cargas, histórico e progressão automática',
  'Sono: tendências, padrões pessoais, o programa "Dormir melhor em 14 dias" e o Yoga Nidra',
  'Relatórios semanais e mensais completos e a Personal Health Timeline',
  'Biblioteca completa de meditações',
];

export function PaywallHost() {
  const isOpen = usePaywallOpen();
  return isOpen ? <Paywall onClose={closePaywall} /> : null;
}

function Paywall({ onClose }: { onClose: () => void }) {
  const { S, update, toast } = useStore();
  const native = storeAvailable();
  const [products, setProducts] = useState<StoreProduct[] | null>(native ? null : []);
  const [plan, setPlan] = useState<Plan>('anual');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const current = premiumOf(S);

  useEffect(() => {
    if (!native) return;
    storeProducts().then(setProducts, () => setProducts([]));
  }, [native]);

  // o preço é sempre o da conta Apple (país da loja), não o idioma da app: no iPhone vem da própria Apple;
  // na web (sem loja) mostram-se os dois, real e euro
  const ref = REF_PRICES[currentLocale() === 'pt-BR' ? 'BR' : 'PT'];
  const loading = native && products === null;
  const storeDown = native && products !== null && !products.some((x) => x.id === PLANS.anual.id || x.id === PLANS.mensal.id);
  const priceOf = (p: Plan) => {
    const sp = products?.find((x) => x.id === PLANS[p].id);
    if (sp) return { text: sp.price, value: sp.value, currency: sp.currency, trial: sp.trialEligible === false ? 0 : sp.trialDays ?? 0 };
    if (native) return { text: '…', value: ref[p].value, currency: ref[p].currency, trial: PLANS[p].trialDays };
    return { text: `${money(REF_PRICES.BR[p].value, 'BRL')} ou ${money(REF_PRICES.PT[p].value, 'EUR')}`, value: ref[p].value, currency: ref[p].currency, trial: PLANS[p].trialDays };
  };
  const m = priceOf('mensal');
  const a = priceOf('anual');
  const deal = annualDeal(m.value, a.value);
  const chosen = plan === 'anual' ? a : m;
  const settings = currentLocale() === 'pt-BR' ? 'Ajustes → [o seu nome] → Assinaturas' : 'Definições → [o seu nome] → Subscrições';

  const apply = async (list: { jws: string; verified: boolean }[]) => {
    if (storeAvailable()) rememberStoreProof(list as never);
    const local = premiumFromStore(list as never);
    let server = null;
    if (getAuth()) server = await syncPremium(list.map((t) => t.jws)).catch(() => null);
    const p = local ?? server;
    update((d) => {
      if (p) d.premium = p;
      else if (d.premium && d.premium !== true && d.premium.source === 'subscription') delete d.premium;
    });
    return p;
  };

  const buy = async () => {
    setErr('');
    setBusy(true);
    try {
      const r = await storeBuy(PLANS[plan].id);
      if (r.status === 'ok') {
        if (await apply([r])) {
          toast('Bem-vindo ao NEFESH Premium! 🌿');
          onClose();
        } else setErr('A compra não foi confirmada pela Apple. Tente "Restaurar compras".');
      } else if (r.status === 'pendente') setErr('A compra está à espera de aprovação (por exemplo, de Compras Partilhadas). Fica ativa assim que for aprovada.');
    } catch (e) {
      setErr((e as Error).message || 'Não foi possível concluir a compra.');
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    setErr('');
    setBusy(true);
    try {
      const p = native ? await apply(await storeRestore()) : getAuth() ? await apply([]) : null;
      if (p) {
        toast('Assinatura restaurada.');
        onClose();
      } else setErr(native ? 'Não encontrámos nenhuma assinatura ativa nesta conta Apple.' : 'Entre na conta NEFESH com que assinou no iPhone.');
    } catch (e) {
      setErr((e as Error).message || 'Não foi possível restaurar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet paywall" role="dialog" aria-modal="true" aria-label="NEFESH Premium">
        <button className="close" onClick={onClose} aria-label="Fechar">×</button>
        <p className="small gold" style={{ margin: 0, fontWeight: 700 }}>NEFESH Premium</p>
        <h2 style={{ margin: '4px 0 8px' }}>Tire o máximo da NEFESH Life</h2>
        {current?.source === 'subscription' ? (
          <>
            <p className="small">O seu Premium está ativo{current.until ? ` até ${current.until.split('-').reverse().join('/')}` : ''} e renova automaticamente.</p>
            {native && <button className="btn ghost" onClick={() => storeManage()}>Gerir ou cancelar a assinatura</button>}
          </>
        ) : (
          <>
            <ul className="paywall-list small">
              {BENEFITS.map((b) => <li key={b}>✓ {b}</li>)}
            </ul>
            <div className="plans" role="radiogroup" aria-label="Plano">
              <button role="radio" aria-checked={plan === 'anual'} className={`plan ${plan === 'anual' ? 'on' : ''}`} onClick={() => setPlan('anual')}>
                <span className="plan-badge">{a.trial ? `${a.trial} dias grátis` : `poupa ${deal.saving}%`}</span>
                <b>Anual</b>
                <span>{a.text} por ano</span>
                <small>{native && !loading && !storeDown ? `equivale a ${money(deal.perMonth, a.currency)} por mês · ` : ''}poupa {deal.saving}%</small>
              </button>
              <button role="radio" aria-checked={plan === 'mensal'} className={`plan ${plan === 'mensal' ? 'on' : ''}`} onClick={() => setPlan('mensal')}>
                <b>Mensal</b>
                <span>{m.text} por mês</span>
                <small>sem compromisso</small>
              </button>
            </div>
            {!native && <p className="small mute" style={{ margin: '8px 0 0' }}>Reais com conta Apple do Brasil, euros com conta Apple da Europa. O preço final é o que a Apple mostra no iPhone, conforme o país da sua conta Apple (não o idioma da app).</p>}
            {storeDown && <p className="small" style={{ margin: '8px 0 0' }}>Não foi possível obter os preços da App Store. Verifique a ligação e tente de novo.</p>}
            {native ? (
              <button className="btn" disabled={busy || loading || storeDown} onClick={buy} style={{ width: '100%', marginTop: 12 }}>
                {busy ? 'Um momento…' : loading ? 'A carregar os preços…' : chosen.trial ? `Começar ${chosen.trial} dias grátis` : 'Assinar'}
              </button>
            ) : (
              <p className="small" style={{ marginTop: 12 }}>Pode assinar no iPhone, na NEFESH Life. Se já assinou, entre aqui com a mesma conta NEFESH e toque em "Restaurar compras".</p>
            )}
            <p className="small mute" style={{ marginTop: 10 }}>
              {chosen.trial
                ? `${chosen.trial} dias grátis, depois ${chosen.text} por ${plan === 'anual' ? 'ano' : 'mês'}. Se cancelar até 24 horas antes do fim do período grátis, não paga nada.`
                : `${chosen.text} por ${plan === 'anual' ? 'ano' : 'mês'}.`}{' '}
              O pagamento é cobrado na sua conta Apple quando confirmar a compra. A assinatura renova automaticamente pelo mesmo preço e período, a menos que a cancele pelo menos 24 horas antes do fim do período, em {settings}.
            </p>
          </>
        )}
        {err && <p className="small" style={{ color: 'var(--warn, #ffb37a)' }}>{err}</p>}
        <p className="small" style={{ marginTop: 8 }}>
          <button className="link small inline" disabled={busy} onClick={restore}>Restaurar compras</button> ·{' '}
          {native && current?.source !== 'subscription' && <><button className="link small inline" disabled={busy} onClick={() => storeRedeem().catch(() => undefined)}>Tenho um código</button> ·{' '}</>}
          <a href={legalUrl('termos')} target="_blank" rel="noreferrer">Termos de Uso</a> ·{' '}
          <a href={legalUrl('privacidade')} target="_blank" rel="noreferrer">Privacidade</a>
        </p>
      </div>
    </div>
  );
}

/** Perfil → NEFESH Premium (estado e entrada para o ecrã de assinatura). */
export function PremiumCard() {
  const { S } = useStore();
  const p = premiumOf(S);
  return (
    <section className="card">
      <h2 style={{ marginTop: 0 }}>NEFESH Premium</h2>
      {p ? (
        <p className="small" style={{ margin: '0 0 8px' }}>Ativo{p.until ? ` até ${p.until.split('-').reverse().join('/')}` : ''}. Obrigado por apoiar a NEFESH Life! 🌿</p>
      ) : (
        <p className="small mute" style={{ margin: '0 0 8px' }}>Assistente sem limites, foto do prato com IA, treino completo, relatórios e todas as meditações.</p>
      )}
      <button className="btn ghost sm" onClick={openPaywall}>{p ? 'Ver a assinatura' : 'Conhecer o Premium'}</button>
    </section>
  );
}

/** Na ação: com acesso, segue; sem acesso, abre o ecrã de assinatura e não segue. */
export function premiumGate(S: Parameters<typeof canAccess>[0], key: Feature) {
  if (canAccess(S, key)) return true;
  openPaywall();
  return false;
}

/** Num cartão: o que fica disponível com o Premium, e o botão para o conhecer. */
export function PremiumLock({ text }: { text: string }) {
  return (
    <div className="premium-lock">
      <p className="small mute" style={{ margin: '6px 0 8px' }}>{text}</p>
      <button className="btn ghost sm" onClick={openPaywall}>Conhecer o Premium</button>
    </div>
  );
}
