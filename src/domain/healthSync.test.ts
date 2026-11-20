import { describe, expect, it } from 'vitest';
import { applyHealthDays } from './healthSync';
import { blankState } from './sample';

describe('dados do app Saúde', () => {
  it('regista passos, sono e exercício sem contar treinos duas vezes', () => {
    const S = blankState();
    S.logs['2026-11-20'] = { sleepH: 6, workouts: [{ sessionId: 'forca-a', title: 'Força', minutes: 20, mvpa: 20, strength: true }] };
    expect(applyHealthDays(S, { '2026-11-20': { steps: 8000, sleepH: 7.5, exMin: 45, at: 'x' } })).toBe(true);
    const l = S.logs['2026-11-20'];
    expect(l.steps).toBe(8000);
    expect(l.sleepH).toBe(6); // o check-in manda
    expect(l.workouts!.map((w) => w.minutes)).toEqual([20, 25]);
    // receber o mesmo outra vez não muda nada
    expect(applyHealthDays(S, { '2026-11-20': { steps: 8000, sleepH: 7.5, exMin: 45, at: 'y' } })).toBe(false);
  });
});
