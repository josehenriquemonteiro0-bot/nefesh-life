/**
 * Consentimentos (especificação v2, secção 11): separados e opcionais.
 * 1. Personalizar a app (necessário ao serviço): aceite antes da avaliação (S.consent).
 * 2. Dados anonimizados e agregados para investigação e desenvolvimento de novas fórmulas
 *    NEFESH: opcional, desligado por omissão.
 * 3. Comunicações de marketing: opcional, desligado por omissão (precisa de conta).
 */
import { keyDaysAgo } from './dates';
import { indexOf } from './plan';
import type { AppState } from './types';

export const rdOn = (S: Pick<AppState, 'consents'>) => !!S.consents?.rd?.on;
export const marketingOn = (S: Pick<AppState, 'consents'>) => !!S.consents?.marketing?.on;

export const CONSENT_TEXT = {
  personal: 'Usar os meus dados para criar e personalizar o meu plano (necessário para a app funcionar).',
  rd: 'Autorizo que os meus dados, anonimizados e só em totais de grupo, ajudem a NEFESH a investigar e desenvolver novas fórmulas.',
  marketing: 'Quero receber novidades, ofertas e convites da NEFESH por e-mail.',
};

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/**
 * Médias para investigação (só com o consentimento 2): objetivo, energia e sono no início
 * e agora (primeiros e últimos 7 registos) e o Índice NEFESH da primeira e da última avaliação.
 * Sem datas, sem nome e sem texto: só números arredondados.
 */
export function rdSummary(S: AppState, now = new Date()) {
  if (!rdOn(S) || !S.ans) return null;
  const keys = Object.keys(S.logs).filter((k) => k <= keyDaysAgo(0, now)).sort();
  const vals = (f: 'e' | 'sleepH') => keys.map((k) => S.logs[k]?.[f]).filter((v): v is number => typeof v === 'number' && v > 0);
  const e = vals('e');
  const s = vals('sleepH');
  const r1 = (v: number | null) => (v === null ? null : Math.round(v * 10) / 10);
  const first = S.evals[0];
  const last = S.evals[S.evals.length - 1];
  return {
    goal: S.ans.goal ?? null,
    eStart: e.length >= 10 ? r1(mean(e.slice(0, 7))) : null,
    eNow: e.length >= 10 ? r1(mean(e.slice(-7))) : null,
    sStart: s.length >= 10 ? r1(mean(s.slice(0, 7))) : null,
    sNow: s.length >= 10 ? r1(mean(s.slice(-7))) : null,
    idxStart: first ? indexOf(first.sc) : null,
    idxNow: last && S.evals.length >= 2 ? indexOf(last.sc) : null,
  };
}
