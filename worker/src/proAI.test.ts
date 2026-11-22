import { describe, expect, it } from 'vitest';
import { DICTATE_SYSTEM, dictate, review } from './proAI';

const kv = () => { const m = new Map<string, string>(); return { get: async (k: string) => m.get(k) ?? null, put: async (k: string, v: string) => void m.set(k, v) }; };
const fake = (out: unknown, calls: { messages: { content: string }[] }[] = []) =>
  ({ beta: { messages: { create: async (r: never) => { calls.push(r); return { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(out) }] }; } } } }) as never;
const ex = (name: string, notes = '') => ({ name, sets: 3, reps: '12', load: '', rest: '60 s', notes });

describe('NEFESH Life Pro com IA', () => {
  it('ditado: envia o plano e o treino atual; devolve o plano limpo, mantendo treinos ainda vazios', async () => {
    expect(DICTATE_SYSTEM).toMatch(/Cadeira extensora/);
    const calls: { messages: { content: string }[] }[] = [];
    const out = { workouts: [{ name: 'Treino A', focus: 'Inferior', day: '', exercises: [ex('Agachamento búlgaro'), ex('Cadeira extensora', 'Segure 2 s em cima')] }, { name: 'Treino B', focus: 'Superior', day: '', exercises: [] }], per_week: 3, notes: '', summary: 'Juntei 2 exercícios ao Treino A.', doubts: '' };
    const plan = { workouts: [{ name: 'Treino A', focus: 'Inferior', day: '', exercises: [ex('')] }, { name: 'Treino B', focus: 'Superior', day: '', exercises: [ex('')] }], per_week: 3, notes: '' };
    const r = await dictate(fake(out, calls), 'm', kv(), 'isa', 'ip', { text: 'no treino A agachamento búlgaro e extensora, segurar 2 segundos', plan, current: 0 });
    expect(r.status).toBe(200);
    expect(calls[0].messages[0].content).toContain('Treino que está a ser montado agora: Treino A');
    expect(calls[0].messages[0].content).toContain('extensora, segurar');
    const p = r.body.plan as { workouts: { name: string; exercises: { name: string; notes: string }[] }[] };
    expect(p.workouts.map((w) => w.name)).toEqual(['Treino A', 'Treino B']);
    expect(p.workouts[0].exercises[1]).toMatchObject({ name: 'Cadeira extensora', notes: 'Segure 2 s em cima' });
    expect(p.workouts[1].exercises).toEqual([]);
    expect(r.body.summary).toMatch(/Juntei/);
    expect((await dictate(fake(out), 'm', kv(), 'isa', 'ip', { text: '' })).status).toBe(400);
  });
  it('revisão: observações gerais e notas só para exercícios que existem', async () => {
    const plan = { workouts: [{ name: 'Treino A', focus: 'Inferior', day: '', exercises: [ex('Leg press 45°'), ex('Mesa flexora')] }], per_week: 2, notes: '' };
    const out = { general: ['Falta trabalho de panturrilha.'], notes: [{ workout: 0, exercise: 1, note: 'Quadril colado ao banco.' }, { workout: 3, exercise: 0, note: 'x' }] };
    const r = await review(fake(out), 'm', kv(), 'isa', 'ip', { plan });
    expect(r.body.general).toEqual(['Falta trabalho de panturrilha.']);
    expect(r.body.notes).toEqual([{ workout: 'Treino A', exercise: 1, name: 'Mesa flexora', note: 'Quadril colado ao banco.' }]);
    expect((await review(fake(out), 'm', kv(), 'isa', 'ip', { plan: { workouts: [] } })).status).toBe(400);
  });
});
