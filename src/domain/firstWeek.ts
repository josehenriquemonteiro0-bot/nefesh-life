/**
 * Primeira semana e desafio da semana.
 * - Desafio da semana: uma micro-ação para o pilar mais fraco (com a Spirulina como apoio),
 *   com um visto por dia; ao fim de 7 dias, a app mostra se o pilar melhorou e propõe o seguinte.
 * - Jornada dos 7 dias: algo novo em cada dia da primeira semana (um cartão no Início).
 */
import { AREAS, INSTAGRAM_REEL } from './content';
import { addDaysKey, daysSince, todayKey } from './dates';
import { provisionalAreas } from './onboarding';
import { planFor } from './plan';
import { took } from './stats';
import type { AppState, AreaKey } from './types';

export const MICRO: Record<AreaKey, { title: string; text: string; metric: string }> = {
  sono: { title: 'Deitar-se 30 minutos mais cedo', text: 'Antes de dormir, experimente a respiração 4-7-8 (em Mente): ajuda a desligar.', metric: 'sono médio' },
  hidratacao: { title: 'Um copo de água ao acordar e em cada refeição', text: 'Marque os copos no Início: a meta é calculada para o seu peso.', metric: 'dias com a meta de água' },
  movimento: { title: '10 minutos de caminhada depois do almoço', text: 'Todos os dias: ajuda a digestão e a energia da tarde.', metric: 'minutos de atividade' },
  nutricao: { title: 'Uma porção de vegetais ao almoço', text: 'Todos os dias: metade do prato, crus ou cozinhados.', metric: 'dias com vegetais ao almoço' },
  energia: { title: '5 minutos de pausa a meio da tarde', text: 'Respirar fundo, apanhar ar ou luz do dia. Experimente a respiração guiada em Mente.', metric: 'energia média' },
};

export interface Challenge { area: AreaKey; start: string; done: string[] }

const r1 = (v: number) => Math.round(v * 10) / 10;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Pilar mais fraco com resposta (as áreas provisórias ficam de fora). */
export function weakestArea(S: Pick<AppState, 'evals' | 'ans'>, skip?: AreaKey): AreaKey {
  const ev = S.evals[S.evals.length - 1];
  if (!ev) return 'hidratacao';
  const prov = provisionalAreas(S.ans);
  const list = AREAS.map(([k]) => k).filter((k) => !prov.includes(k) && k !== skip);
  return (list.length ? list : AREAS.map(([k]) => k)).sort((a, b) => ev.sc[a] - ev.sc[b])[0];
}

/** Valor do pilar nos 7 dias a partir de start (para comparar com a semana anterior). */
export function areaMetric(S: AppState, area: AreaKey, start: string): number | null {
  const keys = Array.from({ length: 7 }, (_, i) => addDaysKey(start, i));
  const logs = keys.map((k) => S.logs[k]);
  switch (area) {
    case 'sono': {
      const m = mean(logs.map((l) => l?.sleepH).filter((v): v is number => typeof v === 'number'));
      return m === null ? null : r1(m);
    }
    case 'hidratacao': {
      if (!logs.some((l) => l?.water)) return null;
      const goal = S.ans ? planFor(S).water : 8;
      return logs.filter((l) => (l?.water ?? 0) >= goal).length;
    }
    case 'movimento':
      return logs.some(Boolean) ? logs.reduce((t, l) => t + (l?.workouts ?? []).reduce((a, w) => a + w.mvpa, 0), 0) : null;
    case 'nutricao':
      return logs.some(Boolean) ? logs.filter((l) => l?.hab?.veg).length : null;
    default: {
      const m = mean(logs.map((l) => l?.e).filter((v): v is number => !!v));
      return m === null ? null : r1(m);
    }
  }
}

/** Desafio em curso (ou null), e o resultado quando a semana acabou. */
export function challengeState(S: AppState, now = new Date()) {
  const c = S.challenge;
  if (!c) return null;
  const today = todayKey(now);
  const day = daysSince(c.start, now) + 1;
  const ended = day > 7;
  const doneToday = c.done.includes(today);
  if (!ended) return { c, day, ended, doneToday, result: null };
  const before = areaMetric(S, c.area, addDaysKey(c.start, -7));
  const after = areaMetric(S, c.area, c.start);
  const better = before !== null && after !== null ? after > before : null;
  return { c, day, ended, doneToday, result: { before, after, better, days: c.done.length } };
}

export const newChallenge = (S: Pick<AppState, 'evals' | 'ans'>, today = todayKey(), skip?: AreaKey): Challenge => ({ area: weakestArea(S, skip), start: today, done: [] });

/** Visto do dia; no desafio dos vegetais também marca o hábito "Vegetais ao almoço". */
export function markChallenge(S: AppState, now = new Date()) {
  if (!S.challenge) return;
  const today = todayKey(now);
  const on = !S.challenge.done.includes(today);
  S.challenge = { ...S.challenge, done: on ? [...S.challenge.done, today] : S.challenge.done.filter((d) => d !== today) };
  if (S.challenge.area === 'nutricao') {
    const l = (S.logs[today] = S.logs[today] ?? {});
    l.hab = { ...(l.hab ?? {}), veg: on };
  }
}

