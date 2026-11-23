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
