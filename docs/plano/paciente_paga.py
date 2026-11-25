"""Estágio 1: licença Pro com pacientes incluídos vs. paciente paga com o código do profissional (comissão ao profissional)."""
import sys, os, itertools, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import simulacao; simulacao.T = 37
from simulacao import run
from refinado import BASE
from estagio1 import MON
M = lambda t: MON[int(t)] if t < 37 else 'depois de dez/29'
N = 3000
def go(extra, seed=15000, sm=6, alpha=0.4, ai=0.6, sh=None):
    st = {**BASE, 'split': 1.0, 'b2b_year': 0, 'ref': 1, 'inf': 0, 'seed': seed, 'seed_m': sm, 'alpha': alpha, 'fixed_add': 3000, 'ai_m': ai, **extra}
    b = run(st, N=N, seed_rng=41, shock={'b2b': 0.0, **(sh or {})}); PAY, CASH, REV, COST = b[0], b[1], b[2], b[3]
    low = -np.minimum(CASH.min(axis=0), 0); ok = REV >= COST; stay = np.full(N, 99)
    for t in range(36, -1, -1): stay = np.where(ok[t:].all(axis=0), t, stay)
    f = lambda L: np.where((PAY >= L).any(axis=0), (PAY >= L).argmax(axis=0), 99)
    q = lambda a: (M(np.median(a)), M(np.percentile(a, 80)))
    return dict(k1=q(f(1000)), k5=q(f(5000)), k10=q(f(10000)), sust=q(stay), v=(round(np.median(low) / 1e3), round(np.percentile(low, 80) / 1e3)), c29=round(np.median(CASH[36]) / 1e3), pay=[round(np.median(PAY[t])) for t in (6, 12, 24, 36)], pac=round(np.median(b[5][24, 1])))
CODE = {'pat_code': True, 'pat_price': 29.9, 'comm': 0.2}
rows = [
    ('A. Licença Pro R$ 249 com 20 pacientes incluídos (atual)', {}, {}),
    ('B. Paciente paga R$ 29,90 com código; Pro grátis; comissão 20%', CODE, {}),
    ('C. = B, conversão prudente (15–30% dos pacientes assinam)', {**CODE, 'pat_conv': (0.15, 0.30)}, {}),
    ('D. = B, pacientes cancelam 50% mais (saem no fim do acompanhamento)', {**CODE, 'pat_churn_x': 1.5}, {}),
    ('E. = C + D (prudente nos dois)', {**CODE, 'pat_conv': (0.15, 0.30), 'pat_churn_x': 1.5}, {}),
]
for ai in (0.6, 1.0):
    print(f'=== IA: {"uso normal (~R$ 6 por pagante)" if ai == 0.6 else "uso intenso (~R$ 10 por pagante)"} · empurrão R$ 15 mil/mês por 6 meses, reinvestir 40% ===')
    for name, extra, sh in rows:
        r = go(extra, ai=ai, sh=sh)
        print(f"{name}\n   1 mil {r['k1'][0]} ({r['k1'][1]}) · 5 mil {r['k5'][0]} ({r['k5'][1]}) · 10 mil {r['k10'][0]} ({r['k10'][1]}) · paga-se {r['sust'][0]} ({r['sust'][1]}) · reserva {r['v'][0]} ({r['v'][1]}) mil · caixa dez/29 {r['c29']} mil · pagantes jun27/dez27/dez28/dez29 {r['pay']}")
