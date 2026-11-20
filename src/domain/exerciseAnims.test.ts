import { describe, expect, it } from 'vitest';
import { ANIMS, animFor, complete } from './exerciseAnims';
import { EXERCISES } from './training';

const len = (p: [number, number], q: [number, number]) => Math.hypot(p[0] - q[0], p[1] - q[1]);

describe('animações dos exercícios', () => {
  it('existe uma animação para cada exercício da biblioteca', () => {
    for (const e of EXERCISES) expect(ANIMS[e.id], e.id).toBeTruthy();
  });
  it('as posições ficam dentro da área e acima do chão', () => {
    for (const [id, a] of Object.entries(ANIMS)) {
      for (const pose of [complete(a.a), complete(a.b)]) {
        for (const [j, v] of Object.entries(pose)) {
          if (!v) continue;
          expect(v[0], `${id}.${j}.x`).toBeGreaterThanOrEqual(0);
          expect(v[0], `${id}.${j}.x`).toBeLessThanOrEqual(120);
          expect(v[1], `${id}.${j}.y`).toBeLessThanOrEqual(93);
        }
      }
    }
  });
  it('os ossos não mudam muito de tamanho entre as duas posições (a figura não estica)', () => {
    const bones: [string, string][] = [['hip', 'kN'], ['kN', 'aN'], ['eN', 'hN']];
    for (const [id, a] of Object.entries(ANIMS)) {
      const A = complete(a.a) as Record<string, [number, number]>;
      const B = complete(a.b) as Record<string, [number, number]>;
      for (const [p, q] of bones) {
        const d = Math.abs(len(A[p], A[q]) - len(B[p], B[q]));
        expect(d, `${id} ${p}-${q}`).toBeLessThan(5);
      }
    }
  });
  it('reconhece exercícios de planos de personal', () => {
    expect(animFor('Agachamento com Desenvolvimento (Halter no Chão)')).toBe('agachamento');
    expect(animFor('Afundo com Halteres')).toBe('afundos');
    expect(animFor('Abdominal Prancha Isométrica')).toBe('prancha');
    expect(animFor('Hiperextensao de Lombar Solo')).toBe('superman');
    expect(animFor('Pulldown Barra Aberta')).toBeNull();
  });
});
