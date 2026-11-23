/**
 * Comunidade NEFESH Life: pontos, ligas semanais, amigos, mensagens prontas e desafios.
 * Guardado na base de dados D1 (SQLite) da Cloudflare.
 *
 * Privacidade: só alcunha, foto, pontos, sequência, nível e (se a pessoa quiser) a evolução do Índice.
 * Peso, medidas e restantes dados de saúde nunca chegam aqui.
 */

import { feedExtras, leaveTeam, partnerState, teamState } from './together';
import { recentPhotos } from './photos';
import type { Note } from './notify';
import { FULL, anomaly, bottlesOf, cleanParts, isCheckDay, overStock, proofsFor, scoreDay, type Habit, type Proofs } from './verify';

/** O subconjunto da API D1 que usamos (permite testar com SQLite local). */
export interface Stmt {
  bind(...v: unknown[]): Stmt;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}
export interface DB {
  prepare(sql: string): Stmt;
  batch(s: Stmt[]): Promise<unknown>;
}

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY, nick TEXT NOT NULL, avatar TEXT, code TEXT UNIQUE NOT NULL,
  league INTEGER NOT NULL DEFAULT 0, evo INTEGER NOT NULL DEFAULT 1,
  idx_first INTEGER, idx_now INTEGER, level INTEGER NOT NULL DEFAULT 0, streak INTEGER NOT NULL DEFAULT 0,
  result TEXT, created TEXT NOT NULL, updated TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS weeks (
  id TEXT NOT NULL, week TEXT NOT NULL, league INTEGER NOT NULL, grp INTEGER NOT NULL,
  points INTEGER NOT NULL DEFAULT 0, evo INTEGER NOT NULL DEFAULT 0, days TEXT NOT NULL DEFAULT '{}',
  updated TEXT NOT NULL, PRIMARY KEY (id, week)
);
CREATE INDEX IF NOT EXISTS weeks_group ON weeks (week, league, grp);
CREATE TABLE IF NOT EXISTS friends (a TEXT NOT NULL, b TEXT NOT NULL, created TEXT NOT NULL, PRIMARY KEY (a, b));
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT, to_id TEXT NOT NULL, from_id TEXT NOT NULL, kind TEXT NOT NULL,
  created TEXT NOT NULL, seen INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS messages_to ON messages (to_id, created);
