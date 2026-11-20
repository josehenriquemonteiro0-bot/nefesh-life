/**
 * Comunidade, parte 2: equipas de melhores amigos, reações e respostas no mural,
 * momentos (receita feita, treino), e parceiro de ritual (sequência a dois).
 */
import type { DB } from './social';

export const TOGETHER_SCHEMA_NOTE = 'tabelas em social.ts (SCHEMA)';
export const TEAM_MAX = 8;
export const REACTIONS = ['👏', '💚', '🔥'] as const;
export const REPLIES: Record<string, string> = {
  parabens: 'Parabéns! 🎉',
  bora: 'Bora! 💪',
  orgulho: 'Que orgulho! 💚',
  inspiras: 'Inspiraste-me hoje 🌿',
  continua: 'Continua assim! 🔥',
};
export const PAIR_MILESTONES = [7, 14, 30, 60, 90];

type Ok = { status: number; body: Record<string, unknown> };
const ok = (body: Record<string, unknown>): Ok => ({ status: 200, body });
const fail = (status: number, error: string): Ok => ({ status, body: { error } });
const code6 = () => {
  const abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  return [...crypto.getRandomValues(new Uint8Array(6))].map((x) => abc[x % abc.length]).join('');
};
const addDays = (key: string, n: number) => {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/* ---------- equipas ---------- */

export async function createTeam(db: DB, uid: string, nameRaw: unknown, now = new Date()): Promise<Ok> {
  const name = String(nameRaw ?? '').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, 30);
  if (name.length < 2) return fail(400, 'Dê um nome à equipa.');
  if (await db.prepare('SELECT 1 FROM team_members WHERE uid = ?').bind(uid).first()) return fail(409, 'Já está numa equipa. Saia primeiro para criar outra.');
  let code = code6();
  while (await db.prepare('SELECT 1 FROM teams WHERE code = ?').bind(code).first()) code = code6();
  const id = [...crypto.getRandomValues(new Uint8Array(8))].map((x) => x.toString(16).padStart(2, '0')).join('');
  const at = now.toISOString();
  await db.batch([
    db.prepare('INSERT INTO teams (id, name, owner, code, created) VALUES (?, ?, ?, ?, ?)').bind(id, name, uid, code, at),
    db.prepare('INSERT INTO team_members (tid, uid, joined) VALUES (?, ?, ?)').bind(id, uid, at),
  ]);
  return ok({ id, code });
}

