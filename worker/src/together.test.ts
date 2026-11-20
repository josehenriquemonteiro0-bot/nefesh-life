import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import * as so from './social';
import * as t from './together';

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
const WED = new Date('2026-11-18T12:00:00Z');
const full = { '2026-11-16': { p: 1, f: 'sacmtpn' }, '2026-11-17': { p: 1, f: 'sacmtpn' }, '2026-11-18': { p: 1, f: 'sacmtpn' } };

async function setup() {
  const db = memoryDB();
  const a = await so.upsertProfile(db, 'ana', { nick: 'Ana' }, WED);
  await so.upsertProfile(db, 'rui', { nick: 'Rui' }, WED);
  await so.addFriend(db, 'rui', a.body.code, WED);
  return db;
}

describe('equipas de melhores amigos', () => {
  it('cria, entra, mostra a meta de ritual e o ranking', async () => {
    const db = await setup();
    const team = await t.createTeam(db, 'ana', 'Os da Spirulina', WED);
    expect((await t.createTeam(db, 'ana', 'Outra', WED)).status).toBe(409);
    expect((await t.joinTeam(db, 'rui', team.body.code, WED)).body.name).toBe('Os da Spirulina');
    await so.sync(db, 'ana', { days: full }, WED);
    const st = (await so.state(db, 'rui', WED)).body as any;
    expect(st.team).toMatchObject({ name: 'Os da Spirulina', goal: 10, done: 3 });
    expect(st.team.members).toHaveLength(2);
    expect(st.teams[0]).toMatchObject({ name: 'Os da Spirulina', members: 2, mine: true });
    await t.leaveTeam(db, 'ana');
    await t.leaveTeam(db, 'rui');
    expect(((await so.state(db, 'rui', WED)).body as any).teams).toHaveLength(0);
  });
});

describe('reações, respostas e momentos', () => {
  it('uma reação por pessoa (pode mudar), uma resposta e momentos limitados', async () => {
    const db = await setup();
    await t.moment(db, 'ana', 'receita', 3, WED);
    const fid = ((await so.state(db, 'rui', WED)).body as any).feed.find((f: any) => f.kind === 'receita').id;
    expect((await t.react(db, 'ana', fid, '💚', WED)).r.status).toBe(400);
    expect((await t.react(db, 'rui', fid, '💚', WED)).owner).toBe('ana');
    expect((await t.react(db, 'rui', fid, '🔥', WED)).owner).toBeNull(); // mudar não volta a avisar
    expect((await t.reply(db, 'rui', fid, 'parabens', WED)).owner).toBe('ana');
    expect((await t.reply(db, 'rui', fid, 'bora', WED)).r.status).toBe(409);
    const item = ((await so.state(db, 'ana', WED)).body as any).feed.find((f: any) => f.id === fid);
    expect(item).toMatchObject({ reactions: { '🔥': 1 }, replies: [{ nick: 'Rui', kind: 'parabens' }] });
    await t.moment(db, 'ana', 'treino', 30, WED);
    await t.moment(db, 'ana', 'treino', 30, WED);
    expect((await t.moment(db, 'ana', 'treino', 30, WED)).status).toBe(429);
  });
});

describe('parceiro de ritual', () => {
  it('convite, aceitação e sequência a dois', async () => {
    const db = await setup();
    expect((await t.invitePartner(db, 'ana', 'estranho', WED)).status).toBe(403);
    await t.invitePartner(db, 'rui', 'ana', WED);
    expect(((await so.state(db, 'ana', WED)).body as any).partner).toMatchObject({ status: 'recebido', nick: 'Rui' });
    await t.acceptPartner(db, 'ana', WED);
    await so.sync(db, 'ana', { days: full }, WED);
    await so.sync(db, 'rui', { days: { '2026-11-17': { p: 1, f: 's' }, '2026-11-18': { p: 1, f: 's' } } }, WED);
    expect(((await so.state(db, 'ana', WED)).body as any).partner).toMatchObject({ status: 'ativo', streak: 2, todayThem: true });
    expect(t.jointStreak({ '2026-11-17': { f: 's' } }, { '2026-11-17': { f: 's' } }, '2026-11-18')).toBe(1);
    await t.endPartner(db, 'ana');
    expect(((await so.state(db, 'rui', WED)).body as any).partner).toBeNull();
  });
});

describe('momentos com foto (24 horas)', async () => {
  const ph = await import('./photos');
  it('aparece para toda a comunidade, esconde-se com denúncias e apaga-se ao fim de 24 h', async () => {
    const db = await setup();
    await so.upsertProfile(db, 'eva', { nick: 'Eva' }, WED); // não é amiga de ninguém
    const id = await ph.savePhoto(db, 'ana', 'QUJD'.repeat(40), 'treino', 30, WED);
    const seen = ((await so.state(db, 'eva', WED)).body as any).photos;
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ id, nick: 'Ana', kind: 'treino' });
    // não aparece duplicada no mural
    expect(((await so.state(db, 'eva', WED)).body as any).feed.some((f: any) => f.kind.startsWith('foto'))).toBe(false);
    expect(await ph.photoBytes(db, id, WED)).not.toBeNull();
    await ph.report(db, 'eva', id, WED);
    expect(((await so.state(db, 'eva', WED)).body as any).photos).toHaveLength(0); // escondida para quem denunciou
    expect(((await so.state(db, 'rui', WED)).body as any).photos).toHaveLength(1);
    const later = new Date(WED.getTime() + 25 * 3600 * 1000);
    expect(await ph.cleanupPhotos(db, later)).toBe(1);
    expect(await ph.photoBytes(db, id, later)).toBeNull();
  });
});
