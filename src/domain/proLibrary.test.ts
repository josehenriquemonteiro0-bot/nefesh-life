import { describe, expect, it } from 'vitest';
import { LIBRARY, addFromLibrary, applySplit, focusGroups, searchExercises, splitName } from './proLibrary';

describe('NEFESH Life Pro: biblioteca e divisão', () => {
  it('divisão ABC cria 3 treinos com foco sugerido e mantém o que já existe', () => {
    expect(splitName(5)).toBe('ABCDE');
    const w = applySplit([], 3);
    expect(w.map((x) => x.name)).toEqual(['Treino A', 'Treino B', 'Treino C']);
    expect(w[2].focus).toBe('Inferior');
    const filled = [{ ...w[0], focus: 'Meu foco', exercises: [{ name: 'Prancha', sets: 3, reps: '30 s', load: '', rest: '', notes: '' }] }];
    const again = applySplit(filled, 5);
    expect(again).toHaveLength(5);
    expect(again[0].focus).toBe('Meu foco');
    expect(again[0].exercises[0].name).toBe('Prancha');
  });
  it('o foco "inferior" sugere exercícios de pernas; ao escrever filtra (sem acentos)', () => {
    expect(focusGroups('Inferior')).toEqual(expect.arrayContaining(['quadriceps', 'posteriores', 'gluteos']));
    expect(focusGroups('Peito e tríceps')).toEqual(expect.arrayContaining(['peito', 'triceps']));
    const s = searchExercises('', 'inferior');
    expect(s.length).toBeGreaterThan(10);
    expect(s.every((e) => ['quadriceps', 'posteriores', 'gluteos', 'panturrilhas'].includes(e.group))).toBe(true);
    const t = searchExercises('triceps', 'inferior');
    expect(t.length).toBeGreaterThan(3);
    expect(searchExercises('agach', 'peito')[0].name).toMatch(/Agachamento/);
    expect(new Set(LIBRARY.map((e) => e.name)).size).toBe(LIBRARY.length);
  });
  it('juntar da lista ocupa a linha vazia e traz séries e repetições sugeridas', () => {
    const [w] = applySplit([], 1);
    const e = LIBRARY.find((x) => x.name === 'Leg press 45°')!;
    const r = addFromLibrary(w, e);
    expect(r.exercises).toHaveLength(1);
    expect(r.exercises[0]).toMatchObject({ name: 'Leg press 45°', sets: 4, reps: '8-10' });
    expect(addFromLibrary(r, e).exercises).toHaveLength(2);
  });
  it('aeróbicos: nomes do Brasil e de Portugal, sinónimos e foco cardio', () => {
    expect(searchExercises('esteira', 'superior')[0].name).toMatch(/esteira/);
    expect(searchExercises('passadeira', '').length).toBeGreaterThanOrEqual(3);
    expect(searchExercises('eliptico', '')[0].name).toBe('Elíptica / elíptico (transport)');
    expect(searchExercises('transport', '')[0].name).toBe('Elíptica / elíptico (transport)');
    expect(searchExercises('bike', '').map((e) => e.name)).toEqual(expect.arrayContaining(['Bicicleta ergométrica', 'Air bike (assault bike)']));
    expect(searchExercises('pulley', '')[0].name).toBe('Puxada à frente');
    expect(searchExercises('avanço', '')[0].name).toMatch(/Afundo/);
    expect(focusGroups('Aeróbico')).toContain('cardio');
    expect(searchExercises('', 'Cardio').every((e) => e.group === 'cardio')).toBe(true);
  });
});
