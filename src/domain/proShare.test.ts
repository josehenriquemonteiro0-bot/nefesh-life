import { describe, expect, it } from 'vitest';
import { shareSummary } from './proShare';
import type { AppState } from './types';

describe('relatório partilhado com o personal', () => {
  it('14 dias de números, médias só dos dias com registo, sem texto livre', () => {
    const now = new Date('2026-11-22T12:00:00');
    const S = {
      ans: { name: 'Maria', goal: 'energia', sexo: 'f', idade: 30, altura: 165, peso: 60, ativ: '1-2', sonoh: '7-8', energia: 3, stress: 3, safe: ['nenhuma'] },
      planStart: '2026-11-01', evals: [],
      logs: {
        '2026-11-22': { e: 4, sleepH: 7.5, steps: 8000, notes: ['dor nas costas'], grat: ['família'], meals: { almoco: [{ kcal: 600, p: 40 }] }, workouts: [{ minutes: 45, mvpa: 45 }] },
        '2026-11-21': { e: 2, sleepH: 6, stress: 4 },
      },
      bodyLog: [{ date: '2026-11-01', peso: 61 }, { date: '2026-11-20', peso: 60.2 }],
    } as unknown as AppState;
    const r = shareSummary(S, now);
    expect(r.days).toHaveLength(14);
    expect(r.from).toBe('2026-11-09');
    expect(r.avg).toMatchObject({ energy: 3, sleep: 6.8, stress: 4, steps: 8000, kcal: 600, prot: 40 });
    expect(r.trainMin).toBe(45);
    expect(r.weight).toMatchObject({ first: 61, last: 60.2 });
    const txt = JSON.stringify(r);
    expect(txt).not.toContain('costas');
    expect(txt).not.toContain('família');
  });

  it('diário do sono só com autorização e só números', () => {
    const now = new Date('2026-11-22T12:00:00');
    const S = { ans: null, evals: [], logs: {
      '2026-11-22': { sleepD: { bed: '23:30', lat: 40, wakes: 2, waso: 30, up: '07:00', q: 2, note: 'pesadelo' } },
      '2026-11-21': { sleepD: { bed: '00:00', lat: 20, wakes: 1, waso: 10, up: '07:00', q: 3 } },
    } } as unknown as AppState;
    expect(shareSummary(S, now, {})).not.toHaveProperty('sleep');
    const r = shareSummary(S, now, { sleep: true });
    expect(r.sleep).toMatchObject({ nights: 2, lat: 30, wakes: 1.5, q: 2.5, upAvg: '07:00' });
    expect(JSON.stringify(r)).not.toContain('pesadelo');
  });
});
