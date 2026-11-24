import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import * as so from './social';
import * as al from './accesslog';

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
const T = 'ab'.repeat(32);
const post = (body: unknown) => new Request('https://x/api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

describe('registos de acesso (Marco Civil, art. 15)', () => {
  it('um registo por pessoa, IP e hora; sem sessão não regista', async () => {
    const db = memoryDB();
    await al.logAccess(db, 'ana', '203.0.113.7', new Date('2026-11-24T10:05:00Z'));
    await al.logAccess(db, 'ana', '203.0.113.7', new Date('2026-11-24T10:40:00Z'));
    await al.logAccess(db, 'ana', '198.51.100.2', new Date('2026-11-24T10:41:00Z'));
    await al.logAccess(db, 'ana', '203.0.113.7', new Date('2026-11-24T11:00:00Z'));
    await al.logAccess(db, null, '203.0.113.7');
    const r = await al.accessOf(db, 'ana', '2026-11-24T00', '2026-11-24T23');
    expect(r).toEqual([
      { ip: '203.0.113.7', at: '2026-11-24T10:05:00.000Z' },
      { ip: '198.51.100.2', at: '2026-11-24T10:41:00.000Z' },
      { ip: '203.0.113.7', at: '2026-11-24T11:00:00.000Z' },
    ]);
  });

  it('apaga o que passou dos 6 meses', async () => {
    const db = memoryDB();
    await al.logAccess(db, 'ana', '203.0.113.7', new Date('2026-05-23T10:00:00Z'));
    await al.logAccess(db, 'ana', '203.0.113.7', new Date('2026-05-25T10:00:00Z'));
    await al.purgeAccess(db, new Date('2026-11-24T10:00:00Z'));
    expect((await al.accessOf(db, 'ana', '2026-01-01', '2026-12-31')).map((x) => x.at.slice(0, 10))).toEqual(['2026-05-25']);
  });

  it('o token vem do pedido ou da resposta de entrar; nada de outros formatos', async () => {
    expect(await al.tokenOf(post({ token: T, x: 1 }), null)).toBe(T);
    expect(await al.tokenOf(post({ email: 'a@b.c' }), Response.json({ token: T }))).toBe(T);
    expect(await al.tokenOf(post({ token: 'curto' }), null)).toBeNull();
    expect(await al.tokenOf(new Request('https://x', { method: 'POST', body: 'x' }), null)).toBeNull();
  });
});
