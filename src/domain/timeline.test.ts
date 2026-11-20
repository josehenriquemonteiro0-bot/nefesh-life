import { describe, expect, it } from 'vitest';
import { blankState } from './sample';
import { timeline } from './timeline';
import type { AppState } from './types';

const NOW = new Date('2026-11-20T12:00:00');

describe('Personal Health Timeline', () => {
  it('junta o histórico de saúde por ordem, com o que está marcado à parte', () => {
    const S = {
      ...blankState(NOW),
      ans: { goal: 'energia', peso: 70 },
      followLabel: true,
      planStart: '2026-10-01',
      bottles: [{ at: '2026-10-25T10:00:00Z', product: 'caps', code: null, url: null }],
      care: {
        prev: { mama: '2026-09-02' },
        labs: [{ id: 'a', date: '2026-10-05', key: 'ldl', name: 'Colesterol LDL', value: 128, unit: 'mg/dL' }],
        visits: [{ id: 'v', date: '2026-12-03', kind: 'Ginecologia', who: 'Dra. Rita' }],
      },
      bodyLog: [{ date: '2026-10-02', peso: 71 }, { date: '2026-11-02', peso: 70.2 }],
    } as unknown as AppState;
    for (let i = 1; i <= 7; i++) S.logs[`2026-10-0${i}`] = { doses: [true, true] };
    const t = timeline(S, NOW);
    expect(t.map((e) => e.title)).toEqual([
      'Consulta: Ginecologia',
      'Peso: 70,2 kg',
      'Frasco novo',
      '7 dias de ritual da Spirulina',
      'Análises',
      'Peso: 71 kg',
      'Início do ritual NEFESH',
      'Mamografia',
    ]);
    expect(t[0].future).toBe(true);
    expect(t.find((e) => e.title === 'Peso: 70,2 kg')!.detail).toBe('-0,8 kg');
    expect(t.find((e) => e.title === 'Análises')!.detail).toBe('Colesterol LDL 128 mg/dL');
  });
});
