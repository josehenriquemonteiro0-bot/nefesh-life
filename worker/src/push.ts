/**
 * Notificações com a app fechada (Web Push), sem custos.
 *
 * - As chaves VAPID são geradas na primeira utilização e guardadas no KV (não é preciso configurar nada).
 * - Enviamos notificações sem conteúdo cifrado: o service worker da app pergunta ao Worker
 *   qual é a mensagem (POST /push/mensagem) e mostra-a.
 * - Um agendamento (cron, a cada 15 minutos) envia o lembrete da toma à hora escolhida
 *   (se a Spirulina ainda não foi marcada nesse dia) e, ao domingo à noite, o aviso de fim da liga.
 */
import type { DB } from './social';
import { cleanupPhotos } from './photos';

export interface KeyStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

/* A tabela push_subs está no SCHEMA de social.ts (aplicado na publicação). */

const b64url = (b: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** Chaves VAPID (geradas uma vez e guardadas no KV). */
export async function vapid(store: KeyStore) {
  const raw = await store.get('vapid');
  if (raw) {
    const v = JSON.parse(raw) as { pub: string; jwk: JsonWebKey };
    return { pub: v.pub, key: await crypto.subtle.importKey('jwk', v.jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']) };
  }
  const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
  const pub = b64url((await crypto.subtle.exportKey('raw', pair.publicKey)) as ArrayBuffer);
  const jwk = (await crypto.subtle.exportKey('jwk', pair.privateKey)) as JsonWebKey;
  await store.put('vapid', JSON.stringify({ pub, jwk }));
  return { pub, key: pair.privateKey };
}

/** Cabeçalho Authorization VAPID (JWT ES256) para o serviço de push do endpoint. */
export async function vapidHeader(store: KeyStore, endpoint: string, now = Date.now()) {
  const { pub, key } = await vapid(store);
  const enc = (o: unknown) => b64url(new TextEncoder().encode(JSON.stringify(o)));
  const unsigned = `${enc({ typ: 'JWT', alg: 'ES256' })}.${enc({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: 'https://www.nefeshglobal.shop' })}`;
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(unsigned));
  return `vapid t=${unsigned}.${b64url(sig)}, k=${pub}`;
}

export interface PushMessage {
  title: string;
  body: string;
  tag?: string;
  url?: string;
}

/** Guarda a mensagem e acorda o telemóvel. Apaga a inscrição se o serviço disser que já não existe. */
export async function sendPush(db: DB, store: KeyStore, endpoint: string, msg: PushMessage, fetcher: typeof fetch = fetch) {
  await db.prepare('UPDATE push_subs SET msg = ? WHERE endpoint = ?').bind(JSON.stringify(msg), endpoint).run();
  try {
    const res = await fetcher(endpoint, {
      method: 'POST',
      headers: { Authorization: await vapidHeader(store, endpoint), TTL: '43200', Urgency: 'normal', 'Content-Length': '0' },
    });
    if (res.status === 404 || res.status === 410) await db.prepare('DELETE FROM push_subs WHERE endpoint = ?').bind(endpoint).run();
    return res.status;
  } catch {
    return 0;
  }
}

const validEndpoint = (e: unknown) => typeof e === 'string' && /^https:\/\/[^\s]{10,800}$/.test(e);
const validTime = (t: unknown) => (typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t) ? t : null);
function validTz(tz: unknown) {
  try {
    if (typeof tz !== 'string' || tz.length > 60) return 'Europe/Lisbon';
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return tz;
  } catch {
    return 'Europe/Lisbon';
  }
}

export async function subscribe(db: DB, b: Record<string, unknown>, uid: string | null, now = new Date()) {
  if (!validEndpoint(b.endpoint)) return { status: 400, body: { error: 'Inscrição inválida.' } };
  const remind = validTime(b.remind);
  const tz = validTz(b.tz);
  const device = String(b.device ?? '').slice(0, 64);
  await db
    .prepare(
      `INSERT INTO push_subs (endpoint, uid, device, remind, tz, created) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE SET uid = COALESCE(excluded.uid, push_subs.uid), device = excluded.device, remind = excluded.remind, tz = excluded.tz`,
    )
    .bind(b.endpoint, uid, device, remind, tz, now.toISOString())
    .run();
  return { status: 200, body: { ok: true } };
}

export async function markDone(db: DB, b: Record<string, unknown>) {
  if (!validEndpoint(b.endpoint) || typeof b.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(b.date)) return { status: 400, body: { error: 'pedido inválido' } };
  await db.prepare('UPDATE push_subs SET done = ? WHERE endpoint = ?').bind(b.date, b.endpoint).run();
  return { status: 200, body: { ok: true } };
}

export async function unsubscribe(db: DB, b: Record<string, unknown>) {
  if (validEndpoint(b.endpoint)) await db.prepare('DELETE FROM push_subs WHERE endpoint = ?').bind(b.endpoint).run();
  return { status: 200, body: { ok: true } };
}

const DEFAULT_MSG: PushMessage = { title: 'NEFESH Life 🌿', body: 'Está na hora do seu ritual de Spirulina.', tag: 'nefesh-dose' };

/** O service worker pergunta qual é a mensagem a mostrar. */
export async function pendingMessage(db: DB, b: Record<string, unknown>) {
  if (!validEndpoint(b.endpoint)) return { status: 200, body: DEFAULT_MSG as unknown as Record<string, unknown> };
  const row = await db.prepare('SELECT msg FROM push_subs WHERE endpoint = ?').bind(b.endpoint).first<{ msg: string | null }>();
  return { status: 200, body: (row?.msg ? JSON.parse(row.msg) : DEFAULT_MSG) as Record<string, unknown> };
}

/** Data (AAAA-MM-DD), hora (HH:MM) e dia da semana (0 = domingo) num fuso horário. */
export function localNow(tz: string, now = new Date()) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' })
      .formatToParts(now)
      .map((x) => [x.type, x.value]),
  );
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday);
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}`, weekday: wd };
}

const minutes = (hm: string) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5));

/** Agendamento: lembrete da toma e aviso de fim da liga. */
export async function runSchedule(db: DB, store: KeyStore, now = new Date(), fetcher: typeof fetch = fetch) {
  // fotos da comunidade só ficam 24 horas
  await cleanupPhotos(db, now).catch(() => 0);
  const { results } = await db
    .prepare('SELECT endpoint, uid, remind, tz, done, sent, league_sent FROM push_subs')
    .all<{ endpoint: string; uid: string | null; remind: string | null; tz: string; done: string | null; sent: string | null; league_sent: string | null }>();
  let sent = 0;
  for (const s of results) {
    const t = localNow(s.tz || 'Europe/Lisbon', now);
    const m = minutes(t.time);
    // lembrete da toma: até 1 hora depois da hora escolhida, se ainda não tomou nem foi lembrado hoje
    if (s.remind && s.done !== t.date && s.sent !== t.date && m >= minutes(s.remind) && m < minutes(s.remind) + 60) {
      await db.prepare('UPDATE push_subs SET sent = ? WHERE endpoint = ?').bind(t.date, s.endpoint).run();
      await sendPush(db, store, s.endpoint, { title: 'Hora do seu ritual NEFESH 🌿', body: 'Está na hora da sua Spirulina de hoje. Um toque na app para marcar a toma.', tag: 'nefesh-dose' }, fetcher);
      sent++;
      continue;
    }
    // domingo às 19h: a liga termina hoje (só para quem está na comunidade e tem pontos esta semana)
    if (s.uid && t.weekday === 0 && m >= 19 * 60 && m < 20 * 60 && s.league_sent !== t.date) {
      const inLeague = await db.prepare('SELECT 1 FROM weeks WHERE id = ? ORDER BY week DESC LIMIT 1').bind(s.uid).first();
      await db.prepare('UPDATE push_subs SET league_sent = ? WHERE endpoint = ?').bind(t.date, s.endpoint).run();
      if (inLeague) {
        await sendPush(db, store, s.endpoint, { title: 'A liga termina hoje 🏆', body: 'Ainda vai a tempo de somar pontos: a Spirulina de hoje conta a dobrar para os outros hábitos.', tag: 'nefesh-liga' }, fetcher);
        sent++;
      }
    }
  }
  return sent;
}

/** Mensagens prontas entre amigos (texto da notificação). */
export const MESSAGE_TEXT: Record<string, string> = {
  aplauso: '👏 Aplausos! Que semana!',
  parabens_spirulina: '🌿 Parabéns, Spirulina tomada! Continue assim.',
  lembrete_spirulina: '🌿 Já tomou a sua Spirulina hoje?',
  lembrete_agua: '💧 Lembrete amigo: beba água!',
  lembrete_treino: '💪 Hoje é dia de mexer o corpo!',
  forca: '💚 Força! Estou a torcer por si.',
  sequencia: '🔥 Que sequência incrível!',
  evolucao: '📈 Parabéns pela evolução no Índice NEFESH!',
  volta: '👋 Tenho saudades suas no ritual! Bora voltar?',
};

/** Notificação para uma pessoa (todos os telemóveis dela com notificações). */
export async function notifyUser(db: DB, store: KeyStore, uid: string, msg: PushMessage, fetcher: typeof fetch = fetch) {
  const { results } = await db.prepare('SELECT endpoint FROM push_subs WHERE uid = ?').bind(uid).all<{ endpoint: string }>();
  for (const r of results) await sendPush(db, store, r.endpoint, msg, fetcher);
  return results.length;
}

/** Avisa o amigo que recebeu uma mensagem (em todos os telemóveis dele com notificações). */
export async function notifyFriend(db: DB, store: KeyStore, toUid: string, fromNick: string, kind: string, fetcher: typeof fetch = fetch) {
  const { results } = await db.prepare('SELECT endpoint FROM push_subs WHERE uid = ?').bind(toUid).all<{ endpoint: string }>();
  for (const r of results) await sendPush(db, store, r.endpoint, { title: `${fromNick} na NEFESH Life`, body: MESSAGE_TEXT[kind] ?? 'Enviou-lhe uma mensagem.', tag: 'nefesh-amigo' }, fetcher);
  return results.length;
}
