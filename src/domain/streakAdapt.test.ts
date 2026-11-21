import { describe, expect, it } from 'vitest';
import { blankState } from './sample';
import { slotsFor } from './plan';
import { streak, tookOn } from './stats';
import { weeklyReport } from './weekReport';
import type { AppState } from './types';

const add = (k: string, n: number) => { const d = new Date(`${k}T12:00:00`); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-CA'); };

describe('sequência depois da semana de adaptação', () => {
  it('os dias da adaptação (menos tomas) continuam a contar quando a dose sobe', () => {
    const start = '2026-11-01';
    const S = { ...blankState(), ans: { goal: 'energia', peso: 70, prior: 'nunca', safe: ['nenhuma'] }, planStart: start } as AppState;
    const now = new Date(`${add(start, 9)}T20:00:00`);
    const nAdapt = slotsFor(S, new Date(`${start}T12:00:00`)).length;
    const nFull = slotsFor(S, now).length;
    expect(nFull).toBeGreaterThan(nAdapt); // o caso que falhava
    // registos antigos, sem o n.º de tomas guardado
    for (let i = 0; i < 7; i++) S.logs[add(start, i)] = { doses: Array(nAdapt).fill(true) };
    for (let i = 7; i <= 9; i++) S.logs[add(start, i)] = { doses: Array(nFull).fill(true) };
    expect(tookOn(S, add(start, 2))).toBe(true);
    expect(streak(S, now)).toBe(10);
    // relatório semanal da semana de adaptação: 7 de 7 (era 0 de 7)
    expect(weeklyReport(S, new Date(`${add(start, 9)}T12:00:00`)).facts.spirulinaDays).toBeGreaterThan(0);
  });
});

import { monthSummary, streakBreak } from './stats';
import { askAccount } from './onboarding';
import { nextReassessment } from './progress';

describe('feedback dos 30 dias', () => {
  const start = '2026-11-01';
  const base = () => ({ ...blankState(), ans: { goal: 'energia', peso: 70, prior: 'regular', safe: ['nenhuma'] }, planStart: start } as AppState);

  it('sequência que parou ontem: mensagem para recomeçar (não no dia de descanso)', () => {
    const S = base();
    const n = slotsFor(S, new Date(`${start}T12:00:00`)).length;
    for (let i = 0; i < 5; i++) S.logs[add(start, i)] = { doses: Array(n).fill(true), slots: n };
    // falhou o dia 6 (o descanso da semana) e o 7: a sequência parou
    expect(streakBreak(S, new Date(`${add(start, 7)}T10:00:00`))).toEqual({ prev: 5, best: 5 });
    expect(streakBreak(S, new Date(`${add(start, 5)}T10:00:00`))).toBeNull();
  });

  it('pedido de conta só em 3 rondas de 2 dias; reavaliação sai ao fim de 5 dias', () => {
    const S = base();
    const day = (d: number) => new Date(`${add(start, d - 1)}T10:00:00`);
    expect([2, 3, 4, 5, 10, 12, 24, 25, 30].map((d) => askAccount(S, false, day(d)))).toEqual([false, true, true, false, true, false, true, true, false]);
    S.evals = [{ date: start, sc: { energia: 50, sono: 50, nutricao: 50, hidratacao: 50, movimento: 50 } }];
    expect(nextReassessment(S, day(16))).toMatchObject({ target: 15, due: true });
    expect(nextReassessment(S, day(26))).toMatchObject({ target: 30, due: false });
  });

  it('resumo do mês', () => {
    const S = base();
    const n = slotsFor(S, new Date(`${start}T12:00:00`)).length;
    for (let i = 0; i < 30; i++) S.logs[add(start, i)] = { doses: Array(n).fill(i % 5 !== 4), slots: n, e: i < 7 ? 3 : 4, water: 20 };
    const m = monthSummary(S, new Date(`${add(start, 29)}T20:00:00`));
    expect(m).toMatchObject({ days: 30, spirulina: 24, water: 30, checkins: 30, energyFirst: 3, energyLast: 4 });
  });
});
