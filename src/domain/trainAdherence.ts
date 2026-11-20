import { keyDaysAgo, shortDate } from './dates';
import type { AppState } from './types';
import { weekdayIndex } from './training';

/** Execução de uma série: feita ou não, e o que a pessoa realmente fez. */
export interface TrainSetLog {
  ex: number;
  set: number;
  done: boolean;
  reps?: string;
  load?: string;
}

/** Execução de um treino do plano do personal. */
export interface TrainSessionLog {
  status: 'seguido' | 'alterado' | 'saltado';
  sets: TrainSetLog[];
  minutes?: number;
  note?: string;
  changes?: string[];
}

/** Última vez que um exercício foi feito (para mostrar a progressão). */
export function lastPerformance(S: AppState, exName: string, now = new Date(), skipToday = true) {
  for (let i = skipToday ? 1 : 0; i < 120; i++) {
    const key = keyDaysAgo(i, now);
    const logs = S.logs[key]?.trainLog;
    if (!logs) continue;
    for (const [wIdx, log] of Object.entries(logs)) {
      const w = S.trainPlan?.workouts[Number(wIdx)];
      if (!w) continue;
      const exIdx = w.exercises.findIndex((e) => e.name.toLowerCase() === exName.toLowerCase());
      if (exIdx < 0) continue;
      const sets = log.sets.filter((s) => s.ex === exIdx && s.done);
      if (!sets.length) continue;
      const best = sets[sets.length - 1];
      return { date: key, reps: best.reps ?? '', load: best.load ?? '', sets: sets.length };
    }
  }
  return null;
}

/** Treinos do plano feitos na semana atual (segunda a domingo) face aos previstos. */
export function weekTrainAdherence(S: AppState, now = new Date()) {
  const planned = S.trainPlan ? S.trainPlan.per_week || S.trainPlan.workouts.length : 0;
  let done = 0;
  let changed = 0;
  let skipped = 0;
  for (let i = 0; i <= weekdayIndex(now); i++) {
    for (const log of Object.values(S.logs[keyDaysAgo(i, now)]?.trainLog ?? {})) {
      if (log.status === 'saltado') skipped++;
      else {
        done++;
        if (log.status === 'alterado') changed++;
      }
    }
  }
  return { planned, done, changed, skipped, pct: planned ? Math.min(100, Math.round((done / planned) * 100)) : 0 };
}

/** Alterações dos últimos dias, para o relatório do personal. */
export function trainChanges(S: AppState, n = 7, now = new Date()): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const key = keyDaysAgo(i, now);
    for (const [wIdx, log] of Object.entries(S.logs[key]?.trainLog ?? {})) {
      const name = S.trainPlan?.workouts[Number(wIdx)]?.name ?? 'Treino';
      if (log.status === 'seguido') out.push(`${shortDate(key)} · ${name}: feito como planeado${log.note ? ` (nota: ${log.note})` : ''}`);
      else if (log.status === 'saltado') out.push(`${shortDate(key)} · ${name}: não fez${log.note ? ` (nota: ${log.note})` : ''}`);
      else out.push(`${shortDate(key)} · ${name}: ${(log.changes ?? []).join('; ') || 'com alterações'}${log.note ? ` (nota: ${log.note})` : ''}`);
    }
  }
  return out;
}

/** Descreve as diferenças entre o planeado e o feito, por exercício. */
export function describeTrainChanges(exercises: { name: string; sets: number; reps: string; load: string }[], sets: TrainSetLog[]): string[] {
  const out: string[] = [];
  exercises.forEach((e, i) => {
    const mine = sets.filter((s) => s.ex === i);
    const done = mine.filter((s) => s.done);
    if (!done.length) {
      out.push(`sem ${e.name}`);
      return;
    }
    const planned = e.sets || mine.length;
    const parts: string[] = [];
    if (done.length < planned) parts.push(`${done.length}/${planned} séries`);
    const loads = [...new Set(done.map((s) => s.load?.trim()).filter(Boolean))];
    if (loads.length && loads.some((l) => l !== e.load.trim())) parts.push(loads.join('/'));
    const reps = [...new Set(done.map((s) => s.reps?.trim()).filter(Boolean))];
    if (reps.length && reps.some((r) => r !== e.reps.trim())) parts.push(`${reps.join('/')} reps`);
    if (parts.length) out.push(`${e.name}: ${parts.join(', ')}`);
  });
  return out;
}
