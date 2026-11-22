import { describe, expect, it } from 'vitest';
import { DICTATE_SYSTEM, dictate, readAssessment, review } from './proAI';

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
    // exceção: aquecimento dito para todos os treinos entra no início de cada um
    const warm = { ...ex('Bicicleta ergométrica'), sets: 1, reps: '10 min', notes: 'Aquecimento' };
    const est2 = { ...est, workouts: est.workouts.map((w) => ({ ...w, exercises: [warm, ex('Supino reto com barra')] })) };
    const r1b = await dictate(fake(est2), 'm', kv(), 'isa', 'ip', { text: 'todos começam com 10 minutos de bicicleta', plan: { workouts: [] }, stage: 'estrutura' });
    const p1b = r1b.body.plan as { workouts: { exercises: { name: string; reps: string }[] }[] };
    expect(p1b.workouts.map((w) => w.exercises.map((e) => `${e.name} ${e.reps}`))).toEqual([['Bicicleta ergométrica 10 min'], ['Bicicleta ergométrica 10 min']]);
    // início com mobilidade e fim com alongamento, em todos
    const mob = { ...ex('Mobilidade articular geral'), sets: 1, reps: '5 min', notes: 'Aquecimento · mobilidade' };
    const fim = { ...ex('Alongamento final (volta à calma)'), sets: 1, reps: '5 min', notes: 'Final · volta à calma' };
    const est3 = { ...est, workouts: est.workouts.map((w) => ({ ...w, exercises: [warm, mob, ex('Supino reto com barra'), fim] })) };
    const r1c = await dictate(fake(est3), 'm', kv(), 'isa', 'ip', { text: 'todos começam com bicicleta e mobilidade e terminam com alongamento', plan: { workouts: [] }, stage: 'estrutura' });
    expect((r1c.body.plan as { workouts: { exercises: { name: string }[] }[] }).workouts[0].exercises.map((e) => e.name)).toEqual(['Bicicleta ergométrica', 'Mobilidade articular geral', 'Alongamento final (volta à calma)']);
    const plan = { workouts: [{ name: 'Treino A', focus: 'Superior', day: '', exercises: [ex('Supino reto com barra')] }, { name: 'Treino B', focus: 'Inferior', day: '', exercises: [] }], per_week: 5, notes: 'x' };
    const out = { workouts: [{ name: 'Treino A', focus: 'Mudado', day: '', exercises: [] }, { name: 'Treino B', focus: 'Inferior', day: '', exercises: [ex('Agachamento livre'), ex('Mesa flexora')] }], per_week: 2, notes: '', summary: 'ok', doubts: '' };
    const r2 = await dictate(fake(out, calls), 'm', kv(), 'isa', 'ip', { text: 'agachamento livre e mesa flexora', plan, stage: 'treino', current: 1 });
    expect(calls[1].messages[0].content).toContain('ETAPA 2 — EXERCÍCIOS do Treino B (foco: Inferior)');
    const p2 = r2.body.plan as { per_week: number; notes: string; workouts: { focus: string; exercises: { name: string }[] }[] };
    expect(p2.workouts[0]).toMatchObject({ focus: 'Superior', exercises: [{ name: 'Supino reto com barra' }] });
    expect(p2.workouts[1].exercises.map((e) => e.name)).toEqual(['Agachamento livre', 'Mesa flexora']);
    expect(p2.per_week).toBe(5);
    expect(p2.notes).toBe('x');
    // os vídeos que o profissional já pôs ficam, mesmo depois de a IA mexer no treino
    const withVideo = { ...plan, workouts: [plan.workouts[0], { ...plan.workouts[1], exercises: [{ ...ex('Agachamento livre'), video: 'https://youtu.be/v1' }] }] };
    const r3 = await dictate(fake(out), 'm', kv(), 'isa', 'ip', { text: 'junta mesa flexora', plan: withVideo, stage: 'treino', current: 1 });
    const p3 = r3.body.plan as { workouts: { exercises: { name: string; video?: string }[] }[] };
    expect(p3.workouts[1].exercises[0]).toMatchObject({ name: 'Agachamento livre', video: 'https://youtu.be/v1' });
  });
  it('revisão: observações gerais e notas só para exercícios que existem', async () => {
    const plan = { workouts: [{ name: 'Treino A', focus: 'Inferior', day: '', exercises: [ex('Leg press 45°'), ex('Mesa flexora')] }], per_week: 2, notes: '' };
    const out = { general: ['Falta trabalho de panturrilha.'], notes: [{ workout: 0, exercise: 1, note: 'Quadril colado ao banco.' }, { workout: 3, exercise: 0, note: 'x' }] };
    const r = await review(fake(out), 'm', kv(), 'isa', 'ip', { plan });
    expect(r.body.general).toEqual(['Falta trabalho de panturrilha.']);
    expect(r.body.notes).toEqual([{ workout: 'Treino A', exercise: 1, name: 'Mesa flexora', note: 'Quadril colado ao banco.' }]);
    expect((await review(fake(out), 'm', kv(), 'isa', 'ip', { plan: { workouts: [] } })).status).toBe(400);
  });
  it('avaliação física: lê PDF/foto e devolve as medidas já limpas', async () => {
    const out = { is_assessment: true, sexo: 'f', idade: 34, altura_cm: 165, peso_kg: 62.4, gordura_pct: 24.37, massa_magra_kg: 47.2, fc_repouso: -1, data: '2026-11-10',
      pescoco: -1, ombros: -1, peito: 88, cintura: 71.5, abdomen: 78, quadril: 98, braco_d: 28, braco_e: -1, antebraco: -1, coxa_d: 55, coxa_e: -1, panturrilha: 35 };
    const r = await readAssessment(fake(out), 'm', kv(), 'isa', 'ip', { file: 'JVBERi0x', media_type: 'application/pdf' });
    expect(r.body.found).toBe(true);
    expect(r.body.profile).toMatchObject({ sexo: 'f', idade: 34, peso: 62.4, gordura: 24.4, magra: 47.2, fc: null, dataAval: '2026-11-10', medidas: { cintura: 71.5, quadril: 98, panturrilha: 35 } });
    expect((r.body.profile as { medidas: Record<string, unknown> }).medidas.braco_e).toBeUndefined();
    expect((await readAssessment(fake(out), 'm', kv(), 'isa', 'ip', { file: 'x', media_type: 'text/plain' })).status).toBe(400);
    expect((await readAssessment(fake({ ...out, is_assessment: false }), 'm', kv(), 'isa', 'ip', { file: 'JVBERi0x', media_type: 'application/pdf' })).body).toEqual({ found: false });
  });
});

