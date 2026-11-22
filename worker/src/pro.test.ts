import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import * as so from './social';
import * as pro from './pro';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite');
function memoryDB(): so.DB {
  const db = new DatabaseSync(':memory:');
  db.exec(so.SCHEMA);
  const stmt = (sql: string, args: unknown[] = []): so.Stmt => ({
    bind: (...v: unknown[]) => stmt(sql, v),
    first: async <T,>() => ((db.prepare(sql).get(...(args as never[])) as T) ?? null),
    all: async <T,>() => ({ results: db.prepare(sql).all(...(args as never[])) as T[] }),
    run: async () => db.prepare(sql).run(...(args as never[])),
  });
  return { prepare: (sql) => stmt(sql), batch: async (s) => { for (const x of s) await x.run(); return []; } };
}
const keys = { get: async () => null, put: async () => undefined } as never;
const NOW = new Date('2026-11-22T15:00:00Z');

describe('NEFESH Life Pro', () => {
  it('vídeo do exercício: só links https', () => {
    const p = pro.cleanPlan({ workouts: [{ name: 'Treino A', exercises: [
      { name: 'Agachamento', sets: 3, video: 'https://youtu.be/abc' },
      { name: 'Prancha', sets: 3, video: 'javascript:alert(1)' },
      { name: 'Remada', sets: 3, video: 'http://x.pt/v' },
    ] }] });
    expect(p.workouts[0].exercises.map((e) => (e as { video?: string }).video)).toEqual(['https://youtu.be/abc', undefined, undefined]);
  });
  it('rascunho: guardar não envia ao aluno; enviar apaga o rascunho', async () => {
    const db = memoryDB();
    await pro.registerPro(db, 'isa', { name: 'Isabela', reg: '' }, NOW, true);
    const code = (await pro.newStudent(db, 'isa', { name: 'Maria' }, NOW)).body.code as string;
    const ex = { name: 'Prancha', sets: 3, reps: '30 s', load: '', rest: '', notes: '' };
    const draft = { workouts: [{ name: 'Treino A', focus: 'Core', day: '', exercises: [ex] }, { name: 'Treino B', focus: 'Inferior', day: '', exercises: [] }], per_week: 3 };
    expect((await pro.saveDraft(db, 'isa', { code, plan: draft }, NOW)).status).toBe(200);
    const st = (await pro.proState(db, 'isa', NOW)).body.students as { plan: unknown; version: number; draft: { workouts: { name: string }[] } }[];
    expect(st[0].plan).toBeNull();
    expect(st[0].version).toBe(0);
    expect(st[0].draft.workouts.map((w) => w.name)).toEqual(['Treino A', 'Treino B']);
    await pro.savePlan(db, 'isa', { code, plan: draft }, NOW);
    const st2 = (await pro.proState(db, 'isa', NOW)).body.students as { plan: unknown; version: number; draft: unknown }[];
    expect(st2[0].version).toBe(1);
    expect(st2[0].draft).toBeNull();
    expect((await pro.saveDraft(db, 'outro', { code, plan: draft }, NOW)).status).toBe(404);
    // com duração: o plano começa no dia do envio; reenviar mantém o início
    await pro.savePlan(db, 'isa', { code, plan: { ...draft, weeks: 8 } }, NOW);
    const sent = (await pro.proState(db, 'isa', NOW)).body.students as { plan: { weeks: number; start: string } }[];
    expect(sent[0].plan).toMatchObject({ weeks: 8, start: '2026-11-22' });
    await pro.savePlan(db, 'isa', { code, plan: { ...draft, weeks: 8, start: '2026-11-22' } }, new Date('2026-11-29T10:00:00Z'));
    expect(((await pro.proState(db, 'isa', NOW)).body.students as { plan: { start: string } }[])[0].plan.start).toBe('2026-11-22');
  });
  it('perfil do aluno: criado com o aluno, aparece no painel, edita-se, limpa-se e sai ao apagar', async () => {
    const db = memoryDB();
    await pro.registerPro(db, 'isa', { name: 'Isabela', reg: '' }, NOW, true);
    const r = await pro.newStudent(db, 'isa', { name: 'Maria', profile: { sexo: 'f', idade: '34', altura: 165, peso: '62,5', nivel: 'iniciante', objetivo: 'Hipertrofia', lesoes: 'dor no joelho direito' } }, NOW);
    const code = r.body.code as string;
    const st = await pro.proState(db, 'isa', NOW);
    const s0 = (st.body.students as { profile: Record<string, unknown> }[])[0];
    expect(s0.profile).toMatchObject({ sexo: 'f', idade: 34, peso: 62.5, nivel: 'iniciante', lesoes: 'dor no joelho direito' });
    expect((await pro.saveProfile(db, 'isa', { code, profile: { idade: 35 } }, NOW)).body.profile).toMatchObject({ idade: 35, sexo: '' });
    expect((await pro.saveProfile(db, 'outro', { code, profile: { idade: 35 } }, NOW)).status).toBe(404);
    expect((await pro.saveProfile(db, 'isa', { code, profile: {} }, NOW)).body.profile).toBeNull();
    await pro.saveProfile(db, 'isa', { code, profile: { idade: 40 } }, NOW);
    await pro.removeStudent(db, 'isa', { code });
    expect(await db.prepare('SELECT COUNT(*) AS n FROM pro_profiles').first<{ n: number }>()).toEqual({ n: 0 });
  });
  it('no servidor de teste o profissional fica aprovado logo (também quem já estava pendente)', async () => {
    const db = memoryDB();
    expect((await pro.registerPro(db, 'isa', { name: 'Isabela', reg: '' }, NOW, true)).body.pro).toMatchObject({ status: 'aprovado', reg: 'teste' });
    expect((await pro.newStudent(db, 'isa', { name: 'Maria' }, NOW)).status).toBe(200);
    await pro.registerPro(db, 'ana', { name: 'Ana', reg: 'CREF 2' }, NOW);
    expect((await pro.proState(db, 'ana', NOW)).body.pro).toMatchObject({ status: 'pendente' });
    expect((await pro.proState(db, 'ana', NOW, true)).body.pro).toMatchObject({ status: 'aprovado' });
  });
  it('profissional pendente até a equipa aprovar; depois cria alunos com código', async () => {
    const db = memoryDB();
    expect((await pro.registerPro(db, 'isa', { name: 'I', reg: 'x' })).status).toBe(400);
    expect((await pro.registerPro(db, 'isa', { name: 'Isabela', reg: 'CREF 012345-G/SP' }, NOW)).body.pro).toMatchObject({ status: 'pendente' });
    expect((await pro.newStudent(db, 'isa', { name: 'Maria' })).status).toBe(403);
    await pro.setProStatus(db, 'isa', 'aprovado');
    const r = await pro.newStudent(db, 'isa', { name: 'Maria' }, NOW);
    expect(r.body.code).toMatch(/^NP-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(pro.validCode(r.body.code)).toBe(true);
  });

  it('plano limpo e com limites; a versão sobe; o aluno liga-se e recebe-o', async () => {
    const db = memoryDB();
    await pro.registerPro(db, 'isa', { name: 'Isabela', reg: 'CREF 1' }, NOW);
    await pro.setProStatus(db, 'isa', 'aprovado');
    const code = String((await pro.newStudent(db, 'isa', { name: 'Maria' }, NOW)).body.code);
    const plan = { workouts: [{ name: 'Treino A', focus: 'Inferior', exercises: [{ name: 'Agachamento', sets: 4, reps: '8-10', load: '40 kg', rest: '90 s', notes: '' }, { name: '' }] }] };
    expect((await pro.savePlan(db, 'isa', { code, plan }, NOW)).body.version).toBe(1);
    expect((await pro.savePlan(db, 'outro', { code, plan }, NOW)).status).toBe(404);
    expect((await pro.linkStudent(db, 'maria', { code: code.toLowerCase() }, NOW)).body).toMatchObject({ pro: 'Isabela', version: 1, plan: { workouts: [{ name: 'Treino A', exercises: [{ name: 'Agachamento', sets: 4 }] }] } });
    expect((await pro.linkStudent(db, 'outra', { code }, NOW)).status).toBe(409);
    expect((await pro.studentPlan(db, 'outra', { code })).status).toBe(404);
  });

  it('treino concluído fica no registo e no painel do profissional', async () => {
    const db = memoryDB();
    await pro.registerPro(db, 'isa', { name: 'Isabela', reg: 'CREF 1' }, NOW);
    await pro.setProStatus(db, 'isa', 'aprovado');
    const code = String((await pro.newStudent(db, 'isa', { name: 'Maria' }, NOW)).body.code);
    await pro.savePlan(db, 'isa', { code, plan: { workouts: [{ name: 'Treino A', exercises: [{ name: 'Agachamento' }] }] } }, NOW);
    await pro.linkStudent(db, 'd:telemovel-123', { code }, NOW);
    const sent = await pro.logWorkout(db, keys, 'd:telemovel-123', { code, day: '2026-11-22', workout: 'Treino A', status: 'alterado', minutes: 50, note: 'Joelho bem', exercises: [{ name: 'Agachamento', sets: 4, of: 4, load: '42,5 kg' }] }, NOW);
    expect(sent.status).toBe(200);
    // corrigir no mesmo dia substitui
    await pro.logWorkout(db, keys, 'd:telemovel-123', { code, day: '2026-11-22', workout: 'Treino A', status: 'seguido', minutes: 45 }, NOW);
    const st = await pro.proState(db, 'isa', NOW);
    expect(st.body.students).toEqual([expect.objectContaining({ name: 'Maria', linked: true, week: 1, last: expect.objectContaining({ workout: 'Treino A', status: 'seguido', minutes: 45 }) })]);
    expect(((await pro.studentLogs(db, 'isa', { code })).body.logs as unknown[]).length).toBe(1);
  });
});

describe('Pro: precisa de atenção', () => {
  const NOW2 = new Date('2026-11-22T15:00:00Z');
  const ex = (name: string, effort: string, sets = 3, pain = false) => ({ name, sets, of: 3, load: '', effort: effort as never, pain });
  const log = (day: string, exercises: ReturnType<typeof ex>[], extra: Record<string, unknown> = {}) => ({ day, data: { status: 'seguido', minutes: 40, note: '', exercises, ...extra } as never });
  it('dor, parado, difícil, pronto para subir e fim do plano', () => {
    const logs = [
      log('2026-11-15', [ex('Leg press 45°', 'facil'), ex('Mesa flexora', 'dificil', 3, true)], { pain: true, note: 'joelho' }),
      log('2026-11-12', [ex('Leg press 45°', 'facil'), ex('Mesa flexora', 'dificil')]),
    ];
    const a = pro.attention(logs, { linked: true, hasPlan: true, endsInDays: 3 }, NOW2);
    expect(a.map((x) => x.kind)).toEqual(['dor', 'parado', 'dificil', 'subir', 'fim']);
    expect(a[0].text).toBe('Relatou dor em Mesa flexora (15/11): "joelho"');
    expect(a[1].text).toBe('Sem treinar há 7 dias');
    expect(a[3].text).toBe('Pronto para subir a carga: Leg press 45°');
  });
  it('sem alertas quando treina bem; não sobe carga se não fez as séries todas', () => {
    const logs = [log('2026-11-21', [ex('Supino', 'facil', 2)]), log('2026-11-19', [ex('Supino', 'facil')])];
    expect(pro.attention(logs, { linked: true, hasPlan: true }, NOW2)).toEqual([]);
    expect(pro.attention([log('2026-11-21', [], { status: 'saltado' }), log('2026-11-20', [], { status: 'saltado' })], { linked: true, hasPlan: true }, NOW2).map((x) => x.kind)).toEqual(['saltou']);
  });
});

describe('Pro: periodização', () => {
  it('duração pelas fases, início marcado ao enviar e dias até ao fim', async () => {
    const p = pro.cleanPlan({ workouts: [{ name: 'Treino A', exercises: [{ name: 'Prancha', sets: 3 }] }], phases: [{ name: 'Adaptação', weeks: 2, notes: '3×12 leve' }, { name: 'Hipertrofia', weeks: 4, notes: '' }, { name: 'Deload', weeks: 1, notes: '' }] });
    expect(p.weeks).toBe(7);
    expect(p.start).toBeUndefined();
    expect(pro.planEndsIn({ weeks: 1, start: '2026-11-16' }, new Date('2026-11-22T15:00:00Z'))).toBe(0);
    expect(pro.planEndsIn({ weeks: 2, start: '2026-11-16' }, new Date('2026-11-22T15:00:00Z'))).toBe(7);
    expect(pro.planEndsIn({ weeks: 1, start: '2026-11-10' }, new Date('2026-11-22T15:00:00Z'))).toBe(-6);
    expect(pro.planEndsIn(null)).toBeNull();
  });
});

describe('Pro: avaliações físicas', () => {
  it('guarda, lista com fotos, atualiza o perfil com a mais recente e apaga tudo com o aluno', async () => {
    const db = memoryDB();
    await pro.registerPro(db, 'isa', { name: 'Isabela', reg: '' }, NOW, true);
    const code = (await pro.newStudent(db, 'isa', { name: 'Maria' }, NOW)).body.code as string;
    const a1 = { day: '2026-10-01', peso: 64, sexo: 'f', idade: 34, protocol: 'jp3', folds: { triceps: 20, suprailiaca: 18, coxa: 25 }, medidas: { cintura: 74 } };
    const a2 = { day: '2026-11-20', peso: '62,5', sexo: 'f', idade: 34, protocol: 'medido', gorduraMedida: 24, medidas: { cintura: 71.5, quadril: 98 } };
    const id1 = (await pro.saveAssessment(db, 'isa', { code, assessment: a1 }, NOW)).body.id as number;
    const id2 = (await pro.saveAssessment(db, 'isa', { code, assessment: a2 }, NOW)).body.id as number;
    expect(id2).toBeGreaterThan(id1);
    expect((await pro.savePhoto(db, 'isa', { code, assess: id2, pose: 'frente', image: 'QUJD' }, NOW)).status).toBe(400); // sem autorização
    expect((await pro.savePhoto(db, 'isa', { code, assess: id2, pose: 'frente', image: 'QUJD', consent: true }, NOW)).status).toBe(200);
    const list = (await pro.listAssessments(db, 'isa', { code })).body.list as { id: number; day: string; peso: number; photos: { id: number; pose: string }[] }[];
    expect(list.map((x) => x.day)).toEqual(['2026-11-20', '2026-10-01']);
    expect(list[0].peso).toBe(62.5);
    expect(list[0].photos).toHaveLength(1);
    expect((await pro.getPhoto(db, 'isa', { code, id: list[0].photos[0].id })).body.image).toBe('QUJD');
    expect((await pro.getPhoto(db, 'outro', { code, id: list[0].photos[0].id })).status).toBe(404);
    const st = (await pro.proState(db, 'isa', NOW)).body.students as { profile: Record<string, unknown> }[];
    expect(st[0].profile).toMatchObject({ peso: 62.5, gordura: 24, dataAval: '2026-11-20', medidas: { cintura: 71.5, quadril: 98 } });
    // corrigir a antiga não muda o perfil
    await pro.saveAssessment(db, 'isa', { code, id: id1, assessment: { ...a1, peso: 65 } }, NOW);
    expect(((await pro.proState(db, 'isa', NOW)).body.students as { profile: { peso: number } }[])[0].profile.peso).toBe(62.5);
    await pro.removeStudent(db, 'isa', { code });
    expect(await db.prepare('SELECT (SELECT COUNT(*) FROM pro_assess) + (SELECT COUNT(*) FROM pro_photos) AS n').first<{ n: number }>()).toEqual({ n: 0 });
  });
});

describe('Pro: conversa', () => {
  it('personal e aluno trocam mensagens (com referência ao treino); não lidas; só quem está ligado', async () => {
    const db = memoryDB();
    await pro.registerPro(db, 'isa', { name: 'Isabela', reg: '' }, NOW, true);
    const code = (await pro.newStudent(db, 'isa', { name: 'Maria' }, NOW)).body.code as string;
    await pro.linkStudent(db, 'd:telemovel-maria', { code }, NOW);
    const noFetch = (async () => new Response('', { status: 201 })) as unknown as typeof fetch;
    await pro.studentWrite(db, keys, 'd:telemovel-maria', { code, text: 'Senti o joelho no agachamento', ref: 'Treino A · 22/11' }, NOW, noFetch);
    expect(((await pro.proState(db, 'isa', NOW)).body.students as { unread: number }[])[0].unread).toBe(1);
    const m = (await pro.proMessages(db, 'isa', { code })).body.messages as { from: string; text: string; ref: string }[];
    expect(m).toEqual([expect.objectContaining({ from: 'aluno', text: 'Senti o joelho no agachamento', ref: 'Treino A · 22/11' })]);
    expect(((await pro.proState(db, 'isa', NOW)).body.students as { unread: number }[])[0].unread).toBe(0);
    await pro.proWrite(db, keys, 'isa', { code, text: 'Troque por leg press esta semana.' }, NOW, noFetch);
    expect((await pro.studentPlan(db, 'd:telemovel-maria', { code })).body.unread).toBe(1);
    const sm = (await pro.studentMessages(db, 'd:telemovel-maria', { code })).body.messages as { from: string }[];
    expect(sm.map((x) => x.from)).toEqual(['aluno', 'pro']);
    expect((await pro.studentMessages(db, 'd:outro', { code })).status).toBe(404);
    expect((await pro.proWrite(db, keys, 'isa', { code, text: '  ' }, NOW, noFetch)).status).toBe(400);
  });
});

describe('Pro: relatório partilhado', () => {
  it('só com autorização; só números; desligar ou sair apaga', async () => {
    const db = memoryDB();
    await pro.registerPro(db, 'isa', { name: 'Isabela', reg: '' }, NOW, true);
    const code = (await pro.newStudent(db, 'isa', { name: 'Maria' }, NOW)).body.code as string;
    await pro.linkStudent(db, 'd:telemovel-maria', { code }, NOW);
    expect((await pro.shareReport(db, 'isa', { code })).status).toBe(404);
    const summary = { from: '2026-11-09', to: '2026-11-22', goal: 'energia', days: [{ d: '2026-11-22', e: 4, sleepH: 7.5, note: 'texto privado' }], avg: { energy: 3.8, sleep: 7.1 }, waterDays: 9, foodDays: 4, spirulinaDays: 12, trainMin: 180, train: { done: 3, planned: 3 }, weight: { first: 64, last: 63.2, from: '2026-10-01', to: '2026-11-20' }, segredo: 'x' };
    await pro.studentShare(db, 'd:telemovel-maria', { code, on: true, summary }, NOW);
    const r = (await pro.shareReport(db, 'isa', { code })).body.report as Record<string, unknown>;
    expect(r).toMatchObject({ goal: 'energia', spirulinaDays: 12, avg: { energy: 3.8, sleep: 7.1 }, weight: { first: 64, last: 63.2 } });
    expect(JSON.stringify(r)).not.toContain('privado');
    expect(JSON.stringify(r)).not.toContain('segredo');
    expect(((await pro.proState(db, 'isa', NOW)).body.students as { shareAt: string }[])[0].shareAt).toBeTruthy();
    expect((await pro.shareReport(db, 'outro', { code })).status).toBe(404);
    await pro.studentShare(db, 'd:telemovel-maria', { code, on: false }, NOW);
    expect((await pro.shareReport(db, 'isa', { code })).status).toBe(404);
    await pro.studentShare(db, 'd:telemovel-maria', { code, on: true, summary }, NOW);
    await pro.unlinkStudent(db, 'd:telemovel-maria', { code }, NOW);
    expect((await pro.shareReport(db, 'isa', { code })).status).toBe(404);
  });
});

describe('Pro: aluno ligado sem treino enviado', () => {
  it('avisa o personal (com ou sem rascunho)', () => {
    expect(pro.attention([], { linked: true, hasPlan: false, hasDraft: true })[0]).toMatchObject({ kind: 'enviar', text: expect.stringContaining('ainda não foi enviado') });
    expect(pro.attention([], { linked: true, hasPlan: false })[0].kind).toBe('enviar');
    expect(pro.attention([], { linked: false, hasPlan: false })).toEqual([]);
  });
});
