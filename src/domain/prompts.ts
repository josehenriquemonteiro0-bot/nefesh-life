/**
 * Perguntas no momento certo: o assistente pede o dado que falta à hora em que faz
 * sentido (sono de manhã, almoço depois do almoço, energia ao fim do dia, peso uma vez
 * por semana), com respostas rápidas de um toque. Uma pergunta de cada vez.
 */
import { dayKey, todayKey } from './dates';
import { bodySeries } from './bodyLog';
import type { AppState, DayLog } from './types';

export interface Ask {
  id: 'sono' | 'almoco' | 'jantar' | 'energia' | 'peso';
  text: string;
  /** respostas rápidas (enviadas ao assistente como se a pessoa as dissesse) */
  quick: string[];
}

const hasMeal = (l: DayLog, k: 'almoco' | 'jantar') => (l.meals?.[k] ?? []).some((e) => !e.auto);

/** Perguntas por fazer agora, da mais útil para a menos. */
export function asksNow(S: AppState, now = new Date()): Ask[] {
  if (!S.ans) return [];
  const h = now.getHours() + now.getMinutes() / 60;
  const l = S.logs[todayKey(now)] ?? {};
  const out: Ask[] = [];
  if (h >= 5 && h < 12 && l.sleepH === undefined) out.push({ id: 'sono', text: 'Bom dia! Quantas horas dormiu esta noite, e como acordou?', quick: ['Dormi 6 horas', 'Dormi 7 horas', 'Dormi 8 horas e acordei bem'] });
  if (h >= 13.5 && h < 17 && !hasMeal(l, 'almoco')) out.push({ id: 'almoco', text: 'O que almoçou hoje?', quick: S.nutriPlan ? ['Almocei o do plano'] : [] });
  if (h >= 20.5 && h < 23.5 && !hasMeal(l, 'jantar')) out.push({ id: 'jantar', text: 'O que jantou?', quick: S.nutriPlan ? ['Jantei o do plano'] : [] });
  if (h >= 18 && !l.e) out.push({ id: 'energia', text: 'Como foi a sua energia hoje, de 1 a 5? E o humor?', quick: ['Energia 3, humor bom', 'Energia 4, humor ótimo', 'Energia 2, cansado'] });
  const last = bodySeries(S).filter((e) => e.peso !== undefined).pop();
  const weekAgo = dayKey(new Date(now.getTime() - 7 * 86400000));
  if (h >= 6 && h < 11 && S.ans.peso && (!last || last.date <= weekAgo)) out.push({ id: 'peso', text: 'Já passou uma semana: quer registar o peso de hoje (de manhã, em jejum)?', quick: [] });
  return out;
}

/** Linha para o assistente: o que falta hoje, para perguntar no fim (só um, se fizer sentido). */
export function asksContext(S: AppState, now = new Date()) {
  const a = asksNow(S, now);
  return a.length ? `Em falta hoje (no fim da resposta, se fizer sentido, pergunta de forma natural por UM destes, o primeiro): ${a.map((x) => x.id).join(', ')}.` : '';
}
