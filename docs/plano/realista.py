"""Empresas difíceis (experiência real de vendas no Brasil) e alternativas: mais profissionais, benefício concreto (clube de vantagens)."""
import sys, os, numpy as np; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from simulacao import run, score
from refinado import BASE, REG_EU
N = 5000
def combo(br_over, sh=None, eu_on=True, br_reg=None):
    st = {**BASE, 'inf': 0, 'split': 0.3, 'ref': 1, 'seed': 80000, 'alpha': 0.5, **br_over}
    if br_reg: st['reg'] = br_reg
    b = run(st, N=N, seed_rng=31, shock=sh)
    if eu_on:
        eu_st = dict(st, app=(9.99, 69.99), seat=9.99, lic=79, seed=12000, fixed_add=500, reg=dict(REG_EU, start=6, **({k: v for k, v in (br_reg or {}).items() if k in ('el_app',)})))
        e = run(eu_st, N=N, seed_rng=32, shock=sh)
        go = (b[0][3] >= 1200).astype(float)
    else:
        e = [np.zeros_like(x) for x in b[:4]] + [None, np.zeros_like(b[5])]; go = 0
    PAY = b[0] + e[0] * go; CASH = b[1] + e[1] * go; REV = b[2] + e[2] * go; COST = b[3] + e[3] * go
    low = np.minimum(CASH.min(axis=0), 0); s = score(PAY, CASH, REV, COST, low)
    md = lambda a: float(np.median(a))
    return s, md(b[5][12, 2]), md(b[5][12, 1]), md(b[5][12, 0] + b[5][12, 3])
# empresas como o José descreveu: metade dos contratos, o dobro do custo de venda, e menos adesão (cancelamentos mais altos)
HARD = {'b2b': 0.4, 'b2b_cost': 2.0}
rows = [
  ('Plano atual, empresas como no plano', {}, None, None),
  ('Plano atual, empresas difíceis', {}, HARD, None),
  ('Empresas difíceis, esforço 30% empresas / 70% profissionais', {'split': 0.7}, HARD, None),
  ('Idem + utilizador comum com clube de vantagens (+30% conversão, -25% cancelamentos)', {'split': 0.7}, dict(HARD, churn=0.75), {'el_app': 1.3}),
  ('Idem + 10% afiliados por resultado', {'split': 0.7, 'inf': 0.1}, dict(HARD, churn=0.75, cpi=0.4), {'el_app': 1.3}),
  ('Sem empresas nenhumas: 100% profissionais + clube de vantagens + afiliados', {'split': 1.0, 'inf': 0.1}, dict(churn=0.75, cpi=0.4, b2b=0.0), {'el_app': 1.3}),
]
for name, over, sh, reg in rows:
    s, emp, pac, app = combo(over, sh, True, reg)
    print(f"{name}\n   P {s['P']:.0%} | 10 mil dez/27 {s['p10k']:.0%} | 20 mil dez/28 {s['p20k']:.0%} | pagantes dez/27 {s['pag27']:,.0f} (empresas {emp:,.0f}, pacientes {pac:,.0f}, app {app:,.0f}) | vale {s['vale']/1e3:.0f} (8/10 {s['vale80']/1e3:.0f}) mil")
print('--- alternativas sem depender de empresas ---')
more = [
  ('Sem empresas, sem Europa, empurrão R$ 50 mil', {'split': 1.0, 'inf': 0.1, 'seed': 50000}, dict(churn=0.75, cpi=0.4, b2b=0.0), {'el_app': 1.3}, False),
  ('Sem empresas, sem Europa, R$ 50 mil + Spirulina com app (3x mais assinantes da Spirulina via afiliados)', {'split': 1.0, 'inf': 0.1, 'seed': 50000}, dict(churn=0.75, cpi=0.4, b2b=0.0), {'el_app': 1.3, 'shop': 3}, False),
  ('Idem, metas com mais 6 meses (10 mil em jun/28)', None, None, None, None),
]
for name, over, sh, reg, eu in more:
    if over is None:
        st = {**BASE, 'inf': 0.1, 'split': 1.0, 'ref': 1, 'seed': 50000, 'alpha': 0.5, 'reg': {'el_app': 1.3, 'shop': 3}}
        b = run(st, N=N, seed_rng=31, shock=dict(churn=0.75, cpi=0.4, b2b=0.0))
        PAY, CASH = b[0], b[1]
        p = float(((PAY[18] >= 10000) & (PAY[24] >= 20000)).mean()); p10 = float((PAY[18] >= 10000).mean())
        print(f"{name}\n   10 mil em jun/28: {p10:.0%} | 20 mil dez/28 {float((PAY[24] >= 20000).mean()):.0%} | as duas: {p:.0%} | vale {-np.median(np.minimum(CASH.min(axis=0),0))/1e3:.0f} (8/10 {-np.percentile(np.minimum(CASH.min(axis=0),0),20)/1e3:.0f}) mil")
        continue
    s, emp, pac, app = combo(over, sh, eu, reg)
    print(f"{name}\n   P {s['P']:.0%} | 10 mil dez/27 {s['p10k']:.0%} | 20 mil dez/28 {s['p20k']:.0%} | pagantes dez/27 {s['pag27']:,.0f} (pacientes {pac:,.0f}, app+Spirulina {app:,.0f}) | vale {s['vale']/1e3:.0f} (8/10 {s['vale80']/1e3:.0f}) mil")