/* ───────── jornada dos 7 dias ───────── */

export type JourneyKind = 'vitoria' | 'receita' | 'insight' | 'pilar' | 'ciencia' | 'comunidade' | 'semana';
export interface JourneyCard { day: number; kind: JourneyKind; title: string; text: string; video?: string }

/** Primeiro padrão (dia 3): só com uma diferença real; senão, um facto verdadeiro do ritual. */
export function firstInsight(S: AppState, now = new Date()) {
  const keys = Array.from({ length: 4 }, (_, i) => addDaysKey(todayKey(now), -i)).filter((k) => !S.planStart || k >= S.planStart);
  const goal = S.ans ? planFor(S).water : 8;
  const withE = keys.filter((k) => S.logs[k]?.e);
  const split = (test: (k: string) => boolean) => {
    const a = withE.filter(test).map((k) => S.logs[k]!.e!), b = withE.filter((k) => !test(k)).map((k) => S.logs[k]!.e!);
    return a.length && b.length ? { a: a.length, diff: mean(a)! - mean(b)! } : null;
  };
  const water = split((k) => (S.logs[k]?.water ?? 0) >= goal);
  if (water && water.diff >= 1) return `Nos ${water.a === 1 ? 'dia' : `${water.a} dias`} em que bebeu a meta de água, a sua energia foi maior. Continue a marcar: com mais dias, a app confirma o padrão.`;
  const sleep = split((k) => (S.logs[k]?.sleepH ?? 0) >= 7);
  if (sleep && sleep.diff >= 1) return `Nos ${sleep.a === 1 ? 'dia' : `${sleep.a} dias`} em que dormiu 7 horas ou mais, a sua energia foi maior.`;
  const doses = keys.filter((k) => took(S, S.logs[k], now)).length;
  return doses ? `Já tomou a Spirulina em ${doses} ${doses === 1 ? 'dia' : 'dias'}. Faça o check-in (energia e sono) todos os dias: a partir daqui a app começa a mostrar o que mais mexe consigo.` : 'Faça o check-in (energia e sono) todos os dias: com 3 ou 4 dias, a app começa a mostrar o que mais mexe consigo.';
}

const AREA_NAME = Object.fromEntries(AREAS) as Record<AreaKey, string>;

/** Cartão do dia da primeira semana (null fora dos dias 1 a 7, ou já fechado). */
export function journeyCard(S: AppState, now = new Date()): JourneyCard | null {
  if (!S.ans || S.sample || !S.planStart) return null;
  const day = daysSince(S.planStart, now) + 1;
  if (day < 1 || day > 7 || (S.journeySeen ?? []).includes(day)) return null;
  const today = todayKey(now);
  switch (day) {
    case 1:
      return took(S, S.logs[today], now)
        ? { day, kind: 'vitoria', title: '🎉 Primeira vitória!', text: 'A sua primeira toma está feita: o ritual começou. Amanhã há uma pergunta nova e uma receita para experimentar.' }
        : null;
    case 2:
      return { day, kind: 'receita', title: '🥣 Receita com Spirulina', text: 'Experimente hoje uma receita: um batido, uma tosta ou um iogurte com Spirulina, em poucos minutos.' };
    case 3:
      return { day, kind: 'insight', title: '💡 O seu primeiro padrão', text: firstInsight(S, now) };
    case 4: {
      const a = S.challenge?.area ?? weakestArea(S);
      return { day, kind: 'pilar', title: `🎯 Hoje: ${AREA_NAME[a].toLowerCase()}`, text: `É o pilar em que tem mais a ganhar. O desafio desta semana: ${MICRO[a].title.toLowerCase()}. ${MICRO[a].text}` };
    }
    case 5:
      return { day, kind: 'ciencia', title: '🔬 A ciência por trás do seu plano', text: 'Os estudos sobre a Spirulina e o seu objetivo, explicados de forma simples. E um vídeo da NEFESH no Instagram.', video: INSTAGRAM_REEL || undefined };
    case 6:
      return { day, kind: 'comunidade', title: '👨‍👩‍👧 Juntos é mais fácil', text: 'Convide a família ou amigos para um desafio, ou entre na liga semanal da comunidade.' };
    default:
      return { day, kind: 'semana', title: '📊 A sua primeira semana', text: 'Veja o resumo dos seus primeiros 7 dias e faça a primeira reavaliação: o Índice antes e depois.' };
  }
}

/* ───────── Evolução na primeira semana: marcos e primeiro insight ───────── */

/** Check-ins que desbloqueiam cada insight; aos 10 aparece o resumo completo. */
export const INSIGHT_STEPS = [2, 4, 7, 10];

/** Dias com check-in (energia) desde o início do plano, no máximo os últimos 30. */
export function checkinDays(S: AppState, now = new Date()) {
  const out: string[] = [];
  for (let i = 0; i < 30; i++) {
    const k = addDaysKey(todayKey(now), -i);
    if (S.planStart && k < S.planStart) break;
    if (S.logs[k]?.e) out.push(k);
  }
  return out.reverse();
}

