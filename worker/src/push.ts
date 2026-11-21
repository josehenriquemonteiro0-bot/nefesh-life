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
    if (res.status === 404 || res.status === 410) {
      await db.prepare('DELETE FROM push_subs WHERE endpoint = ?').bind(endpoint).run();
      await db.prepare('DELETE FROM stock_alerts WHERE endpoint = ?').bind(endpoint).run();
    }
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
  if (validEndpoint(b.endpoint)) {
    await db.prepare('DELETE FROM push_subs WHERE endpoint = ?').bind(b.endpoint).run();
    await db.prepare('DELETE FROM stock_alerts WHERE endpoint = ?').bind(b.endpoint).run();
    await db.prepare('DELETE FROM med_times WHERE endpoint = ?').bind(b.endpoint).run();
    await db.prepare('DELETE FROM reminders WHERE endpoint = ?').bind(b.endpoint).run();
  }
  return { status: 200, body: { ok: true } };
}

/**
 * Data prevista para o fim da Spirulina deste telemóvel (calculada na app pelo ritmo das tomas).
 * Se a data mudar (ex.: frasco novo), o aviso volta a poder ser enviado.
 */
export async function setStockEnd(db: DB, b: Record<string, unknown>) {
  if (!validEndpoint(b.endpoint)) return { status: 400, body: { error: 'pedido inválido' } };
  const ends = typeof b.ends === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.ends) ? b.ends : null;
  if (!ends) {
    await db.prepare('DELETE FROM stock_alerts WHERE endpoint = ?').bind(b.endpoint).run();
    return { status: 200, body: { ok: true } };
  }
  await db
    .prepare(
      `INSERT INTO stock_alerts (endpoint, ends) VALUES (?, ?)
       ON CONFLICT(endpoint) DO UPDATE SET ends = excluded.ends, notified = CASE WHEN stock_alerts.ends = excluded.ends THEN stock_alerts.notified ELSE NULL END`,
    )
    .bind(b.endpoint, ends)
    .run();
  return { status: 200, body: { ok: true } };
}

/** Horas dos lembretes de medicação deste telemóvel (só as horas: os nomes ficam na app). */
export async function setMedTimes(db: DB, b: Record<string, unknown>) {
  if (!validEndpoint(b.endpoint)) return { status: 400, body: { error: 'pedido inválido' } };
  const times = (Array.isArray(b.times) ? b.times : []).map(validTime).filter((t): t is string => !!t);
  const uniq = [...new Set(times)].sort().slice(0, 12);
  if (!uniq.length) await db.prepare('DELETE FROM med_times WHERE endpoint = ?').bind(b.endpoint).run();
  else
    await db
      .prepare('INSERT INTO med_times (endpoint, times) VALUES (?, ?) ON CONFLICT(endpoint) DO UPDATE SET times = excluded.times')
      .bind(b.endpoint, JSON.stringify(uniq))
      .run();
  return { status: 200, body: { ok: true, times: uniq } };
}

/** Lembretes pontuais confirmados pela pessoa (ex.: "Hora de deitar" amanhã às 23:00). Substitui os futuros. */
export async function setReminders(db: DB, b: Record<string, unknown>, now = new Date()) {
  if (!validEndpoint(b.endpoint)) return { status: 400, body: { error: 'pedido inválido' } };
  const today = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);
  const items = (Array.isArray(b.items) ? b.items : [])
    .map((x) => x as Record<string, unknown>)
    .filter((x) => /^[a-z0-9]{4,24}$/.test(String(x.id)) && /^\d{4}-\d{2}-\d{2}$/.test(String(x.date)) && String(x.date) >= today && validTime(x.time))
    .slice(0, 30);
  await db.prepare('DELETE FROM reminders WHERE endpoint = ? AND sent = 0').bind(b.endpoint).run();
  for (const x of items) {
    await db
      .prepare('INSERT OR IGNORE INTO reminders (endpoint, id, date, time, text) VALUES (?, ?, ?, ?, ?)')
      .bind(b.endpoint, String(x.id), String(x.date), String(x.time), String(x.text ?? 'Lembrete').replace(/[\u0000-\u001f]/g, ' ').slice(0, 80))
      .run();
  }
  return { status: 200, body: { ok: true, n: items.length } };
}

/** Dias entre duas datas AAAA-MM-DD. */
const dayDiff = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

/** Quantos dias antes do fim da Spirulina avisamos. */
export const STOCK_NOTICE_DAYS = 7;

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

