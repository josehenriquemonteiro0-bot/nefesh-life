import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import * as so from './social';
import * as pro from './pro';
import { cleanWell, cleanWellDay } from './proWell';

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
const NOW = new Date('2026-11-25T15:00:00Z');
const day = (n: number) => new Date(NOW.getTime() - n * 864e5).toISOString().slice(0, 10);
const plan = {
  goals: 'Melhorar o sono e a digestão',
  habits: [{ text: 'Água morna com limão ao acordar', when: 'manha' }, { text: 'Jantar até às 20h', when: 'noite' }, { text: 'Caminhada de 20 min', when: 'tarde' }],
  practices: ['pmr', 'expira', '<script>'],
  notes: 'Rever em 4 semanas',
  weeks: 4,
};

describe('NEFESH Pro · terapias integrativas', () => {
  it('limpa o plano de bem-estar e o dia', () => {
    const w = cleanWell(plan)!;
    expect(w.habits).toHaveLength(3);
    expect(w.practices).toEqual(['pmr', 'expira']);
    expect(cleanWell({ habits: [{ text: 'x' }] })).toBeNull();
    expect(cleanWell({ habits: [{ text: 'Respirar', when: 'qualquer' }] })!.habits[0].when).toBe('dia');
    expect(cleanWellDay({ done: [0, 2, 2, 9, -1], of: 3, note: 'dormi melhor' })).toEqual({ done: [0, 2], of: 3, note: 'dormi melhor' });
  });

  it('terapeuta regista-se, envia o plano de bem-estar e o paciente recebe-o', async () => {
    const db = memoryDB();
    await pro.registerPro(db, 'andrea', { terms: pro.PRO_TERMS, name: 'Andrea', reg: 'Naturopatia', kind: 'integrativo' }, NOW, true);
    const code = (await pro.newStudent(db, 'andrea', { name: 'Paula' }, NOW)).body.code as string;
    // sem nada, recusa; com treino ou plano alimentar, só fica o bem-estar
    expect((await pro.savePlan(db, 'andrea', { code, plan: { workouts: [] } }, NOW)).body.error).toMatch(/hábito/);
    const r = await pro.savePlan(db, 'andrea', { code, plan: { workouts: [{ name: 'A', exercises: [{ name: 'Agachamento' }] }], jejum: { protocol: '16:8', open: '12:00' }, bemestar: plan } }, NOW);
    expect(r.status).toBe(200);
    const link = await pro.linkStudent(db, 'd:telemovel-999', { code }, NOW);
    const p = link.body.plan as { workouts: unknown[]; jejum?: unknown; bemestar: { habits: unknown[]; start: string } };
    expect(link.body.kind).toBe('integrativo');
    expect(p.workouts).toEqual([]);
    expect(p.jejum).toBeUndefined();
    expect(p.bemestar.habits).toHaveLength(3);
    expect(p.bemestar.start).toBe('2026-11-25');
    expect(link.body).toHaveProperty('nextVisit');
  });

  it('o paciente marca os hábitos; o terapeuta vê a adesão e os alertas', async () => {
    const db = memoryDB();
    await pro.registerPro(db, 'andrea', { terms: pro.PRO_TERMS, name: 'Andrea', reg: 'Naturopatia', kind: 'integrativo' }, NOW, true);
    const code = (await pro.newStudent(db, 'andrea', { name: 'Paula' }, NOW)).body.code as string;
    await pro.savePlan(db, 'andrea', { code, plan: { workouts: [], bemestar: plan } }, new Date(NOW.getTime() - 6 * 864e5));
    await pro.linkStudent(db, 'd:telemovel-999', { code }, NOW);
    for (const n of [0, 1, 2]) expect((await pro.logWellnessDay(db, 'd:telemovel-999', { code, day: day(n), data: { done: n === 0 ? [0, 1, 2] : [0], of: 3, note: n === 0 ? 'Dormi melhor' : '' } }, NOW)).status).toBe(200);
    const st = (await pro.proState(db, 'andrea', NOW)).body as { students: { wellWeek: number; wellPct: number; wellNote: string; alerts: unknown[] }[] };
    expect(st.students[0]).toMatchObject({ wellWeek: 3, wellPct: 56, wellNote: 'Dormi melhor' });
    // outro telemóvel não pode registar
    expect((await pro.logWellnessDay(db, 'd:outro-telemovel', { code, data: { done: [0], of: 3 } }, NOW)).status).toBe(404);
  });

  it('as áreas ficam separadas: o personal não envia plano de bem-estar e não vê os pacientes integrativos', async () => {
    const db = memoryDB();
    await pro.registerPro(db, 'isa', { terms: pro.PRO_TERMS, name: 'Isabela', reg: 'CREF', kind: 'personal' }, NOW, true);
    const code = (await pro.newStudent(db, 'isa', { name: 'João' }, NOW)).body.code as string;
    expect((await pro.savePlan(db, 'isa', { code, plan: { workouts: [], bemestar: plan } }, NOW)).status).toBe(400);
    expect(pro.moduleOf('integrativo')).toBe('integrativo');
    expect(pro.moduleOf('medico')).toBe('nutri');
    expect(pro.moduleOf('personal')).toBe('personal');
  });
});
