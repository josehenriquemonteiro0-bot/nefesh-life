import { slotsFor } from './plan';
import { mealForSlot, spirulinaEntry } from './progress';
import type { AppState, DayLog } from './types';

/**
 * Marca (ou desmarca) a toma i no registo do dia: a toma entra (ou sai) sozinha no
 * diário de nutrição. Usado no Início, no check-in e pelo Coach.
 */
export function applyDose(S: AppState, t: DayLog, i: number, on: boolean) {
  const sl = slotsFor(S);
  if (!sl[i]) return;
  const next = [...(t.doses || [])];
  next[i] = on;
  t.doses = next;
  t.slots = sl.length;
  const tag = `spirulina-${i}`;
  const meals = { ...(t.meals || {}) };
  for (const k of Object.keys(meals) as (keyof typeof meals)[]) meals[k] = (meals[k] || []).filter((e) => e.auto !== tag);
  if (on) {
    const meal = mealForSlot(sl[i].l);
    meals[meal] = [...(meals[meal] || []), spirulinaEntry(S, sl[i], i)];
  }
  t.meals = meals;
}
