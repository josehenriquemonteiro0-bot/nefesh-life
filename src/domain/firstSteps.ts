/**
 * Primeiros passos: nos 3 primeiros dias, o Início mostra só 3 coisas para aprender o essencial
 * (tomar a Spirulina, falar com o assistente, fazer o check-in). Cada uma marca-se sozinha quando é feita;
 * com as três feitas, o cartão dá os parabéns e sai.
 */
import { daysSince, todayKey } from './dates';
import type { AppState } from './types';

export type FirstStep = 'ritual' | 'assistente' | 'checkin';
export const FIRST_STEPS: { id: FirstStep; title: string; how: string }[] = [
  { id: 'ritual', title: 'Tomar a Spirulina', how: 'Toque em "Tomei" no cartão A seguir.' },
  { id: 'assistente', title: 'Falar com o assistente', how: 'Diga o que comeu ou bebeu, como falaria com um amigo.' },
  { id: 'checkin', title: 'Fazer o check-in de hoje', how: '30 segundos: energia, sono e disposição.' },
];

export function firstSteps(S: Pick<AppState, 'ans' | 'sample' | 'planStart' | 'logs' | 'usedCoach' | 'firstStepsDone'>, now = new Date()) {
  if (!S.ans || S.sample || !S.planStart || S.firstStepsDone) return null;
  if (daysSince(S.planStart, now) > 2) return null; // dias 1 a 3
  const l = S.logs[todayKey(now)];
  const done: Record<FirstStep, boolean> = {
    ritual: !!l?.doses?.some(Boolean) || Object.values(S.logs).some((x) => x?.doses?.some(Boolean)),
    assistente: !!S.usedCoach,
    checkin: l?.e !== undefined,
  };
  const n = FIRST_STEPS.filter((s) => done[s.id]).length;
  return { done, n, all: n === FIRST_STEPS.length };
}
