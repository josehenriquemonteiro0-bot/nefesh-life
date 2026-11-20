/**
 * Funcionalidades grátis e Premium.
 *
 * Durante a fase de testes está tudo aberto (PREMIUM_ENFORCED = false). No lançamento,
 * basta pôr true e ligar `isPremium` à assinatura da pessoa (App Store / Google Play).
 */
import type { AppState } from './types';

export const PREMIUM_ENFORCED = false;

export type Feature = 'fotoPrato' | 'lerPlano' | 'treinoObjetivo' | 'relatorioCompleto' | 'metasProfissional' | 'planosProfissional';

export const FEATURES: Record<Feature, { label: string; premium: boolean }> = {
  fotoPrato: { label: 'Foto do prato com IA', premium: true },
  lerPlano: { label: 'Leitura do plano do nutricionista com IA', premium: true },
  treinoObjetivo: { label: 'Treino adaptado ao objetivo', premium: true },
  relatorioCompleto: { label: 'Relatório completo para o profissional', premium: true },
  metasProfissional: { label: 'Metas definidas pelo nutricionista', premium: false },
  planosProfissional: { label: 'Guardar os planos do profissional', premium: false },
};

/** A pessoa tem Premium? Na fase de testes, ninguém tem (e não é preciso). */
export const isPremium = (S: AppState) => !!S.premium;

export const canUse = (f: Feature, S: AppState) => !PREMIUM_ENFORCED || !FEATURES[f].premium || isPremium(S);