export async function joinTeam(db: DB, uid: string, codeRaw: unknown, now = new Date()): Promise<Ok> {
  const code = String(codeRaw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const team = await db.prepare('SELECT id, name FROM teams WHERE code = ?').bind(code).first<{ id: string; name: string }>();
  if (!team) return fail(404, 'Não encontrámos nenhuma equipa com esse código.');
  if (await db.prepare('SELECT 1 FROM team_members WHERE uid = ?').bind(uid).first()) return fail(409, 'Já está numa equipa. Saia primeiro para entrar noutra.');
  const n = await db.prepare('SELECT COUNT(*) AS n FROM team_members WHERE tid = ?').bind(team.id).first<{ n: number }>();
  if ((n?.n ?? 0) >= TEAM_MAX) return fail(400, `A equipa já tem ${TEAM_MAX} pessoas.`);
  await db.prepare('INSERT INTO team_members (tid, uid, joined) VALUES (?, ?, ?)').bind(team.id, uid, now.toISOString()).run();
  return ok({ name: team.name });
}

export async function leaveTeam(db: DB, uid: string): Promise<Ok> {
  const m = await db.prepare('SELECT tid FROM team_members WHERE uid = ?').bind(uid).first<{ tid: string }>();
  if (!m) return ok({ ok: true });
  await db.prepare('DELETE FROM team_members WHERE uid = ?').bind(uid).run();
  const left = await db.prepare('SELECT uid FROM team_members WHERE tid = ? ORDER BY joined LIMIT 1').bind(m.tid).first<{ uid: string }>();
  if (!left) await db.prepare('DELETE FROM teams WHERE id = ?').bind(m.tid).run();
  else await db.prepare('UPDATE teams SET owner = ? WHERE id = ? AND owner = ?').bind(left.uid, m.tid, uid).run();
  return ok({ ok: true });
}

const parse = (s: unknown): Record<string, { p: number; f: string; ds?: number }> => {
  try {
    return typeof s === 'string' ? JSON.parse(s) : {};
  } catch {
    return {};
  }
};
const sDay = (d?: { f: string; ds?: number }) => !!d && ((d.ds ?? 0) > 0 || d.f.includes('s'));

/** A minha equipa (membros, pontos, meta de ritual da semana) e o ranking das equipas. */
export async function teamState(db: DB, uid: string, week: string, today: string) {
  const m = await db.prepare('SELECT t.id, t.name, t.code, t.owner FROM team_members tm JOIN teams t ON t.id = tm.tid WHERE tm.uid = ?').bind(uid).first<{ id: string; name: string; code: string; owner: string }>();
  let team: Record<string, unknown> | null = null;
  if (m) {
    const { results } = await db
      .prepare(
        `SELECT p.id, p.nick, p.avatar, p.streak, w.points, w.days FROM team_members tm JOIN profiles p ON p.id = tm.uid
         LEFT JOIN weeks w ON w.id = tm.uid AND w.week = ? WHERE tm.tid = ? ORDER BY COALESCE(w.points, 0) DESC`,
      )
      .bind(week, m.id)
      .all<{ id: string; nick: string; avatar: string | null; streak: number; points: number | null; days: string | null }>();
    const members = results.map((r) => {
      const d = parse(r.days);
      return { id: r.id, me: r.id === uid, nick: r.nick, avatar: r.avatar, streak: r.streak, points: r.points ?? 0, ritualDays: Object.values(d).filter((x) => sDay(x)).length, today: sDay(d[today]) };
    });
    const goal = members.length * 5;
    const done = members.reduce((t, x) => t + x.ritualDays, 0);
    team = { name: m.name, code: m.code, mine: m.owner === uid, members, goal, done, total: members.reduce((t, x) => t + x.points, 0) };
  }
  // ranking: média de pontos por pessoa (justo para equipas de tamanhos diferentes)
  const { results: rank } = await db
    .prepare(
      `SELECT t.id, t.name, COUNT(tm.uid) AS n, COALESCE(SUM(w.points), 0) AS total FROM teams t
       JOIN team_members tm ON tm.tid = t.id LEFT JOIN weeks w ON w.id = tm.uid AND w.week = ?
       GROUP BY t.id ORDER BY (COALESCE(SUM(w.points), 0) * 1.0 / COUNT(tm.uid)) DESC LIMIT 20`,
    )
    .bind(week)
    .all<{ id: string; name: string; n: number; total: number }>();
  const ranking = rank.map((r, i) => ({ rank: i + 1, name: r.name, members: r.n, avg: Math.round(r.total / Math.max(1, r.n)), mine: !!m && r.id === m.id }));
  return { team, ranking };
}

/* ---------- reações, respostas e momentos ---------- */

/** Reage a uma conquista do mural (uma reação por pessoa; muda se reagir outra vez). Devolve o dono. */
export async function react(db: DB, uid: string, fid: unknown, kind: unknown, now = new Date()) {
  const f = Math.round(Number(fid));
  const k = String(kind);
  if (!(REACTIONS as readonly string[]).includes(k)) return { r: fail(400, 'Reação desconhecida.'), owner: null };
  const item = await db.prepare('SELECT uid FROM feed WHERE id = ?').bind(f).first<{ uid: string }>();
  if (!item) return { r: fail(404, 'Esta conquista já não existe.'), owner: null };
  if (item.uid === uid) return { r: fail(400, 'Não pode reagir às suas próprias conquistas.'), owner: null };
  const prev = await db.prepare('SELECT kind FROM reactions WHERE fid = ? AND uid = ?').bind(f, uid).first<{ kind: string }>();
  await db.prepare('INSERT INTO reactions (fid, uid, kind, created) VALUES (?, ?, ?, ?) ON CONFLICT(fid, uid) DO UPDATE SET kind = excluded.kind').bind(f, uid, k, now.toISOString()).run();
  return { r: ok({ ok: true }), owner: prev ? null : item.uid };
}

/** Resposta pronta a uma conquista (uma por pessoa e por conquista). */
export async function reply(db: DB, uid: string, fid: unknown, kind: unknown, now = new Date()) {
  const f = Math.round(Number(fid));
  const k = String(kind);
  if (!REPLIES[k]) return { r: fail(400, 'Resposta desconhecida.'), owner: null };
  const item = await db.prepare('SELECT uid FROM feed WHERE id = ?').bind(f).first<{ uid: string }>();
  if (!item) return { r: fail(404, 'Esta conquista já não existe.'), owner: null };
  if (await db.prepare('SELECT 1 FROM replies WHERE fid = ? AND uid = ?').bind(f, uid).first()) return { r: fail(409, 'Já respondeu a esta conquista.'), owner: null };
  await db.prepare('INSERT INTO replies (fid, uid, kind, created) VALUES (?, ?, ?, ?)').bind(f, uid, k, now.toISOString()).run();
  return { r: ok({ ok: true }), owner: item.uid === uid ? null : item.uid };
}

/** Momentos que a pessoa partilha no mural: receita feita (value = n.º da receita) ou treino concluído (minutos). */
export async function moment(db: DB, uid: string, kind: unknown, value: unknown, now = new Date()): Promise<Ok> {
  const k = String(kind);
  if (k !== 'receita' && k !== 'treino') return fail(400, 'Momento desconhecido.');
  const v = Math.max(0, Math.min(600, Math.round(Number(value) || 0)));
  const since = new Date(now.getTime() - 86400000).toISOString();
  const n = await db.prepare('SELECT COUNT(*) AS n FROM feed WHERE uid = ? AND kind = ? AND created > ?').bind(uid, k, since).first<{ n: number }>();
  if ((n?.n ?? 0) >= 2) return fail(429, 'Já partilhou o suficiente hoje.');
  await db.prepare('INSERT INTO feed (uid, kind, value, created) VALUES (?, ?, ?, ?)').bind(uid, k, v, now.toISOString()).run();
  return ok({ ok: true });
}

/** Reações e respostas de várias conquistas, para o mural. */
export async function feedExtras(db: DB, uid: string, ids: number[]) {
  const out = new Map<number, { reactions: Record<string, number>; mine: string | null; replies: { nick: string; kind: string }[] }>();
  if (!ids.length) return out;
  const q = ids.map(() => '?').join(',');
  const { results: rs } = await db.prepare(`SELECT fid, uid, kind FROM reactions WHERE fid IN (${q})`).bind(...ids).all<{ fid: number; uid: string; kind: string }>();
  const { results: legacy } = await db.prepare(`SELECT fid, uid FROM cheers WHERE fid IN (${q})`).bind(...ids).all<{ fid: number; uid: string }>();
  const { results: rp } = await db
    .prepare(`SELECT r.fid, r.kind, p.nick FROM replies r JOIN profiles p ON p.id = r.uid WHERE r.fid IN (${q}) ORDER BY r.created`)
    .bind(...ids)
    .all<{ fid: number; kind: string; nick: string }>();
  for (const id of ids) out.set(id, { reactions: {}, mine: null, replies: [] });
  for (const r of [...rs, ...legacy.filter((l) => !rs.some((x) => x.fid === l.fid && x.uid === l.uid)).map((l) => ({ ...l, kind: '👏' }))]) {
    const e = out.get(r.fid)!;
    e.reactions[r.kind] = (e.reactions[r.kind] ?? 0) + 1;
    if (r.uid === uid) e.mine = r.kind;
  }
  for (const r of rp) out.get(r.fid)!.replies.push({ nick: r.nick, kind: r.kind });
  return out;
}

/* ---------- parceiro de ritual ---------- */

export async function invitePartner(db: DB, uid: string, other: unknown, now = new Date()): Promise<Ok> {
  const o = String(other ?? '');
  if (!(await db.prepare('SELECT 1 FROM friends WHERE a = ? AND b = ?').bind(uid, o).first())) return fail(403, 'Só pode convidar um amigo.');
  if (await db.prepare("SELECT 1 FROM pairs WHERE uid = ? AND status = 'ativo'").bind(uid).first()) return fail(409, 'Já tem um parceiro de ritual.');
  if (await db.prepare("SELECT 1 FROM pairs WHERE uid = ? AND status = 'ativo'").bind(o).first()) return fail(409, 'Esse amigo já tem um parceiro de ritual.');
  const at = now.toISOString();
  await db.batch([
    db.prepare('DELETE FROM pairs WHERE uid = ? AND status != ?').bind(uid, 'ativo'),
    db.prepare('INSERT INTO pairs (uid, partner, status, since, best) VALUES (?, ?, ?, ?, 0) ON CONFLICT(uid) DO UPDATE SET partner = excluded.partner, status = excluded.status, since = excluded.since').bind(uid, o, 'enviado', at),
    db.prepare("INSERT INTO pairs (uid, partner, status, since, best) VALUES (?, ?, 'recebido', ?, 0) ON CONFLICT(uid) DO UPDATE SET partner = excluded.partner, status = 'recebido', since = excluded.since WHERE pairs.status != 'ativo'").bind(o, uid, at),
  ]);
  return ok({ ok: true });
}

export async function acceptPartner(db: DB, uid: string, now = new Date()): Promise<Ok> {
  const p = await db.prepare("SELECT partner FROM pairs WHERE uid = ? AND status = 'recebido'").bind(uid).first<{ partner: string }>();
  if (!p) return fail(404, 'Não tem nenhum convite.');
  const at = now.toISOString();
  await db.batch([
    db.prepare("UPDATE pairs SET status = 'ativo', since = ?, best = 0 WHERE uid = ?").bind(at, uid),
    db.prepare("UPDATE pairs SET status = 'ativo', since = ?, best = 0 WHERE uid = ? AND partner = ?").bind(at, p.partner, uid),
  ]);
  return ok({ ok: true });
}

export async function endPartner(db: DB, uid: string): Promise<Ok> {
  const p = await db.prepare('SELECT partner FROM pairs WHERE uid = ?').bind(uid).first<{ partner: string }>();
  await db.batch([db.prepare('DELETE FROM pairs WHERE uid = ?').bind(uid), ...(p ? [db.prepare('DELETE FROM pairs WHERE uid = ? AND partner = ?').bind(p.partner, uid)] : [])]);
  return ok({ ok: true });
}

/** Sequência a dois: dias seguidos em que os dois fizeram o ritual (hoje ainda por fazer não quebra). */
export function jointStreak(a: Record<string, { f: string; ds?: number }>, b: Record<string, { f: string; ds?: number }>, today: string) {
  let n = 0;
  for (let i = 0; i < 400; i++) {
    const d = addDays(today, -i);
    if (sDay(a[d]) && sDay(b[d])) n++;
    else if (i > 0) break;
  }
  return n;
}

export async function partnerState(db: DB, uid: string, today: string, now = new Date()) {
  const p = await db
    .prepare('SELECT pr.partner, pr.status, pr.best, pf.nick, pf.avatar FROM pairs pr JOIN profiles pf ON pf.id = pr.partner WHERE pr.uid = ?')
    .bind(uid)
    .first<{ partner: string; status: string; best: number; nick: string; avatar: string | null }>();
  if (!p) return null;
  if (p.status !== 'ativo') return { status: p.status, nick: p.nick, avatar: p.avatar, streak: 0, todayMe: false, todayThem: false };
  const since = addDays(today, -120);
  const load = async (id: string) => {
    const { results } = await db.prepare('SELECT days FROM weeks WHERE id = ? AND week >= ?').bind(id, since).all<{ days: string }>();
    return Object.assign({}, ...results.map((r) => parse(r.days))) as Record<string, { f: string; ds?: number }>;
  };
  const [a, b] = await Promise.all([load(uid), load(p.partner)]);
  const streak = jointStreak(a, b, today);
  // marcos da dupla no mural (uma vez por marco)
  const hit = PAIR_MILESTONES.filter((m) => streak >= m && m > (p.best ?? 0)).pop();
  if (hit) {
    await db.batch([
      db.prepare('UPDATE pairs SET best = ? WHERE uid = ?').bind(hit, uid),
      db.prepare('INSERT INTO feed (uid, kind, value, created) VALUES (?, ?, ?, ?)').bind(uid, 'dupla', hit, now.toISOString()),
    ]);
  }
  return { status: 'ativo', nick: p.nick, avatar: p.avatar, streak, todayMe: sDay(a[today]), todayThem: sDay(b[today]) };
}
