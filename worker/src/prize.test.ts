import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import * as so from './social';
import * as pz from './prize';

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

const WEEK = '2026-11-16';
const days = (checkins: number) => Object.fromEntries(Array.from({ length: 7 }, (_, i) => [`2026-11-${16 + i}`, { p: 20, f: i < checkins ? 'sc' : 's' }]));
async function person(db: so.DB, id: string, created: string, points: number, checkins: number, updated = '2026-11-22T10:00:00Z') {
  await db.prepare('INSERT INTO profiles (id, nick, code, created, updated) VALUES (?, ?, ?, ?, ?)').bind(id, id.toUpperCase(), `C${id}`, created, created).run();
  await db.prepare('INSERT INTO weeks (id, week, league, grp, points, days, updated) VALUES (?, ?, 0, 0, ?, ?, ?)').bind(id, WEEK, points, JSON.stringify(days(checkins)), updated).run();
}

describe('ranking semanal e cupão NEFESH15', () => {
  it('só ganha quem cumpre as regras; 3 vencedores com código único; uma vez por semana', async () => {
    const db = memoryDB();
    await person(db, 'ana', '2026-10-01T00:00:00Z', 600, 7);
    await person(db, 'novo', '2026-11-15T00:00:00Z', 700, 7); // menos de 15 dias
    await person(db, 'rui', '2026-10-01T00:00:00Z', 500, 4); // só 4 check-ins
    await person(db, 'eva', '2026-10-01T00:00:00Z', 450, 5, '2026-11-22T12:00:00Z');
    await person(db, 'leo', '2026-10-01T00:00:00Z', 450, 5, '2026-11-21T12:00:00Z'); // empate: chegou primeiro
    await person(db, 'mia', '2026-10-01T00:00:00Z', 440, 6);
    await person(db, 'fraude', '2026-10-01T00:00:00Z', 900, 7);
    await db.prepare("INSERT INTO reviews (uid, reason, status, created) VALUES ('fraude', 'x', 'aberto', 'x')").run();
    const w = await pz.closeWeek(db, WEEK, new Date('2026-11-23T09:05:00Z'));
    expect(w!.map((x) => [x.rank, x.uid])).toEqual([[1, 'ana'], [2, 'leo'], [3, 'eva']]);
    expect(w![0].code).toMatch(/^NEFESH15-[A-Z2-9]{4}$/);
    expect(new Set(w!.map((x) => x.code)).size).toBe(3);
    expect(await pz.closeWeek(db, WEEK)).toBeNull();
    const list = await pz.couponList(db);
    expect(list[0]).toMatchObject({ status: 'atribuido', expires: '2026-12-07' });
  });

  it('no máximo 1 cupão a cada 4 semanas', async () => {
    const db = memoryDB();
    await person(db, 'ana', '2026-09-01T00:00:00Z', 600, 7);
    await db.prepare("INSERT INTO coupons (code, uid, week, rank, status, created, expires) VALUES ('NEFESH15-AAAA', 'ana', '2026-11-02', 1, 'usado', 'x', 'x')").run();
    expect(await pz.closeWeek(db, WEEK)).toEqual([]);
  });

  it('a app vê o ranking, a sua posição, o que falta para poder ganhar e os seus cupões', async () => {
    const db = memoryDB();
    await person(db, 'ana', '2026-10-01T00:00:00Z', 600, 7);
    await person(db, 'rui', '2026-11-10T00:00:00Z', 500, 3);
    const s = (await pz.prizeState(db, 'rui', WEEK, '2026-11-20')).prize;
    expect(s.top.map((t) => t.nick)).toEqual(['ANA', 'RUI']);
    expect(s.me).toMatchObject({ rank: 2, prizeRank: null, eligible: false, checkins: 3 });
    expect(s.me.reasons.join(' ')).toMatch(/15 dias na comunidade \(tem 13\).*check-in em 5 dos 7 dias \(tem 3\)/);
    await pz.closeWeek(db, WEEK);
    const a = (await pz.prizeState(db, 'ana', '2026-11-23', '2026-11-23')).prize;
    expect(a.coupons[0]).toMatchObject({ rank: 1, seen: false, expired: false });
    await pz.couponSeen(db, 'ana');
    expect((await pz.prizeState(db, 'ana', '2026-11-23', '2026-11-23')).prize.coupons[0].seen).toBe(true);
  });

  it('e-mail da equipa para o vencedor e estados do cupão', async () => {
    const db = memoryDB();
    await person(db, 'ana', '2026-10-01T00:00:00Z', 600, 7);
    await pz.saveContact(db, 'ana', 'ana@x.pt');
    const [w] = (await pz.closeWeek(db, WEEK))!;
    let row = (await pz.couponList(db))[0];
    expect(row.email).toBe('ana@x.pt');
    const m = pz.prizeEmail('Ana', 1, w.code, row.expires);
    expect(m.body).toContain(w.code);
    expect(m.body).toMatch(/utilização única/);
    await pz.setCouponStatus(db, w.code, 'enviado');
    row = (await pz.couponList(db))[0];
    expect(row.status).toBe('enviado');
    expect(row.sent_at).toBeTruthy();
  });
});
