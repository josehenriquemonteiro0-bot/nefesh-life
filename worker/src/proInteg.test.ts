import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import * as so from './social';
import * as pro from './pro';
import { INTEG_SYSTEM, organizeInteg, readExam } from './proAI';
import { cleanExams, examOut, integText } from '../../src/domain/proInteg';
import { cleanProfile, profileEmpty, profileText } from '../../src/domain/proProfile';

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
const kv = () => { const m = new Map<string, string>(); return { get: async (k: string) => m.get(k) ?? null, put: async (k: string, v: string) => void m.set(k, v) }; };
const fake = (out: unknown, calls: { messages: { content: unknown }[] }[] = []) =>
  ({ beta: { messages: { create: async (r: never) => { calls.push(r); return { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(out) }] }; } } } }) as never;
const NOW = new Date('2026-11-25T15:00:00Z');

const exam = {
  id: 'ex1', date: '2026-10-02', lab: 'Lab Central', title: 'Hemograma e bioquímica',
  items: [
    { name: 'Ferritina', value: '12', unit: 'ng/mL', ref: '15 a 150', flag: 'baixo' },
    { name: 'Vitamina D (25-OH)', value: '18,5', unit: 'ng/mL', ref: '30 a 100', flag: 'baixo' },
    { name: 'TSH', value: '2,1', unit: 'µUI/mL', ref: '0,4 a 4,0', flag: 'normal' },
    { name: 'TSH', value: '2,1', unit: 'µUI/mL', ref: '0,4 a 4,0', flag: 'normal' },
    { name: 'Glicose', value: '', unit: 'mg/dL', ref: '', flag: 'x' },
  ],
};

