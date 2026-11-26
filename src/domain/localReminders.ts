/**
 * Lembretes agendados no próprio telemóvel (app nativa): tocam mesmo com a app fechada e sem rede.
 * Calcula, a partir do estado, a lista completa do que deve estar agendado; quem agenda é src/native/notify.ts.
 * Como nas notificações do servidor, o texto não mostra nomes de medicamentos (podem aparecer no ecrã bloqueado).
 */
import { cycleReminders } from './women';
import { dayKey } from './dates';
import { fastingReminders } from './fasting';
import { reminderTimes } from './meds';
import { sleepReminders } from './sleep';
import { hhmm, routines } from './smart';
import type { AppState } from './types';

export interface LocalReminder {
  /** número estável (o iPhone identifica cada notificação por um inteiro) */
  id: number;
  title: string;
  body: string;
  /** todos os dias a esta hora (HH:MM) */
  daily?: string;
  /** uma vez, nesta data e hora */
  at?: Date;
}

/** O iPhone guarda no máximo 64 notificações agendadas por app. */
export const MAX_LOCAL = 60;

/** Inteiro positivo estável a partir de um texto (FNV-1a de 31 bits). */
export function stableId(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 1) || 1;
}

const valid = (t: string | undefined) => !!t && /^([01]\d|2[0-3]):[0-5]\d$/.test(t);

export function localReminders(S: AppState, now = new Date()): LocalReminder[] {
  const out: LocalReminder[] = [];
  // ritual da Spirulina (todos os dias)
  if (valid(S.reminder)) out.push({ id: stableId('spirulina'), title: 'Hora do seu ritual NEFESH 🌿', body: 'Está na hora da sua Spirulina de hoje. Um toque para marcar a toma.', daily: S.reminder });
  // medicação e suplementos: uma notificação por hora (sem nomes)
  for (const t of reminderTimes(S).filter(valid)) out.push({ id: stableId(`med${t}`), title: `💊 Lembrete das ${t}`, body: 'Está na hora da sua medicação ou suplemento. Toque para marcar a toma na app.', daily: t });
  // sono: ritual da noite, última cafeína e luz da manhã (se a pessoa os ligou)
  for (const r of sleepReminders(S)) out.push({ id: stableId(r.key), title: r.title, body: r.body, daily: r.time });
  // horários aprendidos (Início inteligente): 15 min antes da hora habitual, se a pessoa os ligou
  if (S.smart?.remind) {
    const TXT: Record<string, string> = { treino: 'Daqui a pouco é a hora do seu treino. 💪', meditacao: 'Daqui a pouco é a hora da sua meditação. 🧘', respiracao: 'Uma pausa para respirar 5 minutos? 😮‍💨', checkin: 'Como foi o seu dia? O check-in leva 30 segundos.', diario: 'Como dormiu? Preencha o diário do sono.', ritual: 'Daqui a pouco é a hora do seu ritual da noite. 🌙' };
    for (const r of routines(S, now)) if (TXT[r.k]) out.push({ id: stableId(`smart-${r.k}`), title: 'NEFESH Life', body: TXT[r.k], daily: hhmm(r.m - 15) });
  }
  // lembretes únicos: os combinados com o assistente, os do ciclo e os do jejum (próximos 30 dias)
  const today = dayKey(now);
  const limit = new Date(now.getTime() + 30 * 864e5);
  const once = [...(S.reminders ?? []).filter((r) => r.date >= today), ...cycleReminders(S, today), ...fastingReminders(S, now)];
  for (const r of once) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date) || !valid(r.time)) continue;
    const [y, m, d] = r.date.split('-').map(Number);
    const [hh, mm] = r.time.split(':').map(Number);
    const at = new Date(y, m - 1, d, hh, mm);
    if (at <= now || at > limit) continue;
    out.push({ id: stableId(`r${r.id}`), title: 'NEFESH Life', body: r.text, at });
  }
  // os diários primeiro; depois os únicos por ordem de data, até ao limite do iPhone
  const daily = out.filter((x) => x.daily);
  const single = out.filter((x) => x.at).sort((a, b) => a.at!.getTime() - b.at!.getTime());
  return [...daily, ...single].slice(0, MAX_LOCAL);
}
