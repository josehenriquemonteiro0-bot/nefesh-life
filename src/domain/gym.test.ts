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

describe('evolução das cargas', () => {
  it('guarda uma carga por dia e mostra a subida', async () => {
    const { logLoads, loadProgress, loadKg, GYM } = await import('./gym');
    const id = Object.keys(GYM)[0];
    let log = logLoads(undefined, { [id]: '20 kg', vazio: ' ' }, '2026-11-01');
    log = logLoads(log, { [id]: '22,5' }, '2026-11-08');
    log = logLoads(log, { [id]: '25 kg' }, '2026-11-08'); // corrige no mesmo dia
    expect(log[id]).toEqual([{ d: '2026-11-01', v: '20 kg' }, { d: '2026-11-08', v: '25 kg' }]);
    expect(log.vazio).toBeUndefined();
    expect(loadProgress(log)[0]).toMatchObject({ id, delta: 5, times: 2 });
    expect(loadKg('3x10 12 kg')).toBe(12);
    expect(loadKg('elástico')).toBeNull();
  });
});
