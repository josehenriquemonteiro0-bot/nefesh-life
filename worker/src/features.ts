/**
 * Planos e feature flags no servidor (espelho de src/domain/features.ts).
 * TEST_MODE vem da variável do Worker (wrangler.toml): "true" abre tudo a todos.
 */
export type Tier = 'free' | 'premium';

export const SERVER_FEATURES: Record<string, { tier: Tier; enabled: boolean; freeDaily?: number }> = {
  perfil: { tier: 'free', enabled: true },
  planoSpirulina: { tier: 'free', enabled: true },
  checkin: { tier: 'free', enabled: true },
  agua: { tier: 'free', enabled: true },
  comunidade: { tier: 'free', enabled: true },
  ranking: { tier: 'free', enabled: true },
  profissionais: { tier: 'free', enabled: true },
  metasProfissional: { tier: 'free', enabled: true },
  planosProfissional: { tier: 'free', enabled: true },
  coach: { tier: 'premium', enabled: true, freeDaily: 5 },
  voz: { tier: 'premium', enabled: true },
  fotoPrato: { tier: 'premium', enabled: true },
  lerPlano: { tier: 'premium', enabled: true },
  treinoObjetivo: { tier: 'premium', enabled: true },
  treinoCompleto: { tier: 'premium', enabled: true },
  sonoTendencias: { tier: 'premium', enabled: true },
  relatorioCompleto: { tier: 'premium', enabled: true },
  planosAdaptativos: { tier: 'premium', enabled: true },
  timeline: { tier: 'premium', enabled: true },
  descontoConsultas: { tier: 'premium', enabled: true },
};

export const isTestMode = (env: { TEST_MODE?: string }) => (env.TEST_MODE ?? 'true').trim() !== 'false';

/** Único ponto de verificação no servidor. */
export function canAccess(env: { TEST_MODE?: string }, key: string, premiumActive: boolean) {
  const f = SERVER_FEATURES[key];
  if (!f || !f.enabled) return false;
  return isTestMode(env) || f.tier === 'free' || premiumActive;
}

/** Quota diária (Infinity com acesso total; a quota grátis numa funcionalidade premium; 0 sem acesso). */
export function dailyQuota(env: { TEST_MODE?: string }, key: string, premiumActive: boolean) {
  if (canAccess(env, key, premiumActive)) return Infinity;
  return SERVER_FEATURES[key]?.enabled ? SERVER_FEATURES[key].freeDaily ?? 0 : 0;
}