/** Agendamento: aviso de reposição, lembrete da toma, fim da liga e relatório semanal. */
export async function runSchedule(db: DB, store: KeyStore, now = new Date(), fetcher: typeof fetch = fetch) {
  // fotos da comunidade só ficam 24 horas
  await cleanupPhotos(db, now).catch(() => 0);
  const { results } = await db
    .prepare('SELECT endpoint, uid, remind, tz, done, sent, league_sent FROM push_subs')
    .all<{ endpoint: string; uid: string | null; remind: string | null; tz: string; done: string | null; sent: string | null; league_sent: string | null }>();
  const alerts = new Map(
    (await db.prepare('SELECT endpoint, ends, notified FROM stock_alerts').all<{ endpoint: string; ends: string; notified: string | null }>()).results.map((a) => [a.endpoint, a]),
  );
  let sent = 0;
  for (const s of results) {
    const t = localNow(s.tz || 'Europe/Lisbon', now);
    const m = minutes(t.time);
    // reposição: a Spirulina acaba dentro de 7 dias (um aviso por data prevista, entre as 10h e as 11h)
    const a = alerts.get(s.endpoint);
    if (a && a.notified !== a.ends && m >= 10 * 60 && m < 11 * 60) {
      const left = dayDiff(t.date, a.ends);
      if (left >= 0 && left <= STOCK_NOTICE_DAYS) {
        await db.prepare('UPDATE stock_alerts SET notified = ? WHERE endpoint = ?').bind(a.ends, s.endpoint).run();
        await sendPush(
          db,
          store,
          s.endpoint,
          {
            title: left ? `A sua Spirulina acaba daqui a ${left} ${left === 1 ? 'dia' : 'dias'} 🌿` : 'A sua Spirulina acaba hoje 🌿',
            body: 'Encomende já para o ritual não parar: a entrega demora alguns dias. Toque para ver a reposição.',
            tag: 'nefesh-reposicao',
          },
          fetcher,
        );
        sent++;
        continue;
      }
    }
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
  // lembretes de medicação: até 15 minutos depois de cada hora, uma vez por dia e hora
  const { results: meds } = await db.prepare('SELECT m.endpoint, m.times, m.sent, s.tz FROM med_times m JOIN push_subs s ON s.endpoint = m.endpoint').all<{ endpoint: string; times: string; sent: string; tz: string | null }>();
  for (const r of meds) {
    const t = localNow(r.tz || 'Europe/Lisbon', now);
    const m = minutes(t.time);
    const sentMap = JSON.parse(r.sent || '{}') as Record<string, string>;
    for (const hm of JSON.parse(r.times || '[]') as string[]) {
      if (m < minutes(hm) || m >= minutes(hm) + 15 || sentMap[hm] === t.date) continue;
      sentMap[hm] = t.date;
      await db.prepare('UPDATE med_times SET sent = ? WHERE endpoint = ?').bind(JSON.stringify(sentMap), r.endpoint).run();
      await sendPush(db, store, r.endpoint, { title: `💊 Lembrete das ${hm}`, body: 'Está na hora da sua medicação ou suplemento. Toque para marcar a toma na app.', tag: 'nefesh-med' }, fetcher);
      sent++;
    }
  }
  // lembretes pontuais (até 15 minutos depois da hora)
  const { results: rems } = await db
    .prepare('SELECT r.endpoint, r.id, r.date, r.time, r.text, s.tz FROM reminders r JOIN push_subs s ON s.endpoint = r.endpoint WHERE r.sent = 0')
    .all<{ endpoint: string; id: string; date: string; time: string; text: string; tz: string | null }>();
  for (const r of rems) {
    const t = localNow(r.tz || 'Europe/Lisbon', now);
    const m = minutes(t.time);
    const late = r.date < t.date || (r.date === t.date && m >= minutes(r.time) + 15);
    if (late) {
      await db.prepare('UPDATE reminders SET sent = 2 WHERE endpoint = ? AND id = ?').bind(r.endpoint, r.id).run();
      continue;
    }
    if (r.date !== t.date || m < minutes(r.time)) continue;
    await db.prepare('UPDATE reminders SET sent = 1 WHERE endpoint = ? AND id = ?').bind(r.endpoint, r.id).run();
    const cycle = r.id.startsWith('ciclo');
    await sendPush(
      db, store, r.endpoint,
      cycle
        ? { title: r.text, body: 'Toque para ver na NEFESH.', tag: `nefesh-ciclo-${r.id}` }
        : { title: `⏰ ${r.time} · ${r.text}`, body: 'Lembrete que combinou com o NEFESH Voice Assistant.', tag: `nefesh-lembrete-${r.id}` },
      fetcher,
    );
    sent++;
  }
  // domingo às 20h: o relatório semanal está pronto (uma vez por telemóvel e por domingo)
  for (const s of results) {
    const t = localNow(s.tz || 'Europe/Lisbon', now);
    const m = minutes(t.time);
    if (t.weekday !== 0 || m < 20 * 60 || m >= 21 * 60) continue;
    const key = `relatorio:${s.endpoint}:${t.date}`;
    if (await db.prepare('SELECT 1 FROM notif_once WHERE key = ?').bind(key).first()) continue;
    await db.prepare('INSERT INTO notif_once (key, created) VALUES (?, ?)').bind(key, now.toISOString()).run();
    await sendPush(db, store, s.endpoint, { title: 'O seu relatório da semana está pronto 📊', body: 'Veja a sua consistência, o que a IA percebeu e a prioridade para a próxima semana.', tag: 'nefesh-relatorio' }, fetcher);
    sent++;
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
export async function notifyUser(db: DB, store: KeyStore, uid: string, msg: PushMessage, fetcher: typeof fetch = fetch, now = new Date()) {
  const { results } = await db.prepare('SELECT endpoint, tz FROM push_subs WHERE uid = ?').bind(uid).all<{ endpoint: string; tz: string | null }>();
  // de noite (22h às 8h) não avisa: a pessoa vê na app quando a abrir
  const awake = results.filter((r) => { const h = Number(localNow(r.tz || 'Europe/Lisbon', now).time.slice(0, 2)); return h >= 8 && h < 22; });
  for (const r of awake) await sendPush(db, store, r.endpoint, msg, fetcher);
  return awake.length;
}

/** Avisa o amigo que recebeu uma mensagem (em todos os telemóveis dele com notificações). */
export async function notifyFriend(db: DB, store: KeyStore, toUid: string, fromNick: string, kind: string, fetcher: typeof fetch = fetch, now = new Date()) {
  return notifyUser(db, store, toUid, { title: `${fromNick} na NEFESH Life`, body: MESSAGE_TEXT[kind] ?? 'Enviou-lhe uma mensagem.', tag: 'nefesh-amigo' }, fetcher, now);
}
