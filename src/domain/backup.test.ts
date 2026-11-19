import { describe, expect, it } from 'vitest';
import { makeBackup, readBackup } from './backup';
import { blankState } from './sample';
import { habitOn, meanOf } from './stats';
import { keyDaysAgo } from './dates';

const NOW = new Date(2026, 10, 19, 10);

describe('cópia de segurança', () => {
  it('guarda e recupera o estado completo', () => {
    const S = { ...blankState(NOW), ans: { name: 'Teste', goal: 'energia' as const }, logs: { '2026-11-18': { water: 6, steps: 8000 } } };
    const back = readBackup(makeBackup(S, NOW));
    expect(back.ans?.name).toBe('Teste');
    expect(back.logs['2026-11-18'].steps).toBe(8000);
  });
  it('recusa ficheiros que não são da app', () => {
    expect(() => readBackup('{"foo":1}')).toThrow('não é uma cópia');
    expect(() => readBackup('isto não é json')).toThrow('não é uma cópia');
  });
});

describe('passos e sono registados', () => {
  it('marcam os hábitos automaticamente', () => {
    const S = blankState(NOW);
    expect(habitOn(S, { steps: 6500 }, 'passos')).toBe(true);
    expect(habitOn(S, { steps: 3000, hab: { passos: true } }, 'passos')).toBe(false);
    expect(habitOn(S, { hab: { passos: true } }, 'passos')).toBe(true);
    expect(habitOn(S, { sleepH: 6.5 }, 'sono')).toBe(false);
  });
  it('calculam a média dos últimos 7 dias só com dias registados', () => {
    const S = blankState(NOW);
    expect(meanOf(S, 'steps', NOW)).toBeNull();
    S.logs[keyDaysAgo(0, NOW)] = { steps: 6000 };
    S.logs[keyDaysAgo(2, NOW)] = { steps: 10000 };
    expect(meanOf(S, 'steps', NOW)).toBe(8000);
  });
});
