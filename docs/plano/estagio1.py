"""
Estágio 1 (decisão do José, nov/2026): sem empresas. Utilizador comum, profissionais (NEFESH Life Pro) e os seus
pacientes, e clientes da Spirulina. A app não pode pesar no caixa: procura-se o menor investimento que chega
aos degraus de 1.000, 5.000 e 10.000 pagantes, e o mês em que a app se paga sozinha. Horizonte: dez/2026 a dez/2029.
Correr: python3 estagio1.py
"""
import sys, os, itertools, json, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import simulacao
simulacao.T = 37
from simulacao import run
from refinado import BASE, REG_EU

MON = [f"{m}/{y}" for y in range(26, 30) for m in ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']][11:11 + 37]
N1, N2 = 600, 5000

def sim(g, N, rng=41, shock=None):
    st = {**BASE, 'split': 1.0, 'b2b_year': 0, 'ref': 1, 'inf': g['inf'], 'seed': g['seed'], 'seed_m': g['seed_m'], 'alpha': g['alpha'], 'fixed_add': g['fixed_add']}
    sh = {'b2b': 0.0, **(shock or {})}
    b = run(st, N=N, seed_rng=rng, shock=sh)
    PAY, CASH, REV, COST = b[0], b[1], b[2], b[3]
    if g['eu'] < 37:
        e = run({**st, 'app': (9.99, 69.99), 'seat': 9.99, 'lic': 79, 'seed': g['seed'] / 6.2 * 0.3, 'fixed_add': 500, 'reg': {**REG_EU, 'start': g['eu']}}, N=N, seed_rng=rng + 1, shock=sh)
        PAY, CASH, REV, COST = PAY + e[0], CASH + e[1], REV + e[2], COST + e[3]
    low = np.minimum(CASH.min(axis=0), 0)
    def first(level):  # mês em que chega ao degrau (99 se não chega)
        hit = PAY >= level
        return np.where(hit.any(axis=0), hit.argmax(axis=0), 99)
    ok = REV >= COST
    stay = np.full(N, 99)
    for t in range(36, -1, -1): stay = np.where(ok[t:].all(axis=0), t, stay)
    return dict(first={L: first(L) for L in (1000, 5000, 10000, 20000)}, stay=stay, vale=-low, PAY=PAY, CASH=CASH, REV=REV, COST=COST, mix=b[5])

def summary(r):
    q = lambda a, p: int(np.percentile(a, p))
    out = {}
    for L, f in r['first'].items():
        out[L] = (q(f, 50), q(f, 80))   # mediana e "8 em 10 futuros" (percentil 80 do mês)
    out['sust'] = (q(r['stay'], 50), q(r['stay'], 80))
    out['vale'] = (float(np.median(r['vale'])), float(np.percentile(r['vale'], 80)))
    out['caixa_dez29'] = float(np.median(r['CASH'][36]))
    return out

if __name__ == '__main__':
    GRID = dict(seed=[10000, 20000, 30000, 40000], seed_m=[6, 12], alpha=[0.3, 0.4, 0.5], inf=[0, 0.1, 0.2], fixed_add=[3000], eu=[99, 18])
    res = []
    for vals in itertools.product(*GRID.values()):
        g = dict(zip(GRID, vals))
        s = summary(sim(g, N1)); s['g'] = g; res.append(s)
    # critério: reserva (8 em 10) até R$ 150 mil; depois, chegar aos 10 mil o mais cedo possível (8 em 10 futuros)
    ok = [r for r in res if r['vale'][1] <= 150000]
    ok.sort(key=lambda r: (r[10000][1], r[5000][1], r['vale'][1]))
    print(len(res), 'estratégias;', len(ok), 'com reserva até R$ 150 mil')
    for r in ok[:8]:
        print(r['g'], '| 1k', MON[min(r[1000][0],36)] if r[1000][0] < 99 else '>dez/29', '| 5k', MON[min(r[5000][0],36)] if r[5000][0] < 99 else '>dez/29', '| 10k med', MON[r[10000][0]] if r[10000][0] < 37 else '>dez/29', '8/10', MON[r[10000][1]] if r[10000][1] < 37 else '>dez/29', '| sust', MON[r['sust'][0]] if r['sust'][0] < 37 else '>', '| vale', round(r['vale'][0]/1e3), round(r['vale'][1]/1e3))
    json.dump([{**{str(k): v for k, v in r.items() if k != 'g'}, 'g': r['g']} for r in ok[:20]], open('/tmp/estagio1_top.json', 'w'))
    # fronteira: para cada reserva máxima, o melhor 10k
    print('--- fronteira (reserva 8/10 → 10 mil pagantes em 8 de 10 futuros) ---')
    for cap in (50000, 100000, 150000, 250000, 400000):
        c = [r for r in res if r['vale'][1] <= cap]
        if not c: print(cap, 'nenhuma'); continue
        b = min(c, key=lambda r: (r[10000][1], r['vale'][1]))
        print(f"até R$ {cap//1000} mil: 1k {MON[b[1000][1]] if b[1000][1]<37 else '>'} · 5k {MON[b[5000][1]] if b[5000][1]<37 else '>'} · 10k {MON[b[10000][1]] if b[10000][1]<37 else '>dez/29'} (8 em 10) · sustentável {MON[b['sust'][1]] if b['sust'][1]<37 else '>'} · reserva {b['vale'][1]/1e3:.0f} · {b['g']}")
