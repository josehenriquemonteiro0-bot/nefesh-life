"""Plano recomendado: Brasil enxuto + Europa a partir de jun/2027 (5.000 futuros por região) e testes de crise.
Correr: python3 plano_combinado.py
"""
import sys, numpy as np; sys.path.insert(0, __import__('os').path.dirname(__file__))
from simulacao import run, score
N=5000
BR = dict(app=(39.9,249.9), annual=0.7, seat=29.9, b2b_year=1, lic=249, pro_year=1, seed=60000, seed_m=12, alpha=0.4, split=0.4, ai_m=0.75, eff_p=0.8, eff_c=0.75, fixed_add=3000)
reg=dict(fx=6.2, vat=0.23, mkt=0.35, acq=0.47, fixed=1.8, base=50, shop=0.3, start=6, el_app=1.0, el_seat=0.9, el_lic=0.88)
EU=dict(BR, app=(9.99,69.99), seat=9.99, lic=79, seed=12000, reg=reg, fixed_add=500)
mon=['dez/26','jan/27','fev/27','mar/27','abr/27','mai/27','jun/27','jul/27','ago/27','set/27','out/27','nov/27','dez/27','jan/28','fev/28','mar/28','abr/28','mai/28','jun/28']
def go(name, b_st, e_st, bs={}, es={}):
    b=run(b_st,N=N,seed_rng=7,shock=bs); e=run(e_st,N=N,seed_rng=8,shock=es)
    PAY=b[0]+e[0]; CASH=b[1]+e[1]; REV=b[2]+e[2]; COST=b[3]+e[3]; low=np.minimum(CASH.min(axis=0),0)
    s=score(PAY,CASH,REV,COST,low)
    print(f"{name}: P {s['P']:.0%} vale {s['vale']/1000:.0f} ({s['vale80']/1000:.0f}) sust {mon[int(s['sust'])] if s['sust']<19 else s['sust']} caixa28 {s['caixa28']/1e6:.1f}M")
    return b,e
b,e=go('base',BR,EU)
go('ia+50',BR,EU,{'ai':1.5},{'ai':1.5})
go('ia+50 emp 34.90',dict(BR,seat=34.9),EU,{'ai':1.5},{'ai':1.5})
go('europa metade',BR,EU,{},{'pros':0.5,'b2b':0.5})
go('europa metade, seed 6k',BR,dict(EU,seed=6000),{},{'pros':0.5,'b2b':0.5})
md=lambda a: round(float(np.median(a)))
for t in (3,6,9,12,18):
    print(mon[t],'pag',md(b[0][t]+e[0][t]),'profBR',md(b[5][t,4]),'profEU',md(e[5][t,4]),'seatsBR',md(b[5][t,2]),'seatsEU',md(e[5][t,2]))
