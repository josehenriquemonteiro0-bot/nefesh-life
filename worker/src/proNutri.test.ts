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
const NOW = new Date('2026-11-23T15:00:00Z');
const item = { food: 'Arroz, integral, cozido', grams: 150, measure: '4 col.', kcal: 186, p: 3.9, c: 38.7, f: 1.5, fib: 4.1 };
const nutri = { days: [{ name: 'Todos os dias', weekdays: [], meals: [{ key: 'almoco', label: 'Almoço', time: '13:00', options: [{ name: 'Opção A', items: [item] }], notes: '' }] }], targets: { kcal: 1800, protein: 120 }, notes: 'Beber 2 L de água' };

describe('NEFESH Pro para nutricionistas (servidor)', () => {
  it('nutricionista envia plano alimentar; o paciente recebe-o com o tipo de profissional', async () => {
    const db = memoryDB();
    await pro.registerPro(db, 'ana', { name: 'Ana Nutri', reg: 'CRN 1234', kind: 'nutricionista' }, NOW, true);
    const code = (await pro.newStudent(db, 'ana', { name: 'Maria' }, NOW)).body.code as string;
    expect((await pro.savePlan(db, 'ana', { code, plan: { workouts: [], nutri: { ...nutri, days: [] } } }, NOW)).body.error).toMatch(/alimento/);
    expect((await pro.savePlan(db, 'ana', { code, plan: { workouts: [], nutri } }, NOW)).status).toBe(200);
    const r = await pro.linkStudent(db, 'd:telemovel-123', { code }, NOW);
    expect(r.body).toMatchObject({ kind: 'nutricionista', pro: 'Ana Nutri' });
    expect((r.body.plan as { nutri: { targets: { kcal: number } } }).nutri.targets.kcal).toBe(1800);
  });
  it('um personal não pode enviar plano alimentar', async () => {
    const db = memoryDB();
    await pro.registerPro(db, 'isa', { name: 'Isabela', reg: 'CREF', kind: 'personal' }, NOW, true);
    const code = (await pro.newStudent(db, 'isa', { name: 'João' }, NOW)).body.code as string;
    expect((await pro.savePlan(db, 'isa', { code, plan: { workouts: [], nutri } }, NOW)).status).toBe(400);
  });
  it('registo diário do paciente: adesão e alertas no painel do nutricionista', async () => {
    const db = memoryDB();
    await pro.registerPro(db, 'ana', { name: 'Ana Nutri', reg: 'CRN 1234', kind: 'nutricionista' }, NOW, true);
    const code = (await pro.newStudent(db, 'ana', { name: 'Maria' }, NOW)).body.code as string;
    await pro.savePlan(db, 'ana', { code, plan: { workouts: [], nutri } }, NOW);
    await pro.linkStudent(db, 'd:telemovel-123', { code }, NOW);
    for (const [day, pct] of [['2026-11-21', 20], ['2026-11-22', 30], ['2026-11-23', 40]] as const)
      expect((await pro.logNutriDay(db, 'd:telemovel-123', { code, day, data: { meals: [{ label: 'Almoço', status: 'alterado', changes: ['sem arroz'] }], pct, hunger: 4 } }, NOW)).status).toBe(200);
    await pro.logNutriDay(db, 'd:telemovel-123', { code, day: '2026-11-23', data: { meals: [{ label: 'Almoço', status: 'seguido' }], pct: 40, hunger: 5 } }, NOW);
    const st = ((await pro.proState(db, 'ana', NOW)).body.students as { alerts: { kind: string }[]; nutriWeek: number; nutriLast: { day: string; hunger: number } }[])[0];
    expect(st.alerts.map((a) => a.kind)).toEqual(expect.arrayContaining(['adesao', 'fome']));
    expect(st.nutriWeek).toBe(3);
    expect(st.nutriLast).toMatchObject({ day: '2026-11-23', hunger: 5 });
    expect((await pro.logNutriDay(db, 'd:outro-telemovel', { code, data: {} }, NOW)).status).toBe(404);
  });
});

