"""
Modelo final NEFESH Life (dez/2026 → dez/2028, 25 meses), base real de 350 clientes de Spirulina.
Caixa real: planos anuais entram adiantados (Apple paga ~1 mês depois); contratos de empresas e licenças do Pro
podem ser anuais adiantados (10 meses pelo preço de 12). Anuais não cancelam a meio; renovam ao 12.º mês.
Crescimento: semente inicial + parte da receita reconhecida reinvestida (comissões por cliente que paga).
Choques opcionais para os testes de crise.
"""
import itertools, sys, json
import numpy as np

T = 25
def run(st, N=400, seed_rng=1, shock=None):
    shock = dict(shock or {})
    reg = st.get('reg', {})
    fx = reg.get('fx', 1.0)                      # R$ por unidade da moeda da região
    vat = reg.get('vat', 0.0)                    # IVA incluído no preço da app (Europa 23%)
    mkt = reg.get('mkt', 1.0)                    # tamanho do mercado/rede (profissionais e empresas que se conseguem alcançar)
    acq = reg.get('acq', 1.0)                    # custo de aquisição relativo (salários e eventos mais caros)
    start = reg.get('start', 0)                  # mês em que a região arranca
    rng = np.random.default_rng(seed_rng)
    U = lambda a, b: rng.uniform(a, b, N)
    app_m, app_y = st['app']
    a_share = np.clip(st['annual'] + U(-0.1, 0.1), 0.2, 0.85)
    seat_p, lic_p = st['seat'], st['lic']
    el_app = reg.get('el_app', 1.0 if app_m == 39.9 else 0.8)
    el_seat = reg.get('el_seat') or {24.9: 1.15, 29.9: 1.0, 34.9: 0.85, 39.9: 0.7}[seat_p]
    el_lic = reg.get('el_lic') or (1.0 if lic_p == 249 else 0.88)
    # incertezas
    cpp = U(350, 900) / el_lic * acq * st.get('eff_p', 1) * shock.get('pros_cost', 1)
    cpc = U(3000, 8000) / el_seat * (1.15 if st['b2b_year'] else 1) * acq * st.get('eff_c', 1) * shock.get('b2b_cost', 1)
    founder_pros = U(6, 15) * mkt; founder_b2b = U(0.3, 1.2) * el_seat * mkt
    pro_active = U(0.45, 0.7); pat_add = U(1.5, 4.0); pat_cap = U(15, 30)
    lic_adopt = U(0.20, 0.45) * el_lic; pat_conv = U(0.12, 0.30) * el_app
    pro_year = U(0.3, 0.5) if st['pro_year'] else np.zeros(N)
    seats = U(60, 200); seat_use = U(0.5, 0.8)
    churn_b2b_m = U(0.01, 0.03); renew_b2b = U(0.75, 0.9)
    prepay = U(0.3, 0.6) if st['b2b_year'] else np.zeros(N)
    bundle_take = U(0.2, 0.5); shop_new = U(15, 60) * reg.get('shop', 1); churn_bun = U(0.04, 0.08)
    organic = U(800, 2500) * mkt; k = U(0.03, 0.07) + (U(0.01, 0.03) if st.get('ref') else 0); trial = U(0.04, 0.09) * el_app; t2p = U(0.3, 0.5)
    churn_m = U(0.06, 0.11) * shock.get('churn', 1); renew_y = U(0.45, 0.65)
    free_ret = U(0.55, 0.7); ai_paid = U(6, 14) * shock.get('ai', 1) * st.get('ai_m', 1) / fx; ai_free = U(0.3, 0.9) * shock.get('ai', 1) * st.get('ai_m', 1) / fx
    # utilizador comum: influenciadores e conteúdo pago, em custo por instalação (R$ 4 a 15 no Brasil)
    cpi = U(4, 15) * acq * shock.get('cpi', 1)
    fixed = (6000 + U(0, 3000)) * reg.get('fixed', 1) / fx + st.get('fixed_add', 0)
    delay = shock.get('delay', 0)            # meses sem a app na loja (atraso da Apple)
    net_m = app_m / (1 + vat) * 0.85 * 0.9; net_y = app_y / (1 + vat) * 0.85 * 0.9
    lic_m = lic_p * 0.9; lic_y = lic_p * 10 * 0.9; seat_m = seat_p * 0.9; seat_y = seat_p * 10 * 0.9; bun_net = 15 * 0.9

    H = T + 13
    y_new = np.zeros((H, N))                 # novos anuais (app) por mês
    cy_new = np.zeros((H, N))                # contratos anuais novos por mês
    ly_new = np.zeros((H, N))                # licenças anuais novas por mês
    pros = np.zeros(N); pats = np.zeros(N); pat_pay = np.zeros(N)
    b2c_m = np.zeros(N); ctr_m = np.zeros(N); free = np.zeros(N); bun = reg.get('base', 350) * bundle_take
    pipe_p = np.zeros((H, N)); pipe_c = np.zeros((H, N)); pipe_i = np.zeros((H, N)); ramp_c = np.zeros(N)
    cash = np.zeros(N); low = np.zeros(N); rev_prev = np.zeros(N); apple_due = np.zeros(N); lic_prev = np.zeros(N)
    PAY = np.zeros((T, N)); CASH = np.zeros((T, N)); REV = np.zeros((T, N)); COST = np.zeros((T, N)); MIX = np.zeros((T, 5, N))
    for t in range(T):
        if t < start:
            PAY[t] = 0; CASH[t] = 0; REV[t] = 0; COST[t] = 0; MIX[t] = 0
            continue
        tt = t - start
        growth = (st['seed'] if tt < st['seed_m'] else 0) + st['alpha'] * rev_prev
        inf = st.get('inf', 0)                                   # parte do investimento em influenciadores
        pipe_i[t + 1] += growth * inf / cpi
        pipe_p[t + 1] += growth * (1 - inf) * st['split'] / cpp
        pipe_c[t + 2] += growth * (1 - inf) * (1 - st['split']) / cpc
        new_pros = (founder_pros + pipe_p[t]) * shock.get('pros', 1)
        new_ctr = (founder_b2b * min(1, tt / 2) + pipe_c[t]) * shock.get('b2b', 1)
        pros = pros * 0.97 + new_pros
        act = pros * pro_active
        pats = np.minimum(pats + act * pat_add, act * pat_cap)
        lic_act = act * lic_adopt
        d_lic = np.maximum(0, lic_act - lic_prev); lic_prev = lic_act
        ly_new[t] = d_lic * pro_year + (ly_new[t - 12] * 0.85 if t >= 12 else 0)   # licenças anuais novas + renovações
        pats_lic = pats * lic_adopt
        pat_pay = pat_pay * (1 - churn_m) + np.maximum(0, pats * (1 - lic_adopt) * pat_conv - pat_pay) * 0.5
        # empresas: anuais (renovam ao 12.º mês) ou mensais
        renewed = cy_new[t - 12] * renew_b2b if t >= 12 else 0
        cy_new[t] = new_ctr * prepay + renewed
        ctr_m = ctr_m * (1 - churn_b2b_m) + new_ctr * (1 - prepay)
        contracts = cy_new[max(0, t - 11):t + 1].sum(0) + ctr_m
        # 3) os funcionários ativam as contas aos poucos (cerca de 3 meses até ao uso normal)
        ramp_c = ramp_c * 0.6 + new_ctr * 0.4 if t else new_ctr * 0.4
        corp = (contracts - ramp_c) * seats * seat_use + ramp_c * seats * seat_use * 0.4
        # app (Apple): só depois de a app estar na loja
        live = t >= delay
        installs = (organic * (1 + 0.03 * t) + k * (free + b2c_m + bun + pats + corp) + pipe_i[t] * shock.get('inf', 1)) * (1 if live else 0.15)
        free = free * free_ret + installs * 0.4
        new_subs = installs * trial * t2p + free * 0.002
        renew_app = y_new[t - 12] * renew_y if t >= 12 else 0
        y_new[t] = new_subs * a_share + renew_app
        b2c_y = y_new[max(0, t - 11):t + 1].sum(0)
        b2c_m = b2c_m * (1 - churn_m) + new_subs * (1 - a_share)
        bun = bun * (1 - churn_bun) + shop_new * bundle_take + free * 0.005
        b2c = b2c_m + b2c_y
        paying = b2c + pat_pay + pats_lic + bun + corp
        # receita reconhecida (para decidir o reinvestimento) e caixa real
        rev = (b2c_m + pat_pay) * net_m + b2c_y * net_y / 12 + lic_act * lic_m + corp * seat_m + bun * bun_net
        apple_cash_now = apple_due                               # a Apple paga o mês anterior
        apple_due = (b2c_m + pat_pay) * net_m + y_new[t] * net_y
        lic_cash = lic_act * (1 - pro_year) * lic_m + ly_new[t] * lic_y   # mensais pagam todos os meses; anuais pagam o ano adiantado
        # anual: a empresa paga os lugares contratados adiantado; mensal: paga os lugares em uso
        corp_cash = cy_new[t] * seats * seat_use * seat_y + ctr_m * seats * seat_use * seat_m
        cash_in = apple_cash_now + lic_cash + corp_cash + bun * bun_net
        # indicação: quem indica e quem é indicado ganham 1 mês (cerca de 30% das assinaturas novas vêm por indicação)
        ref_cost = st.get('ref', 0) * new_subs * 0.3 * net_m
        cost = fixed + growth + paying * ai_paid + free * ai_free + ref_cost
        cash = cash + cash_in - cost
        low = np.minimum(low, cash); rev_prev = rev
        PAY[t] = paying; CASH[t] = cash; REV[t] = rev; COST[t] = cost
        MIX[t] = [b2c, pat_pay + pats_lic, corp, bun, act]
    return PAY, CASH * fx, REV * fx, COST * fx, low * fx, MIX

