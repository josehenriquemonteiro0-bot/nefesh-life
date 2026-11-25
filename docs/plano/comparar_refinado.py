"""Comparação final das estratégias candidatas (5.000 futuros) e testes de crise da escolhida."""
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from refinado import combo
C = {
 'A atual (R$60k, 40%, Europa jun/27)':        dict(inf=0,   split=0.4, ref=0, seed=60000, alpha=0.4, eu_start=6,  eu_inf=0),
 'B R$80k, 70% empresas, indicação, só BR':     dict(inf=0,   split=0.3, ref=1, seed=80000, alpha=0.5, eu_start=99, eu_inf=0),
 'C = B + 10% influenciadores':                 dict(inf=0.1, split=0.3, ref=1, seed=80000, alpha=0.5, eu_start=99, eu_inf=0),
 'D = B + Europa jun/27':                       dict(inf=0,   split=0.3, ref=1, seed=80000, alpha=0.5, eu_start=6,  eu_inf=0),
 'E = C + Europa jun/27':                       dict(inf=0.1, split=0.3, ref=1, seed=80000, alpha=0.5, eu_start=6,  eu_inf=0),
 'F = C + Europa jan/28':                       dict(inf=0.1, split=0.3, ref=1, seed=80000, alpha=0.5, eu_start=13, eu_inf=0),
}
mon = ['dez/26','jan/27','fev/27','mar/27','abr/27','mai/27','jun/27','jul/27','ago/27','set/27','out/27','nov/27','dez/27']
for k, g in C.items():
    s, _ = combo(g, 5000, rng=31)
    print(f"{k:42s} P {s['P']:.1%} | 20mil jun/28 {s['p_jun28']:.0%} | vale {s['vale']/1e3:.0f} (8/10: {s['vale80']/1e3:.0f}) | pag27 {s['pag27']:.0f} pag28 {s['pag28']:.0f} | app27 {s['b2c27']:.0f} app28 {s['b2c28']:.0f} | EU28 {s['eu28']:.0f} | lucro {mon[int(s['sust'])] if s['sust']<13 else s['sust']} | caixa28 {s['caixa28']/1e6:.1f}M")
if len(sys.argv) > 1:
    g = C[sys.argv[1]]
    for name, sh, es in [('Apple atrasa 2 meses', {'delay': 2}, None), ('cancelamentos +50%', {'churn': 1.5}, None), ('profissionais -40%', {'pros': 0.6}, None),
                         ('IA +50%', {'ai': 1.5}, None), ('empresas -50%', {'b2b': 0.5}, None), ('influenciadores 2x mais caros', {'cpi': 2}, None),
                         ('Europa vende metade', {}, {'pros': 0.5, 'b2b': 0.5}), ('crise combinada', {'pros': 0.75, 'b2b': 0.75, 'ai': 1.25, 'churn': 1.25}, None)]:
        s, _ = combo(g, 5000, rng=31, shock=sh, eu_shock=es)
        print(f"  {name:30s} P {s['P']:.0%} vale {s['vale']/1e3:.0f} (8/10: {s['vale80']/1e3:.0f})")
