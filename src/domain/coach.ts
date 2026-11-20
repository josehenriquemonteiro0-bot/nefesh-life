/**
 * AI Coach (especificação v2, secção 4): contexto enviado ao servidor, aplicação das ações
 * devolvidas (registos declarados) e histórico da conversa neste telemóvel.
 *
 * Os cálculos (calorias, macros) são feitos aqui, com a tabela de alimentos da app;
 * o modelo só escolhe os alimentos e as quantidades.
 */
import { GOAL_LABEL, QUESTIONS, TRAINING } from './content';
import { daysSince, fmtNum, keyDaysAgo, todayKey } from './dates';
import { foodById, entryOf, MEALS, totals, type FoodEntry, type MealKey } from './foods';
import { planFor, slotsFor } from './plan';
import { doseText } from './lots';
import { adherence, average, streak, took } from './stats';
import { targetsFor } from './body';
import { setSource } from './sources';
import { mealForHour, PHOTO_API, deviceId } from './photo';
import { applyDose } from './doses';
import { notePremiumUse } from './analytics';
import type { AppState, DayLog } from './types';

export type CoachActionType = 'agua' | 'sono' | 'spirulina' | 'energia' | 'disposicao' | 'refeicao' | 'treino' | 'passos';

export interface CoachAction {
  type: CoachActionType;
  value: number;
  meal: MealKey | '';
  intensity: 'leve' | 'moderado' | 'intenso' | '';
  title: string;
  replace: boolean;
  items: { food_id: string; name: string; grams: number; kcal100: number; p100: number; c100: number; f100: number }[];
}

export interface CoachReply {
  reply: string;
  actions: CoachAction[];
  suggest_professional: boolean;
  remaining?: number;
  limit?: number;
}

export interface CoachMsg {
  role: 'user' | 'assistant';
  text: string;
  at: string;
  /** o que foi registado com esta resposta */
  applied?: string[];
  /** registo do dia antes destas ações (para desfazer) */
  undo?: { day: string; log: DayLog | null };
  undone?: boolean;
  pro?: boolean;
}

const MEAL_LABEL = Object.fromEntries(MEALS) as Record<MealKey, string>;
const r1 = (n: number) => Math.round(n * 10) / 10;

