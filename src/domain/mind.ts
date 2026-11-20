/**
 * Mente e stress: humor (a disposição do check-in, 1–5), stress (1–5), respiração guiada
 * de 2 a 5 minutos e diário de gratidão. Bem-estar, não terapia: perante tristeza ou
 * ansiedade persistentes, a app sugere um profissional (e linhas de apoio em crise).
 */
import { keyDaysAgo } from './dates';
import type { AppState, DayLog } from './types';

export interface Technique {
  id: 'coerencia' | 'quadrada' | '478';
  name: string;
  text: string;
  /** fases em segundos: inspirar, reter, expirar, reter */
  steps: [string, number][];
}

export const TECHNIQUES: Technique[] = [
  { id: 'coerencia', name: 'Coerência (5–5)', text: 'Inspire 5 segundos, expire 5. Acalma e equilibra; boa para qualquer momento do dia.', steps: [['Inspire', 5], ['Expire', 5]] },
  { id: 'quadrada', name: 'Respiração quadrada', text: 'Inspire 4, segure 4, expire 4, segure 4. Ajuda a focar antes de uma tarefa ou reunião.', steps: [['Inspire', 4], ['Segure', 4], ['Expire', 4], ['Segure', 4]] },
  { id: '478', name: '4-7-8 para dormir', text: 'Inspire 4, segure 7, expire devagar 8. Para desacelerar à noite (se ficar tonto, volte a respirar normalmente).', steps: [['Inspire', 4], ['Segure', 7], ['Expire', 8]] },
];
export const techniqueOf = (id: string) => TECHNIQUES.find((t) => t.id === id) ?? TECHNIQUES[0];

export const MOODS = ['😞', '🙁', '😐', '🙂', '😄'];
export const MOOD_LABEL = ['Muito em baixo', 'Em baixo', 'Assim-assim', 'Bem', 'Muito bem'];
export const STRESS_LABEL = ['Nada', 'Pouco', 'Algum', 'Bastante', 'Muito'];

/** Fase da respiração ao fim de t segundos: nome, segundos que faltam na fase e se é inspirar/expirar. */
export function breathPhase(tech: Technique, t: number) {
  const cycle = tech.steps.reduce((s, [, n]) => s + n, 0);
  let x = t % cycle;
  let big = false;
  for (const [name, n] of tech.steps) {
    // "Segure" mantém o tamanho da fase anterior (cheio depois de inspirar, vazio depois de expirar)
    big = name === 'Inspire' ? true : name === 'Expire' ? false : big;
    if (x < n) return { name, left: Math.ceil(n - x), n, big };
    x -= n;
  }
  return { name: tech.steps[0][0], left: tech.steps[0][1], n: tech.steps[0][1], big: true };
}

/** Grava uma sessão de respiração: marca o hábito e soma os minutos do dia. */
export function logBreath(l: DayLog, minutes: number) {
  l.breath = Math.round(((l.breath ?? 0) + minutes) * 10) / 10;
  l.hab = { ...(l.hab ?? {}), resp: true };
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const r1 = (v: number | null) => (v === null ? null : Math.round(v * 10) / 10);

/** Ligações simples entre o humor e o sono, o movimento e a respiração (30 dias, 3+ dias de cada lado). */
export function moodInsights(S: Pick<AppState, 'logs'>, now = new Date()) {
  const days = Array.from({ length: 30 }, (_, i) => S.logs[keyDaysAgo(i, now)]).filter((l): l is DayLog => !!l?.d);
  const pair = (f: (l: DayLog) => boolean | null) => {
    const yes = days.filter((l) => f(l) === true).map((l) => l.d!);
    const no = days.filter((l) => f(l) === false).map((l) => l.d!);
    return yes.length >= 3 && no.length >= 3 ? { yes: r1(mean(yes))!, no: r1(mean(no))! } : null;
  };
  const out: { text: string; diff: number }[] = [];
  const sleep = pair((l) => (typeof l.sleepH === 'number' ? l.sleepH >= 7 : null));
  if (sleep) out.push({ text: `Nos dias depois de dormir 7 h ou mais, o seu humor é ${sleep.yes} (contra ${sleep.no}).`, diff: sleep.yes - sleep.no });
  const move = pair((l) => (l.workouts?.length ?? 0) > 0 || (l.steps ?? 0) >= 7000);
  if (move) out.push({ text: `Nos dias com treino ou 7000+ passos, o humor é ${move.yes} (contra ${move.no}).`, diff: move.yes - move.no });
  const breath = pair((l) => (l.breath ?? 0) > 0);
  if (breath) out.push({ text: `Nos dias com respiração guiada, o humor é ${breath.yes} (contra ${breath.no}).`, diff: breath.yes - breath.no });
  return out.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
}

/** Humor baixo ou stress alto em 5 dos últimos 7 dias: sugerir falar com alguém. */
export function needsSupport(S: Pick<AppState, 'logs'>, now = new Date()) {
  const last = Array.from({ length: 7 }, (_, i) => S.logs[keyDaysAgo(i, now)]);
  return last.filter((l) => (l?.d !== undefined && l.d <= 2) || (l?.stress ?? 0) >= 5).length >= 5;
}

/** Entradas recentes do diário de gratidão. */
export function gratitudeLog(S: Pick<AppState, 'logs'>, n = 14, now = new Date()) {
  return Array.from({ length: n }, (_, i) => ({ day: keyDaysAgo(i, now), items: S.logs[keyDaysAgo(i, now)]?.grat ?? [] })).filter((x) => x.items.length);
}

/** Pedido para abrir a respiração guiada (vindo do Coach). */
const KEY = 'nefesh-respirar';
export const requestBreath = (min: number) => {
  try {
    sessionStorage.setItem(KEY, String(min));
  } catch {
    /* sem armazenamento */
  }
};
export const takeBreathRequest = () => {
  try {
    const v = Number(sessionStorage.getItem(KEY));
    sessionStorage.removeItem(KEY);
    return v > 0 ? v : null;
  } catch {
    return null;
  }
};
