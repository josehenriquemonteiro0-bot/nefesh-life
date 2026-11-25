import sys, os, numpy as np; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from simulacao import run, score
from refinado import BASE, REG_EU
def gated(g, N=5000, rng=31, shock=None, eu_shock=None, gate=1200, b2c_cpi=1.0):
    br_st = dict(BASE, inf=g['inf'], split=g['split'], ref=g['ref'], seed=g['seed'], alpha=g['alpha'])
    sh = dict(shock or {}); sh['cpi'] = sh.get('cpi', 1) * b2c_cpi
    br = run(br_st, N=N, seed_rng=rng, shock=sh)
    eu_st = dict(br_st, app=(9.99, 69.99), seat=9.99, lic=79, seed=12000, fixed_add=500, inf=0, reg=dict(REG_EU, start=6))
    eu = run(eu_st, N=N, seed_rng=rng + 1, shock=shock if eu_shock is None else eu_shock)
    go = (br[0][3] >= gate).astype(float)        # Europa só arranca se em mar/27 houver pelo menos `gate` pagantes no Brasil
    PAY = br[0] + eu[0] * go; CASH = br[1] + eu[1] * go; REV = br[2] + eu[2] * go; COST = br[3] + eu[3] * go
    low = np.minimum(CASH.min(axis=0), 0); s = score(PAY, CASH, REV, COST, low)
    s['p_jun28'] = float(((PAY[12] >= 10000) & (PAY[18] >= 20000)).mean()); s['eu_go'] = float(go.mean())
    return s, (br, eu, go, PAY, CASH, REV, COST)
if __name__ == '__main__':
    D = dict(inf=0, split=0.3, ref=1, seed=80000, alpha=0.5)
    E = dict(D, inf=0.1)
    for name, g, kw in [('D com regra de março', D, {}), ('E com regra de março', E, {}), ('E, influenciadores por resultado (CPI -60%)', E, {'b2c_cpi': 0.4}), ('E, inf 20% por resultado', dict(E, inf=0.2), {'b2c_cpi': 0.4})]:
        s, _ = gated(g, **kw)
        print(f"{name:45s} P {s['P']:.1%} jun28 {s['p_jun28']:.0%} vale {s['vale']/1e3:.0f} (8/10 {s['vale80']/1e3:.0f}) pag27 {s['pag27']:.0f} pag28 {s['pag28']:.0f} caixa28 {s['caixa28']/1e6:.1f}M Europa arranca em {s['eu_go']:.0%}")
    print('crises sobre D com regra de março:')
    for name, sh, es in [('Apple atrasa 2 meses', {'delay': 2}, None), ('cancelamentos +50%', {'churn': 1.5}, None), ('profissionais -40%', {'pros': 0.6}, None),
                         ('IA +50%', {'ai': 1.5}, None), ('empresas -50%', {'b2b': 0.5}, None), ('Europa vende metade', {}, {'pros': 0.5, 'b2b': 0.5}), ('crise combinada', {'pros': 0.75, 'b2b': 0.75, 'ai': 1.25, 'churn': 1.25}, None)]:
        s, _ = gated(D, shock=sh, eu_shock=es)
        print(f"  {name:28s} P {s['P']:.0%} vale {s['vale']/1e3:.0f} (8/10 {s['vale80']/1e3:.0f}) Europa {s['eu_go']:.0%}")
