import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import * as so from './social';
import * as as from './appstore';
import * as pg from './premiumGate';
import fx from './appstore.fixtures.json';

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
const kv = () => {
  const m = new Map<string, string>();
  return { m, get: async (k: string) => m.get(k) ?? null, put: async (k: string, v: string) => void m.set(k, v) };
};
const b64url = (b: Uint8Array | string) => Buffer.from(b).toString('base64url');
const NOW = Date.parse('2026-12-01T12:00:00Z');
async function sign(payload: object) {
  const h = b64url(JSON.stringify({ alg: 'ES256', x5c: [fx.leaf, fx.inter, fx.root] }));
  const p = b64url(JSON.stringify(payload));
  const key = await crypto.subtle.importKey('pkcs8', Buffer.from(fx.leafKey, 'base64'), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const s = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(`${h}.${p}`)));
  return `${h}.${p}.${b64url(s)}`;
}
const TOKEN = 'cd'.repeat(32);

describe('Premium confirmado no servidor', () => {
  it('só atua com PREMIUM_ENFORCED = "true"', () => {
    expect(pg.enforced({})).toBe(false);
    expect(pg.enforced({ PREMIUM_ENFORCED: 'true' })).toBe(true);
  });

  it('conta com Premium (cortesia), conta sem Premium e pedido sem nada', async () => {
    const db = memoryDB();
    const store = kv();
    store.m.set(`s:${TOKEN}`, 'ana');
    expect(await pg.hasPremium(db, store, { token: TOKEN }, NOW)).toBe(false);
    await pg.grantCourtesy(db, 'ana', '2027-01-31');
    expect(await pg.hasPremium(db, store, { token: TOKEN }, NOW)).toBe(true);
    expect(await pg.hasPremium(db, store, { token: TOKEN }, Date.parse('2027-02-01'))).toBe(false);
    // conta partilhada com muita gente: o 4.º aparelho do dia fica sem Premium
    for (const d of ['d1', 'd2', 'd3']) expect(await pg.hasPremium(db, store, { token: TOKEN, device: d }, NOW)).toBe(true);
    expect(await pg.hasPremium(db, store, { token: TOKEN, device: 'd4' }, NOW)).toBe(false);
    expect(await pg.hasPremium(db, store, {}, NOW)).toBe(false);
  });

  it('sem conta: aceita a transação da Apple válida (e guarda 1 hora); recusa a expirada', async () => {
    const db = memoryDB();
    const store = kv();
    const tx = { bundleId: as.BUNDLE_ID, productId: 'com.nefesh.life.premium.mensal', transactionId: '1', originalTransactionId: '1', expiresDate: NOW + 864e5, signedDate: NOW, environment: 'Sandbox' };
    const ok = await sign(tx);
    expect(await pg.hasPremium(db, store, { premium: ok }, NOW, fx.rootSha256)).toBe(true);
    expect([...store.m.keys()].some((k) => k.startsWith('pj:'))).toBe(true);
    expect(await pg.hasPremium(db, store, { premium: await sign({ ...tx, expiresDate: NOW - 1 }) }, NOW, fx.rootSha256)).toBe(false);
    // a mesma assinatura em aparelhos diferentes: até 3 por dia
    const st2 = kv();
    for (const d of ['a1', 'a2', 'a3']) expect(await pg.hasPremium(db, st2, { premium: ok, device: d }, NOW, fx.rootSha256)).toBe(true);
    expect(await pg.hasPremium(db, st2, { premium: ok, device: 'a4' }, NOW, fx.rootSha256)).toBe(false);
    expect(await pg.hasPremium(db, st2, { premium: ok, device: 'a1' }, NOW, fx.rootSha256)).toBe(true);
    // com a raiz verdadeira da Apple, a cadeia de teste não passa
    expect(await pg.hasPremium(db, kv(), { premium: ok }, NOW)).toBe(false);
  });
});
