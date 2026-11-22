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
    expect(animFor('Pulldown Barra Aberta')).toBe('puxada');
    expect(animFor('Exercício inventado')).toBeNull();
  });
  it('todos os exercícios que o personal pode escolher têm bonequinho', async () => {
    const { LIBRARY } = await import('./proLibrary');
    const { GYM } = await import('./gymData');
    const { ROUTINES } = await import('./exerciseAnims');
    for (const e of [...LIBRARY, ...Object.values(GYM)]) {
      const id = ROUTINES[e.name] ? 'rotina' : animFor(e.name);
      expect(id, e.name).toBeTruthy();
      if (id !== 'rotina') expect(ANIMS[id!], e.name).toBeTruthy();
    }
  });
  it('escolhe o movimento certo nos exercícios de ginásio', () => {
    const cases: [string, string][] = [
      ['Supino reto com barra', 'supino'], ['Supino inclinado com halteres', 'supino_inclinado'], ['Crucifixo invertido (posterior de ombro)', 'crucifixo_inv'],
      ['Peck deck (voador)', 'voador'], ['Puxada à frente', 'puxada'], ['Pulldown com braços estendidos', 'pulldown_reto'],
      ['Remada sentada (cabo)', 'remada_sentada'], ['Remada alta', 'remada_alta'], ['Desenvolvimento Arnold', 'desenvolvimento'],
      ['Rosca Scott', 'rosca_barra'], ['Rosca martelo', 'rosca'], ['Tríceps corda', 'triceps_polia'], ['Tríceps coice (kickback)', 'coice_triceps'],
      ['Glúteo 4 apoios (coice)', 'coice_4apoios'], ['Glúteo na polia (coice)', 'coice_polia'], ['Panturrilha no leg press', 'panturrilha'],
      ['Leg press 45°', 'leg_press'], ['Cadeira extensora', 'extensora'], ['Mesa flexora', 'mesa_flexora'], ['Cadeira flexora', 'flexora_sentada'],
      ['Levantamento terra romeno', 'stiff'], ['Elevação pélvica (hip thrust)', 'hip_thrust'], ['Agachamento búlgaro', 'bulgaro'],
      ['Passadeira / esteira (corrida)', 'esteira_corrida'], ['Esteira 10 min', 'esteira'], ['Bicicleta ergométrica', 'bicicleta'],
      ['Abdominal bicicleta', 'abdominal_bicicleta'], ['Elíptica / elíptico (transport)', 'eliptica'], ['Remo ergómetro (remo indoor)', 'remo'],
      ['Prancha lateral', 'prancha_lateral'], ['Hiperextensão lombar (banco romano)', 'hiperextensao'], ['Supino fechado', 'supino'],
      ['Mergulho no banco', 'mergulho_banco'], ['Paralelas (tríceps)', 'paralelas'], ['Agachamento na parede (isometria)', 'parede'],
    ];
    for (const [n, id] of cases) expect(animFor(n), n).toBe(id);
  });
  it('nomes livres do personal: pelo grupo muscular ou pelas notas', () => {
    expect(animFor('Exercício para peito na máquina nova')).toBe('supino');
    expect(animFor('Circuito de pernas')).toBe('agachamento');
    expect(animFor('Exercício X', 'tipo remada na polia')).toBe('remada_sentada');
  });
});
