import { describe, expect, it } from 'vitest';
import { blankState } from './sample';
import { byPhase, cycleDay, cycleLength, menoSleep, periodLength, periodStarts, pregnancy, showWomen, womenContext } from './women';
import type { AppState } from './types';

const add = (k: string, n: number) => { const d = new Date(`${k}T12:00:00`); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-CA'); };
function withPeriods(starts: string[], len = 5): AppState {
  const S = { ...blankState(), ans: { sexo: 'f' } } as AppState;
  for (const s of starts) for (let i = 0; i < len; i++) S.logs[add(s, i)] = { cycle: { p: true } };
  return S;
}

describe('saúde da mulher', () => {
  it('encontra os inícios, a duração média do ciclo e da menstruação', () => {
    const S = withPeriods(['2026-08-01', '2026-08-30', '2026-09-28', '2026-10-27'], 4);
    expect(periodStarts(S)).toEqual(['2026-08-01', '2026-08-30', '2026-09-28', '2026-10-27']);
    expect(cycleLength(S)).toBe(29);
    expect(periodLength(S)).toBe(4);
  });

  it('dia, fase e próxima menstruação (estimativa)', () => {
    const S = withPeriods(['2026-09-28', '2026-10-27'], 5); // ciclo de 29 dias
    expect(cycleDay(S, '2026-10-29')).toMatchObject({ day: 3, phase: 'menstrual', next: '2026-11-25' });
    expect(cycleDay(S, '2026-11-05')!.phase).toBe('folicular');
    expect(cycleDay(S, '2026-11-11')!.phase).toBe('ovulatoria'); // dia 16 ≈ 29 − 14
    expect(cycleDay(S, '2026-11-20')).toMatchObject({ phase: 'lutea', inDays: 5 });
    // sem registos, usa o último início indicado
    expect(cycleDay({ logs: {}, women: { mode: 'ciclo', lastStart: '2026-11-10', cycleLen: 28 } }, '2026-11-12')!.day).toBe(3);
    expect(cycleDay({ logs: {} }, '2026-11-12')).toBeNull();
  });

  it('energia e sono por fase, só com registos suficientes', () => {
    const S = withPeriods(['2026-10-01', '2026-10-29'], 5);
    for (const d of ['2026-10-02', '2026-10-03', '2026-10-30']) S.logs[d] = { ...S.logs[d], e: 2, sleepH: 6.5 };
    for (const d of ['2026-10-10', '2026-10-11']) S.logs[d] = { e: 4, sleepH: 7.5 };
    const b = byPhase(S)!;
    expect(b.find((x) => x.phase === 'menstrual')).toMatchObject({ energy: 2, sleep: 6.5, n: 3 });
    expect(b.find((x) => x.phase === 'folicular')).toMatchObject({ energy: 4 });
    expect(b.find((x) => x.phase === 'lutea')!.energy).toBeNull();
  });

  it('gravidez: semana e trimestre pela data prevista do parto', () => {
    const p = pregnancy('2027-04-20', new Date('2026-11-20T12:00:00'))!;
    expect(p).toMatchObject({ week: 18, trimester: 2 });
    expect(pregnancy(undefined)).toBeNull();
  });

  it('menopausa: sono com e sem afrontamentos', () => {
    const S = { ...blankState() } as AppState;
    ['01', '02', '03'].forEach((d) => (S.logs[`2026-11-${d}`] = { sleepH: 5.5, cycle: { sy: ['Afrontamentos'] } }));
    ['04', '05', '06'].forEach((d) => (S.logs[`2026-11-${d}`] = { sleepH: 7 }));
    expect(menoSleep(S)).toEqual({ with: 5.5, without: 7 });
  });

  it('aparece a mulheres ou a quem ativou; o Coach recebe só um resumo', () => {
    expect(showWomen({ ans: { sexo: 'f' } })).toBe(true);
    expect(showWomen({ ans: { sexo: 'm' } })).toBe(false);
    expect(showWomen({ ans: { sexo: 'm' }, women: { mode: 'nao', show: true } })).toBe(true);
    expect(showWomen({ ans: { sexo: 'f' }, women: { mode: 'nao' } })).toBe(false);
    const S = { ...blankState(), women: { mode: 'gravidez' as const, due: '2027-04-20' } } as AppState;
    expect(womenContext(S, new Date('2026-11-20T12:00:00'))).toMatch(/semana 18 \(2\.º trimestre\)/);
  });
});