describe('fase 2: check-in semanal, consultas e IA', () => {
  const setup = async () => {
    const db = memoryDB();
    await pro.registerPro(db, 'ana', { name: 'Ana Nutri', reg: 'CRN 1234', kind: 'nutricionista' }, NOW, true);
    const code = (await pro.newStudent(db, 'ana', { name: 'Maria' }, NOW)).body.code as string;
    await pro.savePlan(db, 'ana', { code, plan: { workouts: [], nutri } }, NOW);
    await pro.linkStudent(db, 'd:telemovel-123', { code }, NOW);
    return { db, code };
  };
  const keys = { get: async () => null, put: async () => undefined } as never;
  it('check-in: em falta ao início, respondido some, pedido volta a aparecer; alerta no painel', async () => {
    const { db, code } = await setup();
    expect((await pro.studentPlan(db, 'd:telemovel-123', { code })).body.checkinDue).toBe(true);
    expect((await pro.studentCheckin(db, keys, 'd:telemovel-123', { code, checkin: { fome: 5, saciedade: 2, intestino: 3, energia: 3, adesao: 4, nota: 'muita fome à tarde' } }, NOW, (async () => new Response('')) as never)).status).toBe(200);
    const due = (await pro.studentPlan(db, 'd:telemovel-123', { code })).body.checkinDue;
    expect(due).toBe(false);
    await pro.requestCheckin(db, 'ana', { code }, new Date(NOW.getTime() + 1000));
    expect((await pro.studentPlan(db, 'd:telemovel-123', { code })).body.checkinDue).toBe(true);
    const list = (await pro.listCheckins(db, 'ana', { code })).body.list as { adesao?: number; request?: boolean }[];
    expect(list.find((c) => !c.request)).toMatchObject({ adesao: 4 });
    const st = ((await pro.proState(db, 'ana', NOW)).body.students as { alerts: { kind: string; text: string }[] }[])[0];
    expect(st.alerts.find((a) => a.kind === 'checkin')?.text).toMatch(/adesão 4\/10, muita fome, pouca saciedade/);
  });
  it('consultas: nota privada e retorno (o paciente vê a data; o novo substitui o anterior)', async () => {
    const { db, code } = await setup();
    expect((await pro.addNote(db, 'ana', { code, kind: 'nota', text: 'S: mais fome à tarde. P: lanche com proteína.' }, NOW)).status).toBe(200);
    await pro.addNote(db, 'ana', { code, kind: 'retorno', day: '2026-12-10', time: '18:00', text: 'Consultório' }, NOW);
    await pro.addNote(db, 'ana', { code, kind: 'retorno', day: '2026-11-24', time: '09:30', text: '' }, NOW);
    expect((await pro.studentPlan(db, 'd:telemovel-123', { code })).body.nextVisit).toMatchObject({ day: '2026-11-24', time: '09:30' });
    const notes = (await pro.listNotes(db, 'ana', { code })).body.list as { kind: string }[];
    expect(notes.filter((n) => n.kind === 'retorno')).toHaveLength(1);
    expect(notes.filter((n) => n.kind === 'nota')).toHaveLength(1);
    const st = ((await pro.proState(db, 'ana', NOW)).body.students as { alerts: { kind: string }[] }[])[0];
    expect(st.alerts.map((a) => a.kind)).toContain('retorno');
    // as notas não vão para o paciente
    expect(JSON.stringify((await pro.studentPlan(db, 'd:telemovel-123', { code })).body)).not.toMatch(/lanche com proteína/);
  });
  it('IA: ditado devolve refeições limpas; revisão devolve sugestões', async () => {
    const { dictateNutri, reviewNutri } = await import('./proAI');
    const kv = () => { const m = new Map<string, string>(); return { get: async (k: string) => m.get(k) ?? null, put: async (k: string, v: string) => void m.set(k, v) }; };
    const fake = (out: unknown) => ({ beta: { messages: { create: async () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(out) }] }) } } }) as never;
    const d = await dictateNutri(fake({ meals: [{ key: 'pa', label: 'Pequeno-almoço', time: '07:30', notes: '', options: [{ name: 'Opção A', items: [{ food: 'Ovo, de galinha, inteiro, cozido', grams: 100, measure: '2 ovos', kcal: 146, p: 13.3, c: 0.6, f: 9.5, fib: 0 }] }] }], summary: 'Juntei o pequeno-almoço.', doubts: '' }), 'm', kv(), 'ana', 'ip', { text: 'pequeno-almoço 2 ovos cozidos', meals: [] });
    expect(d.status).toBe(200);
    expect((d.body.meals as { options: { items: { grams: number }[] }[] }[])[0].options[0].items[0].grams).toBe(100);
    const r = await reviewNutri(fake({ general: ['Proteína abaixo da meta.'], notes: [{ meal: 'Almoço', note: 'Iogurte tem lactose: a paciente é intolerante.' }] }), 'm', kv(), 'ana', 'ip', { meals: [], targets: {}, totals: {} });
    expect(r.body).toMatchObject({ general: ['Proteína abaixo da meta.'] });
  });
});

