"""Números finais do Plano mestre (estágio 1): estratégia recomendada, trajetórias, marcos e crises."""
import sys, os, json, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import simulacao; simulacao.T = 37
from simulacao import run
from refinado import BASE
from estagio1 import MON
N = 5000
REC = dict(seed=20000, seed_m=6, alpha=0.4)
def go(ai=0.6, sh=None, **over):
    g = {**REC, **over}
    st = {**BASE, 'split': 1.0, 'b2b_year': 0, 'ref': 1, 'inf': 0, 'fixed_add': 3000, 'ai_m': ai, **g}
    b = run(st, N=N, seed_rng=41, shock={'b2b': 0.0, **(sh or {})})
    return b
def stats(b):
    PAY, CASH, REV, COST, _, MIX = b
    low = -np.minimum(CASH.min(axis=0), 0); ok = REV >= COST; stay = np.full(N, 99)
    for t in range(36, -1, -1): stay = np.where(ok[t:].all(axis=0), t, stay)
    f = lambda L: np.where((PAY >= L).any(axis=0), (PAY >= L).argmax(axis=0), 99)
    M = lambda t: MON[int(t)] if t < 37 else 'depois de dez/29'
    q = lambda a: (M(np.median(a)), M(np.percentile(a, 80)))
    p_by = lambda L, t: float((PAY[t] >= L).mean())
    return dict(k1=q(f(1000)), k5=q(f(5000)), k10=q(f(10000)), sust=q(stay), vale=(round(np.median(low) / 1e3), round(np.percentile(low, 80) / 1e3)),
                p1k_set27=p_by(1000, 9), p5k_dez28=p_by(5000, 24), p10k_dez29=p_by(10000, 36), caixa=(round(np.median(CASH[24]) / 1e3), round(np.median(CASH[36]) / 1e3)))
if __name__ == '__main__':
    b = go()
    s = stats(b); print('RECOMENDADA (IA uso normal):', s)
    PAY, CASH, REV, COST, _, MIX = b
    md = lambda a: round(float(np.median(a)))
    print('caixa', json.dumps([dict(m=MON[t], mediana=round(md(CASH[t]) / 1000), pior=round(float(np.percentile(CASH[t], 20)) / 1000)) for t in range(0, 25)]))
    print('canais', json.dumps([dict(m=MON[t], pacientes=md(MIX[t, 1]), app=md(MIX[t, 0]), spirulina=md(MIX[t, 3])) for t in range(37)]))
    for t in (0, 3, 6, 9, 12, 18, 24, 30, 36):
        print(MON[t], 'pag', md(PAY[t]), 'rev', round(md(REV[t]) / 1000, 1), 'cost', round(md(COST[t]) / 1000, 1), 'cash', round(md(CASH[t]) / 1000), 'pros ativos', md(MIX[t, 4]), 'pacientes', md(MIX[t, 1]), 'app', md(MIX[t, 0]), 'spirulina', md(MIX[t, 3]))
    print('--- crises ---')
    for name, kw in [('IA uso intenso (R$ 10)', dict(ai=1.0)), ('IA a meio (R$ 8)', dict(ai=0.8)), ('Apple atrasa 2 meses', dict(sh={'delay': 2})), ('Cancelamentos +50%', dict(sh={'churn': 1.5})),
                     ('Profissionais 40% mais lentos', dict(sh={'pros': 0.6})), ('Profissionais 2x mais caros de trazer', dict(sh={'pros_cost': 2})), ('Crise combinada (prof. -25%, cancel. +25%, IA R$ 8)', dict(ai=0.8, sh={'pros': 0.75, 'churn': 1.25}))]:
        print(name, stats(go(**kw)))
    print('--- variantes ---')
    for name, kw in [('Licença R$ 299', dict(lic=299)), ('Empurrão R$ 15 mil', dict(seed=15000)), ('Empurrão R$ 10 mil', dict(seed=10000)), ('Reinvestir 30%', dict(alpha=0.3))]:
        print(name, stats(go(**kw)))
