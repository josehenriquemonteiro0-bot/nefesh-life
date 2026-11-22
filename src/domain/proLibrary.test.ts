import { describe, expect, it } from 'vitest';
import { INTRO, LIBRARY, OUTRO, addFromLibrary, addWarmup, applySplit, focusGroups, hasBookend, isWarmup, searchExercises, splitName, toggleBookend } from './proLibrary';

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
  it('aquecimento: entra no início, substitui o anterior e tira linhas vazias', () => {
    const [w] = applySplit([], 1);
    const a = addWarmup({ ...w, exercises: [...w.exercises, { name: 'Supino reto com barra', sets: 4, reps: '10', load: '', rest: '90 s', notes: '' }] }, 'Bicicleta ergométrica', 10);
    expect(a.exercises.map((e) => `${e.name} ${e.sets}x${e.reps}`)).toEqual(['Bicicleta ergométrica 1x10 min', 'Supino reto com barra 4x10']);
    expect(isWarmup(a.exercises[0])).toBe(true);
    const b = addWarmup(a, 'Passadeira / esteira (caminhada)', 10);
    expect(b.exercises.map((e) => e.name)).toEqual(['Passadeira / esteira (caminhada)', 'Supino reto com barra']);
  });
  it('início e fim do treino: aeróbico primeiro, mobilidade depois, alongamento no fim; tocar outra vez tira', () => {
    const [w0] = applySplit([], 1);
    let w = { ...w0, exercises: [{ name: 'Leg press 45°', sets: 4, reps: '10', load: '', rest: '90 s', notes: '' }] };
    const by = (l: string) => [...INTRO, ...OUTRO].find((x) => x.label === l)!;
    w = toggleBookend(w, by('Alongamento final 5 min'));
    w = toggleBookend(w, by('Mobilidade articular 5 min'));
    w = toggleBookend(w, by('Bicicleta 10 min'));
    w = toggleBookend(w, by('Esteira 10 min'));
    expect(w.exercises.map((e) => e.name)).toEqual(['Passadeira / esteira (caminhada)', 'Mobilidade articular geral', 'Leg press 45°', 'Alongamento final (volta à calma)']);
    expect(hasBookend(w, by('Bicicleta 10 min'))).toBe(false);
    w = toggleBookend(w, by('Mobilidade articular 5 min'));
    expect(w.exercises.map((e) => e.name)).toEqual(['Passadeira / esteira (caminhada)', 'Leg press 45°', 'Alongamento final (volta à calma)']);
  });
});
