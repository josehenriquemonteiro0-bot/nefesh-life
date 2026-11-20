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
  await Promise.all([store.delete(await emailKey(email)), store.delete(`d:${u.id}`), store.delete(`s:${String(token)}`)]);
  return { status: 200, body: { ok: true } };
}