/**
 * O dia de maior energia contra o de menor: o fator com mais diferença (desafio feito,
 * copos de água, horas de sono, Spirulina tomada), só quando o dia bom tem o valor "bom".
 */
export function energyInsight(S: AppState, now = new Date()) {
  const days = checkinDays(S, now);
  if (days.length < 2) return null;
  const e = (k: string) => S.logs[k]!.e!;
  const hi = days.reduce((a, b) => (e(b) > e(a) ? b : a));
  const lo = days.reduce((a, b) => (e(b) < e(a) ? b : a));
  if (e(hi) === e(lo)) return null;
  const L = (k: string) => S.logs[k] ?? {};
  const cand: { score: number; text: string }[] = [];
  const ch = S.challenge;
  if (ch && ch.done.includes(hi) && !ch.done.includes(lo)) cand.push({ score: 1, text: 'fez o desafio da semana' });
  if (took(S, S.logs[hi], now) && !took(S, S.logs[lo], now)) cand.push({ score: 1, text: 'tomou a Spirulina' });
  const w = (L(hi).water ?? 0) - (L(lo).water ?? 0);
  if (w >= 2) cand.push({ score: w / 4, text: `bebeu ${L(hi).water} copos de água` });
  const s = (L(hi).sleepH ?? 0) - (L(lo).sleepH ?? 0);
  if (typeof L(hi).sleepH === 'number' && typeof L(lo).sleepH === 'number' && s >= 1) cand.push({ score: s / 2, text: `dormiu ${String(L(hi).sleepH).replace('.', ',')} horas` });
  if (!cand.length) return null;
  const best = cand.sort((a, b) => b.score - a.score)[0];
  const others = days.filter((k) => k !== hi).map(e);
  const y = Math.round((others.reduce((a, b) => a + b, 0) / others.length) * 10) / 10;
  return { text: `No dia em que ${best.text}, a sua energia foi ${e(hi)}. Nos outros, ${String(y).replace('.', ',')}.` };
}

/** Estado dos marcos: check-ins, próximo insight, nível já atingido e ontem/hoje. */
export function insightProgress(S: AppState, now = new Date()) {
  const n = checkinDays(S, now).length;
  const next = INSIGHT_STEPS.find((x) => x > n) ?? null;
  const level = INSIGHT_STEPS.filter((x) => x <= n).pop() ?? 0;
  const today = todayKey(now), yesterday = addDaysKey(today, -1);
  const yt = S.logs[yesterday]?.e && S.logs[today]?.e && (!S.planStart || yesterday >= S.planStart) ? { y: S.logs[yesterday]!.e!, t: S.logs[today]!.e! } : null;
  return { n, next, left: next ? next - n : 0, level, yt, insight: n >= 2 ? energyInsight(S, now) : null };
}

/* ───────── Início progressivo ───────── */

export type HomeCard = 'agua' | 'comunidade' | 'passos' | 'habitos' | 'pros';
export const CARD_LABEL: Record<HomeCard, string> = { agua: 'Hidratação', comunidade: 'Comunidade', passos: 'Passos', habitos: 'Hábitos de hoje', pros: 'Profissionais' };
const ALL_CARDS: HomeCard[] = ['agua', 'comunidade', 'passos', 'habitos', 'pros'];

/** Calendário: dia 4 o pilar mais fraco (hidratação, ou passos se for o movimento), 6 comunidade, 8 o outro, 10 hábitos, 14 profissionais. */
export function unlockPlan(S: Pick<AppState, 'evals' | 'ans'>): [number, HomeCard][] {
  const first: HomeCard = weakestArea(S) === 'movimento' ? 'passos' : 'agua';
  return [[4, first], [6, 'comunidade'], [8, first === 'agua' ? 'passos' : 'agua'], [10, 'habitos'], [14, 'pros']];
}

/**
 * Cartões visíveis no Início. Progressivo só para quem começou com esta versão
 * (homeProgressive), até ao 14.º dia; "Mostrar tudo no Início" no Perfil desliga.
 * A hidratação aparece logo se o desafio da semana for a água.
 */
export function homeVisibility(S: AppState, now = new Date()) {
  const all = { show: new Set<HomeCard>(ALL_CARDS), novo: null as HomeCard | null, amanha: null as HomeCard | null, progressive: false };
  if (!S.ans || S.sample || S.homeAll || !S.homeProgressive || !S.planStart) return all;
  const day = daysSince(S.planStart, now) + 1;
  const plan = unlockPlan(S);
  if (day > plan[plan.length - 1][0]) return all;
  const show = new Set<HomeCard>(plan.filter(([d]) => d <= day).map(([, c]) => c));
  if (S.challenge?.area === 'hidratacao') show.add('agua');
  return { show, novo: plan.find(([d]) => d === day)?.[1] ?? null, amanha: plan.find(([d]) => d === day + 1)?.[1] ?? null, progressive: true };
}
