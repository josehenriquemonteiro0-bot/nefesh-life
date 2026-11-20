import { todayKey } from '../domain/dates';
import { slotsFor } from '../domain/plan';
import { applyDose } from '../domain/doses';
import { pushRitualDone } from '../domain/push';
import { streak, took } from '../domain/stats';
import type { AppState, DayLog } from '../domain/types';
import { useStore } from './store';

/** Com o ritual de hoje acabado de cumprir: cancela o lembrete e devolve a mensagem. */
export function ritualJustDone(S: AppState, before: DayLog | undefined, after: DayLog) {
  const S2 = { ...S, logs: { ...S.logs, [todayKey()]: after } };
  if (!took(S2, after) || took(S, before)) return null;
  if (S.notifications) pushRitualDone();
  const n = streak(S2);
  return `Ritual do dia cumprido. ${n} ${n === 1 ? 'dia seguido' : 'dias seguidos'}.`;
}

export function useDoseToggle() {
  const { S, todayLog: l, updateToday, toast } = useStore();
  const sl = slotsFor(S);
  const doses = l.doses || [];
  const toggle = (i: number) => {
    const after: DayLog = JSON.parse(JSON.stringify(l));
    applyDose(S, after, i, !doses[i]);
    updateToday((t) => applyDose(S, t, i, !doses[i]));
    const msg = ritualJustDone(S, l, after);
    if (msg) toast(msg);
  };
  return { slots: sl, doses, toggle };
}
