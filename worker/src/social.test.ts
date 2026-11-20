import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import * as so from './social';

/** D1 simulada com o SQLite do Node. */
// o Vite não conhece o módulo node:sqlite; carrega-se pelo require do Node
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

const MON = new Date('2026-11-16T12:00:00Z'); // segunda
const WED = new Date('2026-11-18T12:00:00Z');
const NEXT_MON = new Date('2026-11-23T12:00:00Z');

describe('comunidade', () => {
  it('semanas começam à segunda', () => {
    expect(so.weekOf('2026-11-20')).toBe('2026-11-16');
    expect(so.weekOf('2026-11-16')).toBe('2026-11-16');
    expect(so.weekOf('2026-11-22')).toBe('2026-11-16');
  });

  it('limpa os dias: só esta semana, pontos até 100, letras conhecidas', () => {
    const d = so.cleanDays({ '2026-11-15': { p: 50, f: 's' }, '2026-11-17': { p: 500, f: 'ssaX<' } }, '2026-11-16', '2026-11-18');
    expect(d).toEqual({ '2026-11-17': { p: 100, f: 'sa' } });
  });

  it('perfil, pontos, liga e amigos', async () => {
    const db = memoryDB();
    expect((await so.sync(db, 'ana', { days: {} }, WED)).status).toBe(404);
    const a = await so.upsertProfile(db, 'ana', { nick: 'Ana' }, MON);
    await so.upsertProfile(db, 'rui', { nick: 'Rui', evo: false }, MON);
    expect((await so.upsertProfile(db, 'x', { nick: 'A' })).status).toBe(400);
    const r1 = await so.sync(db, 'ana', { days: { '2026-11-16': { p: 80, f: 'sac' }, '2026-11-17': { p: 90, f: 'sact' } }, evo: 40, idx: 72, idxFirst: 60 }, WED);
    // o servidor recalcula: só Spirulina (verificável pelo stock) + declarados (até 50 por dia) + evolução
    expect(r1.body.points).toBeGreaterThan(40);
    expect(r1.body.points).toBeLessThan(210);
    await so.sync(db, 'rui', { days: { '2026-11-17': { p: 30, f: 's' } }, idx: 50 }, WED);
    // amigos com o código
    expect((await so.addFriend(db, 'rui', 'zzz', WED)).status).toBe(404);
    expect((await so.addFriend(db, 'ana', a.body.code, WED)).status).toBe(400);
    expect((await so.addFriend(db, 'rui', a.body.code, WED)).body.nick).toBe('Ana');
    // mensagens: só prontas, só a amigos, máximo 3 por dia
    expect((await so.sendMessage(db, 'rui', 'ana', 'texto livre', WED)).status).toBe(400);
    expect((await so.sendMessage(db, 'rui', 'ninguem', 'aplauso', WED)).status).toBe(403);
    for (let i = 0; i < 3; i++) expect((await so.sendMessage(db, 'rui', 'ana', 'aplauso', WED)).status).toBe(200);
    expect((await so.sendMessage(db, 'rui', 'ana', 'aplauso', WED)).status).toBe(429);
    const st = (await so.state(db, 'ana', WED)).body as any;
    expect(st.league.map((x: any) => x.nick)).toEqual(['Ana', 'Rui']);
    expect(st.friends[0]).toMatchObject({ nick: 'Rui' });
    expect(st.messages).toHaveLength(3);
    await so.markSeen(db, 'ana');
    expect(((await so.state(db, 'ana', WED)).body as any).messages.every((m: any) => m.seen)).toBe(true);
    // evolução do Índice: só quem aceitou
    const ev = (await so.evolution(db)).body.ranking as any[];
    expect(ev).toEqual([expect.objectContaining({ nick: 'Ana', from: 60, to: 72, gain: 12 })]);
  });

  it('na semana seguinte, o primeiro sobe de liga e o inativo não', async () => {
    const db = memoryDB();
    await so.upsertProfile(db, 'ana', { nick: 'Ana' }, MON);
    await so.upsertProfile(db, 'rui', { nick: 'Rui' }, MON);
    await so.sync(db, 'ana', { days: { '2026-11-16': { p: 100, f: 'sacmtpn' }, '2026-11-17': { p: 100, f: 'sacmtpn' }, '2026-11-18': { p: 100, f: 'sacmtpn' } } }, WED);
    await so.sync(db, 'rui', { days: { '2026-11-17': { p: 20, f: '' } } }, WED);
    expect((await so.sync(db, 'ana', { days: {} }, NEXT_MON)).body.league).toBe(1);
    expect((await so.sync(db, 'rui', { days: {} }, NEXT_MON)).body.league).toBe(0);
    const me = ((await so.state(db, 'ana', NEXT_MON)).body as any).me;
    expect(me.result).toMatchObject({ rank: 1, from: 0, to: 1 });
    await so.clearResult(db, 'ana');
    expect(((await so.state(db, 'ana', NEXT_MON)).body as any).me.result).toBeNull();
  });

  it('desafios entre amigos contam os dias de cada um', async () => {
    const db = memoryDB();
    const a = await so.upsertProfile(db, 'ana', { nick: 'Ana' }, MON);
    await so.upsertProfile(db, 'rui', { nick: 'Rui' }, MON);
    expect((await so.createChallenge(db, 'rui', 'agua', ['ana'], MON)).status).toBe(400);
    await so.addFriend(db, 'rui', a.body.code, MON);
    await so.createChallenge(db, 'rui', 'agua', ['ana', 'estranho'], MON);
    await so.sync(db, 'ana', { days: { '2026-11-16': { p: 50, f: 'a' }, '2026-11-17': { p: 50, f: 'a' }, '2026-11-18': { p: 50, f: 's' } } }, WED);
    const c = ((await so.state(db, 'rui', WED)).body as any).challenges[0];
    expect(c).toMatchObject({ kind: 'agua', start: '2026-11-16', target: 6 });
    expect(c.members.map((m: any) => [m.nick, m.done])).toEqual([['Ana', 2], ['Rui', 0]]);
    await so.leave(db, 'ana');
    expect(((await so.state(db, 'ana', WED)).body as any).joined).toBe(false);
  });
});

