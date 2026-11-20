import { describe, expect, it } from 'vitest';
import { buildPing } from './analytics';
import { blankState } from './sample';

describe('estatísticas anónimas (app)', () => {
  it('envia só contagens de utilização, sem dados pessoais', () => {
    const S = { ...blankState(), ans: { name: 'Ana', peso: 70, goal: 'energia' } as never, planStart: '2026-11-10' };
    S.logs['2026-11-20'] = { water: 3, e: 4, steps: 5000 } as never;
    const p = buildPing(S, 'tel-aaaaaaaa', new Date('2026-11-20T12:00:00'));
    expect(p).toMatchObject({ plan: true, stage: '8-30', water: 1, checkin: 1, steps: 1, diary: 0 });
    expect(JSON.stringify(p)).not.toContain('Ana');
    expect(JSON.stringify(p)).not.toContain('70');
  });
});
