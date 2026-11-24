import { describe, expect, it } from 'vitest';
import { firstSteps } from './firstSteps';
import { blankState } from './sample';

const NOW = new Date('2026-11-24T12:00:00');
const base = () => ({ ...blankState(NOW), ans: { name: 'Ana' } as never, planStart: '2026-11-24' });

describe('Primeiros passos', () => {
  it('3 passos que se marcam sozinhos, só nos dias 1 a 3', () => {
    const S = base();
    expect(firstSteps(S, NOW)).toMatchObject({ n: 0, all: false });
    S.logs['2026-11-24'] = { doses: [true], e: 4 };
    expect(firstSteps(S, NOW)).toMatchObject({ n: 2, done: { ritual: true, assistente: false, checkin: true } });
    S.usedCoach = true;
    expect(firstSteps(S, NOW)).toMatchObject({ n: 3, all: true });
    expect(firstSteps(S, new Date('2026-11-27T12:00:00'))).toBeNull();
    S.firstStepsDone = true;
    expect(firstSteps(S, NOW)).toBeNull();
  });
  it('não aparece antes da avaliação nem nos dados de exemplo', () => {
    expect(firstSteps({ ...base(), ans: null } as never, NOW)).toBeNull();
    expect(firstSteps({ ...base(), sample: true } as never, NOW)).toBeNull();
  });
});
