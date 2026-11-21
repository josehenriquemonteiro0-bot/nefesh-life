/**
 * AI Coach (especificação v2, secção 4): contexto enviado ao servidor, aplicação das ações
 * devolvidas (registos declarados) e histórico da conversa neste telemóvel.
 *
 * Os cálculos (calorias, macros) são feitos aqui, com a tabela de alimentos da app;
 * o modelo só escolhe os alimentos e as quantidades.
 */
import { GOAL_LABEL, QUESTIONS, TRAINING } from './content';
import { daysSince, fmtNum, keyDaysAgo, shortDate, todayKey } from './dates';
import { foodById, entryOf, MEALS, totals, type FoodEntry, type MealKey } from './foods';
import { planFor, slotsFor } from './plan';
import { doseText } from './lots';
import { adherence, average, streak, tookOn } from './stats';
import { targetsFor } from './body';
import { setSource } from './sources';
import { mealForHour, PHOTO_API, deviceId } from './photo';
import { applyDose } from './doses';
import { memoryContext } from './patterns';
import { asksContext } from './prompts';
import { GYM, logLoads } from './gym';
import { coachPlanMeal, coachPlanWorkout } from './planMeal';
import { womenContext } from './women';
import { progContext, recordProgress, type Feel } from './progression';
import { RUN_PLANS, currentSession, planDone, planSegments, sessionText } from './runPlans';
import { fmtKm, fmtTime } from './gps';
import { CYCLE_SYMPTOMS, FLOW_LABEL, MUCUS } from './cycleData';
import { notePremiumUse } from './analytics';
import type { AppState, DayLog } from './types';

export type CoachActionType =
  | 'agua' | 'sono' | 'spirulina' | 'energia' | 'disposicao' | 'refeicao' | 'plano_refeicao' | 'plano_treino' | 'treino' | 'passos'
  | 'humor' | 'stress' | 'gratidao' | 'respiracao' | 'memoria' | 'nota' | 'lembrete' | 'consulta' | 'desafio' | 'abrir' | 'resumo' | 'peso' | 'meditar' | 'ciclo';

export interface CoachAction {
  type: CoachActionType;
  value: number;
  meal: MealKey | '';
  intensity: 'leve' | 'moderado' | 'intenso' | '';
  title: string;
  replace: boolean;
  /** plano_refeicao: opção, estado e alterações */
  option?: number;
  status?: 'seguido' | 'alterado' | 'saltado' | '';
  note?: string;
  items: { food_id: string; name: string; grams: number; kcal100: number; p100: number; c100: number; f100: number }[];
  /** lembrete e consulta */
  date?: string;
  time?: string;
  /** desafio */
  challenge?: string;
  level?: 'leve' | 'firme';
  friends?: string[];
  /** abrir um ecrã */
  screen?: string;
  /** treino detalhado */
  exercises?: { gym_id: string; name: string; sets: number; reps: number; kg: number; feel?: Feel | '' }[];
}

/** Ações que só acontecem depois de a pessoa confirmar. */
export const NEEDS_CONFIRM: CoachActionType[] = ['lembrete', 'consulta', 'desafio'];

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
  undo?: { day: string; log: DayLog | null; extra?: Pick<AppState, 'memory' | 'gymLoadLog' | 'gymLoads' | 'exNames' | 'bodyLog' | 'ans'> };
  /** propostas que pedem confirmação (lembretes, consulta, desafio) e o seu estado */
  proposals?: CoachAction[];
  proposalStatus?: 'pendente' | 'feito' | 'cancelado';
  /** ecrãs que o assistente sugere abrir */
  open?: string[];
  /** resumo do dia gerado na app */
  summary?: boolean;
  undone?: boolean;
  pro?: boolean;
  /** mensagem ditada por voz */
  voice?: boolean;
  /** pausa de respiração sugerida (minutos) */
  breath?: number;
  /** meditação da biblioteca sugerida (id) */
  meditate?: string;
}

const MEAL_LABEL = Object.fromEntries(MEALS) as Record<MealKey, string>;
const STATUS = { seguido: 'seguido', alterado: 'com alterações', saltado: 'não fez' } as const;
const r1 = (n: number) => Math.round(n * 10) / 10;

