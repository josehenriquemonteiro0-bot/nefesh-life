/**
 * Próxima ação do dia no Início: a coisa mais útil a fazer agora, pela hora e pelo que já foi feito.
 * Ordem: a toma de Spirulina em falta → a medicação da hora → a água atrasada → a refeição da hora → o check-in à noite → tudo feito.
 */
import { planFor, slotsFor } from './plan';
import type { AppState, DayLog } from './types';
import { medsToday } from './meds';

export type ActionKind = 'dose' | 'med' | 'agua' | 'refeicao' | 'checkin' | 'treino' | 'feito';
export interface NextAction {
  kind: ActionKind;
  title: string;
  detail: string;
  /** índice da toma (para marcar com um toque) */
  slot?: number;
  /** toma de medicação (id@hora) */
  med?: string;
}

/** Hora (0–24) a partir da qual cada toma "conta" como devida. */
const slotHour = (label: string) => (/almoço/i.test(label) ? 12 : /lanche|treino/i.test(label) ? 16 : /jantar/i.test(label) ? 19 : 8);

export function nextAction(S: AppState, l: DayLog, now = new Date()): NextAction {
  const h = now.getHours() + now.getMinutes() / 60;
  if (!S.ans) return { kind: 'feito', title: 'Faça a sua avaliação', detail: '2 minutos para o seu plano.' };
  const slots = slotsFor(S, now);
  const doses = l.doses ?? [];
  // 1. a toma de Spirulina devida (ou a primeira, de manhã)
  const due = slots.findIndex((s, i) => !doses[i] && h >= slotHour(s.l) - 1);
  if (due >= 0) return { kind: 'dose', slot: due, title: `Tomar a Spirulina (${slots[due].l.toLowerCase()})`, detail: 'Um toque para marcar. É o centro do seu ritual.' };
  // 1b. medicação ou suplemento já na hora e ainda por tomar (até 3 horas depois)
  const med = medsToday(S, l, now).find((t) => t.due && !t.taken && h - (Number(t.time.slice(0, 2)) + Number(t.time.slice(3)) / 60) <= 3);
  if (med) return { kind: 'med', med: med.key, title: `${med.med.name} (${med.time})`, detail: `${med.med.dose ? `${med.med.dose}. ` : ''}Um toque quando tomar.` };
  // 2. água atrasada face ao ritmo do dia (das 8h às 22h)
  const goal = planFor(S).water;
  const expected = Math.floor((goal * Math.min(1, Math.max(0, (h - 8) / 14))));
  const w = l.water ?? 0;
  if (w < expected) return { kind: 'agua', title: `Beber água: faltam ${goal - w} copos`, detail: `Pelo ritmo de hoje, já devia ir em ${expected}.` };
  // 3. refeição da hora sem registo
  const meals = l.meals ?? {};
  const has = (k: keyof NonNullable<DayLog['meals']>) => (meals[k] ?? []).some((e) => !e.auto);
  if (h >= 12.5 && h < 15.5 && !has('almoco')) return { kind: 'refeicao', title: 'Registar o almoço', detail: 'Uma foto do prato chega.' };
  if (h >= 20 && h < 22.5 && !has('jantar')) return { kind: 'refeicao', title: 'Registar o jantar', detail: 'Uma foto do prato chega.' };
  // 4. check-in ao fim do dia
  if (h >= 18 && !l.e) return { kind: 'checkin', title: 'Fazer o check-in', detail: '30 segundos: como foi o seu dia?' };
  // 5. a toma que ainda falta mais tarde
  const later = slots.findIndex((_, i) => !doses[i]);
  if (later >= 0) return { kind: 'dose', slot: later, title: `Mais tarde: Spirulina (${slots[later].l.toLowerCase()})`, detail: 'Pode marcar já, se tomou.' };
  return { kind: 'feito', title: 'Tudo em dia por agora 🎉', detail: 'Bom trabalho. Volte mais logo.' };
}
