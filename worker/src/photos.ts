/**
 * Momentos com foto na comunidade (como "stories"): visíveis para toda a comunidade
 * durante 24 horas e depois apagados. Cada foto é revista pela IA antes de ser publicada;
 * qualquer pessoa pode denunciar (a foto esconde-se logo para quem denunciou e,
 * com 3 denúncias, para todos).
 */
import Anthropic from '@anthropic-ai/sdk';
import type { DB } from './social';

export const PHOTO_TTL_MS = 24 * 3600 * 1000;
export const PHOTO_KINDS = ['treino', 'receita', 'spirulina', 'refeicao'] as const;
const MAX_CHARS = 400_000; // ~300 KB em base64

const SCHEMA = {
  type: 'object',
  properties: {
    safe: { type: 'boolean', description: 'false se tem nudez ou conteúdo sexual, violência, ódio, drogas, documentos ou dados pessoais legíveis, ou crianças em situação imprópria' },
    fits: { type: 'boolean', description: 'true se a foto tem a ver com o momento indicado (treino/exercício, comida/receita, Spirulina, refeição) ou é uma selfie de bem-estar' },
    other_people: { type: 'boolean', description: 'true se aparecem rostos reconhecíveis de outras pessoas além de quem tirou a foto' },
    note: { type: 'string', description: 'frase curta para a pessoa, em português de Portugal' },
  },
  required: ['safe', 'fits', 'other_people', 'note'],
  additionalProperties: false,
} as const;

export async function moderate(client: Anthropic, model: string, image: string, kind: string) {
  const r = await client.beta.messages.create({
    model,
    max_tokens: 800,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: `Revês fotos que as pessoas querem partilhar na comunidade da app de bem-estar NEFESH Life, visível para todos os membros durante 24 horas. O momento indicado é: ${kind}. Sê protetor: na dúvida sobre segurança, recusa.`,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
    messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } }, { type: 'text', text: 'Revê esta foto.' }] }],
  });
  const t = r.content.find((x) => x.type === 'text');
  if (r.stop_reason === 'refusal' || !t || t.type !== 'text') return { safe: false, fits: false, other_people: false, note: 'Não foi possível rever a foto.' };
  return JSON.parse(t.text) as { safe: boolean; fits: boolean; other_people: boolean; note: string };
}

const newId = () => [...crypto.getRandomValues(new Uint8Array(12))].map((x) => x.toString(16).padStart(2, '0')).join('');

/** Guarda a foto aprovada e cria o momento no mural. */
export async function savePhoto(db: DB, uid: string, image: string, kind: string, value: number, now = new Date()) {
  const id = newId();
  const at = now.toISOString();
  await db.prepare('INSERT INTO feed (uid, kind, value, created) VALUES (?, ?, ?, ?)').bind(uid, `foto-${kind}`, value, at).run();
  const f = await db.prepare('SELECT id FROM feed WHERE uid = ? AND created = ? ORDER BY id DESC LIMIT 1').bind(uid, at).first<{ id: number }>();
  await db.prepare('INSERT INTO photos (id, fid, uid, kind, data, created, hidden) VALUES (?, ?, ?, ?, ?, ?, 0)').bind(id, f?.id ?? null, uid, kind, image, at).run();
  return id;
}

export const validImage = (image: unknown): image is string => typeof image === 'string' && image.length > 100 && image.length <= MAX_CHARS && /^[A-Za-z0-9+/=]+$/.test(image);

/** Fotos das últimas 24 h, para toda a comunidade (sem as escondidas nem as que eu denunciei). */
export async function recentPhotos(db: DB, uid: string, now = new Date()) {
  const since = new Date(now.getTime() - PHOTO_TTL_MS).toISOString();
  const { results } = await db
    .prepare(
      `SELECT ph.id, ph.fid, ph.uid, ph.kind, ph.created, p.nick, p.avatar FROM photos ph JOIN profiles p ON p.id = ph.uid
       WHERE ph.created > ? AND ph.hidden = 0 AND ph.id NOT IN (SELECT pid FROM photo_reports WHERE uid = ?)
       ORDER BY ph.created DESC LIMIT 40`,
    )
    .bind(since, uid)
    .all<{ id: string; fid: number; uid: string; kind: string; created: string; nick: string; avatar: string | null }>();
  return results.map((r) => ({ id: r.id, fid: r.fid, me: r.uid === uid, uid: r.uid === uid ? undefined : r.uid, kind: r.kind, created: r.created, nick: r.nick, avatar: r.avatar }));
}

export async function photoBytes(db: DB, id: string, now = new Date()) {
  if (!/^[0-9a-f]{24}$/.test(id)) return null;
  const since = new Date(now.getTime() - PHOTO_TTL_MS).toISOString();
  const r = await db.prepare('SELECT data FROM photos WHERE id = ? AND hidden = 0 AND created > ?').bind(id, since).first<{ data: string }>();
  if (!r) return null;
  return Uint8Array.from(atob(r.data), (c) => c.charCodeAt(0));
}

/** Denúncia: esconde logo para quem denunciou; com 3 denúncias, esconde para todos. */
export async function report(db: DB, uid: string, id: unknown, now = new Date()) {
  const pid = String(id ?? '');
  const ph = await db.prepare('SELECT uid FROM photos WHERE id = ?').bind(pid).first<{ uid: string }>();
  if (!ph) return { status: 404, body: { error: 'Esta foto já não existe.' } };
  await db.prepare('INSERT OR IGNORE INTO photo_reports (pid, uid, created) VALUES (?, ?, ?)').bind(pid, uid, now.toISOString()).run();
  const n = await db.prepare('SELECT COUNT(*) AS n FROM photo_reports WHERE pid = ?').bind(pid).first<{ n: number }>();
  if ((n?.n ?? 0) >= 3) {
    await db.prepare('UPDATE photos SET hidden = 1 WHERE id = ?').bind(pid).run();
    await db.prepare("INSERT OR IGNORE INTO reviews (uid, reason, status, created) VALUES (?, 'foto denunciada por 3 pessoas', 'aberto', ?)").bind(ph.uid, now.toISOString()).run();
  }
  return { status: 200, body: { ok: true } };
}

export async function deletePhoto(db: DB, uid: string, id: unknown) {
  const pid = String(id ?? '');
  const ph = await db.prepare('SELECT fid FROM photos WHERE id = ? AND uid = ?').bind(pid, uid).first<{ fid: number | null }>();
  if (!ph) return { status: 404, body: { error: 'Foto não encontrada.' } };
  await db.batch([
    db.prepare('DELETE FROM photos WHERE id = ?').bind(pid),
    db.prepare('DELETE FROM photo_reports WHERE pid = ?').bind(pid),
    ...(ph.fid ? [db.prepare('DELETE FROM feed WHERE id = ?').bind(ph.fid)] : []),
  ]);
  return { status: 200, body: { ok: true } };
}

/** Limpeza (agendada): apaga as fotos com mais de 24 horas e os momentos delas. */
export async function cleanupPhotos(db: DB, now = new Date()) {
  const since = new Date(now.getTime() - PHOTO_TTL_MS).toISOString();
  const { results } = await db.prepare('SELECT id, fid FROM photos WHERE created <= ?').bind(since).all<{ id: string; fid: number | null }>();
  for (const r of results) {
    await db.batch([
      db.prepare('DELETE FROM photos WHERE id = ?').bind(r.id),
      db.prepare('DELETE FROM photo_reports WHERE pid = ?').bind(r.id),
      ...(r.fid ? [db.prepare('DELETE FROM feed WHERE id = ?').bind(r.fid)] : []),
    ]);
  }
  return results.length;
}