/** Resumo do contexto da pessoa (texto curto, sem dados de identificação além do primeiro nome). */
export function buildContext(S: AppState, now = new Date(), extra: { friends?: string[] } = {}): string {
  const a = S.ans ?? {};
  const l = S.logs[todayKey(now)] ?? {};
  const lines: string[] = [];
  const hh = now.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
  lines.push(`Agora: ${now.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}, ${hh}. Data de hoje: ${todayKey(now)}.`);
  const mem = memoryContext(S, now);
  if (mem) lines.push(mem);
  const asks = asksContext(S, now);
  if (asks) lines.push(asks);
  if (extra.friends) lines.push(extra.friends.length ? `Amigos na app (alcunhas): ${extra.friends.slice(0, 30).join(', ')}.` : 'Ainda não tem amigos na app.');
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
    const meds = (S.care?.meds ?? []).filter((m) => m.active);
    if (meds.length) lines.push(`Medicação e suplementos (não alteres doses nem horários; perante dúvidas, o médico ou o farmacêutico): ${meds.map((m) => `${m.name}${m.dose ? ` ${m.dose}` : ''} às ${m.times.join(', ')}`).join('; ')}.`);
    const wc = womenContext(S, now);
    if (wc) lines.push(wc);
    const names = { ...Object.fromEntries(Object.entries(GYM).map(([id, e]) => [id, e.name])), ...(S.exNames ?? {}) };
    const pg = progContext(S, names, todayKey(now));
    if (pg.length) lines.push(`Progressão (carga ou dose da próxima vez): ${pg.join('; ')}.`);
    if (S.runPlan) {
      const rp = S.runPlan;
      if (planDone(rp)) lines.push(`Plano de corrida ${RUN_PLANS[rp.id].title}: concluído.`);
      else {
        const c = currentSession(rp, now);
        lines.push(`Plano de corrida ${RUN_PLANS[rp.id].title}: próxima sessão semana ${c.week}, sessão ${c.session} (${sessionText(planSegments({ ...rp, ...c }))}).`);
      }
    }
    const lastRun = (S.runs ?? [])[(S.runs ?? []).length - 1];
    if (lastRun) lines.push(`Último treino com GPS (${lastRun.date}): ${lastRun.kind}, ${fmtKm(lastRun.dist)} km em ${fmtTime(lastRun.moving)}.`);
    const tg = targetsFor(S);
    lines.push(`Metas diárias (${tg.source === 'pro' ? `do profissional ${tg.by ?? ''}`.trim() : 'referência da app'}): ${tg.kcal} kcal, ${tg.protein} g de proteína; água ${c.water} copos.`);
  }
  // só o plano lido do ficheiro atual (como no cartão do plano)
  const nutriPlan = S.nutriPlan && S.plans?.nutri && S.nutriPlan.name === S.plans.nutri.name ? S.nutriPlan : null;
  const trainPlan = S.trainPlan && S.plans?.treino && S.trainPlan.name === S.plans.treino.name ? S.trainPlan : null;
  if (nutriPlan?.meals.length) {
    const log = l.planLog ?? {};
    lines.push(
      `Plano alimentar do nutricionista${nutriPlan.professional ? ` (${nutriPlan.professional})` : ''} (segue-o, não o alteres). Refeições do plano [n] e o que já está marcado hoje:\n${nutriPlan.meals
        .map((m, i) => `[${i}] ${m.label}${m.time ? ` (${m.time})` : ''}: ${m.options.map((o, j) => `opção ${j}: ${o.items.map((it) => it.name).join(', ')}`).join(' | ')}${log[String(i)] ? ` — hoje: ${STATUS[log[String(i)].status]}` : ''}`)
        .join('\n')}`,
    );
  } else if (S.plans?.nutri) lines.push(`Tem plano alimentar do nutricionista${S.plans.nutri.by ? ` (${S.plans.nutri.by})` : ''}: segue-o, não o alteres.`);
  if (trainPlan?.workouts.length) {
    const tlog = l.trainLog ?? {};
    lines.push(
      `Plano de treino do personal${trainPlan.professional ? ` (${trainPlan.professional})` : ''} (segue-o). Treinos [n] e o que já está marcado hoje:\n${trainPlan.workouts
        .map((w, i) => `[${i}] ${w.name}${w.focus ? ` — ${w.focus}` : ''}${w.day ? ` (${w.day})` : ''}${tlog[String(i)] ? ` — hoje: ${STATUS[tlog[String(i)].status]}` : ''}`)
        .join('\n')}`,
    );
  } else if (S.plans?.treino) lines.push(`Tem plano de treino do personal${S.plans.treino.by ? ` (${S.plans.treino.by})` : ''}: segue-o.`);
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
    if (e.length) today.push(`${name.toLowerCase()}: ${e.map((x) => `${x.name}${x.barcode && S.scanned?.[x.barcode]?.nova === 4 ? ' [ultraprocessado]' : ''}`).join(', ')} (${totals(e).kcal} kcal)`);
  }
  if (l.workouts?.length) today.push(`treinos: ${l.workouts.map((w) => `${w.title} ${w.minutes} min`).join(', ')}`);
  lines.push(`Registos de hoje: ${today.join('; ')}.`);
  const e7 = average(S, 1, 7, 'e', now);
  const s7 = Array.from({ length: 7 }, (_, i) => S.logs[keyDaysAgo(i + 1, now)]?.sleepH).filter((x): x is number => x !== undefined);
  const took7 = Array.from({ length: 7 }, (_, i) => tookOn(S, keyDaysAgo(i + 1, now))).filter(Boolean).length;
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
        const ex = a.exercises ?? [];
        // sem minutos ditos: cerca de 3 minutos por série (com descanso), mínimo 15
        const minutes = Math.round(a.value) || Math.max(15, ex.reduce((t, e) => t + Math.max(1, e.sets) * 3, 0));
        const strength = ex.length > 0 || /for[çc]a|gin[áa]sio|muscula|pesos|crossfit|peito|costas|pernas|bra[çc]os|ombro/i.test(a.title);
        // cargas para o histórico e a evolução (exercícios do ginásio pelo id; os outros pelo nome)
        const loads: Record<string, string> = {};
        for (const e of ex) {
          const key = e.gym_id || `livre:${e.name.trim().toLowerCase()}`;
          const v = `${e.sets && e.reps ? `${e.sets}×${e.reps}` : e.sets ? `${e.sets} séries` : ''}${e.kg ? `${e.sets ? ' · ' : ''}${String(e.kg).replace('.', ',')} kg` : ''}`.trim();
          if (v) loads[key] = v;
          if (!e.gym_id) S.exNames = { ...(S.exNames ?? {}), [key]: e.name.trim() };
        }
        const rated = ex.filter((e) => e.feel && e.gym_id).map((e) => ({ id: e.gym_id, feel: e.feel as Feel, kg: e.kg || null }));
        if (rated.length) S.prog = recordProgress(S.prog, rated, todayKey(now));
        if (Object.keys(loads).length) {
          S.gymLoadLog = logLoads(S.gymLoadLog, loads, todayKey(now));
          S.gymLoads = { ...(S.gymLoads ?? {}), ...Object.fromEntries(Object.entries(loads).filter(([k]) => !k.startsWith('livre:'))) };
        }
        const keep = a.replace ? (l.workouts || []).filter((w) => w.sessionId !== 'coach') : l.workouts || [];
        l.workouts = [...keep, { sessionId: 'coach', title: a.title || 'Treino', minutes, mvpa: a.intensity === 'leve' ? 0 : minutes, strength }];
        l.t = Math.max(l.t ?? 0, INTENSITY[a.intensity] ?? 2);
        done.push(`💪 Treino: ${a.title || 'treino'}, ${minutes} min${ex.length ? ` · ${ex.map((e) => `${e.name}${e.sets && e.reps ? ` ${e.sets}×${e.reps}` : ''}${e.kg ? ` ${String(e.kg).replace('.', ',')} kg` : ''}`).join(', ')}` : ''}`);
        break;
      }
      case 'plano_refeicao': {
        const msg = coachPlanMeal(S, l, a.value, a.option ?? 0, (a.status || 'seguido') as 'seguido' | 'alterado' | 'saltado', a.note);
        if (msg) done.push(`📋 ${msg}${a.status === 'alterado' && a.note ? ` (${a.note})` : ''} ✓`);
        break;
      }
      case 'humor':
        l.d = a.value;
        done.push(`🙂 Humor: ${a.value}/5`);
        break;
      case 'stress':
        l.stress = a.value;
        done.push(`🌬️ Stress: ${a.value}/5`);
        break;
      case 'gratidao': {
        const g = (a.note ?? '').trim();
        if (g) {
          l.grat = [...(l.grat ?? []), g].slice(-5);
          done.push(`💚 Gratidão: ${g}`);
        }
        break;
      }
      case 'peso': {
        const kg = Math.round(a.value * 10) / 10;
        const day = todayKey(now);
        S.bodyLog = [...(S.bodyLog ?? []).filter((e) => e.date !== day), { ...((S.bodyLog ?? []).find((e) => e.date === day) ?? {}), date: day, peso: kg }];
        // o plano (água, metas, dose) acompanha o peso mais recente
        if (S.ans) S.ans = { ...S.ans, peso: kg };
        done.push(`⚖️ Peso: ${String(kg).replace('.', ',')} kg (plano atualizado)`);
        break;
      }
      case 'memoria': {
        const t = (a.note ?? '').trim();
        if (t && !(S.memory?.facts ?? []).some((f) => f.text.toLowerCase() === t.toLowerCase())) {
          S.memory = { ...(S.memory ?? {}), facts: [...(S.memory?.facts ?? []), { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, text: t, at: now.toISOString() }].slice(-30) };
          done.push(`🧠 Vou lembrar-me: ${t}`);
        }
        break;
      }
      case 'nota': {
        const t = (a.note ?? '').trim();
        if (t) {
          l.notes = [...(l.notes ?? []), t].slice(-5);
          done.push(`📝 Relato guardado: ${t}`);
        }
        break;
      }
      case 'ciclo': {
        const msg = applyCycle(S, a, now);
        if (msg) done.push(`🌸 ${msg}`);
        break;
      }
      case 'respiracao':
      case 'meditar':
      case 'lembrete':
      case 'consulta':
      case 'desafio':
      case 'abrir':
      case 'resumo':
        break;
      case 'plano_treino': {
        const msg = coachPlanWorkout(S, l, a.value, a.option ?? 0, (a.status || 'seguido') as 'seguido' | 'alterado' | 'saltado', a.note);
        if (msg) done.push(`🏋️ ${msg} ✓`);
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

/** Registo do ciclo ditado ao assistente (hoje ou um dia passado). */
function applyCycle(S: AppState, a: CoachAction, now: Date): string | null {
  const today = todayKey(now);
  const k = a.date && /^\d{4}-\d{2}-\d{2}$/.test(a.date) && a.date <= today && a.date >= keyDaysAgo(60, now) ? a.date : today;
  const l: DayLog = (S.logs[k] = S.logs[k] || {});
  const c = { ...(l.cycle ?? {}) };
  const when = k === today ? '' : ` (${shortDate(k)})`;
  let msg: string | null = null;
  switch (a.title) {
    case 'menstruacao': {
      c.p = true;
      delete c.spot;
      const f = Math.round(a.value);
      if (f >= 1 && f <= 4) c.flow = f as 1 | 2 | 3 | 4;
      msg = `Menstruação${c.flow ? `, fluxo ${FLOW_LABEL[c.flow].toLowerCase()}` : ''}${when}`;
      break;
    }
    case 'fim':
      delete c.p;
      delete c.flow;
      msg = `Fim da menstruação${when}`;
      break;
    case 'borra':
      c.spot = true;
      msg = `Borra / escape${when}`;
      break;
    case 'sintomas': {
      const said = (a.note ?? '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
      const found = CYCLE_SYMPTOMS.filter((s) => said.includes(s.toLowerCase()));
      if (!found.length) return null;
      c.sy = [...new Set([...(c.sy ?? []), ...found])];
      msg = `Sintomas${when}: ${found.join(', ')}`;
      break;
    }
    case 'dor': {
      const v = Math.max(0, Math.min(10, Math.round(a.value)));
      if (v) c.pain = v;
      else delete c.pain;
      msg = `Dor${when}: ${v} em 10`;
      break;
    }
    case 'muco': {
      const m = MUCUS.find(([key]) => key === (a.note ?? '').trim().toLowerCase());
      if (!m) return null;
      c.mucus = m[0];
      msg = `Muco${when}: ${m[1].toLowerCase()}`;
      break;
    }
    case 'relacao_protegida':
    case 'relacao_desprotegida':
      c.sex = a.title === 'relacao_protegida' ? 'p' : 'u';
      msg = `Relação ${c.sex === 'p' ? 'com' : 'sem'} proteção${when}`;
      break;
    case 'teste_ovulacao_pos':
    case 'teste_ovulacao_neg':
      c.ovt = a.title.endsWith('pos') ? '+' : '-';
      msg = `Teste de ovulação ${c.ovt === '+' ? 'positivo' : 'negativo'}${when}`;
      break;
    case 'teste_gravidez_pos':
    case 'teste_gravidez_neg':
      c.pt = a.title.endsWith('pos') ? '+' : '-';
      msg = `Teste de gravidez ${c.pt === '+' ? 'positivo' : 'negativo'}${when}`;
      break;
    default:
      return null;
  }
  l.cycle = c;
  return msg;
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

export async function askCoach(S: AppState, history: CoachMsg[], extra: { friends?: string[] } = {}): Promise<CoachReply> {
  notePremiumUse('coach');
  let res: Response;
  try {
    res = await fetch(`${PHOTO_API}/coach`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: todaysMessages(history), context: buildContext(S, new Date(), extra), device: deviceId() }),
    });
  } catch {
    throw new CoachError('Sem ligação à internet. Tente outra vez.', 0);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new CoachError(body.error || 'O Coach não conseguiu responder. Tente outra vez.', res.status);
  return body as CoachReply;
}
