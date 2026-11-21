import { describe, expect, it } from 'vitest';
import { MEDITATIONS, estimateSeconds, suggested } from './meditations';

describe('biblioteca de meditação', () => {
  it('tem 12 sessões, 4 grátis, e cada uma dura perto do anunciado', () => {
    expect(MEDITATIONS).toHaveLength(12);
    expect(MEDITATIONS.filter((m) => m.free).map((m) => m.id)).toEqual(['ritual', 'ansiedade', 'pausa', 'desligar']);
    for (const m of MEDITATIONS) {
      const min = estimateSeconds(m) / 60;
      expect(min, m.id).toBeGreaterThan(m.minutes * 0.7);
      expect(min, m.id).toBeLessThan(m.minutes * 1.3);
    }
  });
  it('escreve sempre "Spirulina" e sugere a sessão do momento', () => {
    expect(JSON.stringify(MEDITATIONS)).not.toMatch(/espirulina/i);
    expect(suggested(7)).toBe('ritual');
    expect(suggested(22)).toBe('desligar');
    expect(suggested(15)).toBe('pausa');
    expect(suggested(15, 5)).toBe('ansiedade');
  });
});
