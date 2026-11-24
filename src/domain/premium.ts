/**
 * NEFESH Premium: planos, preços de referência e estado a partir das assinaturas da App Store.
 * No iPhone, os preços mostrados vêm sempre da Apple (moeda e impostos da conta da pessoa);
 * os de referência servem para a versão web e para quando a loja ainda não respondeu.
 */
import type { PremiumInfo } from './features';

export const PLANS = {
  anual: { id: 'com.nefesh.life.premium.anual', label: 'Anual', trialDays: 7 },
  mensal: { id: 'com.nefesh.life.premium.mensal', label: 'Mensal', trialDays: 0 },
} as const;
export type Plan = keyof typeof PLANS;
export const planOf = (productId: string): Plan | null => (productId === PLANS.anual.id ? 'anual' : productId === PLANS.mensal.id ? 'mensal' : null);

/** Preços de referência (iguais aos Termos de Uso). */
export const REF_PRICES: Record<'BR' | 'PT', Record<Plan, { value: number; currency: string }>> = {
  BR: { mensal: { value: 39.9, currency: 'BRL' }, anual: { value: 249.9, currency: 'BRL' } },
  PT: { mensal: { value: 9.99, currency: 'EUR' }, anual: { value: 69.99, currency: 'EUR' } },
};

export const money = (value: number, currency: string, locale = currency === 'BRL' ? 'pt-BR' : 'pt-PT') =>
  new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value);

/** Quanto sai por mês o plano anual e a poupança face ao mensal (percentagem inteira). */
export function annualDeal(monthly: number, annual: number) {
  return { perMonth: Math.floor((annual / 12) * 100) / 100, saving: Math.round((1 - annual / (monthly * 12)) * 100) };
}

export interface StoreTransaction {
  jws: string;
  verified: boolean;
  productId?: string;
  /** fim do período pago, em milissegundos */
  expires?: number;
  revoked?: boolean;
}

/** Premium a partir das assinaturas ativas do iPhone (só as confirmadas pela Apple no aparelho). */
export function premiumFromStore(list: StoreTransaction[], now = Date.now()): PremiumInfo | null {
  const ok = list.filter((t) => t.verified && !t.revoked && t.productId && planOf(t.productId) && (t.expires ?? 0) > now);
  if (!ok.length) return null;
  const until = Math.max(...ok.map((t) => t.expires!));
  return { source: 'subscription', until: new Date(until).toISOString().slice(0, 10) };
}

const JWS_KEY = 'nefesh-premium-jws';
/** Guarda a última assinatura ativa da Apple (para o servidor confirmar o Premium sem conta). */
export function rememberStoreProof(list: StoreTransaction[], now = Date.now()) {
  const best = list.filter((t) => t.verified && !t.revoked && t.productId && planOf(t.productId) && (t.expires ?? 0) > now).sort((a, b) => (b.expires ?? 0) - (a.expires ?? 0))[0];
  try {
    if (best) localStorage.setItem(JWS_KEY, best.jws);
    else localStorage.removeItem(JWS_KEY);
  } catch {
    /* sem armazenamento */
  }
}

/** O que vai nos pedidos de IA para o servidor confirmar o Premium: o token da conta e/ou a assinatura da Apple. */
export function premiumProof(token?: string): { token?: string; premium?: string } {
  let premium: string | undefined;
  try {
    premium = localStorage.getItem(JWS_KEY) ?? undefined;
  } catch {
    premium = undefined;
  }
  return { ...(token ? { token } : {}), ...(premium ? { premium } : {}) };
}
