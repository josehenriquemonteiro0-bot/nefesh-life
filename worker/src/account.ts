/**
 * Contas NEFESH Life: e-mail e palavra-passe, com os dados da app guardados na nuvem (Cloudflare KV).
 *
 * - Palavras-passe e códigos de recuperação nunca são guardados em claro (PBKDF2-SHA256, 100 000 iterações).
 * - Sem serviço de e-mail: a recuperação da palavra-passe usa um código entregue no registo.
 * - Chaves no KV:  u:<hash do e-mail>  conta  ·  s:<token>  sessão  ·  d:<id>  dados da app
 */

export interface AccountStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

interface User {
  id: string;
  email: string;
  salt: string;
  hash: string;
  rsalt: string;
  rhash: string;
  created: string;
}

const SESSION_TTL = 60 * 60 * 24 * 180;
const ITER = 100_000;
/** tamanho máximo dos dados de uma pessoa (a app ocupa normalmente menos de 1 MB) */
export const MAX_DATA = 5_000_000;

const hex = (b: ArrayBuffer | Uint8Array) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
const random = (n: number) => hex(crypto.getRandomValues(new Uint8Array(n)));

async function pbkdf2(secret: string, salt: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: ITER }, key, 256);
  return hex(bits);
}

/** Comparação em tempo constante. */
function same(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function emailKey(email: string) {
  return `u:${hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`nefesh-conta:${email}`)))}`;
}

export const cleanEmail = (v: unknown) => String(v ?? '').trim().toLowerCase().slice(0, 200);
export const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
export const validPassword = (p: unknown) => typeof p === 'string' && p.length >= 8 && p.length <= 200;

/** Código de recuperação legível: 4 grupos de 4 (sem letras que se confundem). */
export function recoveryCode() {
  const abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const b = crypto.getRandomValues(new Uint8Array(16));
  const s = [...b].map((x) => abc[x % abc.length]).join('');
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}`;
}
const normCode = (c: unknown) => String(c ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

async function newSession(store: AccountStore, id: string) {
  const token = random(32);
  await store.put(`s:${token}`, id, { expirationTtl: SESSION_TTL });
  return token;
}

export type Result = { status: number; body: Record<string, unknown> };
const err = (status: number, error: string): Result => ({ status, body: { error } });

export async function register(store: AccountStore, emailRaw: unknown, password: unknown): Promise<Result> {
  const email = cleanEmail(emailRaw);
  if (!validEmail(email)) return err(400, 'E-mail inválido.');
  if (!validPassword(password)) return err(400, 'A palavra-passe precisa de pelo menos 8 caracteres.');
  const k = await emailKey(email);
  if (await store.get(k)) return err(409, 'Já existe uma conta com este e-mail. Entre com a sua palavra-passe.');
  const code = recoveryCode();
  const salt = random(16);
  const rsalt = random(16);
  const user: User = { id: random(12), email, salt, hash: await pbkdf2(password as string, salt), rsalt, rhash: await pbkdf2(normCode(code), rsalt), created: new Date().toISOString() };
  await store.put(k, JSON.stringify(user));
  return { status: 200, body: { token: await newSession(store, user.id), email, recovery: code, updatedAt: null } };
}

async function userOf(store: AccountStore, email: string) {
  const raw = await store.get(await emailKey(email));
  return raw ? (JSON.parse(raw) as User) : null;
}

async function dataMeta(store: AccountStore, id: string) {
  const raw = await store.get(`d:${id}`);
  if (!raw) return null;
  return (JSON.parse(raw) as { updatedAt: string }).updatedAt ?? null;
}

export async function login(store: AccountStore, emailRaw: unknown, password: unknown): Promise<Result> {
  const email = cleanEmail(emailRaw);
  const u = validEmail(email) && typeof password === 'string' ? await userOf(store, email) : null;
  // a mesma resposta para e-mail inexistente e palavra-passe errada
  if (!u || !same(await pbkdf2(password as string, u.salt), u.hash)) return err(401, 'E-mail ou palavra-passe incorretos.');
  return { status: 200, body: { token: await newSession(store, u.id), email, updatedAt: await dataMeta(store, u.id) } };
}

export async function recover(store: AccountStore, emailRaw: unknown, code: unknown, password: unknown): Promise<Result> {
  const email = cleanEmail(emailRaw);
  if (!validPassword(password)) return err(400, 'A nova palavra-passe precisa de pelo menos 8 caracteres.');
  const u = validEmail(email) ? await userOf(store, email) : null;
  if (!u || !same(await pbkdf2(normCode(code), u.rsalt), u.rhash)) return err(401, 'E-mail ou código de recuperação incorretos.');
  // nova palavra-passe e novo código (o antigo deixa de servir)
  const next = recoveryCode();
  u.salt = random(16);
  u.hash = await pbkdf2(password as string, u.salt);
  u.rsalt = random(16);
  u.rhash = await pbkdf2(normCode(next), u.rsalt);
  await store.put(await emailKey(email), JSON.stringify(u));
  return { status: 200, body: { token: await newSession(store, u.id), email, recovery: next, updatedAt: await dataMeta(store, u.id) } };
}

export async function sessionUser(store: AccountStore, token: unknown) {
  const t = String(token ?? '');
  if (!/^[0-9a-f]{64}$/.test(t)) return null;
  return store.get(`s:${t}`);
}

export async function logout(store: AccountStore, token: unknown): Promise<Result> {
  const t = String(token ?? '');
  if (/^[0-9a-f]{64}$/.test(t)) await store.delete(`s:${t}`);
  return { status: 200, body: { ok: true } };
}

export async function getData(store: AccountStore, token: unknown): Promise<Result> {
  const id = await sessionUser(store, token);
  if (!id) return err(401, 'A sessão terminou. Entre outra vez.');
  const raw = await store.get(`d:${id}`);
  return { status: 200, body: raw ? JSON.parse(raw) : { data: null, updatedAt: null } };
}

export async function saveData(store: AccountStore, token: unknown, data: unknown, updatedAt: unknown): Promise<Result> {
  const id = await sessionUser(store, token);
  if (!id) return err(401, 'A sessão terminou. Entre outra vez.');
  if (!data || typeof data !== 'object') return err(400, 'Dados inválidos.');
  const at = typeof updatedAt === 'string' && !Number.isNaN(Date.parse(updatedAt)) ? updatedAt : new Date().toISOString();
  const raw = JSON.stringify({ data, updatedAt: at });
  if (raw.length > MAX_DATA) return err(413, 'Os dados são demasiado grandes para guardar na nuvem.');
  await store.put(`d:${id}`, raw);
  return { status: 200, body: { ok: true, updatedAt: at } };
}

/** Apaga a conta e os dados da nuvem (pede a palavra-passe outra vez). */
export async function deleteAccount(store: AccountStore, token: unknown, emailRaw: unknown, password: unknown): Promise<Result> {
  const id = await sessionUser(store, token);
  const email = cleanEmail(emailRaw);
  const u = id ? await userOf(store, email) : null;
  if (!u || u.id !== id || typeof password !== 'string' || !same(await pbkdf2(password, u.salt), u.hash)) return err(401, 'Palavra-passe incorreta.');
  const hk = await store.get(`hk:${u.id}`);
  await Promise.all([
    store.delete(await emailKey(email)),
    store.delete(`d:${u.id}`),
    store.delete(`s:${String(token)}`),
    store.delete(`hd:${u.id}`),
    store.delete(`hk:${u.id}`),
    ...(hk ? [store.delete(`h:${hk}`)] : []),
  ]);
  return { status: 200, body: { ok: true } };
}

/* ---------- app Saúde (Apple Watch e relógios que escrevem no app Saúde) ---------- */

export interface HealthDay {
  steps?: number;
  sleepH?: number;
  exMin?: number;
  at: string;
}

/** Chave pessoal do atalho do iPhone (não é a sessão: só serve para enviar dados de saúde). */
export async function healthKey(store: AccountStore, token: unknown, rotate = false): Promise<Result> {
  const id = await sessionUser(store, token);
  if (!id) return err(401, 'A sessão terminou. Entre outra vez.');
  let key = await store.get(`hk:${id}`);
  // nova chave: a antiga deixa de funcionar (ex.: se ficou gravada num atalho partilhado)
  if (key && rotate) {
    await store.delete(`h:${key}`);
    key = null;
  }
  if (!key) {
    key = random(12);
    await Promise.all([store.put(`hk:${id}`, key), store.put(`h:${key}`, id)]);
  }
  return { status: 200, body: { key } };
}

/** Lê números como o Atalhos os envia: "7 200", "7,5", "7.5 h", "450 min". */
export function looseNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v ?? '').trim().replace(/\s/g, '').replace(',', '.');
  const m = s.match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

/** Sono em horas: aceita horas, minutos ou segundos (o Atalhos varia conforme a versão). */
export function sleepHours(v: unknown): number | undefined {
  const n = looseNumber(v);
  if (n === null || n <= 0) return undefined;
  const h = n <= 24 ? n : n <= 1440 ? n / 60 : n / 3600;
  return h <= 24 ? Math.round(h * 4) / 4 : undefined;
}

export async function healthPush(store: AccountStore, body: Record<string, unknown>, today: string): Promise<Result> {
  const key = String(body.chave ?? body.key ?? '').trim().toLowerCase();
  if (!/^[0-9a-f]{24}$/.test(key)) return err(400, 'Chave em falta ou inválida. Copie-a outra vez na app NEFESH Life.');
  const id = await store.get(`h:${key}`);
  if (!id) return err(401, 'Chave desconhecida. Copie-a outra vez na app NEFESH Life.');
  const steps = looseNumber(body.passos);
  const ex = looseNumber(body.exercicio);
  const day: HealthDay = { at: new Date().toISOString() };
  if (steps !== null && steps >= 0 && steps <= 150000) day.steps = Math.round(steps);
  const sl = sleepHours(body.sono);
  if (sl !== undefined) day.sleepH = sl;
  if (ex !== null && ex >= 0 && ex <= 1440) day.exMin = Math.round(ex);
  if (day.steps === undefined && day.sleepH === undefined && day.exMin === undefined) return err(400, 'Não chegaram valores de passos, sono ou exercício.');
  const raw = await store.get(`hd:${id}`);
  const all = (raw ? JSON.parse(raw) : {}) as Record<string, HealthDay>;
  all[today] = { ...all[today], ...day };
  // guarda só as últimas 3 semanas
  const keep = Object.keys(all).sort().slice(-21);
  await store.put(`hd:${id}`, JSON.stringify(Object.fromEntries(keep.map((k) => [k, all[k]]))));
  const parts = [day.steps !== undefined && `${day.steps} passos`, day.sleepH !== undefined && `${day.sleepH} h de sono`, day.exMin !== undefined && `${day.exMin} min de exercício`].filter(Boolean);
  return { status: 200, body: { ok: true, mensagem: `NEFESH Life: ${parts.join(', ')} enviados.` } };
}

export async function healthPull(store: AccountStore, token: unknown): Promise<Result> {
  const id = await sessionUser(store, token);
  if (!id) return err(401, 'A sessão terminou. Entre outra vez.');
  const raw = await store.get(`hd:${id}`);
  return { status: 200, body: { days: raw ? JSON.parse(raw) : {} } };
}
