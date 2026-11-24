/**
 * Planos e feature flags (especificação v2, secção 2).
 *
 * Um único ponto de verificação: `canAccess(S, key)`.
 * - TEST_MODE = true (fase de teste com amigos e famílias): tudo desbloqueado para todos,
 *   mas a interface mostra o selo "Premium" nas funcionalidades premium, para medir interesse.
 * - TEST_MODE = false (lançamento): as funcionalidades premium exigem Premium ativo.
 *
 * O TEST_MODE vem da variável de build VITE_TEST_MODE ("false" desliga); por omissão está ligado.
 */
import type { AppState } from './types';

export const TEST_MODE: boolean = (import.meta.env?.VITE_TEST_MODE as string | undefined)?.trim() !== 'false';

export type Tier = 'free' | 'premium';

export interface FeatureConfig {
  label: string;
  tier: Tier;
  /** desligada para todos (ex.: ainda não construída) */
  enabled: boolean;
  /** quota grátis por dia numa funcionalidade premium (ex.: 5 mensagens ao AI Coach) */
  freeDaily?: number;
  /** o que o plano grátis tem (ex.: "básico", "resumo") */
  freeNote?: string;
}

/** Tabela central de funcionalidades (chave → plano). */
export const FEATURES = {
  // grátis
  perfil: { label: 'Perfil e quiz de objetivo', tier: 'free', enabled: true },
  planoSpirulina: { label: 'Plano de uso de Spirulina e lembrete', tier: 'free', enabled: true },
  checkin: { label: 'Check-in diário', tier: 'free', enabled: true },
  agua: { label: 'Contador de água', tier: 'free', enabled: true },
  comunidade: { label: 'Comunidade, Circles e desafios', tier: 'free', enabled: true },
  ranking: { label: 'Ranking semanal', tier: 'free', enabled: true },
  profissionais: { label: 'Diretório de profissionais', tier: 'free', enabled: true },
  metasProfissional: { label: 'Metas definidas pelo nutricionista', tier: 'free', enabled: true },
  planosProfissional: { label: 'Guardar os planos do profissional', tier: 'free', enabled: true },
  // premium
  coach: { label: 'NEFESH Voice Assistant', tier: 'premium', enabled: true, freeDaily: 5, freeNote: '5 mensagens por dia' },
  voz: { label: 'Voz: registos e conversa', tier: 'premium', enabled: true },
  fotoPrato: { label: 'Registo de refeição por foto', tier: 'premium', enabled: true },
  lerPlano: { label: 'Leitura do plano do profissional com IA', tier: 'premium', enabled: true },
  treinoObjetivo: { label: 'Treino adaptado ao objetivo', tier: 'premium', enabled: true, freeNote: 'básico' },
  treinoCompleto: { label: 'Treino completo (séries, cargas, histórico)', tier: 'premium', enabled: true, freeNote: 'básico' },
  sonoTendencias: { label: 'Sono e recuperação (tendências)', tier: 'premium', enabled: true, freeNote: 'básico' },
  relatorioCompleto: { label: 'Relatório semanal e mensal completo', tier: 'premium', enabled: true, freeNote: 'resumo' },
  planosAdaptativos: { label: 'Planos adaptativos', tier: 'premium', enabled: false },
  timeline: { label: 'Personal Health Timeline', tier: 'premium', enabled: true },
  meditacao: { label: 'Biblioteca de meditação completa', tier: 'premium', enabled: true, freeNote: '4 sessões grátis' },
  descontoConsultas: { label: 'Desconto em consultas de parceiros', tier: 'premium', enabled: false },
} satisfies Record<string, FeatureConfig>;

export type Feature = keyof typeof FEATURES;
const cfg = (key: Feature): FeatureConfig => FEATURES[key];

/** De onde vem o Premium da pessoa (assinatura, cliente NEFESH com assinatura de Spirulina, ou teste). */
export type PremiumSource = 'subscription' | 'nefesh_member' | 'test';
export interface PremiumInfo {
  source: PremiumSource;
  /** fim do Premium (AAAA-MM-DD); sem data, não expira */
  until?: string;
}

/** Premium ativo da pessoa (aceita o formato antigo `premium: true`). */
export function premiumOf(S: Pick<AppState, 'premium'>, today = new Date().toISOString().slice(0, 10)): PremiumInfo | null {
  const p = S.premium;
  if (!p) return null;
  const info: PremiumInfo = p === true ? { source: 'test' } : p;
  if (info.until && info.until < today) return null;
  return info;
}

export const isPremium = (S: Pick<AppState, 'premium'>) => !!premiumOf(S);
export const isPremiumFeature = (key: Feature) => cfg(key).tier === 'premium';

/** Único ponto de verificação de acesso. */
export function canAccess(S: Pick<AppState, 'premium'>, key: Feature, testMode = TEST_MODE): boolean {
  const c = cfg(key);
  if (!c.enabled) return false;
  if (testMode || c.tier === 'free') return true;
  return isPremium(S);
}

/**
 * Quota diária de uma funcionalidade: Infinity com acesso total; o número grátis
 * (ex.: 5) quando a funcionalidade premium tem quota grátis; 0 sem acesso.
 */
export function dailyQuota(S: Pick<AppState, 'premium'>, key: Feature, testMode = TEST_MODE): number {
  if (canAccess(S, key, testMode)) return Infinity;
  return cfg(key).enabled ? cfg(key).freeDaily ?? 0 : 0;
}

/** Compatibilidade com o código anterior. */
export const canUse = (f: Feature, S: AppState) => canAccess(S, f);
export const PREMIUM_ENFORCED = !TEST_MODE;
