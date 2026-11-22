import { describe, expect, it } from 'vitest';
import { applyReviewNotes } from './ProAI';

describe('revisão do Pro', () => {
  it('põe as notas só nos exercícios sem nota', () => {
    const plan = { is_workout: true, per_week: 2, professional: '', notes: '', workouts: [{ name: 'Treino A', focus: '', day: '', exercises: [
      { name: 'Leg press 45°', sets: 4, reps: '10', load: '', rest: '90 s', notes: '' },
      { name: 'Mesa flexora', sets: 3, reps: '12', load: '', rest: '60 s', notes: 'minha nota' },
    ] }] };
    const r = applyReviewNotes(plan, [
      { workout: 'Treino A', exercise: 0, name: 'Leg press 45°', note: 'Não bloqueie os joelhos.' },
      { workout: 'Treino A', exercise: 1, name: 'Mesa flexora', note: 'outra' },
    ]);
    expect(r.workouts[0].exercises.map((e) => e.notes)).toEqual(['Não bloqueie os joelhos.', 'minha nota']);
  });
});
