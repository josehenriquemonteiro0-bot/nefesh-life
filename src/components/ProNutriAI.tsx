import type { NutriRx } from '../domain/proNutri';
import type { StudentProfile } from '../domain/proProfile';

/** Ditado por voz e revisão do plano alimentar pela IA (fase 2). */
export function NutriAICard(_: { rx: NutriRx; dayIndex: number; profile: StudentProfile | null; onRx: (r: NutriRx) => void }) {
  return null;
}
