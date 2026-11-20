/**
 * Limites diários de fotos, guardados no Cloudflare KV.
 * Contam por telemóvel, por rede (IP) e no total do dia.
 */

/** Só o que usamos do KV: permite testar com uma implementação em memória. */
export interface CounterStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}

export interface Limits {
  device: number;
  ip: number;
  global: number;
}

export interface LimitCheck {
  ok: boolean;
  /** fotos que ainda restam hoje a este telemóvel */
  remaining: number;
  reason?: 'device' | 'ip' | 'global';
}

/** Dia no fuso de Lisboa, para o limite voltar a zero à meia-noite de Portugal. */
export function dayKey(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export const cleanDeviceId = (id: unknown) => {
  const s = String(id ?? '');
  return /^[A-Za-z0-9-]{8,64}$/.test(s) ? s : 'sem-id';
};

const TTL = 60 * 60 * 48;

function keys(device: string, ip: string, day: string) {
  return { d: `d:${day}:${device}`, i: `i:${day}:${ip}`, g: `g:${day}` };
}

async function read(store: CounterStore, k: string) {
  return Number((await store.get(k)) ?? 0) || 0;
}

/** Verifica se ainda há fotos disponíveis hoje (não conta). */
export async function check(store: CounterStore, limits: Limits, device: string, ip: string, now = new Date()): Promise<LimitCheck> {
  const k = keys(device, ip, dayKey(now));
  const [d, i, g] = await Promise.all([read(store, k.d), read(store, k.i), read(store, k.g)]);
  const remaining = Math.max(0, limits.device - d);
  if (d >= limits.device) return { ok: false, remaining, reason: 'device' };
  if (i >= limits.ip) return { ok: false, remaining, reason: 'ip' };
  if (g >= limits.global) return { ok: false, remaining, reason: 'global' };
  return { ok: true, remaining };
}

/** Conta uma foto analisada com sucesso. Devolve quantas restam ao telemóvel. */
export async function count(store: CounterStore, limits: Limits, device: string, ip: string, now = new Date()): Promise<number> {
  const k = keys(device, ip, dayKey(now));
  const [d, i, g] = await Promise.all([read(store, k.d), read(store, k.i), read(store, k.g)]);
  await Promise.all([
    store.put(k.d, String(d + 1), { expirationTtl: TTL }),
    store.put(k.i, String(i + 1), { expirationTtl: TTL }),
    store.put(k.g, String(g + 1), { expirationTtl: TTL }),
  ]);
  return Math.max(0, limits.device - d - 1);
}

export const LIMIT_MESSAGES: Record<NonNullable<LimitCheck['reason']>, string> = {
  device: 'Já usou as fotos de hoje. Amanhã há mais! Entretanto, pode adicionar os alimentos pela lista.',
  ip: 'Esta rede já usou muitas fotos hoje. Tente amanhã ou adicione os alimentos pela lista.',
  global: 'A análise de fotos atingiu o limite de hoje. Tente amanhã ou adicione os alimentos pela lista.',
};
