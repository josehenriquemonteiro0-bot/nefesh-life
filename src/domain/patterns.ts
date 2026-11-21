/**
 * "O que o assistente sabe sobre si": padrões calculados no telemóvel a partir dos registos
 * (dia da semana em que falha o treino ou a Spirulina, sono ao fim de semana, água, alimentos
 * mais frequentes, ligação do humor ao sono…) e factos que a pessoa pediu para lembrar.
 * Tudo visível e apagável; o assistente usa-os para dar sugestões mais certeiras.
 */
import { dayKey, keyDaysAgo } from './dates';
import { planFor } from './plan';
import { tookOn } from './stats';
import { moodInsights } from './mind';
import type { AppState, DayLog } from './types';

export interface Pattern {
  id: string;
  text: string;
}

const DAYS_PL = ['aos domingos', 'às segundas-feiras', 'às terças-feiras', 'às quartas-feiras', 'às quintas-feiras', 'às sextas-feiras', 'aos sábados'];
const fmt = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',');
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Dias dos últimos n dias com registos, com o dia da semana. */
function lastDays(S: Pick<AppState, 'logs'>, n: number, now: Date) {
  return Array.from({ length: n }, (_, i) => {
    const k = keyDaysAgo(i + 1, now);
    return { k, wd: new Date(`${k}T12:00:00`).getDay(), l: S.logs[k] as DayLog | undefined };
  });
}

/** Dia da semana claramente mais fraco num hábito (só com 4+ semanas de uso). */
function weakDay(days: ReturnType<typeof lastDays>, f: (l: DayLog | undefined, k: string) => boolean) {
  const used = days.filter((d) => d.l && Object.keys(d.l).length);
  if (used.length < 21) return null;
  const rate = Array.from({ length: 7 }, (_, wd) => {
    const ds = used.filter((d) => d.wd === wd);
    return ds.length >= 3 ? ds.filter((d) => f(d.l, d.k)).length / ds.length : null;
  });
  const known = rate.filter((r): r is number => r !== null);
  const avg = mean(known);
  if (avg === null || avg < 0.3) return null;
  const min = Math.min(...known);
  return min <= avg - 0.3 ? { wd: rate.indexOf(min), min, avg } : null;
}

export function patternsOf(S: AppState, now = new Date()): Pattern[] {
  const out: Pattern[] = [];
  const d56 = lastDays(S, 56, now);
  const d30 = d56.slice(0, 30);

  const tr = weakDay(d56, (l) => (l?.workouts?.length ?? 0) > 0);
  if (tr) out.push({ id: 'treino-dia', text: `Costuma falhar o treino ${DAYS_PL[tr.wd]}.` });
  if (S.ans) {
    const sp = weakDay(d56, (_l, k) => tookOn(S, k));
    if (sp) out.push({ id: 'spirulina-dia', text: `Esquece mais a Spirulina ${DAYS_PL[sp.wd]}.` });
  }

  const sleepW = d56.filter((d) => (d.wd === 0 || d.wd === 6) && typeof d.l?.sleepH === 'number').map((d) => d.l!.sleepH!);
  const sleepD = d56.filter((d) => d.wd > 0 && d.wd < 6 && typeof d.l?.sleepH === 'number').map((d) => d.l!.sleepH!);
  if (sleepW.length >= 3 && sleepD.length >= 6) {
    const w = mean(sleepW)!;
    const dd = mean(sleepD)!;
    if (Math.abs(w - dd) >= 0.5) out.push({ id: 'sono-fds', text: `Dorme ${w < dd ? 'menos' : 'mais'} ao fim de semana (${fmt(w)} h contra ${fmt(dd)} h durante a semana).` });
  }

  if (S.ans) {
    const goal = planFor(S).water;
    const wDays = d30.filter((d) => (d.l?.water ?? 0) > 0);
    if (wDays.length >= 7) {
      const ok = wDays.filter((d) => d.l!.water! >= goal).length;
      if (ok / wDays.length < 0.4) out.push({ id: 'agua', text: `A água fica muitas vezes abaixo da meta (cumpriu em ${ok} de ${wDays.length} dias).` });
    }
  }

  const count: Record<string, number> = {};
  for (const d of d30) for (const m of Object.values(d.l?.meals ?? {})) for (const e of m ?? []) if (!e.auto) count[e.name.replace(/\s*\(.*\)$/, '')] = (count[e.name.replace(/\s*\(.*\)$/, '')] ?? 0) + 1;
  const top = Object.entries(count).filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([n]) => n.toLowerCase());
  if (top.length) out.push({ id: 'alimentos', text: `Come com frequência: ${top.join(', ')}.` });

  const mood = moodInsights(S, now)[0];
  if (mood && Math.abs(mood.diff) >= 0.5) out.push({ id: 'humor', text: mood.text });

  const e = d30.filter((d) => d.l?.e);
  const eTrain = e.filter((d) => (d.l!.workouts?.length ?? 0) > 0).map((d) => d.l!.e!);
  const eRest = e.filter((d) => !(d.l!.workouts?.length ?? 0)).map((d) => d.l!.e!);
  if (eTrain.length >= 3 && eRest.length >= 3 && Math.abs(mean(eTrain)! - mean(eRest)!) >= 0.5)
    out.push({ id: 'energia-treino', text: `Nos dias com treino a energia é ${fmt(mean(eTrain)!)}, nos outros ${fmt(mean(eRest)!)}.` });

  if (S.plans?.nutri) out.push({ id: 'plano-nutri', text: `Segue um plano alimentar${S.plans.nutri.by ? ` de ${S.plans.nutri.by}` : ' do nutricionista'}.` });
  if (S.plans?.treino) out.push({ id: 'plano-treino', text: `Segue um plano de treino${S.plans.treino.by ? ` de ${S.plans.treino.by}` : ' do personal'}.` });
  return out.filter((p) => !(S.memory?.hidden ?? []).includes(p.id));
}

/** Relatos guardados nos últimos n dias (mais recentes primeiro). */
export function recentNotes(S: Pick<AppState, 'logs'>, n = 21, now = new Date()) {
  return Array.from({ length: n }, (_, i) => keyDaysAgo(i, now))
    .flatMap((k) => (S.logs[k]?.notes ?? []).map((text, idx) => ({ day: k, idx, text })));
}

/** Linhas para o contexto do assistente. */
export function memoryContext(S: AppState, now = new Date()) {
  const lines: string[] = [];
  const p = patternsOf(S, now);
  const facts = S.memory?.facts ?? [];
  if (p.length || facts.length) lines.push(`O que sabes sobre a pessoa (usa para personalizar, sem o repetir a cada mensagem):\n${[...facts.map((f) => `- ${f.text}`), ...p.map((x) => `- ${x.text}`)].join('\n')}`);
  const notes = recentNotes(S, 21, now);
  if (notes.length) lines.push(`Relatos recentes da pessoa:\n${notes.slice(0, 8).map((x) => `- ${x.day}: ${x.text}`).join('\n')}`);
  const up = (S.reminders ?? []).filter((r) => r.date >= dayKey(now)).slice(0, 6);
  if (up.length) lines.push(`Lembretes combinados: ${up.map((r) => `${r.date} ${r.time} ${r.text}`).join('; ')}.`);
  return lines.join('\n');
}
