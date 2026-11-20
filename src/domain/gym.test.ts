import { describe, expect, it } from 'vitest';
import { GYM, gymWeek, setsFor } from './gym';

describe('treinos no ginásio', () => {
  it('iniciante: corpo inteiro 3 vezes; intermediário: superior/inferior 4 vezes', () => {
    const ini = gymWeek({ corpo: 'manter' }, 'iniciante');
    const int = gymWeek({ corpo: 'manter' }, 'intermedio');
    expect(ini.filter((s) => s.kind === 'forca')).toHaveLength(3);
    expect(int.filter((s) => s.kind === 'forca')).toHaveLength(4);
    for (const s of [...ini, ...int]) for (const id of s.exercises) expect(GYM[id]).toBeDefined();
  });
  it('perder gordura acrescenta cardio; ganhar massa acrescenta uma série', () => {
    expect(gymWeek({ corpo: 'perder-suave' }, 'iniciante').filter((s) => s.kind === 'cardio').length).toBeGreaterThan(1);
    expect(setsFor('supino_barra', 'intermedio', { corpo: 'ganhar-suave' })).toBe('5 × 8');
    expect(setsFor('supino_barra', 'intermedio', { corpo: 'manter' })).toBe('4 × 8');
  });
});