/** Resumo do contexto da pessoa (texto curto, sem dados de identificação além do primeiro nome). */
export function buildContext(S: AppState, now = new Date()): string {
  const a = S.ans ?? {};
  const l = S.logs[todayKey(now)] ?? {};
  const lines: string[] = [];
  const hh = now.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
  lines.push(`Agora: ${now.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}, ${hh}.`);
  if (a.name) lines.push(`Primeiro nome: ${a.name}.`);
  if (!S.ans) lines.push('Ainda não fez a avaliação inicial (sugere fazê-la no separador Saúde → Plano).');
  else {
    lines.push(`Objetivo: ${GOAL_LABEL[a.goal ?? 'energia']}.${S.planStart ? ` Dia ${daysSince(S.planStart, now) + 1} do ritual.` : ''}`);
    const c = planFor(S);
    const sl = slotsFor(S, now);
    lines.push(
      `Plano de Spirulina: ${doseText(c.caps, c.format)} por dia (${fmtNum(c.g)} g)${S.proDose ? `, indicado por ${S.proDose.by || 'um profissional'}` : ''}; tomas: ${sl.map((s, i) => `${s.l} ${doseText(s.n, c.format)} ${(l.doses || [])[i] ? '(tomada hoje)' : '(por tomar)'}`).join(', ')}; lembrete às ${S.reminder}.`,
    );
    lines.push(`Ritual: ${streak(S, now)} dias seguidos; aderência ${adherence(S, 14, now)}% nos últimos 14 dias.`);
    const flags = (a.safe || []).filter((x) => x !== 'nenhuma');
    if (flags.length) {
      const q = QUESTIONS.find((x) => x.id === 'safe');
      const opts: Record<string, string> = Object.fromEntries(q && 'o' in q ? q.o : []);
      lines.push(`Cuidados declarados: ${flags.map((f) => opts[f] ?? f).join(', ')} (não dês conselhos que dependam disto; sugere o profissional).`);
    }
    const tg = targetsFor(S);
    lines.push(`Metas diárias (${tg.source === 'pro' ? `do profissional ${tg.by ?? ''}`.trim() : 'referência da app'}): ${tg.kcal} kcal, ${tg.protein} g de proteína; água ${c.water} copos.`);
  }
  if (S.plans?.nutri) lines.push(`Tem plano alimentar do nutricionista${S.plans.nutri.by ? ` (${S.plans.nutri.by})` : ''}: segue-o, não o alteres.`);
  if (S.plans?.treino) lines.push(`Tem plano de treino do personal${S.plans.treino.by ? ` (${S.plans.treino.by})` : ''}: segue-o.`);
  // hoje
  const today: string[] = [];
  today.push(`água ${l.water ?? 0} copos`);
  if (l.sleepH !== undefined) today.push(`sono ${fmtNum(l.sleepH)} h`);
  if (l.e) today.push(`energia ${l.e}/5`);
  if (l.d) today.push(`disposição ${l.d}/5`);
  if (l.steps !== undefined) today.push(`${l.steps} passos`);
  if (l.t) today.push(`treino ${TRAINING[l.t].toLowerCase()}`);
  for (const [k, name] of MEALS) {
    const e = (l.meals?.[k] || []).filter((x) => !x.auto);
    if (e.length) today.push(`${name.toLowerCase()}: ${e.map((x) => x.name).join(', ')} (${totals(e).kcal} kcal)`);
  }
  if (l.workouts?.length) today.push(`treinos: ${l.workouts.map((w) => `${w.title} ${w.minutes} min`).join(', ')}`);
  lines.push(`Registos de hoje: ${today.join('; ')}.`);
  const e7 = average(S, 1, 7, 'e', now);
  const s7 = Array.from({ length: 7 }, (_, i) => S.logs[keyDaysAgo(i + 1, now)]?.sleepH).filter((x): x is number => x !== undefined);
  const took7 = Array.from({ length: 7 }, (_, i) => took(S, S.logs[keyDaysAgo(i + 1, now)], now)).filter(Boolean).length;
  lines.push(`Últimos 7 dias: energia média ${e7 ? fmtNum(r1(e7)) : '—'}/5; sono médio ${s7.length ? `${fmtNum(r1(s7.reduce((x, y) => x + y, 0) / s7.length))} h` : '—'}; Spirulina em ${took7} de 7 dias.`);
  return lines.join('\n');
}

