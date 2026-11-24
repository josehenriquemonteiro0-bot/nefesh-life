/**
 * NEFESH Premium no servidor: a app bloqueia as funções Premium, e o servidor confirma.
 *
 * Só atua com a variável PREMIUM_ENFORCED = "true" (a ligar no lançamento; até lá a versão da família
 * continua aberta). Conta como Premium:
 * - uma conta NEFESH com Premium (assinatura confirmada ou cortesia dada pela equipa), pelo token;
 * - sem conta, a transação assinada pela Apple que o iPhone envia (verificada e guardada 1 hora).
 *
 * Funções: foto do prato, voz e leitura do plano exigem Premium; o assistente por escrito tem
 * 5 mensagens grátis por dia.
 */
import { sessionUser } from './account';
import { BUNDLE_ID, PRODUCTS, premiumOf, verifyTransaction } from './appstore';
import type { DB } from './social';

export const FREE_COACH_DAILY = 5;
export const PREMIUM_MESSAGE = 'Esta função faz parte do NEFESH Premium. Veja os planos no Perfil → NEFESH Premium.';

interface KV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}

export const enforced = (env: { PREMIUM_ENFORCED?: string }) => env.PREMIUM_ENFORCED?.trim() === 'true';

const sha = async (s: string) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, '0')).join('');

/** A pessoa que faz o pedido tem Premium? (token da conta ou transação da Apple) */
export async function hasPremium(db: DB | undefined, kv: KV, body: { token?: unknown; premium?: unknown }, now = Date.now(), rootSha256?: string): Promise<boolean> {
  if (db && body.token) {
    const uid = await sessionUser(kv as never, body.token);
    if (uid && (await premiumOf(db, uid, now))) return true;
  }
  const jws = typeof body.premium === 'string' ? body.premium.slice(0, 20000) : '';
  if (!jws) return false;
  const key = `pj:${await sha(jws)}`;
  const cached = await kv.get(key);
  if (cached) return Number(cached) > now;
  const v = await verifyTransaction(jws, rootSha256);
  const ok = v.ok && v.tx.bundleId === BUNDLE_ID && v.tx.productId in PRODUCTS && !v.tx.revocationDate && (v.tx.expiresDate ?? 0) > now;
  const until = ok && v.ok ? v.tx.expiresDate! : 0;
  await kv.put(key, String(until), { expirationTtl: 3600 });
  return until > now;
}

/** Cortesia dada pela equipa (família, parceiros, revisão da Apple): Premium na conta até uma data. */
export async function grantCourtesy(db: DB, uid: string, until: string, now = new Date()) {
  await db
    .prepare("INSERT INTO premium (uid, product, otid, expires, env, updated) VALUES (?, 'cortesia', ?, ?, 'cortesia', ?) ON CONFLICT(uid) DO UPDATE SET product = 'cortesia', otid = excluded.otid, expires = excluded.expires, env = 'cortesia', updated = excluded.updated")
    .bind(uid, `cortesia-${uid}`, `${until}T23:59:59.000Z`, now.toISOString())
    .run();
}
