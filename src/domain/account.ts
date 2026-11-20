/**
 * Conta NEFESH Life (e-mail e palavra-passe) e sincronização dos dados com a nuvem.
 *
 * A sessão fica neste telemóvel (localStorage), fora do estado da app,
 * para que uma cópia de segurança nunca leve a sessão.
 */
import { useSyncExternalStore } from 'react';
import { PHOTO_API, deviceId } from './photo';
import type { AppState } from './types';

const AUTH_KEY = 'nefesh-life-conta';

export interface Auth {
  email: string;
  token: string;
  /** updatedAt do estado que está na nuvem (último enviado ou recebido) */
  cloudAt?: string | null;
  /** quando sincronizou pela última vez (ISO) */
  syncedAt?: string;
}

let current: Auth | null = read();
const listeners = new Set<() => void>();

function read(): Auth | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? (JSON.parse(raw) as Auth) : null;
  } catch {
    return null;
  }
}

export function getAuth() {
  return current;
}

export function setAuth(a: Auth | null) {
  current = a;
  try {
    if (a) localStorage.setItem(AUTH_KEY, JSON.stringify(a));
    else localStorage.removeItem(AUTH_KEY);
  } catch {
    /* armazenamento indisponível */
  }
  listeners.forEach((l) => l());
}

export function patchAuth(p: Partial<Auth>) {
  if (current) setAuth({ ...current, ...p });
}

export function useAuth() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
}

export class AccountError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function call<T = Record<string, unknown>>(action: string, body: Record<string, unknown>): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${PHOTO_API}/conta/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, device: deviceId() }),
    });
  } catch {
    throw new AccountError('Sem ligação à internet. Tente outra vez.', 0);
  }
  const out = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    // sessão expirada (não confundir com palavra-passe errada ao apagar a conta)
    if (res.status === 401 && (action === 'dados' || action === 'guardar' || action === 'saude-dados')) setAuth(null);
    throw new AccountError(out.error || `Erro ${res.status}`, res.status);
  }
  return out;
}

interface AuthReply {
  token: string;
  email: string;
  recovery?: string;
  updatedAt: string | null;
}

export const register = (email: string, password: string) => call<AuthReply>('registar', { email, password });
export const login = (email: string, password: string) => call<AuthReply>('entrar', { email, password });
export const recover = (email: string, code: string, password: string) => call<AuthReply>('recuperar', { email, code, password });

export async function logout() {
  const a = current;
  setAuth(null);
  if (a) await call('sair', { token: a.token }).catch(() => undefined);
}

export async function deleteAccount(password: string) {
  const a = current;
  if (!a) return;
  await call('apagar', { token: a.token, email: a.email, password });
  setAuth(null);
}

/** O que vai para a nuvem: o estado da app, sem a marca de demonstração. */
export function cloudCopy(S: AppState): AppState {
  return { ...S, sample: false };
}

export async function pull(): Promise<{ data: AppState | null; updatedAt: string | null }> {
  const a = current;
  if (!a) return { data: null, updatedAt: null };
  return call('dados', { token: a.token });
}

export async function push(S: AppState) {
  const a = current;
  if (!a) return;
  const updatedAt = S.updatedAt ?? new Date().toISOString();
  await call('guardar', { token: a.token, data: cloudCopy(S), updatedAt });
  patchAuth({ cloudAt: updatedAt, syncedAt: new Date().toISOString() });
}

/**
 * Decide o que fazer ao entrar na conta.
 * - 'usar-nuvem': este telemóvel não tem plano, ou não mudou desde a última sincronização
 * - 'enviar': a nuvem está vazia
 * - 'perguntar': os dois lados têm dados diferentes
 */
export function mergeDecision(local: AppState, cloudAt: string | null, lastCloudAt?: string | null): 'usar-nuvem' | 'enviar' | 'perguntar' | 'nada' {
  const hasLocal = !!local.ans && !local.sample;
  if (!cloudAt) return hasLocal ? 'enviar' : 'nada';
  if (!hasLocal) return 'usar-nuvem';
  if (local.updatedAt === cloudAt) return 'nada';
  // a nuvem não mudou desde a última sincronização: só este telemóvel mudou
  if (lastCloudAt && cloudAt === lastCloudAt) return 'enviar';
  // este telemóvel não mudou desde a última sincronização: só a nuvem mudou
  if (lastCloudAt && local.updatedAt && local.updatedAt <= lastCloudAt) return 'usar-nuvem';
  return 'perguntar';
}

/** Chave pessoal para o atalho do iPhone. */
export async function healthKey(nova = false): Promise<string> {
  const a = current;
  if (!a) throw new AccountError('Crie uma conta ou entre primeiro.', 401);
  return (await call<{ key: string }>('saude-chave', { token: a.token, nova })).key;
}

export async function healthDays(): Promise<Record<string, import('./healthSync').HealthDay>> {
  const a = current;
  if (!a) return {};
  return (await call<{ days: Record<string, import('./healthSync').HealthDay> }>('saude-dados', { token: a.token })).days;
}

/** Hora curta para "sincronizado às". */
export const syncedLabel = (iso?: string) =>
  iso ? new Date(iso).toLocaleString('pt-PT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'ainda não';