/** Entrada do diário a partir de um alimento indicado pelo Coach (tabela da app, ou estimativa marcada). */
export function coachEntry(i: CoachAction['items'][number]): FoodEntry {
  const food = i.food_id ? foodById(i.food_id) : undefined;
  if (food) return { ...entryOf(food, Math.round(i.grams)), coach: true };
  const k = i.grams / 100;
  return {
    id: `coach-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: i.name || 'Alimento',
    grams: Math.round(i.grams),
    kcal: Math.round(i.kcal100 * k),
    p: r1(i.p100 * k),
    c: r1(i.c100 * k),
    f: r1(i.f100 * k),
    coach: true,
    est: true,
  };
}

const INTENSITY: Record<string, number> = { leve: 1, moderado: 2, intenso: 3 };

/**
 * Aplica as ações ao registo de hoje (no rascunho do estado) e devolve o que foi registado,
 * em frases curtas para mostrar à pessoa.
 */
export function applyCoachActions(S: AppState, actions: CoachAction[], now = new Date()): string[] {
  const key = todayKey(now);
  const l: DayLog = (S.logs[key] = S.logs[key] || {});
  const done: string[] = [];
  for (const a of actions) {
    switch (a.type) {
      case 'agua': {
        const before = l.water ?? 0;
        l.water = Math.max(0, Math.min(30, a.replace ? a.value : before + a.value));
        done.push(`💧 Água: ${l.water} ${l.water === 1 ? 'copo' : 'copos'} hoje`);
        break;
      }
      case 'sono':
        l.sleepH = Math.max(0, Math.min(16, Math.round(a.value * 2) / 2));
        setSource(l, 'sleepH', null);
        done.push(`🌙 Sono: ${fmtNum(l.sleepH)} h`);
        break;
      case 'energia':
        l.e = a.value;
        done.push(`⚡ Energia: ${a.value}/5`);
        break;
      case 'disposicao':
        l.d = a.value;
        done.push(`🙂 Disposição: ${a.value}/5`);
        break;
      case 'passos':
        l.steps = a.value;
        setSource(l, 'steps', null);
        done.push(`👟 Passos: ${a.value.toLocaleString('pt-PT')}`);
        break;
      case 'spirulina': {
        if (!S.ans) break;
        const sl = slotsFor(S, now);
        const missing = sl.map((_, i) => i).filter((i) => !(l.doses || [])[i]);
        for (const i of missing) applyDose(S, l, i, true);
        done.push(missing.length ? '🌿 Spirulina: toma marcada' : '🌿 Spirulina: já estava marcada');
        break;
      }
      case 'treino': {
        const minutes = Math.round(a.value);
        const strength = /for[çc]a|gin[áa]sio|muscula|pesos|crossfit/i.test(a.title);
        const keep = a.replace ? (l.workouts || []).filter((w) => w.sessionId !== 'coach') : l.workouts || [];
        l.workouts = [...keep, { sessionId: 'coach', title: a.title || 'Treino', minutes, mvpa: a.intensity === 'leve' ? 0 : minutes, strength }];
        l.t = Math.max(l.t ?? 0, INTENSITY[a.intensity] ?? 2);
        done.push(`💪 Treino: ${a.title || 'treino'}, ${minutes} min`);
        break;
      }
      case 'refeicao': {
        const meal: MealKey = a.meal || mealForHour(now.getHours());
        const meals = { ...(l.meals || {}) };
        const prev = meals[meal] || [];
        const entries = a.items.map(coachEntry);
        meals[meal] = [...(a.replace ? prev.filter((e) => !e.coach) : prev), ...entries];
        l.meals = meals;
        const t = totals(entries);
        const est = entries.some((e) => e.est);
        done.push(`🍽️ ${MEAL_LABEL[meal]}: ${entries.map((e) => `${e.name} (${e.grams} g)`).join(', ')} · ${t.kcal} kcal${est ? ' (estimativa)' : ''}`);
        break;
      }
    }
  }
  return done;
}

// histórico da conversa (só neste telemóvel)
const HISTORY_KEY = 'nefesh-life-coach';
export function loadHistory(): CoachMsg[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') as CoachMsg[];
  } catch {
    return [];
  }
}
export function saveHistory(h: CoachMsg[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(-40)));
  } catch {
    /* sem armazenamento */
  }
}
export function clearHistory() {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    /* sem armazenamento */
  }
}

/** Só as mensagens de hoje vão para o Coach (os registos são sempre do dia). */
export const todaysMessages = (h: CoachMsg[], now = new Date()) =>
  h.filter((m) => new Date(m.at).toDateString() === now.toDateString()).slice(-12).map(({ role, text }) => ({ role, text }));

export class CoachError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function askCoach(S: AppState, history: CoachMsg[]): Promise<CoachReply> {
  notePremiumUse('coach');
  let res: Response;
  try {
    res = await fetch(`${PHOTO_API}/coach`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: todaysMessages(history), context: buildContext(S), device: deviceId() }),
    });
  } catch {
    throw new CoachError('Sem ligação à internet. Tente outra vez.', 0);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new CoachError(body.error || 'O Coach não conseguiu responder. Tente outra vez.', res.status);
  return body as CoachReply;
}
