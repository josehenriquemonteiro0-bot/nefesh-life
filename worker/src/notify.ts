/**
 * Notificações da comunidade (o parceiro já tomou, meta da equipa, marcos de amigos,
 * momentos com foto, liga). Regras para não incomodar:
 * - no máximo 3 por pessoa por dia;
 * - nada entre as 22h e as 8h (hora do telemóvel);
 * - cada acontecimento avisa uma só vez;
 * - a pessoa pode desligá-las no Perfil.
 */
import type { DB } from './social';
import { localNow, sendPush, type KeyStore, type PushMessage } from './push';

export const COMMUNITY_DAILY_MAX = 3;
export const QUIET_FROM = 22;
export const QUIET_TO = 8;

export interface Note {
  to: string;
  msg: PushMessage;
  /** chave única do acontecimento (para avisar uma só vez) */
  once: string;
}

const lisbonDay = (now: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);

export async function setCommunityPush(db: DB, uid: string, on: unknown) {
  await db.prepare('INSERT INTO push_prefs (uid, community) VALUES (?, ?) ON CONFLICT(uid) DO UPDATE SET community = excluded.community').bind(uid, on === false ? 0 : 1).run();
  return { status: 200, body: { ok: true } };
}

export const isQuiet = (hour: number) => hour >= QUIET_FROM || hour < QUIET_TO;

/** Envia um aviso da comunidade, respeitando as regras. Devolve quantos telemóveis avisou. */
export async function sendNote(db: DB, store: KeyStore, n: Note, now = new Date(), fetcher: typeof fetch = fetch) {
  // uma vez por acontecimento
  if (await db.prepare('SELECT 1 FROM notif_once WHERE key = ?').bind(n.once).first()) return 0;
  const pref = await db.prepare('SELECT community FROM push_prefs WHERE uid = ?').bind(n.to).first<{ community: number }>();
  if (pref && !pref.community) return 0;
  const { results: subs } = await db.prepare('SELECT endpoint, tz FROM push_subs WHERE uid = ?').bind(n.to).all<{ endpoint: string; tz: string | null }>();
  if (!subs.length) return 0;
  const awake = subs.filter((s) => !isQuiet(Number(localNow(s.tz || 'Europe/Lisbon', now).time.slice(0, 2))));
  if (!awake.length) return 0;
  const day = lisbonDay(now);
  const c = await db.prepare('SELECT n FROM push_daily WHERE uid = ? AND day = ?').bind(n.to, day).first<{ n: number }>();
  if ((c?.n ?? 0) >= COMMUNITY_DAILY_MAX) return 0;
  await db.batch([
    db.prepare('INSERT OR IGNORE INTO notif_once (key, created) VALUES (?, ?)').bind(n.once, now.toISOString()),
    db.prepare('INSERT INTO push_daily (uid, day, n) VALUES (?, ?, 1) ON CONFLICT(uid, day) DO UPDATE SET n = n + 1').bind(n.to, day),
  ]);
  for (const s of awake) await sendPush(db, store, s.endpoint, n.msg, fetcher);
  return awake.length;
}

export async function sendNotes(db: DB, store: KeyStore, notes: Note[], now = new Date(), fetcher: typeof fetch = fetch) {
  let sent = 0;
  for (const n of notes) sent += await sendNote(db, store, n, now, fetcher).catch(() => 0);
  return sent;
}

/** Amigos e colegas de equipa de uma pessoa (sem repetidos). */
export async function circleOf(db: DB, uid: string) {
  const { results: fr } = await db.prepare('SELECT b AS id FROM friends WHERE a = ?').bind(uid).all<{ id: string }>();
  const { results: tm } = await db
    .prepare('SELECT tm2.uid AS id FROM team_members tm1 JOIN team_members tm2 ON tm2.tid = tm1.tid WHERE tm1.uid = ? AND tm2.uid != ?')
    .bind(uid, uid)
    .all<{ id: string }>();
  return [...new Set([...fr, ...tm].map((x) => x.id))];
}