CREATE TABLE IF NOT EXISTS challenges (
  id TEXT PRIMARY KEY, owner TEXT NOT NULL, kind TEXT NOT NULL, start TEXT NOT NULL, created TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS challenge_members (cid TEXT NOT NULL, uid TEXT NOT NULL, PRIMARY KEY (cid, uid));
CREATE TABLE IF NOT EXISTS feed (
  id INTEGER PRIMARY KEY AUTOINCREMENT, uid TEXT NOT NULL, kind TEXT NOT NULL, value INTEGER NOT NULL DEFAULT 0, created TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS feed_created ON feed (created);
CREATE TABLE IF NOT EXISTS cheers (fid INTEGER NOT NULL, uid TEXT NOT NULL, PRIMARY KEY (fid, uid));
CREATE TABLE IF NOT EXISTS push_subs (
  endpoint TEXT PRIMARY KEY, uid TEXT, device TEXT, remind TEXT, tz TEXT,
  done TEXT, sent TEXT, league_sent TEXT, msg TEXT, created TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS push_uid ON push_subs (uid);
CREATE TABLE IF NOT EXISTS proofs (uid TEXT NOT NULL, date TEXT NOT NULL, kind TEXT NOT NULL, value INTEGER NOT NULL DEFAULT 1, created TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS proofs_uid ON proofs (uid, date);
CREATE TABLE IF NOT EXISTS photo_hashes (hash TEXT PRIMARY KEY, uid TEXT NOT NULL, created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS bottles (
  id INTEGER PRIMARY KEY AUTOINCREMENT, uid TEXT NOT NULL, code TEXT, product TEXT NOT NULL, units INTEGER NOT NULL,
  verified INTEGER NOT NULL DEFAULT 0, created TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS bottles_uid ON bottles (uid);
CREATE TABLE IF NOT EXISTS bottle_codes (code TEXT PRIMARY KEY, product TEXT NOT NULL, used_by TEXT, used_at TEXT, created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS reviews (uid TEXT PRIMARY KEY, reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'aberto', created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS teams (id TEXT PRIMARY KEY, name TEXT NOT NULL, owner TEXT NOT NULL, code TEXT UNIQUE NOT NULL, created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS team_members (uid TEXT PRIMARY KEY, tid TEXT NOT NULL, joined TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS team_members_tid ON team_members (tid);
CREATE TABLE IF NOT EXISTS reactions (fid INTEGER NOT NULL, uid TEXT NOT NULL, kind TEXT NOT NULL, created TEXT NOT NULL, PRIMARY KEY (fid, uid));
CREATE TABLE IF NOT EXISTS replies (id INTEGER PRIMARY KEY AUTOINCREMENT, fid INTEGER NOT NULL, uid TEXT NOT NULL, kind TEXT NOT NULL, created TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS replies_fid ON replies (fid);
CREATE TABLE IF NOT EXISTS pairs (uid TEXT PRIMARY KEY, partner TEXT NOT NULL, status TEXT NOT NULL, since TEXT NOT NULL, best INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS photos (id TEXT PRIMARY KEY, fid INTEGER, uid TEXT NOT NULL, kind TEXT NOT NULL, data TEXT NOT NULL, created TEXT NOT NULL, hidden INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS photos_created ON photos (created);
CREATE TABLE IF NOT EXISTS photo_reports (pid TEXT NOT NULL, uid TEXT NOT NULL, created TEXT NOT NULL, PRIMARY KEY (pid, uid));
CREATE TABLE IF NOT EXISTS push_prefs (uid TEXT PRIMARY KEY, community INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS notif_once (key TEXT PRIMARY KEY, created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS push_daily (uid TEXT NOT NULL, day TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (uid, day));
CREATE TABLE IF NOT EXISTS stock_alerts (endpoint TEXT PRIMARY KEY, ends TEXT NOT NULL, notified TEXT);
CREATE TABLE IF NOT EXISTS invites (uid TEXT PRIMARY KEY, by_uid TEXT NOT NULL, created TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS invites_by ON invites (by_uid);
CREATE TABLE IF NOT EXISTS team_kinds (tid TEXT PRIMARY KEY, kind TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS coupons (
  code TEXT PRIMARY KEY, uid TEXT NOT NULL, week TEXT NOT NULL, rank INTEGER NOT NULL, points INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'atribuido', created TEXT NOT NULL, expires TEXT NOT NULL, sent_at TEXT, used_at TEXT, seen INTEGER
);
CREATE INDEX IF NOT EXISTS coupons_uid ON coupons (uid, week);
CREATE TABLE IF NOT EXISTS prize_weeks (week TEXT PRIMARY KEY, winners INTEGER NOT NULL, closed TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS contacts (uid TEXT PRIMARY KEY, email TEXT NOT NULL, updated TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS med_times (endpoint TEXT PRIMARY KEY, times TEXT NOT NULL, sent TEXT NOT NULL DEFAULT '{}');
CREATE TABLE IF NOT EXISTS reminders (endpoint TEXT NOT NULL, id TEXT NOT NULL, date TEXT NOT NULL, time TEXT NOT NULL, text TEXT NOT NULL, sent INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (endpoint, id));
CREATE TABLE IF NOT EXISTS pros (uid TEXT PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL, reg TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pendente', created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS pro_students (code TEXT PRIMARY KEY, pro TEXT NOT NULL, name TEXT NOT NULL, uid TEXT, plan TEXT, version INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'convite', created TEXT NOT NULL, updated TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS pro_students_pro ON pro_students (pro);
CREATE INDEX IF NOT EXISTS pro_students_uid ON pro_students (uid);
CREATE TABLE IF NOT EXISTS pro_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL, day TEXT NOT NULL, workout TEXT NOT NULL, data TEXT NOT NULL, created TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS pro_logs_code ON pro_logs (code, day);
CREATE TABLE IF NOT EXISTS pro_profiles (code TEXT PRIMARY KEY, data TEXT NOT NULL, updated TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS pro_drafts (code TEXT PRIMARY KEY, plan TEXT NOT NULL, updated TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS pro_assess (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL, day TEXT NOT NULL, data TEXT NOT NULL, created TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS pro_assess_code ON pro_assess (code, day);
CREATE TABLE IF NOT EXISTS pro_photos (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL, assess INTEGER NOT NULL, pose TEXT NOT NULL, data TEXT NOT NULL, created TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS pro_photos_code ON pro_photos (code, assess);
CREATE TABLE IF NOT EXISTS pro_msgs (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL, sender TEXT NOT NULL, text TEXT NOT NULL, ref TEXT NOT NULL DEFAULT '', created TEXT NOT NULL, seen INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS pro_msgs_code ON pro_msgs (code, id);
CREATE TABLE IF NOT EXISTS pro_share (code TEXT PRIMARY KEY, data TEXT NOT NULL, updated TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS pro_checkins (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL, day TEXT NOT NULL, data TEXT NOT NULL, created TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS pro_checkins_code ON pro_checkins (code, id);
CREATE TABLE IF NOT EXISTS pro_notes (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL, kind TEXT NOT NULL, day TEXT NOT NULL, time TEXT NOT NULL DEFAULT '', text TEXT NOT NULL DEFAULT '', created TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS pro_notes_code ON pro_notes (code, kind, day);
CREATE TABLE IF NOT EXISTS pro_team (key TEXT PRIMARY KEY, on_ INTEGER NOT NULL DEFAULT 0, updated TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS pro_directory (uid TEXT PRIMARY KEY, data TEXT NOT NULL, updated TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS pro_student_kind (code TEXT PRIMARY KEY, kind TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS pro_areas (uid TEXT NOT NULL, kind TEXT NOT NULL, reg TEXT NOT NULL, status TEXT NOT NULL, created TEXT NOT NULL, PRIMARY KEY (uid, kind));
CREATE TABLE IF NOT EXISTS ex_videos (k TEXT PRIMARY KEY, name TEXT NOT NULL, url TEXT NOT NULL, updated TEXT NOT NULL);
`;

/** Marcos da sequência do ritual que aparecem no mural. */
export const RITUAL_MILESTONES = [7, 14, 30, 60, 90, 180, 365];

export const LEAGUES = ['Bronze', 'Prata', 'Ouro', 'Esmeralda', 'Diamante'];
export const GROUP_SIZE = 20;
const DAY_CAP = 100;
const EVO_CAP = 150;
const CHALLENGE_BONUS = 50;

export const MESSAGE_KINDS = [
  'aplauso', 'parabens_spirulina', 'lembrete_spirulina', 'lembrete_agua', 'lembrete_treino',
  'forca', 'sequencia', 'evolucao', 'volta',
] as const;

/** Desafios: letra do hábito no registo diário, dias e meta. */
export const CHALLENGE_KINDS: Record<string, { flag: string; days: number; target: number }> = {
  ritual: { flag: 's', days: 7, target: 7 },
  agua: { flag: 'a', days: 7, target: 6 },
  treino: { flag: 't', days: 7, target: 4 },
  checkin: { flag: 'c', days: 7, target: 6 },
  passos: { flag: 'p', days: 7, target: 5 },
  // desafios combinados: a Spirulina e outro hábito no mesmo dia
  ritual_agua: { flag: 'sa', days: 7, target: 6 },
  ritual_treino: { flag: 'st', days: 7, target: 4 },
  ritual_checkin: { flag: 'sc', days: 7, target: 6 },
  ritual_refeicoes: { flag: 'sm', days: 7, target: 5 },
};
/** Durações possíveis dos desafios (dias). */
export const DURATIONS = [7, 21, 30, 90] as const;
/** Desafio principal de lançamento: 21 dias de Spirulina e água. */
export const RESET = { flag: 'sa', days: 21, target: { firme: 18, leve: 15 } } as const;
export const TEAM_SIZE_RESET = 8;

/**
 * Desafio guardado como "tipo:dias:nível" (os antigos são só "tipo", 7 dias, firme).
 * Nível "leve": 75% dos dias; "firme": a proporção do desafio de 7 dias.
 */
export function challengeDef(kind: string) {
  const [base, d, lv] = String(kind).split(':');
  const level: 'leve' | 'firme' = lv === 'leve' ? 'leve' : 'firme';
  if (base === 'reset21') return { kind: `reset21:21:${level}`, base, flag: RESET.flag, days: 21, target: RESET.target[level], level };
  const k = CHALLENGE_KINDS[base];
  if (!k) return null;
  const days = (DURATIONS as readonly number[]).includes(Number(d)) ? Number(d) : 7;
  const firm = Math.max(1, Math.round((k.target / 7) * days));
  const target = level === 'leve' ? Math.max(1, Math.round(firm * 0.75)) : firm;
  return { kind: `${base}:${days}:${level}`, base, flag: k.flag, days, target, level };
}

/** Desafio NEFESH da semana: sempre com a Spirulina (roda todas as semanas). */
const OFFICIAL = ['ritual', 'ritual_agua', 'ritual_treino', 'ritual_checkin', 'ritual_refeicoes'] as const;

type Day = { p: number; f: string };
/** dia guardado: pontos, letras declaradas, letras verificadas, Spirulina declarada e totais */
export type StoredDay = Day & { v?: string; ds?: number; dv?: number; dd?: number };
type Ok = { status: number; body: Record<string, unknown> };
const ok = (body: Record<string, unknown>): Ok => ({ status: 200, body });
const fail = (status: number, error: string): Ok => ({ status, body: { error } });

/* ---------- datas (Lisboa) ---------- */

export function lisbonDay(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
const addDays = (key: string, n: number) => {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
/** Segunda-feira da semana de um dia. */
export function weekOf(key: string) {
  const d = new Date(`${key}T12:00:00Z`);
  return addDays(key, -((d.getUTCDay() + 6) % 7));
}
export const officialChallenge = (week: string) => {
  const n = Math.floor(new Date(`${week}T12:00:00Z`).getTime() / (7 * 86400000));
  return OFFICIAL[((n % OFFICIAL.length) + OFFICIAL.length) % OFFICIAL.length];
};

/* ---------- utilidades ---------- */

const randomCode = () => {
  const abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  return [...crypto.getRandomValues(new Uint8Array(6))].map((x) => abc[x % abc.length]).join('');
};
const cleanNick = (v: unknown) => String(v ?? '').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, 24);
const cleanAvatar = (v: unknown) => (typeof v === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v) && v.length <= 120_000 ? v : null);
const parseDays = (s: unknown): Record<string, Day> => {
  try {
    return typeof s === 'string' ? JSON.parse(s) : {};
  } catch {
    return {};
  }
};

/** Limpa os dias enviados pela app: só datas desta semana, pontos limitados, letras conhecidas. */
export function cleanDays(raw: unknown, week: string, today: string): Record<string, Day> {
  const out: Record<string, Day> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw as Record<string, Day>)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || k < week || k > addDays(today, 1) || k > addDays(week, 6)) continue;
    const p = Math.max(0, Math.min(DAY_CAP, Math.round(Number(v?.p) || 0)));
    const f = [...new Set(String(v?.f ?? '').replace(/[^sacmtpn]/g, ''))].join('');
    out[k] = { p, f };
  }
  return out;
}

/** Quantos dias com todas as letras pedidas (ex.: 'sa' = Spirulina e água) entre duas datas. */
export function countFlag(days: Record<string, Day>, flag: string, from: string, to: string) {
  return Object.entries(days).filter(([k, d]) => k >= from && k <= to && [...flag].every((x) => d.f.includes(x))).length;
}

/* ---------- perfil ---------- */

export async function getProfile(db: DB, id: string) {
  return db.prepare('SELECT * FROM profiles WHERE id = ?').bind(id).first<Record<string, unknown>>();
}

export async function upsertProfile(db: DB, id: string, b: Record<string, unknown>, now = new Date()): Promise<Ok> {
  const nick = cleanNick(b.nick);
  if (nick.length < 2) return fail(400, 'Escolha uma alcunha com pelo menos 2 letras.');
  const avatar = cleanAvatar(b.avatar);
  const evo = b.evo === false ? 0 : 1;
  const at = now.toISOString();
  const cur = await getProfile(db, id);
  if (cur) {
    await db.prepare('UPDATE profiles SET nick = ?, avatar = ?, evo = ?, updated = ? WHERE id = ?').bind(nick, avatar, evo, at, id).run();
    return ok({ code: cur.code });
  }
  let code = randomCode();
  for (let i = 0; i < 5 && (await db.prepare('SELECT 1 FROM profiles WHERE code = ?').bind(code).first()); i++) code = randomCode();
  await db.batch([
    db.prepare('INSERT INTO profiles (id, nick, avatar, code, evo, created, updated) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(id, nick, avatar, code, evo, at, at),
    db.prepare('INSERT INTO feed (uid, kind, value, created) VALUES (?, ?, 0, ?)').bind(id, 'entrou', at),
  ]);
  return ok({ code });
}

/** Atualiza só a foto (ou a remove, com avatar vazio): a app chama sempre que a foto do Perfil muda. */
export async function updateAvatar(db: DB, id: string, avatarRaw: unknown, now = new Date()): Promise<Ok> {
  if (!(await getProfile(db, id))) return fail(404, 'Entre primeiro na comunidade.');
  const avatar = avatarRaw ? cleanAvatar(avatarRaw) : null;
  if (avatarRaw && !avatar) return fail(400, 'Foto inválida ou demasiado grande.');
  await db.prepare('UPDATE profiles SET avatar = ?, updated = ? WHERE id = ?').bind(avatar, now.toISOString(), id).run();
  return ok({ ok: true });
}

/** Sair da comunidade: apaga tudo o que está na D1 sobre a pessoa. */
export async function leave(db: DB, id: string): Promise<Ok> {
  await db.batch([
    db.prepare('DELETE FROM profiles WHERE id = ?').bind(id),
    db.prepare('DELETE FROM weeks WHERE id = ?').bind(id),
    db.prepare('DELETE FROM friends WHERE a = ? OR b = ?').bind(id, id),
    db.prepare('DELETE FROM messages WHERE to_id = ? OR from_id = ?').bind(id, id),
    db.prepare('DELETE FROM challenge_members WHERE uid = ?').bind(id),
    db.prepare('DELETE FROM invites WHERE uid = ? OR by_uid = ?').bind(id, id),
    db.prepare('DELETE FROM contacts WHERE uid = ?').bind(id),
    db.prepare('DELETE FROM challenges WHERE owner = ?').bind(id),
    db.prepare('DELETE FROM cheers WHERE uid = ? OR fid IN (SELECT id FROM feed WHERE uid = ?)').bind(id, id),
    db.prepare('DELETE FROM feed WHERE uid = ?').bind(id),
    db.prepare('DELETE FROM proofs WHERE uid = ?').bind(id),
    db.prepare('DELETE FROM bottles WHERE uid = ?').bind(id),
    db.prepare('DELETE FROM reviews WHERE uid = ?').bind(id),
    db.prepare('DELETE FROM photo_hashes WHERE uid = ?').bind(id),
    db.prepare('DELETE FROM reactions WHERE uid = ?').bind(id),
    db.prepare('DELETE FROM replies WHERE uid = ?').bind(id),
    db.prepare('DELETE FROM pairs WHERE uid = ? OR partner = ?').bind(id, id),
  ]);
  await leaveTeam(db, id);
  await db.batch([db.prepare('DELETE FROM photo_reports WHERE pid IN (SELECT id FROM photos WHERE uid = ?)').bind(id), db.prepare('DELETE FROM photos WHERE uid = ?').bind(id), db.prepare('DELETE FROM photo_reports WHERE uid = ?').bind(id)]);
  return ok({ ok: true });
}

/* ---------- pontos e ligas ---------- */

/** Fecha a semana anterior: sobe, desce ou mantém a liga conforme a posição no grupo. */
async function settlePrevious(db: DB, id: string, week: string, league: number) {
  const prevWeek = addDays(week, -7);
  const mine = await db.prepare('SELECT league, grp, points FROM weeks WHERE id = ? AND week = ?').bind(id, prevWeek).first<{ league: number; grp: number; points: number }>();
  if (!mine) return { league, result: null };
  const { results } = await db
    .prepare('SELECT id, points FROM weeks WHERE week = ? AND league = ? AND grp = ? ORDER BY points DESC, updated ASC')
    .bind(prevWeek, mine.league, mine.grp)
    .all<{ id: string; points: number }>();
  const n = results.length;
  const rank = results.findIndex((r) => r.id === id) + 1;
  const up = Math.max(1, Math.ceil(n * 0.2));
  let change = 0;
  if (rank <= up && mine.points >= 150 && n >= 2) change = 1;
  else if (mine.points < 50 || (n >= 8 && rank > n - Math.floor(n * 0.2))) change = -1;
  const next = Math.max(0, Math.min(LEAGUES.length - 1, mine.league + change));
  return { league: next, result: { week: prevWeek, rank, n, points: mine.points, from: mine.league, to: next } };
}

export interface SyncBody {
  days?: unknown;
  evo?: unknown;
  streak?: unknown;
  level?: unknown;
  idx?: unknown;
  /** Índice da primeira avaliação */
  idxFirst?: unknown;
  /** unidades de 0,5 g por dia no plano (para o stock) */
  dose?: unknown;
}

export type HealthDays = Record<string, { steps?: number; sleepH?: number; exMin?: number }>;

/** Guarda os pontos da semana atual (a app envia os dias de segunda até hoje). */
export async function sync(db: DB, id: string, b: SyncBody, now = new Date(), health: HealthDays = {}, notes: Note[] = []): Promise<Ok> {
  const prof = await getProfile(db, id);
  if (!prof) return fail(404, 'Entre primeiro na comunidade.');
  const today = lisbonDay(now);
  const week = weekOf(today);
  // o servidor calcula os pontos: a app só diz o que foi feito; as provas vêm do servidor
  const flagsIn = cleanDays(b.days, week, today);
  const raw = (b.days && typeof b.days === 'object' ? b.days : {}) as Record<string, { parts?: unknown; f?: string }>;
  const proofs = await proofsFor(db, id, week, today);
  const dose = Math.max(1, Math.min(12, Math.round(Number(b.dose) || 4)));
  const streakIn = Math.max(0, Math.min(3650, Math.round(Number(b.streak) || 0)));
  // dias anteriores com Spirulina (para o stock)
  const { results: hist } = await db.prepare('SELECT days FROM weeks WHERE id = ? AND week < ?').bind(id, week).all<{ days: string }>();
  const sDates: string[] = [];
  for (const h of hist) for (const [d, v] of Object.entries(parseDays(h.days) as Record<string, StoredDay>)) if ((v.ds ?? (v.f.includes('s') ? 1 : 0)) > 0) sDates.push(d);
  const parts: Record<string, Record<Habit, number>> = {};
  for (const d of Object.keys(flagsIn)) {
    const fromFlags = Object.fromEntries((Object.keys(FULL) as Habit[]).map((k) => [k, flagsIn[d].f.includes(k) ? FULL[k] : 0]));
    parts[d] = cleanParts(raw[d]?.parts ?? fromFlags);
    if (parts[d].s > 0) sDates.push(d);
  }
  const over = overStock(sDates, dose, await bottlesOf(db, id));
  const days: Record<string, StoredDay> = {};
  for (const d of Object.keys(parts).sort()) {
    const pr: Proofs = { ...(proofs.get(d) ?? { meals: 0, spirulinaPhoto: false }), ...(health[d] ?? {}) };
    const check = await isCheckDay(id, d);
    const sOk = !over.has(d) && (!check || pr.spirulinaPhoto);
    const sc = scoreDay(parts[d], pr, sOk, streakIn);
    days[d] = { p: sc.points, f: flagsIn[d].f, v: sc.v, ds: parts[d].s, dv: sc.verified, dd: sc.declared };
  }
  const evo = Math.max(0, Math.min(EVO_CAP, Math.round(Number(b.evo) || 0)));
  const official = CHALLENGE_KINDS[officialChallenge(week)];
  const bonus = countFlag(days, official.flag, week, addDays(week, 6)) >= official.target - 1 ? CHALLENGE_BONUS : 0;
  const points = Object.values(days).reduce((t, d) => t + d.p, 0) + evo + bonus;
  // desafio da semana cumprido: aparece no mural (uma vez por semana)
  if (bonus && !(await db.prepare("SELECT 1 FROM feed WHERE uid = ? AND kind = 'desafio' AND created >= ?").bind(id, `${week}T00:00:00`).first())) {
    await db.prepare("INSERT INTO feed (uid, kind, value, created) VALUES (?, 'desafio', 0, ?)").bind(id, now.toISOString()).run();
  }
  // sinais de fraude: a pessoa sai do ranking dos outros até a equipa rever
  const repeated = [...proofs.values()].reduce((t, p) => t + p.repeated, 0);
  const reason = anomaly(Object.values(days).map((d) => ({ declared: d.dd ?? 0, verified: d.dv ?? 0 })), repeated);
  if (reason) await db.prepare("INSERT OR IGNORE INTO reviews (uid, reason, status, created) VALUES (?, ?, 'aberto', ?)").bind(id, reason, now.toISOString()).run();
  const at = now.toISOString();
  const row = await db.prepare('SELECT league, grp, points, days FROM weeks WHERE id = ? AND week = ?').bind(id, week).first<{ league: number; grp: number; points: number; days: string }>();
  const stmts: Stmt[] = [];
  const nick = String(prof.nick);
  // --- notificações da comunidade (enviadas depois de guardar) ---
  const prevDays = parseDays(row?.days) as Record<string, StoredDay>;
  const tookNow = (days[today]?.ds ?? 0) > 0;
  const tookBefore = (prevDays[today]?.ds ?? (prevDays[today]?.f?.includes('s') ? 1 : 0)) > 0;
  if (tookNow && !tookBefore) {
    // o parceiro de ritual ainda não tomou: só falta ele
    const pair = await db.prepare("SELECT partner FROM pairs WHERE uid = ? AND status = 'ativo'").bind(id).first<{ partner: string }>();
    if (pair) {
      const pr = await db.prepare('SELECT days FROM weeks WHERE id = ? AND week = ?').bind(pair.partner, week).first<{ days: string }>();
      const pd = (parseDays(pr?.days) as Record<string, StoredDay>)[today];
      if (!pd || !((pd.ds ?? 0) > 0 || pd.f.includes('s')))
        notes.push({ to: pair.partner, once: `parceiro:${pair.partner}:${today}`, msg: { title: `${nick} já tomou a Spirulina 🌿`, body: 'Só falta você para a sequência a dois continuar!', tag: 'nefesh-parceiro' } });
    }
  }
  if (row) {
    // ultrapassagem na liga: avisa quem ficou para trás
    const { results: others } = await db
      .prepare('SELECT id, points FROM weeks WHERE week = ? AND league = ? AND grp = ? AND id != ?')
      .bind(week, row.league, row.grp, id)
      .all<{ id: string; points: number }>();
    for (const o of others)
      if (row.points <= o.points && points > o.points)
        notes.push({ to: o.id, once: `ultrapassado:${o.id}:${id}:${today}`, msg: { title: `${nick} passou à sua frente na liga 🏆`, body: 'Ainda vai a tempo: cada hábito de hoje conta.', tag: 'nefesh-liga' } });
  }
  let league = Number(prof.league) || 0;
  if (row) {
    stmts.push(db.prepare('UPDATE weeks SET points = ?, evo = ?, days = ?, updated = ? WHERE id = ? AND week = ?').bind(points, evo, JSON.stringify(days), at, id, week));
  } else {
    // primeira vez esta semana: fecha a anterior e entra num grupo de até 20 pessoas da mesma liga
    const s = await settlePrevious(db, id, week, league);
    league = s.league;
    if (s.result && s.result.to > s.result.from)
      notes.push({ to: id, once: `liga:${id}:${week}`, msg: { title: `Subiu para a liga ${LEAGUES[s.result.to]}! 🎉`, body: `Ficou em ${s.result.rank}.º na semana passada. Boa semana!`, tag: 'nefesh-liga' } });
    const c = await db.prepare('SELECT COUNT(*) AS n FROM weeks WHERE week = ? AND league = ?').bind(week, league).first<{ n: number }>();
    const grp = Math.floor((c?.n ?? 0) / GROUP_SIZE);
    stmts.push(db.prepare('INSERT INTO weeks (id, week, league, grp, points, evo, days, updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(id, week, league, grp, points, evo, JSON.stringify(days), at));
    stmts.push(db.prepare('UPDATE profiles SET league = ?, result = ? WHERE id = ?').bind(league, s.result ? JSON.stringify(s.result) : null, id));
  }
  const num = (v: unknown) => {
    const n = Number(v);
    return v !== null && v !== undefined && v !== '' && Number.isFinite(n) && n >= 0 && n <= 100 ? Math.round(n) : null;
  };
  const idx = num(b.idx);
  const idxFirst = num(b.idxFirst) ?? idx;
  // conquistas para o mural
  const newStreak = streakIn;
  const newLevel = Math.max(0, Math.min(20, Math.round(Number(b.level) || 0)));
  const ev = (kind: string, value: number) => db.prepare('INSERT INTO feed (uid, kind, value, created) VALUES (?, ?, ?, ?)').bind(id, kind, value, at);
  const prevStreak = Number(prof.streak) || 0;
  const hit = RITUAL_MILESTONES.filter((m) => prevStreak < m && newStreak >= m).pop();
  if (hit) stmts.push(ev('ritual', hit));
  if (newLevel > (Number(prof.level) || 0)) stmts.push(ev('nivel', newLevel));
  const prevIdx = prof.idx_now === null || prof.idx_now === undefined ? null : Number(prof.idx_now);
  if (prof.evo && idx !== null && prevIdx !== null && idx > prevIdx) stmts.push(ev('indice', idx - prevIdx));
  if (league > (Number(prof.league) || 0)) stmts.push(ev('liga', league));
  stmts.push(
    db
      .prepare('UPDATE profiles SET streak = ?, level = ?, idx_now = COALESCE(?, idx_now), idx_first = COALESCE(idx_first, ?), updated = ? WHERE id = ?')
      .bind(newStreak, newLevel, idx, idxFirst, at, id),
  );
  await db.batch(stmts);
  if (hit) {
    const { results: fr } = await db.prepare('SELECT b AS id FROM friends WHERE a = ?').bind(id).all<{ id: string }>();
    for (const f of fr)
      notes.push({ to: f.id, once: `marco:${id}:${hit}:${f.id}`, msg: { title: `${nick} chegou aos ${hit} dias de ritual! 🎉`, body: 'Dê-lhe os parabéns no mural da comunidade.', tag: 'nefesh-mural' } });
  }
  if (tookNow && !tookBefore) {
    // meta da equipa: quase lá (falta 1 dia) ou cumprida
    const tm = await db.prepare('SELECT tid FROM team_members WHERE uid = ?').bind(id).first<{ tid: string }>();
    if (tm) {
      const { results: mem } = await db
        .prepare('SELECT tm.uid, w.days FROM team_members tm LEFT JOIN weeks w ON w.id = tm.uid AND w.week = ? WHERE tm.tid = ?')
        .bind(week, tm.tid)
        .all<{ uid: string; days: string | null }>();
      const goal = mem.length * 5;
      const done = mem.reduce((t, m) => t + Object.values(parseDays(m.days) as Record<string, StoredDay>).filter((d) => (d.ds ?? 0) > 0 || d.f.includes('s')).length, 0);
      for (const m of mem) {
        if (done >= goal) notes.push({ to: m.uid, once: `equipa-meta:${tm.tid}:${week}:${m.uid}`, msg: { title: 'A vossa equipa cumpriu a meta da semana! 🏅', body: `${done} dias de ritual somados. Que equipa!`, tag: 'nefesh-equipa' } });
        else if (done === goal - 1 && m.uid !== id) notes.push({ to: m.uid, once: `equipa-quase:${tm.tid}:${week}:${m.uid}`, msg: { title: 'Falta 1 dia de ritual para a meta da equipa 💪', body: 'A sua toma de hoje pode fechar a meta.', tag: 'nefesh-equipa' } });
      }
    }
  }
  return ok({ points, league, bonus, review: !!reason });
}

/* ---------- amigos e mensagens ---------- */

const areFriends = async (db: DB, a: string, b: string) => !!(await db.prepare('SELECT 1 FROM friends WHERE a = ? AND b = ?').bind(a, b).first());

export async function addFriend(db: DB, id: string, codeRaw: unknown, now = new Date()): Promise<Ok> {
  const code = String(codeRaw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const other = await db.prepare('SELECT id, nick FROM profiles WHERE code = ?').bind(code).first<{ id: string; nick: string }>();
  if (!other) return fail(404, 'Não encontrámos ninguém com esse código.');
  if (other.id === id) return fail(400, 'Esse é o seu próprio código.');
  if (!(await getProfile(db, id))) return fail(404, 'Entre primeiro na comunidade.');
  const c = await db.prepare('SELECT COUNT(*) AS n FROM friends WHERE a = ?').bind(id).first<{ n: number }>();
  if ((c?.n ?? 0) >= 200) return fail(400, 'Chegou ao limite de amigos.');
  const at = now.toISOString();
  await db.batch([
    db.prepare('INSERT OR IGNORE INTO friends (a, b, created) VALUES (?, ?, ?)').bind(id, other.id, at),
    db.prepare('INSERT OR IGNORE INTO friends (a, b, created) VALUES (?, ?, ?)').bind(other.id, id, at),
  ]);
  return ok({ nick: other.nick });
}

/**
 * Entrar por um link de convite: fica amigo de quem convidou, regista quem convidou
 * (para medir convites) e, se o link for de um 21 Day Reset, entra nesse Reset.
 */
export async function acceptInvite(db: DB, id: string, codeRaw: unknown, cidRaw: unknown, now = new Date()): Promise<Ok> {
  const code = String(codeRaw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const inviter = await db.prepare('SELECT id, nick FROM profiles WHERE code = ?').bind(code).first<{ id: string; nick: string }>();
  if (!inviter) return fail(404, 'Este convite já não é válido.');
  if (inviter.id === id) return ok({ self: true });
  const f = await addFriend(db, id, code, now);
  if (f.status !== 200) return f;
  await db.prepare('INSERT OR IGNORE INTO invites (uid, by_uid, created) VALUES (?, ?, ?)').bind(id, inviter.id, now.toISOString()).run();
  let joined = false;
  const cid = String(cidRaw ?? '').replace(/[^a-f0-9]/g, '').slice(0, 32);
  if (cid) {
    const c = await db.prepare('SELECT id, kind, start, owner FROM challenges WHERE id = ?').bind(cid).first<{ id: string; kind: string; start: string; owner: string }>();
    const def = c ? challengeDef(c.kind) : null;
    const isMember = c ? await db.prepare('SELECT 1 FROM challenge_members WHERE cid = ? AND uid = ?').bind(c.id, inviter.id).first() : null;
    if (c && def && def.base === 'reset21' && isMember && addDays(c.start, def.days - 1) >= lisbonDay(now)) {
      const n = await db.prepare('SELECT COUNT(*) AS n FROM challenge_members WHERE cid = ?').bind(c.id).first<{ n: number }>();
      if ((n?.n ?? 0) < TEAM_SIZE_RESET) {
        await db.prepare('INSERT OR IGNORE INTO challenge_members (cid, uid) VALUES (?, ?)').bind(c.id, id).run();
        joined = true;
      }
    }
  }
  return ok({ nick: inviter.nick, joined });
}

/** Números da comunidade para a página de estatísticas (só contagens). */
export async function communityStats(db: DB) {
  const n = async (q: string) => Number((await db.prepare(q).first<{ n: number }>())?.n ?? 0);
  return {
    members: await n('SELECT COUNT(*) AS n FROM profiles'),
    invites: await n('SELECT COUNT(*) AS n FROM invites'),
    inviters: await n('SELECT COUNT(DISTINCT by_uid) AS n FROM invites'),
    resets: await n("SELECT COUNT(*) AS n FROM challenges WHERE kind LIKE 'reset21%'"),
    resetPeople: await n("SELECT COUNT(*) AS n FROM challenge_members m JOIN challenges c ON c.id = m.cid WHERE c.kind LIKE 'reset21%'"),
    resetDone: await n("SELECT COUNT(*) AS n FROM feed WHERE kind = 'reset'"),
    challenges: await n("SELECT COUNT(*) AS n FROM challenges WHERE kind NOT LIKE 'reset21%'"),
    circles: await n('SELECT COUNT(*) AS n FROM teams'),
  };
}

export async function removeFriend(db: DB, id: string, other: unknown): Promise<Ok> {
  const o = String(other ?? '');
  await db.batch([
    db.prepare('DELETE FROM friends WHERE a = ? AND b = ?').bind(id, o),
    db.prepare('DELETE FROM friends WHERE a = ? AND b = ?').bind(o, id),
  ]);
  return ok({ ok: true });
}

export async function sendMessage(db: DB, id: string, to: unknown, kind: unknown, now = new Date()): Promise<Ok> {
  const t = String(to ?? '');
  const k = String(kind ?? '');
  if (!(MESSAGE_KINDS as readonly string[]).includes(k)) return fail(400, 'Mensagem desconhecida.');
  if (!(await areFriends(db, id, t))) return fail(403, 'Só pode enviar mensagens a amigos.');
  const since = new Date(now.getTime() - 86400000).toISOString();
  const a = await db.prepare('SELECT COUNT(*) AS n FROM messages WHERE from_id = ? AND to_id = ? AND created > ?').bind(id, t, since).first<{ n: number }>();
  if ((a?.n ?? 0) >= 3) return fail(429, 'Já enviou 3 mensagens a este amigo hoje.');
  const b = await db.prepare('SELECT COUNT(*) AS n FROM messages WHERE from_id = ? AND created > ?').bind(id, since).first<{ n: number }>();
  if ((b?.n ?? 0) >= 40) return fail(429, 'Chegou ao limite de mensagens de hoje.');
  await db.prepare('INSERT INTO messages (to_id, from_id, kind, created) VALUES (?, ?, ?, ?)').bind(t, id, k, now.toISOString()).run();
  return ok({ ok: true });
}

/** Aplauso a uma conquista do mural (um por pessoa). */
export async function cheer(db: DB, id: string, fid: unknown): Promise<Ok> {
  const f = Math.round(Number(fid));
  const item = await db.prepare('SELECT uid FROM feed WHERE id = ?').bind(f).first<{ uid: string }>();
  if (!item) return fail(404, 'Esta conquista já não existe.');
  if (item.uid === id) return fail(400, 'Não pode aplaudir as suas próprias conquistas.');
  await db.prepare('INSERT OR IGNORE INTO cheers (fid, uid) VALUES (?, ?)').bind(f, id).run();
  return ok({ ok: true });
}

export async function markSeen(db: DB, id: string): Promise<Ok> {
  await db.prepare('UPDATE messages SET seen = 1 WHERE to_id = ? AND seen = 0').bind(id).run();
  return ok({ ok: true });
}

/* ---------- desafios entre amigos ---------- */

export async function createChallenge(db: DB, id: string, kind: unknown, friends: unknown, now = new Date()): Promise<Ok> {
  const def = challengeDef(String(kind ?? ''));
  if (!def) return fail(400, 'Desafio desconhecido.');
  const k = def.kind;
  const ids = Array.isArray(friends) ? [...new Set(friends.map(String))].slice(0, 20) : [];
  const valid: string[] = [];
  for (const f of ids) if (await areFriends(db, id, f)) valid.push(f);
  // o 21 Day Reset pode começar a solo (e convidar amigos depois); os outros pedem amigos
  if (!valid.length && def.base !== 'reset21') return fail(400, 'Escolha pelo menos um amigo.');
  if (def.base === 'reset21') {
    const active = await db
      .prepare("SELECT c.id FROM challenges c JOIN challenge_members m ON m.cid = c.id WHERE m.uid = ? AND c.kind LIKE 'reset21%' AND c.start >= ?")
      .bind(id, addDays(lisbonDay(now), -20))
      .first();
    if (active) return fail(409, 'Já está num 21 Day Reset.');
  }
  const cid = [...crypto.getRandomValues(new Uint8Array(8))].map((x) => x.toString(16).padStart(2, '0')).join('');
  const start = lisbonDay(now);
  await db.batch([
    db.prepare('INSERT INTO challenges (id, owner, kind, start, created) VALUES (?, ?, ?, ?, ?)').bind(cid, id, k, start, now.toISOString()),
    ...[id, ...valid].map((u) => db.prepare('INSERT OR IGNORE INTO challenge_members (cid, uid) VALUES (?, ?)').bind(cid, u)),
  ]);
  return ok({ id: cid });
}

export async function leaveChallenge(db: DB, id: string, cid: unknown): Promise<Ok> {
  await db.prepare('DELETE FROM challenge_members WHERE cid = ? AND uid = ?').bind(String(cid ?? ''), id).run();
  return ok({ ok: true });
}

/** Dias (com letras) de várias pessoas entre duas semanas. */
async function daysOf(db: DB, ids: string[], weeks: string[]) {
  const out = new Map<string, Record<string, Day>>();
  if (!ids.length) return out;
  const q = `SELECT id, days FROM weeks WHERE id IN (${ids.map(() => '?').join(',')}) AND week IN (${weeks.map(() => '?').join(',')})`;
  const { results } = await db.prepare(q).bind(...ids, ...weeks).all<{ id: string; days: string }>();
  for (const r of results) out.set(r.id, { ...(out.get(r.id) ?? {}), ...parseDays(r.days) });
  return out;
}

/* ---------- estado completo para o ecrã Comunidade ---------- */

export async function state(db: DB, id: string, now = new Date()): Promise<Ok> {
  const me = await getProfile(db, id);
  if (!me) return ok({ joined: false });
  const today = lisbonDay(now);
  const week = weekOf(today);
  const mine = await db.prepare('SELECT league, grp, points FROM weeks WHERE id = ? AND week = ?').bind(id, week).first<{ league: number; grp: number; points: number }>();

  // liga desta semana
  let league: unknown[] = [];
  if (mine) {
    const { results } = await db
      .prepare(
        `SELECT w.id, w.points, p.nick, p.avatar, p.streak, p.level FROM weeks w JOIN profiles p ON p.id = w.id
         WHERE w.week = ? AND w.league = ? AND w.grp = ?
           AND (w.id = ? OR w.id NOT IN (SELECT uid FROM reviews WHERE status = 'aberto'))
         ORDER BY w.points DESC, w.updated ASC LIMIT 50`,
      )
      .bind(week, mine.league, mine.grp, id)
      .all<Record<string, unknown>>();
    league = results.map((r, i) => ({ rank: i + 1, me: r.id === id, nick: r.nick, avatar: r.avatar, points: r.points, streak: r.streak, level: r.level, id: r.id }));
  }

  // amigos
  const { results: fr } = await db
    .prepare(
      `SELECT p.id, p.nick, p.avatar, p.streak, p.level, p.league, w.points, w.days FROM friends f
       JOIN profiles p ON p.id = f.b LEFT JOIN weeks w ON w.id = p.id AND w.week = ?
       WHERE f.a = ? ORDER BY COALESCE(w.points, 0) DESC LIMIT 200`,
    )
    .bind(week, id)
    .all<Record<string, unknown>>();
  const friends = fr.map((r) => ({
    id: r.id,
    nick: r.nick,
    avatar: r.avatar,
    streak: r.streak,
    level: r.level,
    league: r.league,
    points: r.points ?? 0,
    today: parseDays(r.days)[today]?.f ?? '',
  }));

  // mensagens dos últimos 14 dias
  const since = new Date(now.getTime() - 14 * 86400000).toISOString();
  const { results: msgs } = await db
    .prepare(`SELECT m.id, m.kind, m.created, m.seen, p.nick, p.avatar, m.from_id FROM messages m LEFT JOIN profiles p ON p.id = m.from_id WHERE m.to_id = ? AND m.created > ? ORDER BY m.created DESC LIMIT 50`)
    .bind(id, since)
    .all<Record<string, unknown>>();

  // desafios (ativos ou terminados há menos de 7 dias)
  const { results: ch } = await db
    .prepare(`SELECT c.id, c.kind, c.start, c.owner FROM challenges c JOIN challenge_members m ON m.cid = c.id WHERE m.uid = ? AND c.start >= ? ORDER BY c.start DESC LIMIT 12`)
    .bind(id, addDays(today, -97))
    .all<{ id: string; kind: string; start: string; owner: string }>();
  const challenges = [];
  for (const c of ch) {
    const def = challengeDef(c.kind);
    if (!def) continue;
    const end = addDays(c.start, def.days - 1);
    // terminados há mais de 7 dias já não aparecem
    if (end < addDays(today, -7)) continue;
    const { results: mem } = await db
      .prepare('SELECT p.id, p.nick, p.avatar FROM challenge_members m JOIN profiles p ON p.id = m.uid WHERE m.cid = ?')
      .bind(c.id)
      .all<{ id: string; nick: string; avatar: string | null }>();
    const weeks: string[] = [];
    for (let w = weekOf(c.start); w <= weekOf(end < today ? end : today); w = addDays(w, 7)) weeks.push(w);
    const ds = await daysOf(db, mem.map((m) => m.id), weeks);
    const myDone = countFlag(ds.get(id) ?? {}, def.flag, c.start, end);
    // Reset cumprido: aparece no mural (uma vez)
    if (def.base === 'reset21' && myDone >= def.target) {
      const key = `reset:${c.id}:${id}`;
      if (!(await db.prepare('SELECT 1 FROM notif_once WHERE key = ?').bind(key).first())) {
        await db.batch([
          db.prepare('INSERT INTO notif_once (key, created) VALUES (?, ?)').bind(key, new Date().toISOString()),
          db.prepare("INSERT INTO feed (uid, kind, value, created) VALUES (?, 'reset', 21, ?)").bind(id, new Date().toISOString()),
        ]);
      }
    }
    challenges.push({
      id: c.id,
      kind: def.base,
      level: def.level,
      start: c.start,
      end,
      target: def.target,
      days: def.days,
      day: Math.max(1, Math.min(def.days, Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${c.start}T12:00:00Z`)) / 86400000) + 1)),
      mine: c.owner === id,
      members: mem
        .map((m) => ({ id: m.id, me: m.id === id, nick: m.nick, avatar: m.avatar, done: countFlag(ds.get(m.id) ?? {}, def.flag, c.start, end) }))
        .sort((a, b) => b.done - a.done),
    });
  }

  // mural: conquistas dos amigos, da liga e minhas (últimos 14 dias)
  const leagueIds = (league as { id: string }[]).map((m) => m.id);
  const circle = [...new Set([id, ...friends.map((f) => String(f.id)), ...leagueIds])].slice(0, 200);
  const { results: fd } = await db
    .prepare(
      `SELECT f.id, f.uid, f.kind, f.value, f.created, p.nick, p.avatar,
        (SELECT COUNT(*) FROM cheers c WHERE c.fid = f.id) AS cheers,
        (SELECT COUNT(*) FROM cheers c WHERE c.fid = f.id AND c.uid = ?) AS mine
       FROM feed f JOIN profiles p ON p.id = f.uid
       WHERE f.uid IN (${circle.map(() => '?').join(',')}) AND f.created > ? AND f.kind NOT LIKE 'foto-%' ORDER BY f.created DESC LIMIT 40`,
    )
    .bind(id, ...circle, since)
    .all<Record<string, unknown>>();
  const extras = await feedExtras(db, id, fd.map((r) => Number(r.id)));
  const feed = fd.map((r) => {
    const x = extras.get(Number(r.id));
    return { id: r.id, me: r.uid === id, kind: r.kind, value: r.value, created: r.created, nick: r.nick, avatar: r.avatar, cheers: Number(r.cheers) || 0, cheered: Number(r.mine) > 0, reactions: x?.reactions ?? {}, myReaction: x?.mine ?? null, replies: x?.replies ?? [] };
  });
  const teams = await teamState(db, id, week, today);
  // momentos com foto (24 h, toda a comunidade), com as reações de cada um
  const ph = await recentPhotos(db, id, now);
  const phx = await feedExtras(db, id, ph.map((x) => x.fid).filter(Boolean));
  const photos = ph.map((x) => ({ ...x, reactions: phx.get(x.fid)?.reactions ?? {}, myReaction: phx.get(x.fid)?.mine ?? null }));
  const partner = await partnerState(db, id, today, now);

  // desafio oficial da semana
  const okind = officialChallenge(week);
  const odef = CHALLENGE_KINDS[okind];
  const myDays = (await daysOf(db, [id], [week])).get(id) ?? {};

  // verificação de hoje
  const todayRow = await db.prepare('SELECT days FROM weeks WHERE id = ? AND week = ?').bind(id, week).first<{ days: string }>();
  const td = (parseDays(todayRow?.days) as Record<string, StoredDay>)[today];
  const tp = (await proofsFor(db, id, today, today)).get(today);
  const review = await db.prepare("SELECT reason FROM reviews WHERE uid = ? AND status = 'aberto'").bind(id).first<{ reason: string }>();
  const verify = {
    points: td?.p ?? 0,
    verified: td?.dv ?? 0,
    declared: td?.dd ?? 0,
    v: td?.v ?? '',
    checkDay: await isCheckDay(id, today),
    spirulinaPhoto: !!tp?.spirulinaPhoto,
    meals: tp?.meals ?? 0,
    review: !!review,
  };

  return ok({
    joined: true,
    verify,
    me: { nick: me.nick, avatar: me.avatar, code: me.code, league: me.league, evo: !!me.evo, streak: me.streak, level: me.level, points: mine?.points ?? 0, result: me.result ? JSON.parse(String(me.result)) : null },
    week,
    leagueName: LEAGUES[Number(mine?.league ?? me.league) || 0],
    league,
    friends,
    messages: msgs.map((m) => ({ id: m.id, kind: m.kind, created: m.created, seen: !!m.seen, nick: m.nick ?? 'Ex-membro', avatar: m.avatar, from: m.from_id })),
    challenges,
    feed,
    photos,
    team: teams.team,
    teams: teams.ranking,
    partner,
    official: { kind: okind, target: odef.target - 1, done: countFlag(myDays, odef.flag, week, addDays(week, 6)), bonus: CHALLENGE_BONUS },
  });
}

/** Ranking de evolução do Índice NEFESH (quem aceitou aparecer). */
export async function evolution(db: DB): Promise<Ok> {
  const { results } = await db
    .prepare(
      `SELECT nick, avatar, idx_first, idx_now, (idx_now - idx_first) AS gain FROM profiles
       WHERE evo = 1 AND idx_first IS NOT NULL AND idx_now IS NOT NULL ORDER BY gain DESC, idx_now DESC LIMIT 50`,
    )
    .all<Record<string, unknown>>();
  return ok({ ranking: results.map((r, i) => ({ rank: i + 1, nick: r.nick, avatar: r.avatar, from: r.idx_first, to: r.idx_now, gain: r.gain })) });
}

/** Marca a última promoção como vista (para não repetir a celebração). */
export async function clearResult(db: DB, id: string): Promise<Ok> {
  await db.prepare('UPDATE profiles SET result = NULL WHERE id = ?').bind(id).run();
  return ok({ ok: true });
}