describe('NEFESH Pro · ficha integrativa', () => {
  it('limpa a anamnese integrativa e os exames; o perfil fica com eles', () => {
    const p = cleanProfile({ sexo: 'f', idade: 42, integ: { queixa: 'Cansaço há 6 meses', sono: '  acorda às 3h ', inventado: 'x' }, exames: [exam, { items: [] }] });
    expect(p.integ).toEqual({ queixa: 'Cansaço há 6 meses', sono: 'acorda às 3h' });
    expect(p.exames).toHaveLength(1);
    expect(p.exames![0].items.map((i) => i.name)).toEqual(['Ferritina', 'Vitamina D (25-OH)', 'TSH']);
    expect(profileEmpty(cleanProfile({ integ: { queixa: '' }, exames: [] }))).toBe(true);
    expect(profileEmpty(cleanProfile({ exames: [exam] }))).toBe(false);
    expect(profileText(p)).toContain('queixa: Cansaço há 6 meses');
    expect(profileText(p)).toContain('1 exame');
  });

  it('valores fora da referência: só o exame mais recente de cada análise', () => {
    const older = { ...exam, id: 'ex0', date: '2026-01-10', items: [{ name: 'Ferritina', value: '8', unit: 'ng/mL', ref: '15 a 150', flag: 'baixo' }, { name: 'Insulina', value: '30', unit: 'µUI/mL', ref: '2 a 25', flag: 'alto' }] };
    const ex = cleanExams([older, exam, { note: 'Esteatose hepática leve.', title: 'Ecografia', date: '2026-09-01' }]);
    expect(ex.map((e) => e.date)).toEqual(['2026-10-02', '2026-09-01', '2026-01-10']);
    const out = examOut(ex);
    expect(out.map((i) => `${i.name} ${i.value}`)).toEqual(['Ferritina 12', 'Vitamina D (25-OH) 18,5', 'Insulina 30']);
    const t = integText({ sexo: 'f', idade: 42, integ: { queixa: 'Cansaço' }, exames: ex });
    expect(t).toContain('Mulher, 42 anos');
    expect(t).toContain('Queixa principal e o que espera: Cansaço');
    expect(t).toContain('Ferritina 12 ng/mL (baixo, 02/10/2026)');
  });

  it('o terapeuta guarda a ficha com exames e volta a vê-la no painel', async () => {
    const db = memoryDB();
    await pro.registerPro(db, 'andrea', { terms: pro.PRO_TERMS, name: 'Andrea', reg: 'Naturopatia', kind: 'integrativo' }, NOW, true);
    const code = (await pro.newStudent(db, 'andrea', { name: 'Paula' }, NOW)).body.code as string;
    const r = await pro.saveProfile(db, 'andrea', { code, profile: { sexo: 'f', integ: { queixa: 'Cansaço', ambiente: 'bolor no quarto' }, exames: [exam] } }, NOW);
    expect(r.status).toBe(200);
    const st = (await pro.proState(db, 'andrea', NOW)).body as { students: { profile: { integ: Record<string, string>; exames: unknown[] } }[] };
    expect(st.students[0].profile.integ.ambiente).toBe('bolor no quarto');
    expect(st.students[0].profile.exames).toHaveLength(1);
  });

  it('exame: lê o documento, limpa os valores e não guarda o ficheiro', async () => {
    const calls: { messages: { content: unknown }[] }[] = [];
    const r = await readExam(fake({ is_exam: true, ...exam, id: 'zz', note: '' }, calls), 'm', kv(), 'andrea', 'ip', { file: 'JVBERi0xLjQK', media_type: 'application/pdf' });
    expect(r.status).toBe(200);
    const e = (r.body as { exam: { items: unknown[]; lab: string } }).exam;
    expect(e.items).toHaveLength(3);
    expect(e.lab).toBe('Lab Central');
    expect(JSON.stringify(calls[0].messages[0].content)).toContain('document');
    expect((await readExam(fake({ is_exam: false, date: '', lab: '', title: '', items: [], note: '' }), 'm', kv(), 'a', 'ip', { file: 'JVBERi0xLjQK', media_type: 'application/pdf' })).body).toEqual({ found: false });
    expect((await readExam(fake({}), 'm', kv(), 'a', 'ip', { file: 'JVBERi0xLjQK', media_type: 'text/plain' })).status).toBe(400);
  });

  it('notas da consulta: envia a ficha atual, devolve os campos, os alertas e as perguntas', async () => {
    expect(INTEG_SYSTEM).toMatch(/hipericão/);
    expect(INTEG_SYSTEM).toMatch(/Nunca sugeres parar ou mudar medicação/);
    const calls: { messages: { content: string }[] }[] = [];
    const out = {
      sexo: 'f', idade: 42, queixa: 'Cansaço há 6 meses', historia: '', doencas: 'Hipotiroidismo', medicacao: 'Levotiroxina 50 mcg; hipericão por conta própria', alergias: '', medico: '', familia: '',
      digestao: 'Intestino preso', sono: 'Acorda às 3h', energia: '', emocional: '', hormonal: '', pele: '', dores: '', imunidade: '', alimentacao: '', habitos: '', movimento: '', rotina: '',
      ambiente: 'Bolor no quarto', observacoes: '',
      alerts: ['Hipericão pode interagir com a levotiroxina e outros medicamentos: confirme com o médico.'], ask: ['Usa anticoncecional?'], summary: 'Registei a queixa, saúde, sono, digestão e ambiente.',
    };
    const r = await organizeInteg(fake(out, calls as never), 'm', kv(), 'andrea', 'ip', { text: 'cansada há 6 meses, acorda às 3h…', integ: { queixa: 'Cansaço' }, sexo: '', idade: null });
    expect(r.status).toBe(200);
    const b = r.body as { integ: Record<string, string>; alerts: string[]; ask: string[]; idade: number };
    expect(b.integ.medicacao).toContain('hipericão');
    expect(b.integ).not.toHaveProperty('historia');
    expect(b.idade).toBe(42);
    expect(b.alerts).toHaveLength(1);
    expect(b.ask).toEqual(['Usa anticoncecional?']);
    expect(calls[0].messages[0].content).toContain('queixa: Cansaço');
    expect((await organizeInteg(fake(out), 'm', kv(), 'a', 'ip', { text: '' })).status).toBe(400);
  });

  it('sintomas: o terapeuta escolhe, o paciente avalia por semana e o painel mostra a evolução', async () => {
    const db = memoryDB();
    await pro.registerPro(db, 'andrea', { terms: pro.PRO_TERMS, name: 'Andrea', reg: 'Naturopatia', kind: 'integrativo' }, NOW, true);
    const code = (await pro.newStudent(db, 'andrea', { name: 'Paula' }, NOW)).body.code as string;
    const plan = { goals: 'Energia', habits: [{ text: 'Caminhar 20 min', when: 'tarde' }], practices: [], notes: '', track: ['Cansaço', 'Inchaço', 'cansaço', 'Dor de cabeça', 'Ansiedade', 'Azia', 'Insónia', 'Sétimo'] };
    expect((await pro.savePlan(db, 'andrea', { code, plan: { workouts: [], bemestar: plan } }, NOW)).status).toBe(200);
    await pro.linkStudent(db, 'd:tel', { code }, NOW);
    const link = await pro.linkStudent(db, 'd:tel', { code }, NOW);
    expect((link.body.plan as { bemestar: { track: string[] } }).bemestar.track).toEqual(['Cansaço', 'Inchaço', 'Dor de cabeça', 'Ansiedade', 'Azia', 'Insónia']);
    const wk = (n: number) => new Date(NOW.getTime() - n * 7 * 864e5);
    expect((await pro.logSymptomCheck(db, 'd:tel', { code, data: { v: [8, 6, 2, null, null, null] } }, wk(2))).status).toBe(200);
    expect((await pro.logSymptomCheck(db, 'd:tel', { code, data: { v: [5, 9, 1, null, null, null], note: 'Mais disposta' } }, NOW)).status).toBe(200);
    expect((await pro.logSymptomCheck(db, 'd:tel', { code, data: { v: [null, 'x', 11] } }, NOW)).status).toBe(400);
    expect((await pro.logSymptomCheck(db, 'd:outro', { code, data: { v: [1] } }, NOW)).status).toBe(404);
    const st = (await pro.proState(db, 'andrea', NOW)).body as { students: { symptoms: { label: string; first: number; last: number }[]; symNote: string; alerts: { kind: string; text: string }[] }[] };
    const s0 = st.students[0];
    expect(s0.symptoms.find((x) => x.label === 'Cansaço')).toMatchObject({ first: 8, last: 5 });
    expect(s0.symNote).toBe('Mais disposta');
    expect(s0.alerts.find((a) => a.kind === 'sintomas')?.text).toContain('Inchaço 6→9');
  });

  it('pré-anamnese: o paciente responde na app; o terapeuta lê, junta à ficha e arquiva', async () => {
    const db = memoryDB();
    await pro.registerPro(db, 'andrea', { terms: pro.PRO_TERMS, name: 'Andrea', reg: 'Naturopatia', kind: 'integrativo' }, NOW, true);
    const code = (await pro.newStudent(db, 'andrea', { name: 'Paula' }, NOW)).body.code as string;
    await pro.linkStudent(db, 'd:tel', { code }, NOW);
    expect((await pro.sendIntake(db, 'd:tel', { code, data: { integ: {} } }, NOW)).status).toBe(400);
    expect((await pro.sendIntake(db, 'd:tel', { code, data: { sexo: 'f', idade: '42', integ: { queixa: 'Cansaço', sono: 'Acordo às 3h', observacoes: 'não deve passar' } } }, NOW)).status).toBe(200);
    expect((await pro.linkStudent(db, 'd:tel', { code }, NOW)).body.intakeAt).toBeTruthy();
    const st = (await pro.proState(db, 'andrea', NOW)).body as { students: { intakeAt: string; alerts: { kind: string }[] }[] };
    expect(st.students[0].intakeAt).toBeTruthy();
    expect(st.students[0].alerts.some((a) => a.kind === 'anamnese')).toBe(true);
    const r = (await pro.readIntake(db, 'andrea', { code })).body.intake as { integ: Record<string, string>; idade: number };
    expect(r.integ).toEqual({ queixa: 'Cansaço', sono: 'Acordo às 3h' });
    expect(r.idade).toBe(42);
    expect((await pro.readIntake(db, 'outro', { code })).status).toBe(404);
    await pro.archiveIntake(db, 'andrea', { code });
    expect((await pro.readIntake(db, 'andrea', { code })).body.intake).toBeNull();
    // um personal não recebe pré-anamnese integrativa
    await pro.registerPro(db, 'isa', { terms: pro.PRO_TERMS, name: 'Isabela', reg: 'CREF', kind: 'personal' }, NOW, true);
    const c2 = (await pro.newStudent(db, 'isa', { name: 'João' }, NOW)).body.code as string;
    await pro.linkStudent(db, 'd:tel2', { code: c2 }, NOW);
    expect((await pro.sendIntake(db, 'd:tel2', { code: c2, data: { integ: { queixa: 'x' } } }, NOW)).status).toBe(400);
  });

  it('partilha: o diário do sono passa limpo (só números e horas válidas)', () => {
    const r = pro.cleanShare({ from: '2026-11-01', to: '2026-11-14', days: [], avg: {}, sleep: { nights: 9, eff: 78, asleepH: 6.2, lat: 42, wakes: 2.5, q: 2, bedAvg: '23:40', upAvg: '<b>', note: 'texto' } });
    expect(r.sleep).toEqual({ nights: 9, eff: 78, asleepH: 6.2, lat: 42, wakes: 2.5, q: 2, bedAvg: '23:40', upAvg: null });
    expect(pro.cleanShare({})).not.toHaveProperty('sleep');
  });
});