describe('ditado: início e fim arrumados como no manual', () => {
  it('alongamento e esteira no início com duração certa, sem descanso, notas do manual', async () => {
    const ex2 = (name: string, reps: string, notes: string, rest = '60 s') => ({ name, sets: 3, reps, load: '', rest, notes });
    const out = { workouts: [{ name: 'Treino A', focus: 'Inferior', day: '', exercises: [
      ex2('Alongamento dinâmico', '10 ou 8-12', 'Aquecimento · alongamento'),
      ex2('Agachamento livre', '10', ''),
      ex2('Passadeira / esteira (caminhada)', '10 min', 'Aquecimento'),
      ex2('Alongamento final (volta à calma)', '12', 'Final · volta à calma'),
    ] }], per_week: 3, weeks: 0, notes: '', summary: 'ok', doubts: '' };
    const plan = { workouts: [{ name: 'Treino A', focus: 'Inferior', day: '', exercises: [] }], per_week: 3, notes: '' };
    const r = await dictate(fake(out), 'm', kv(), 'isa', 'ip', { text: 'começa com alongamento e esteira', plan, stage: 'treino', current: 0 });
    const exs = (r.body.plan as { workouts: { exercises: { name: string; sets: number; reps: string; rest: string; notes: string }[] }[] }).workouts[0].exercises;
    expect(exs.map((e) => `${e.name}|${e.sets}x${e.reps}|${e.rest}|${e.notes}`)).toEqual([
      'Passadeira / esteira (caminhada)|1x10 min||Aquecimento',
      'Alongamento dinâmico|1x5 min||Aquecimento · mobilidade',
      'Agachamento livre|3x10|60 s|',
      'Alongamento final (volta à calma)|1x5 min||Final',
    ]);
  });
});

describe('relatório de acompanhamento do utilizador', () => {
  it('ordena as avaliações por data, limpa valores e aceita metas', async () => {
    const { cleanReport } = await import('./proAI');
    const m = Object.fromEntries(['pescoco', 'ombros', 'peito', 'cintura', 'abdomen', 'quadril', 'braco_d', 'braco_e', 'antebraco', 'coxa_d', 'coxa_e', 'panturrilha'].map((k) => [k, -1]));
    const r = cleanReport({
      is_report: true, sexo: 'm', idade: -1, profissional: 'Nutricionista Exemplo',
      avaliacoes: [
        { ...m, outros: [{ nome: 'Dobra tricipital', valor: 4.5, unidade: 'mm' }, { nome: 'IMC', valor: 25, unidade: '' }, { nome: 'Densidade corporal', valor: 1.051, unidade: 'g/mL' }, { nome: 'Dobra tricipital', valor: 9, unidade: 'mm' }], data: '2026-10-08', altura_cm: 178, peso_kg: 79.2, gordura_pct: 19.4, massa_magra_kg: 63.8, fc_repouso: -1, cintura: 82, quadril: 95 },
        { ...m, outros: [], data: '2026-03-05', altura_cm: 178, peso_kg: 85.0, gordura_pct: 26.1, massa_magra_kg: 62.5, fc_repouso: -1, cintura: 90 },
        { ...m, outros: [], data: '', altura_cm: -1, peso_kg: -1, gordura_pct: -1, massa_magra_kg: -1, fc_repouso: -1 },
      ],
      kcal_dia: 2200, proteina_g: 9999,
    }) as { found: boolean; evals: { date: string; gordura: number; medidas: Record<string, number> }[]; kcal: number; protein: null; by: string; sexo: string };
    expect(r.found).toBe(true);
    expect(r.evals.map((e) => e.date)).toEqual(['2026-03-05', '2026-10-08']);
    expect(r.evals[1].gordura).toBe(19.4);
    expect(r.evals[1].medidas).toEqual({ cintura: 82, quadril: 95 });
    expect((r.evals[1] as never as { extra: unknown }).extra).toEqual([{ label: 'Dobra tricipital', v: 4.5, u: 'mm' }, { label: 'Densidade corporal', v: 1.051, u: 'g/mL' }]);
    expect(r.kcal).toBe(2200);
    expect(r.protein).toBeNull();
    expect(r.by).toBe('Nutricionista Exemplo');
    expect(r.sexo).toBe('m');
  });
  it('documento sem dados', async () => {
    const { cleanReport } = await import('./proAI');
    expect(cleanReport({ is_report: false })).toEqual({ found: false });
  });
});