describe('fase 3: equipa e diretório', () => {
  it('com autorização do paciente, nutricionista e personal veem o essencial um do outro', async () => {
    const db = memoryDB();
    await pro.registerPro(db, 'ana', { name: 'Ana Nutri', reg: 'CRN 1', kind: 'nutricionista' }, NOW, true);
    await pro.registerPro(db, 'isa', { name: 'Isabela', reg: 'CREF 1', kind: 'personal' }, NOW, true);
    const cn = (await pro.newStudent(db, 'ana', { name: 'Maria' }, NOW)).body.code as string;
    const cp = (await pro.newStudent(db, 'isa', { name: 'Maria' }, NOW)).body.code as string;
    await pro.savePlan(db, 'ana', { code: cn, plan: { workouts: [], nutri, jejum: { protocol: '14:10', open: '10:00' } } }, NOW);
    await pro.savePlan(db, 'isa', { code: cp, plan: { workouts: [{ name: 'Treino A', focus: 'Inferior', exercises: [{ name: 'Agachamento', sets: 3 }] }], per_week: 3 } }, NOW);
    await pro.linkStudent(db, 'u-maria', { code: cn }, NOW);
    await pro.linkStudent(db, 'u-maria', { code: cp }, NOW);
    const teamOfAna = async () => ((await pro.proState(db, 'ana', NOW)).body.students as { team?: { pro: string; summary: string[] }[] }[])[0].team;
    expect(await teamOfAna()).toBeUndefined();
    await pro.studentTeam(db, 'u-maria', { code: cn, on: true }, NOW);
    expect(await teamOfAna()).toEqual([{ pro: 'Isabela', kind: 'personal', summary: ['Treino: Treino A (Inferior) · 3× por semana', 'Treinos feitos nos últimos 7 dias: 0'] }]);
    const isaTeam = ((await pro.proState(db, 'isa', NOW)).body.students as { team?: { summary: string[] }[] }[])[0].team!;
    expect(isaTeam[0].summary.join(' | ')).toMatch(/1800 kcal · 120 g de proteína.*Almoço 13:00.*Jejum 14:10/);
    await pro.studentTeam(db, 'u-maria', { code: cp, on: false }, NOW);
    expect(await teamOfAna()).toBeUndefined();
  });
  it('diretório: só aprovados que quiseram aparecer, com contacto válido', async () => {
    const db = memoryDB();
    await pro.registerPro(db, 'ana', { name: 'Ana Nutri', reg: 'CRN 1', kind: 'nutricionista' }, NOW, true);
    await pro.registerPro(db, 'zé', { name: 'Zé', reg: 'X', kind: 'personal' }, NOW);
    expect((await pro.saveDirectory(db, 'ana', { on: true, contact: 'javascript:alert(1)' }, NOW)).status).toBe(400);
    expect((await pro.saveDirectory(db, 'ana', { on: true, city: 'Lisboa', online: true, areas: 'Emagrecimento, diabetes', contact: '+351 912 345 678' }, NOW)).status).toBe(200);
    expect((await pro.saveDirectory(db, 'zé', { on: true, contact: 'ze@x.pt' }, NOW)).status).toBe(403);
    const list = (await pro.directory(db)).body.list as { name: string; contact: string; online: boolean }[];
    expect(list).toEqual([expect.objectContaining({ name: 'Ana Nutri', kind: 'nutricionista', contact: '+351912345678', online: true, city: 'Lisboa' })]);
    await pro.saveDirectory(db, 'ana', { on: false }, NOW);
    expect((await pro.directory(db)).body.list).toEqual([]);
  });
});
