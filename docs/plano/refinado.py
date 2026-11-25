"""Plano refinado: empresas + profissionais + utilizador comum (influenciadores e indicação), Brasil e Europa.
Procura as estratégias com 95% ou mais de probabilidade das duas metas e a menor reserva.
Correr: python3 refinado.py 1  (varrimento, 1.000 futuros)  ·  python3 refinado.py 2  (as melhores com 5.000 futuros)
"""
import sys, os, json, itertools, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from simulacao import run, score

REG_EU = dict(fx=6.2, vat=0.23, mkt=0.35, acq=0.47, fixed=1.8, base=50, shop=0.3, el_app=1.0, el_seat=0.9, el_lic=0.88)
BASE = dict(app=(39.9, 249.9), annual=0.7, seat=29.9, b2b_year=1, lic=249, pro_year=1, seed_m=12, ai_m=1.0, eff_p=0.8, eff_c=0.75, fixed_add=3000)
GRID = dict(inf=[0, 0.1, 0.2, 0.3, 0.4], split=[0.3, 0.4, 0.5], ref=[0, 1], seed=[60000, 70000, 80000], alpha=[0.4, 0.5], eu_start=[6, 99], eu_inf=[0, 0.3])

def combo(g, N, rng=7, shock=None, eu_shock=None):
    br_st = dict(BASE, inf=g['inf'], split=g['split'], ref=g['ref'], seed=g['seed'], alpha=g['alpha'])
    br = run(br_st, N=N, seed_rng=rng, shock=shock)
    if g['eu_start'] < 25:
        eu_st = dict(br_st, app=(9.99, 69.99), seat=9.99, lic=79, seed=12000, fixed_add=500, inf=g['eu_inf'], reg=dict(REG_EU, start=g['eu_start']))
        eu = run(eu_st, N=N, seed_rng=rng + 1, shock=shock if eu_shock is None else eu_shock)
    else:
        eu = tuple(np.zeros_like(x) for x in br[:4]) + (np.zeros_like(br[4]), np.zeros_like(br[5]))
    PAY = br[0] + eu[0]; CASH = br[1] + eu[1]; REV = br[2] + eu[2]; COST = br[3] + eu[3]
    low = np.minimum(CASH.min(axis=0), 0)
    s = score(PAY, CASH, REV, COST, low)
    s['p_jun28'] = float(((PAY[12] >= 10000) & (PAY[18] >= 20000)).mean())   # 20 mil já em junho de 2028
    s['b2c27'] = float(np.median(br[5][12, 0])); s['b2c28'] = float(np.median(br[5][24, 0]))
    s['eu28'] = float(np.median(eu[0][24]))
    return s, (br, eu, PAY, CASH, REV, COST)

if __name__ == '__main__':
    if sys.argv[1] == '1':
        out = []
        keys = list(GRID)
        for vals in itertools.product(*GRID.values()):
            g = dict(zip(keys, vals))
            if g['eu_start'] == 99 and g['eu_inf']: continue
            s, _ = combo(g, 1000); s['g'] = g; out.append(s)
        json.dump(out, open('refinado1.json', 'w'))
        print(len(out), 'estratégias')
    else:
        r1 = json.load(open('refinado1.json'))
        cand = [r for r in r1 if r['P'] >= 0.93]
        cand = sorted(cand, key=lambda r: r['vale80'])[:25]
        out = []
        for r in cand:
            s, _ = combo(r['g'], 5000, rng=21); s['g'] = r['g']; out.append(s)
        json.dump(out, open('refinado2.json', 'w'))
        for s in sorted(out, key=lambda r: (-(r['P'] >= 0.95), r['vale80']))[:15]:
            print({k: (round(v, 3) if isinstance(v, float) else v) for k, v in s.items()})
