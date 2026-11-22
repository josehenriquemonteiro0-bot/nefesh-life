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
  it('por etapas: a estrutura só cria os treinos; a etapa do treino B só muda o B', async () => {
    const calls: { messages: { content: string }[] }[] = [];
    const est = { workouts: [{ name: 'Treino A', focus: 'Superior', day: 'seg', exercises: [ex('Supino reto com barra')] }, { name: 'Treino B', focus: 'Inferior', day: 'ter', exercises: [] }], per_week: 5, notes: '', summary: 'Criei A e B.', doubts: '' };
    const r1 = await dictate(fake(est, calls), 'm', kv(), 'isa', 'ip', { text: '5 vezes por semana, A superior, B inferior', plan: { workouts: [] }, stage: 'estrutura' });
    expect(calls[0].messages[0].content).toContain('ETAPA 1');
    const p1 = r1.body.plan as { per_week: number; workouts: { name: string; focus: string; exercises: unknown[] }[] };
    expect(p1.per_week).toBe(5);
    expect(p1.workouts.map((w) => [w.name, w.focus, w.exercises.length])).toEqual([['Treino A', 'Superior', 0], ['Treino B', 'Inferior', 0]]);
    const plan = { workouts: [{ name: 'Treino A', focus: 'Superior', day: '', exercises: [ex('Supino reto com barra')] }, { name: 'Treino B', focus: 'Inferior', day: '', exercises: [] }], per_week: 5, notes: 'x' };
    const out = { workouts: [{ name: 'Treino A', focus: 'Mudado', day: '', exercises: [] }, { name: 'Treino B', focus: 'Inferior', day: '', exercises: [ex('Agachamento livre'), ex('Mesa flexora')] }], per_week: 2, notes: '', summary: 'ok', doubts: '' };
    const r2 = await dictate(fake(out, calls), 'm', kv(), 'isa', 'ip', { text: 'agachamento livre e mesa flexora', plan, stage: 'treino', current: 1 });
    expect(calls[1].messages[0].content).toContain('ETAPA 2 — EXERCÍCIOS do Treino B (foco: Inferior)');
    const p2 = r2.body.plan as { per_week: number; notes: string; workouts: { focus: string; exercises: { name: string }[] }[] };
    expect(p2.workouts[0]).toMatchObject({ focus: 'Superior', exercises: [{ name: 'Supino reto com barra' }] });
    expect(p2.workouts[1].exercises.map((e) => e.name)).toEqual(['Agachamento livre', 'Mesa flexora']);
    expect(p2.per_week).toBe(5);
    expect(p2.notes).toBe('x');
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
