import { describe, expect, it } from 'vitest';
import { blankState } from './sample';
import { calendarMarks, cycleAlerts, cycleContext, cycleHistory, cycleInsights, cycleReminders, cycleStats, phaseAdvice, predict } from './women';
import { applyCoachActions, type CoachAction } from './coach';
import type { AppState } from './types';

const add = (k: string, n: number) => { const d = new Date(`${k}T12:00:00`); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-CA'); };
function withPeriods(starts: string[], len = 5, extra: Partial<AppState> = {}): AppState {
  const S = { ...blankState(), ans: { sexo: 'f' }, women: { mode: 'ciclo' as const }, ...extra } as AppState;
  for (const s of starts) for (let i = 0; i < len; i++) S.logs[add(s, i)] = { cycle: { p: true, flow: 2 } };
  return S;
}
const act = (o: Partial<CoachAction>): CoachAction => ({ type: 'ciclo', value: 0, meal: '', intensity: '', title: '', replace: false, items: [], note: '', date: '', ...o });

describe('ciclo: previsões', () => {
  const regular = ['2026-07-01', '2026-07-29', '2026-08-26', '2026-09-23', '2026-10-21'];

  it('estatísticas e regularidade', () => {
    const st = cycleStats(withPeriods(regular))!;
    expect(st).toMatchObject({ n: 4, mean: 28, min: 28, max: 28, regular: true, period: 5 });
    expect(cycleStats(withPeriods(['2026-07-01', '2026-07-24', '2026-08-30', '2026-09-25']))!.regular).toBe(false);
  });

  it('próxima menstruação com intervalo, janela fértil e fase', () => {
    const p = predict(withPeriods(regular), '2026-11-01')!;
    expect(p).toMatchObject({ day: 12, len: 28, next: '2026-11-18', inDays: 17, late: 0, spread: 1, phase: 'folicular' });
    expect(p.range).toEqual(['2026-11-17', '2026-11-19']);
    expect(p.fertile).toMatchObject({ from: '2026-10-30', to: '2026-11-05', ovu: '2026-11-04' });
    expect(p.fertileToday).toBe(true);
    // poucos ciclos: intervalo mais largo
    expect(predict(withPeriods(['2026-10-21']), '2026-11-01')!.spread).toBe(3);
  });

  it('atraso e teste de ovulação positivo', () => {
    const S = withPeriods(regular);
    expect(predict(S, '2026-11-21')).toMatchObject({ late: 3, next: '2026-11-21', phase: 'lutea' });
    S.logs['2026-11-06'] = { cycle: { ovt: '+' } };
    expect(predict(S, '2026-11-08')!.fertile).toMatchObject({ ovu: '2026-11-07', lh: true });
  });

  it('método hormonal: sem fases nem janela fértil', () => {
    const S = withPeriods(regular, 4, { women: { mode: 'ciclo', method: 'pilula' } });
    const p = predict(S, '2026-11-01')!;
    expect(p.phase).toBeNull();
    expect(p.fertile).toBeNull();
    expect(calendarMarks(S, '2026-11-01').fertile.size).toBe(0);
    expect(phaseAdvice(S, '2026-11-01')).toBeNull();
  });

  it('calendário: 3 menstruações previstas e janelas férteis', () => {
    const m = calendarMarks(withPeriods(regular), '2026-11-01');
    expect(m.periods.has('2026-11-18')).toBe(true);
    expect(m.periods.has('2026-12-16')).toBe(true);
    expect(m.periods.has('2027-01-13')).toBe(true);
    expect(m.ovu.has('2026-11-04')).toBe(true);
    expect(m.ovu.has('2026-12-02')).toBe(true);
    expect(m.ovu.has('2026-07-15')).toBe(true); // ciclo passado
  });

  it('histórico com fluxo, dor e sintomas por ciclo', () => {
    const S = withPeriods(regular);
    S.logs['2026-09-24'] = { cycle: { p: true, flow: 4, pain: 8, sy: ['Cólicas'] } };
    const c = cycleHistory(S).find((x) => x.start === '2026-09-23')!;
    expect(c).toMatchObject({ len: 28, period: 5, maxFlow: 4, maxPain: 8, heavyDays: 1 });
    expect(c.symptoms).toEqual([['Cólicas', 1]]);
  });
});

describe('ciclo: avisos e alertas', () => {
  it('avisos discretos por defeito, com ids aceites pelo servidor', () => {
    const S = withPeriods(['2026-09-23', '2026-10-21']);
    const r = cycleReminders(S, '2026-11-01');
    expect(r.map((x) => x.date)).toEqual(['2026-11-16', '2026-11-21']);
    expect(r.every((x) => /^[a-z0-9]{4,24}$/.test(x.id) && x.text === '🌸 Lembrete do seu ciclo')).toBe(true);
    S.women = { mode: 'ciclo', goal: 'engravidar', notif: { plain: true } };
    const r2 = cycleReminders(S, '2026-11-01');
    expect(r2.map((x) => x.text)).toContain('🌸 A janela fértil começa hoje (estimativa)');
    expect(r2[0].text).toMatch(/daqui a 2 dias/);
    S.women = { mode: 'gravidez' };
    expect(cycleReminders(S, '2026-11-01')).toEqual([]);
  });

  it('ciclos fora do intervalo, dor forte e menstruação longa', () => {
    const S = withPeriods(['2026-06-01', '2026-07-15', '2026-08-30', '2026-10-15'], 9);
    for (const k of ['2026-07-16', '2026-08-31']) S.logs[k] = { cycle: { p: true, pain: 8 } };
    const ids = cycleAlerts(S, '2026-11-01').map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining(['ciclos', 'longa', 'dor']));
    expect(cycleAlerts(withPeriods(['2026-09-23', '2026-10-21']), '2026-11-01')).toEqual([]);
  });

  it('atraso com relações sem proteção sugere teste; ausência longa não alerta com implante', () => {
    const S = withPeriods(['2026-09-23', '2026-10-21']);
    S.logs['2026-11-03'] = { cycle: { sex: 'u' } };
    expect(cycleAlerts(S, '2026-11-22').map((a) => a.id)).toContain('teste');
    const old = withPeriods(['2026-07-01']);
    expect(cycleAlerts(old, '2026-11-01').map((a) => a.id)).toContain('ausente');
    old.women = { mode: 'ciclo', method: 'implante' };
    expect(cycleAlerts(old, '2026-11-01').map((a) => a.id)).not.toContain('ausente');
  });

  it('fluxo intenso com ferritina baixa', () => {
    const S = withPeriods(['2026-09-23', '2026-10-21']);
    S.logs['2026-10-22'] = { cycle: { p: true, flow: 3 } };
    S.care = { labs: [{ id: 'a', date: '2026-10-01', key: 'ferritina', name: 'Ferritina', value: 9, unit: 'ng/mL' }] };
    expect(cycleAlerts(S, '2026-11-10').map((a) => a.id)).toContain('fluxo');
  });
});