def score(PAY, CASH, REV, COST, low):
    both = (PAY[12] >= 10000) & (PAY[24] >= 20000)
    ok = REV >= COST
    stay = np.full(PAY.shape[1], 99)
    for t in range(T - 1, -1, -1): stay = np.where(ok[t:].all(axis=0), t, stay)
    return dict(P=float(both.mean()), p10k=float((PAY[12] >= 10000).mean()), p20k=float((PAY[24] >= 20000).mean()),
                vale=float(-np.median(low)), vale80=float(-np.percentile(low, 20)), sust=float(np.median(stay)),
                pag27=float(np.median(PAY[12])), pag28=float(np.median(PAY[24])), caixa28=float(np.median(CASH[24])))

GRID = dict(app=[(39.9, 249.9), (49.9, 299.9)], annual=[0.5, 0.6, 0.7], seat=[24.9, 29.9, 34.9, 39.9], b2b_year=[0, 1],
            lic=[249, 299], pro_year=[0, 1], seed=[0, 15000, 25000, 35000, 50000], seed_m=[3, 6, 9, 12], alpha=[0.3, 0.4, 0.5], split=[0.4, 0.5, 0.65])

if __name__ == '__main__':
    stage = sys.argv[1]
    keys = list(GRID)
    if stage == '1':
        out = []
        for vals in itertools.product(*GRID.values()):
            st = dict(zip(keys, vals))
            r = score(*run(st, N=60, seed_rng=11)[:5]); r['st'] = st; out.append(r)
        json.dump(out, open('s1.json', 'w'))
        print('etapa 1:', len(out), 'estratégias x 60 =', len(out) * 60)
    else:
        s1 = json.load(open('s1.json'))
        cand = sorted(s1, key=lambda r: (-r['P'], r['vale']))[:250] + sorted([r for r in s1 if r['P'] >= 0.6], key=lambda r: r['vale'])[:250]
        seen = set(); out = []
        for r in cand:
            key = json.dumps(r['st'], sort_keys=True)
            if key in seen: continue
            seen.add(key)
            st = r['st']; st['app'] = tuple(st['app'])
            r2 = score(*run(st, N=2000, seed_rng=99)[:5]); r2['st'] = st; out.append(r2)
        json.dump(out, open('s2.json', 'w'), default=list)
        print('etapa 2:', len(out), 'estratégias x 2000 =', len(out) * 2000)
