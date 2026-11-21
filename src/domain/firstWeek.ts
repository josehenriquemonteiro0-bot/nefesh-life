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