describe('ciclo: padrões, conselho e assistente', () => {
  it('sono antes da menstruação e conselho de treino com dor', () => {
    const S = withPeriods(['2026-08-26', '2026-09-23', '2026-10-21']);
    for (const s of ['2026-08-26', '2026-09-23']) for (let i = 0; i < 28; i++) {
      const k = add(s, i);
      S.logs[k] = { ...S.logs[k], sleepH: i >= 25 ? 6 : 7.5 };
    }
    expect(cycleInsights(S)[0]).toMatch(/90 minutos a menos/);
    S.logs['2026-10-22'] = { cycle: { p: true, sy: ['Cólicas'] } };
    expect(phaseAdvice(S, '2026-10-22')!.train).toMatch(/caminhada/);
    expect(phaseAdvice(S, '2026-11-01')!.phase).toBe('folicular');
  });

  it('o assistente regista o ciclo, incluindo dias anteriores', () => {
    const S = withPeriods([]);
    const now = new Date('2026-11-21T10:00:00');
    const done = applyCoachActions(S, [
      act({ title: 'menstruacao', value: 3, date: '2026-11-20' }),
      act({ title: 'menstruacao', value: 3 }),
      act({ title: 'sintomas', note: 'Cólicas, cansaço, inventado' }),
      act({ title: 'dor', value: 6 }),
    ], now);
    expect(S.logs['2026-11-20'].cycle).toMatchObject({ p: true, flow: 3 });
    expect(S.logs['2026-11-21'].cycle).toMatchObject({ p: true, flow: 3, sy: ['Cólicas', 'Cansaço'], pain: 6 });
    expect(done[0]).toMatch(/Menstruação, fluxo intenso/);
    // data no futuro ignorada: fica hoje
    applyCoachActions(S, [act({ title: 'teste_gravidez_neg', date: '2027-01-01' })], now);
    expect(S.logs['2026-11-21'].cycle!.pt).toBe('-');
  });

  it('contexto do assistente sem datas exatas e sem prometer dias seguros', () => {
    const S = withPeriods(['2026-09-23', '2026-10-21'], 5, { women: { mode: 'ciclo', goal: 'evitar' } });
    const t = cycleContext(S, '2026-11-01')!;
    expect(t).toMatch(/dia 12 de ~28/);
    expect(t).toMatch(/daqui a 17 dias/);
    expect(t).toMatch(/nunca digas que um dia é "seguro"/);
    expect(t).not.toMatch(/2026/);
  });
});
