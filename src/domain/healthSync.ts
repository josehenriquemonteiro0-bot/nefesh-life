/**
 * Dados do app Saúde (iPhone, Apple Watch e relógios que escrevem no app Saúde),
 * enviados pelo atalho NEFESH Saúde para a conta e trazidos para a app.
 */
import type { AppState } from './types';

export interface HealthDay {
  steps?: number;
  sleepH?: number;
  exMin?: number;
  at: string;
}

/** Link do atalho partilhado pelo iCloud (definido quando o atalho oficial estiver criado). */
export const HEALTH_SHORTCUT_URL: string = (import.meta.env.VITE_HEALTH_SHORTCUT as string | undefined)?.trim() || '';

export const HEALTH_WORKOUT_ID = 'saude-exercicio';

/**
 * Junta os dias recebidos aos registos. Devolve true se mudou alguma coisa.
 * Os minutos de exercício do relógio entram como atividade, descontando os treinos
 * registados à mão nesse dia (para não contar duas vezes).
 */
export function applyHealthDays(S: AppState, days: Record<string, HealthDay>): boolean {
  let changed = false;
  for (const [date, h] of Object.entries(days)) {
    const l = (S.logs[date] = S.logs[date] || {});
    if (h.steps !== undefined && l.steps !== h.steps) {
      l.steps = h.steps;
      changed = true;
    }
    if (h.sleepH !== undefined && l.sleepH === undefined) {
      // o sono escrito no check-in tem prioridade
      l.sleepH = h.sleepH;
      changed = true;
    }
    if (h.exMin !== undefined) {
      const manual = (l.workouts || []).filter((w) => w.sessionId !== HEALTH_WORKOUT_ID);
      const extra = Math.max(0, h.exMin - manual.reduce((t, w) => t + w.minutes, 0));
      const prev = (l.workouts || []).find((w) => w.sessionId === HEALTH_WORKOUT_ID);
      if ((prev?.minutes ?? 0) !== extra) {
        l.workouts = extra ? [...manual, { sessionId: HEALTH_WORKOUT_ID, title: 'Exercício (app Saúde)', minutes: extra, mvpa: extra, strength: false }] : manual;
        changed = true;
      }
    }
    if (Object.keys(l).length === 0) delete S.logs[date];
  }
  return changed;
}

/** Data da última receção, para mostrar "últimos dados: …". */
export function lastHealthAt(days: Record<string, HealthDay>) {
  return Object.values(days).map((d) => d.at).sort().pop();
}
