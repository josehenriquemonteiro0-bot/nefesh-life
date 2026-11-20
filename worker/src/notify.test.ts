import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import * as so from './social';
import * as t from './together';
import * as n from './notify';
import * as push from './push';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite');
function memoryDB(): so.DB {
  const db = new DatabaseSync(':memory:');
  db.exec(so.SCHEMA);
  const stmt = (sql: string, args: unknown[] = []): so.Stmt => ({
    bind: (...x: unknown[]) => stmt(sql, x),
    first: async <T,>() => ((db.prepare(sql).get(...(args as never[])) as T) ?? null),
    all: async <T,>() => ({ results: db.prepare(sql).all(...(args as never[])) as T[] }),
    run: async () => db.prepare(sql).run(...(args as never[])),
  });
  return { prepare: (sql) => stmt(sql), batch: async (s) => { for (const x of s) await x.run(); return []; } };
}
const kv = () => { const m = new Map<string, string>(); return { get: async (k: string) => m.get(k) ?? null, put: async (k: string, v: string) => void m.set(k, v) }; };
const NOON = new Date('2026-11-18T12:00:00Z');
const NIGHT = new Date('2026-11-18T23:30:00Z');
const okFetch = (() => { const calls: string[] = []; const f = (async (u: string) => { calls.push(u); return new Response(null, { status: 201 }); }) as unknown as typeof fetch; return { f, calls }; })();

async function setup() {
  const db = memoryDB();
  const a = await so.upsertProfile(db, 'ana', { nick: 'Ana' }, NOON);
  await so.upsertProfile(db, 'rui', { nick: 'Rui' }, NOON);
  await so.addFriend(db, 'rui', a.body.code, NOON);
  for (const u of ['ana', 'rui']) await push.subscribe(db, { endpoint: `https://push.example/${u}-0000000`, remind: '08:30', tz: 'Europe/Lisbon' }, u);
  return db;
}

describe('notificações da comunidade', () => {
  it('o parceiro recebe "só falta você" quando o outro toma', async () => {
    const db = await setup();
    await t.invitePartner(db, 'rui', 'ana', NOON);
    await t.acceptPartner(db, 'ana', NOON);
    const notes: n.Note[] = [];
    await so.sync(db, 'ana', { days: { '2026-11-18': { p: 1, f: 's', parts: { s: 20 } } } }, NOON, {}, notes);
    expect(notes.map((x) => [x.to, x.msg.title])).toContainEqual(['rui', 'Ana já tomou a Spirulina 🌿']);
    // voltar a sincronizar não volta a avisar
    const again: n.Note[] = [];
    await so.sync(db, 'ana', { days: { '2026-11-18': { p: 1, f: 's', parts: { s: 20 } } } }, NOON, {}, again);
    expect(again.filter((x) => x.to === 'rui' && x.once.startsWith('parceiro'))).toHaveLength(0);
  });

  it('respeita uma vez por acontecimento, 3 por dia, a noite e a preferência', async () => {
    const db = await setup();
    const store = kv();
    const note = (k: string): n.Note => ({ to: 'ana', once: k, msg: { title: 't', body: 'b' } });
    expect(await n.sendNote(db, store, note('a'), NOON, okFetch.f)).toBe(1);
    expect(await n.sendNote(db, store, note('a'), NOON, okFetch.f)).toBe(0); // repetido
    await n.sendNote(db, store, note('b'), NOON, okFetch.f);
    await n.sendNote(db, store, note('c'), NOON, okFetch.f);
    expect(await n.sendNote(db, store, note('d'), NOON, okFetch.f)).toBe(0); // 4.º do dia
    expect(await n.sendNote(db, store, { ...note('e'), to: 'rui' }, NIGHT, okFetch.f)).toBe(0); // 23h30 em Lisboa
    await n.setCommunityPush(db, 'rui', false);
    expect(await n.sendNote(db, store, { ...note('f'), to: 'rui' }, NOON, okFetch.f)).toBe(0); // desligou
  });

  it('meta da equipa e ultrapassagem na liga', async () => {
    const db = await setup();
    const team = await t.createTeam(db, 'ana', 'Equipa', NOON);
    await t.joinTeam(db, 'rui', team.body.code, NOON);
    const FRI = new Date('2026-11-20T12:00:00Z');
    const THU = new Date('2026-11-19T12:00:00Z');
    const days = (k: number, extra = {}) => Object.fromEntries(Array.from({ length: k }, (_, i) => [`2026-11-${16 + i}`, { p: 1, f: 's', parts: { s: 20, a: 15, ...extra } }]));
    await so.sync(db, 'rui', { days: days(5) }, FRI);
    await so.sync(db, 'ana', { days: days(4) }, THU);
    const notes: n.Note[] = [];
    await so.sync(db, 'ana', { days: days(5, { m: 15, c: 10 }) }, FRI, {}, notes);
    const keys = notes.map((x) => x.once.split(':')[0] + '>' + x.to);
    expect(keys).toContain('equipa-meta>ana');
    expect(keys).toContain('equipa-meta>rui');
    expect(keys).toContain('ultrapassado>rui');
    expect(n.isQuiet(23)).toBe(true);
    expect(n.isQuiet(7)).toBe(true);
    expect(n.isQuiet(8)).toBe(false);
  });
});
