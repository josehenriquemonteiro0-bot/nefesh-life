import { describe, expect, it } from 'vitest';
import { breathPhase, logBreath, moodInsights, needsSupport, techniqueOf } from './mind';
import { keyDaysAgo } from './dates';

const NOW = new Date('2026-11-20T12:00:00');

describe('mente', () => {
  it('fases da respiração: segurar mantém o tamanho', () => {
    const q = techniqueOf('quadrada');
    expect(breathPhase(q, 1)).toMatchObject({ name: 'Inspire', left: 3, big: true });
    expect(breathPhase(q, 5)).toMatchObject({ name: 'Segure', big: true });
    expect(breathPhase(q, 9)).toMatchObject({ name: 'Expire', big: false });
    expect(breathPhase(q, 13)).toMatchObject({ name: 'Segure', big: false });
    expect(breathPhase(q, 16)).toMatchObject({ name: 'Inspire' });
  });
  it('a sessão marca o hábito e soma os minutos', () => {
    const l = { breath: 2 };
    logBreath(l, 3);
    expect(l).toMatchObject({ breath: 5, hab: { resp: true } });
  });
  it('liga o humor ao sono e sugere ajuda quando é preciso', () => {
    const logs: Record<string, object> = {};
    for (let i = 0; i < 8; i++) logs[keyDaysAgo(i, NOW)] = i % 2 ? { d: 4, sleepH: 7.5 } : { d: 2, sleepH: 5.5 };
    expect(moodInsights({ logs } as never, NOW)[0].text).toMatch(/dormir 7 h ou mais, o seu humor é 4 \(contra 2\)/);
    expect(needsSupport({ logs } as never, NOW)).toBe(false);
    for (let i = 0; i < 5; i++) logs[keyDaysAgo(i, NOW)] = { d: 1 };
    expect(needsSupport({ logs } as never, NOW)).toBe(true);
  });
});
