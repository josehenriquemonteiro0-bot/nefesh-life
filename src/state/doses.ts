import { todayKey } from '../domain/dates';
import { slotsFor } from '../domain/plan';
import { mealForSlot, spirulinaEntry } from '../domain/progress';
import { pushRitualDone } from '../domain/push';
import { streak, took } from '../domain/stats';
import { useStore } from './store';

/**
 * Marcar (ou desmarcar) uma toma de Spirulina: a toma entra sozinha no diário de
 * nutrição e, com o ritual cumprido, o lembrete de hoje é cancelado.
 * Usado no Início e no check-in.
 */
export function useDoseToggle() {
  const { S, todayLog: l, updateToday, toast } = useStore();
  const sl = slotsFor(S);
  const doses = l.doses || [];
  const toggle = (i: number) => {
    const next = [...doses];
    next[i] = !next[i];
    const tag = `spirulina-${i}`;
    updateToday((t) => {
      t.doses = next;
      const meal = mealForSlot(sl[i].l);
      const meals = { ...(t.meals || {}) };
      for (const k of Object.keys(meals) as (keyof typeof meals)[]) meals[k] = (meals[k] || []).filter((e) => e.auto !== tag);
      if (next[i]) meals[meal] = [...(meals[meal] || []), spirulinaEntry(S, sl[i], i)];
      t.meals = meals;
    });
    const after = { ...S, logs: { ...S.logs, [todayKey()]: { ...l, doses: next } } };
    if (took(after, after.logs[todayKey()]) && !took(S, l)) {
      if (S.notifications) pushRitualDone();
      toast(`Ritual do dia cumprido. ${streak(after)} dias seguidos.`);
    }
  };
  return { slots: sl, doses, toggle };
}