describe('schema.sql', () => {
  it('é igual ao SCHEMA do código', async () => {
    const { readFileSync } = createRequire(import.meta.url)('node:fs');
    const file = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
    expect(file.split('\n').slice(1).join('\n').trim()).toBe(so.SCHEMA.trim());
  });
});

describe('desafios com a Spirulina', () => {
  it('o desafio da semana é sempre com a Spirulina e os combinados pedem os dois hábitos', () => {
    for (let w = 0; w < 10; w++) expect(so.officialChallenge(`2026-${String(1 + (w % 12)).padStart(2, '0')}-05`)).toMatch(/^ritual/);
    const days = { '2026-11-16': { p: 1, f: 'sa' }, '2026-11-17': { p: 1, f: 'a' }, '2026-11-18': { p: 1, f: 's' } };
    expect(so.countFlag(days, 'sa', '2026-11-16', '2026-11-22')).toBe(1);
    expect(so.countFlag(days, 's', '2026-11-16', '2026-11-22')).toBe(2);
  });
});

describe('mural de conquistas', () => {
  it('regista marcos do ritual, nível e Índice, e aceita aplausos de outros', async () => {
    const db = memoryDB();
    const a = await so.upsertProfile(db, 'ana', { nick: 'Ana' }, MON);
    await so.upsertProfile(db, 'rui', { nick: 'Rui' }, MON);
    await so.addFriend(db, 'rui', a.body.code, MON);
    await so.sync(db, 'ana', { days: { '2026-11-16': { p: 50, f: 's' } }, streak: 6, level: 0, idx: 60 }, MON);
    await so.sync(db, 'ana', { days: { '2026-11-17': { p: 50, f: 's' } }, streak: 7, level: 1, idx: 68 }, WED);
    const feed = ((await so.state(db, 'rui', WED)).body as any).feed;
    const kinds = feed.filter((f: any) => f.nick === 'Ana').map((f: any) => `${f.kind}:${f.value}`).sort();
    expect(kinds).toEqual(['entrou:0', 'indice:8', 'nivel:1', 'ritual:7']);
    const item = feed.find((f: any) => f.kind === 'ritual');
    expect((await so.cheer(db, 'ana', item.id)).status).toBe(400);
    await so.cheer(db, 'rui', item.id);
    await so.cheer(db, 'rui', item.id);
    const again = ((await so.state(db, 'rui', WED)).body as any).feed.find((f: any) => f.id === item.id);
    expect(again).toMatchObject({ cheers: 1, cheered: true });
  });
});
