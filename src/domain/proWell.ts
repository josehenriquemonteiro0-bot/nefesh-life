/**
 * NEFESH Life Pro · terapias integrativas, do lado do paciente: o plano de bem-estar do terapeuta,
 * os hábitos marcados em cada dia (enviados ao terapeuta) e as práticas guiadas da app.
 */
import { keyDaysAgo, todayKey } from './dates';
import { TECHNIQUES } from './mind';
import { meditationById } from './meditations';
import { proApi } from './pro';
import { shareSummary } from './proShare';
import type { AppState } from './types';

export interface WellPlan {
  goals: string;
  habits: { text: string; when: 'manha' | 'tarde' | 'noite' | 'dia' }[];
  practices: string[];
  notes: string;
  weeks?: number;
  start?: string;
}

export const WELL_KIND = 'integrativo';
export const isWellKind = (kind?: string | null) => kind === WELL_KIND;
export const WHEN_LABEL: Record<WellPlan['habits'][number]['when'], string> = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite', dia: 'Ao longo do dia' };

/** As práticas que o terapeuta pode indicar: respirações e sessões guiadas da app. */
export function practiceOf(id: string): { kind: 'respiracao' | 'meditacao'; id: string; name: string; minutes: number } | null {
  const t = TECHNIQUES.find((x) => x.id === id);
  if (t) return { kind: 'respiracao', id, name: t.name, minutes: 5 };
  const m = meditationById(id);
  return m ? { kind: 'meditacao', id, name: m.title, minutes: m.minutes } : null;
}
export const PRACTICE_IDS = [...TECHNIQUES.map((t) => t.id), 'pmr', 'bodyscan', 'nidra', 'baralhar', 'desligar', 'ansiedade', 'autocompaixao', 'gratidao', 'presente', 'caminhada', 'intencao'].filter((id) => practiceOf(id));

export function applyWellPlan(S: AppState, r: { code: string; pro: string; plan: { bemestar?: WellPlan } | null; version: number }) {
  S.wellLink = { code: r.code, pro: r.pro, version: r.version, at: todayKey() };
  if (r.plan?.bemestar) S.wellPlan = r.plan.bemestar;
}

export function clearWellPlan(S: AppState) {
  delete S.wellLink;
  S.wellPlan = null;
  S.wellShare = { on: false };
}

/** Marca ou desmarca um hábito de hoje. */
export function toggleHabit(S: AppState, i: number, day = todayKey()) {
  const l = (S.logs[day] = S.logs[day] ?? {});
  const set = new Set(l.wellDone ?? []);
  if (set.has(i)) set.delete(i);
  else set.add(i);
  l.wellDone = [...set].sort((a, b) => a - b);
}

/** Envia ao terapeuta os últimos 7 dias de hábitos (só os que mudaram desde o último envio). */
const SENT = 'nefesh-life-bemestar-enviado';
export async function sendWellDays(S: AppState, now = new Date()) {
  if (!S.wellLink || !S.wellPlan) return;
  const of = S.wellPlan.habits.length;
  let sent: Record<string, string> = {};
  try { sent = JSON.parse(localStorage.getItem(SENT) || '{}'); } catch { sent = {}; }
  for (let i = 0; i < 7; i++) {
    const day = keyDaysAgo(i, now);
    const done = (S.logs[day]?.wellDone ?? []).filter((n) => n < of);
    if (!done.length && i > 0) continue;
    const mark = `${of}:${done.join(',')}`;
    const k = `${S.wellLink.code}|${day}`;
    if (sent[k] === mark) continue;
    await proApi('aluno/habitos', { code: S.wellLink.code, day, data: { done, of } });
    sent[k] = mark;
  }
  try { localStorage.setItem(SENT, JSON.stringify(sent)); } catch { /* sem armazenamento */ }
}

/** Partilha (ou deixa de partilhar) o resumo de bem-estar (sono, humor, stress, energia…) com o terapeuta. */
export async function syncWellShare(S: AppState, on: boolean) {
  if (!S.wellLink) return;
  await proApi('aluno/partilha', on ? { code: S.wellLink.code, on: true, summary: shareSummary(S, new Date(), {}) } : { code: S.wellLink.code, on: false });
}

/** Semana do plano (se tiver duração). */
export function wellWeek(p: WellPlan | null | undefined, now = new Date()) {
  if (!p?.weeks || !p.start) return null;
  const days = Math.floor((new Date(`${todayKey(now)}T12:00:00`).getTime() - new Date(`${p.start}T12:00:00`).getTime()) / 864e5);
  return { week: Math.min(p.weeks, Math.floor(days / 7) + 1), of: p.weeks, ended: days >= p.weeks * 7 };
}
