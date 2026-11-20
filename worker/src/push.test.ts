import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import * as push from './push';
import { SCHEMA, type DB, type Stmt } from './social';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite');
function memoryDB(): DB {
  const db = new DatabaseSync(':memory:');
  db.exec(SCHEMA);
  const stmt = (sql: string, args: unknown[] = []): Stmt => ({
    bind: (...v: unknown[]) => stmt(sql, v),
    first: async <T,>() => ((db.prepare(sql).get(...(args as never[])) as T) ?? null),
    all: async <T,>() => ({ results: db.prepare(sql).all(...(args as never[])) as T[] }),
    run: async () => db.prepare(sql).run(...(args as never[])),
  });
  return { prepare: (sql) => stmt(sql), batch: async (s) => { for (const x of s) await x.run(); return []; } };
}
const kv = () => { const m = new Map<string, string>(); return { get: async (k: string) => m.get(k) ?? null, put: async (k: string, v: string) => void m.set(k, v) }; };
const EP = 'https://web.push.apple.com/QWERTY123456';

describe('notificações', () => {
  it('gera as chaves VAPID uma vez e assina um JWT válido', async () => {
    const store = kv();
    const a = await push.vapid(store);
    expect((await push.vapid(store)).pub).toBe(a.pub);
    const h = await push.vapidHeader(store, EP);
    const [, jwt, k] = h.match(/^vapid t=([^,]+), k=(.+)$/)!;
    expect(k).toBe(a.pub);
    const [hd, pl, sig] = jwt.split('.');
    const dec = (x: string) => Uint8Array.from(atob(x.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
    expect(JSON.parse(new TextDecoder().decode(dec(pl))).aud).toBe('https://web.push.apple.com');
    const pubKey = await crypto.subtle.importKey('raw', dec(k), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    expect(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pubKey, dec(sig), new TextEncoder().encode(`${hd}.${pl}`))).toBe(true);
  });

  it('lembra a toma à hora certa, uma vez por dia, e não lembra quem já tomou', async () => {
    const db = memoryDB();
    const store = kv();
    const calls: string[] = [];
    const fetcher = (async (u: string) => { calls.push(u); return new Response(null, { status: 201 }); }) as unknown as typeof fetch;
    await push.subscribe(db, { endpoint: EP, remind: '08:30', tz: 'Europe/Lisbon' }, null);
    await push.subscribe(db, { endpoint: EP + 'B', remind: '08:30', tz: 'Europe/Lisbon' }, null);
    await push.markDone(db, { endpoint: EP + 'B', date: '2026-11-20' });
    expect(await push.runSchedule(db, store, new Date('2026-11-20T08:15:00Z'), fetcher)).toBe(0); // 8:15 em Lisboa
    expect(await push.runSchedule(db, store, new Date('2026-11-20T08:31:00Z'), fetcher)).toBe(1);
    expect(await push.runSchedule(db, store, new Date('2026-11-20T08:46:00Z'), fetcher)).toBe(0);
    expect(calls).toEqual([EP]);
    expect((await push.pendingMessage(db, { endpoint: EP })).body.title).toMatch(/ritual/);
  });

  it('apaga inscrições que já não existem e avisa os amigos', async () => {
    const db = memoryDB();
    const store = kv();
    await push.subscribe(db, { endpoint: EP, remind: null, tz: 'Europe/Lisbon' }, 'ana');
    const gone = (async () => new Response(null, { status: 410 })) as unknown as typeof fetch;
    expect(await push.notifyFriend(db, store, 'ana', 'Rui', 'forca', gone, new Date('2026-11-20T12:00:00Z'))).toBe(1);
    expect(await push.notifyFriend(db, store, 'ana', 'Rui', 'forca', gone, new Date('2026-11-20T12:00:00Z'))).toBe(0);
  });

  it('avisa da reposição 7 dias antes, uma vez por data, e de novo se a data mudar', async () => {
    const db = memoryDB();
    const store = kv();
    const calls: string[] = [];
    const fetcher = (async (u: string) => { calls.push(u); return new Response(null, { status: 201 }); }) as unknown as typeof fetch;
    await push.subscribe(db, { endpoint: EP, remind: null, tz: 'Europe/Lisbon' }, null);
    expect((await push.setStockEnd(db, { endpoint: EP, ends: 'amanhã' })).status).toBe(200); // data inválida apaga
    await push.setStockEnd(db, { endpoint: EP, ends: '2026-12-05' });
    // a 20/11 faltam 15 dias: ainda não avisa
    expect(await push.runSchedule(db, store, new Date('2026-11-20T10:20:00Z'), fetcher)).toBe(0);
    // a 28/11 faltam 7 dias: avisa às 10h, só uma vez
    expect(await push.runSchedule(db, store, new Date('2026-11-28T09:50:00Z'), fetcher)).toBe(0);
    expect(await push.runSchedule(db, store, new Date('2026-11-28T10:05:00Z'), fetcher)).toBe(1);
    expect((await push.pendingMessage(db, { endpoint: EP })).body.title).toMatch(/acaba daqui a 7 dias/);
    expect(await push.runSchedule(db, store, new Date('2026-11-28T10:35:00Z'), fetcher)).toBe(0);
    expect(await push.runSchedule(db, store, new Date('2026-11-29T10:05:00Z'), fetcher)).toBe(0);
    // a mesma data outra vez não repete; uma data nova (frasco novo acabado) volta a avisar
    await push.setStockEnd(db, { endpoint: EP, ends: '2026-12-05' });
    expect(await push.runSchedule(db, store, new Date('2026-11-30T10:05:00Z'), fetcher)).toBe(0);
    await push.setStockEnd(db, { endpoint: EP, ends: '2026-12-03' });
    expect(await push.runSchedule(db, store, new Date('2026-11-30T10:05:00Z'), fetcher)).toBe(1);
    expect(calls).toEqual([EP, EP]);
    // sair das notificações apaga também o aviso
    await push.unsubscribe(db, { endpoint: EP });
    expect(await db.prepare('SELECT 1 FROM stock_alerts').first()).toBeNull();
  });
});

describe('relatório semanal', () => {
  it('avisa ao domingo às 20h, uma vez', async () => {
    const db = memoryDB();
    const store = kv();
    const calls: string[] = [];
    const fetcher = (async (u: string) => { calls.push(u); return new Response(null, { status: 201 }); }) as unknown as typeof fetch;
    await push.subscribe(db, { endpoint: EP, remind: null, tz: 'Europe/Lisbon' }, null);
    expect(await push.runSchedule(db, store, new Date('2026-11-22T19:50:00Z'), fetcher)).toBe(0); // domingo 19:50
    expect(await push.runSchedule(db, store, new Date('2026-11-22T20:05:00Z'), fetcher)).toBe(1);
    expect((await push.pendingMessage(db, { endpoint: EP })).body.title).toMatch(/relatório da semana/);
    expect(await push.runSchedule(db, store, new Date('2026-11-22T20:20:00Z'), fetcher)).toBe(0);
    expect(await push.runSchedule(db, store, new Date('2026-11-23T20:05:00Z'), fetcher)).toBe(0); // segunda
  });
});
