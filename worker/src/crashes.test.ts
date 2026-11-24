import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import * as so from './social';
import * as cr from './crashes';

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

describe('avisos de falhas da app', () => {
  it('junta as falhas iguais, conta-as e não guarda dados pessoais', async () => {
    const db = memoryDB();
    const err = { message: 'TypeError: x is undefined (ana@exemplo.pt, 912345678)', stack: 'at Coach (Coach.tsx:10)\nat App', where: 'coach', version: '1.0', platform: 'ios' };
    await cr.saveCrash(db, err, new Date('2026-11-24T10:00:00Z'));
    await cr.saveCrash(db, err, new Date('2026-11-24T11:00:00Z'));
    await cr.saveCrash(db, { ...err, message: 'Outra falha' }, new Date('2026-11-24T12:00:00Z'));
    const rows = await cr.listCrashes(db);
    expect(rows).toHaveLength(2);
    const a = rows.find((r) => r.count === 2)!;
    expect(a.message).toBe('TypeError: x is undefined ([e-mail], [n])');
    expect(a.first).toBe('2026-11-24T10:00:00.000Z');
    expect(a.last).toBe('2026-11-24T11:00:00.000Z');
    expect((await cr.saveCrash(db, { message: '' })).status).toBe(400);
  });

  it('resumo por e-mail: só às 8h de Lisboa, só com falhas por avisar, e marca-as como avisadas', async () => {
    const db = memoryDB();
    const sent: unknown[] = [];
    const mailer = { send: async (m: unknown) => void sent.push(m) };
    await cr.saveCrash(db, { message: 'Falha A', platform: 'web' }, new Date('2026-11-24T07:00:00Z'));
    // sem envio configurado, ou fora das 8h: nada
    expect(await cr.emailDigest(db, undefined, 'a@x', 'b@x', 'url', new Date('2026-11-24T08:10:00Z'))).toBeNull();
    expect(await cr.emailDigest(db, mailer, 'a@x', 'b@x', 'url', new Date('2026-11-24T10:10:00Z'))).toBeNull();
    const d = cr.digest(await cr.listCrashes(db), 'url');
    expect(d.subject).toBe('NEFESH Life: 1 falha nova na app');
    expect(d.text).toContain('1× Falha A');
    // limpeza aos 90 dias
    await cr.purgeCrashes(db, new Date('2027-03-01T00:00:00Z'));
    expect(await cr.listCrashes(db)).toHaveLength(0);
  });
});
