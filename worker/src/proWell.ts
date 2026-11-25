/**
 * NEFESH Life Pro · terapias integrativas (naturopatia e outras práticas complementares).
 *
 * O terapeuta monta um plano de bem-estar: objetivos, hábitos diários (com o momento do dia),
 * práticas guiadas da app (respirações, meditações, relaxamento) e orientações. Não há construtor de
 * plano alimentar nem jejum (no Brasil, a prescrição dietética é exclusiva de nutricionistas).
 * O paciente marca os hábitos de cada dia; o terapeuta vê a adesão.
 */
import type { DB } from './social';

export const WELL_KIND = 'integrativo';
export const WELL_LOG = '__bemestar';
export const isWellPro = (kind?: string | null) => kind === WELL_KIND;

const str = (v: unknown, max: number) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
export const WHEN = ['manha', 'tarde', 'noite', 'dia'] as const;

export interface WellPlan {
  goals: string;
  habits: { text: string; when: (typeof WHEN)[number] }[];
  /** ids de respirações (mind.TECHNIQUES) e de meditações (meditations), validados na app */
  practices: string[];
  notes: string;
  weeks?: number;
  start?: string;
}

/** Plano de bem-estar limpo (ou null se estiver vazio). */
export function cleanWell(v: unknown): WellPlan | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const habits = (Array.isArray(o.habits) ? o.habits : []).slice(0, 12).map((h) => {
    const x = (h ?? {}) as Record<string, unknown>;
    const when = (WHEN as readonly string[]).includes(String(x.when)) ? (String(x.when) as WellPlan['habits'][number]['when']) : 'dia';
    return { text: str(x.text, 100), when };
  }).filter((h) => h.text.length >= 2);
  const practices = [...new Set((Array.isArray(o.practices) ? o.practices : []).map((p) => String(p)).filter((p) => /^[a-z0-9]{2,20}$/.test(p)))].slice(0, 8);
  const goals = str(o.goals, 300);
  const notes = str(o.notes, 800);
  const weeks = Math.max(0, Math.min(52, Math.round(Number(o.weeks) || 0)));
  const start = /^\d{4}-\d{2}-\d{2}$/.test(String(o.start ?? '')) ? String(o.start) : '';
  if (!habits.length && !practices.length && !notes && !goals) return null;
  return { goals, habits, practices, notes, ...(weeks ? { weeks } : {}), ...(weeks && start ? { start } : {}) };
}

export interface WellDay { done: number[]; of: number; note?: string }
export function cleanWellDay(v: unknown): WellDay {
  const o = (v ?? {}) as Record<string, unknown>;
  const of = Math.max(0, Math.min(12, Math.round(Number(o.of) || 0)));
  const done = [...new Set((Array.isArray(o.done) ? o.done : []).map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n < of))].sort((a, b) => a - b);
  const note = str(o.note, 200);
  return { done, of, ...(note ? { note } : {}) };
}

/** O paciente envia os hábitos feitos num dia (substitui o que esse dia tinha). */
export async function logWellDay(db: DB, code: string, b: Record<string, unknown>, now = new Date()) {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(String(b.day)) ? String(b.day) : now.toISOString().slice(0, 10);
  const data = cleanWellDay(b.data);
  await db.batch([
    db.prepare('DELETE FROM pro_logs WHERE code = ? AND day = ? AND workout = ?').bind(code, day, WELL_LOG),
    db.prepare('INSERT INTO pro_logs (code, day, workout, data, created) VALUES (?, ?, ?, ?, ?)').bind(code, day, WELL_LOG, JSON.stringify(data), now.toISOString()),
  ]);
}

const weekAgo = (now: Date) => new Date(now.getTime() - 7 * 864e5).toISOString().slice(0, 10);

/** Resumo para o painel do terapeuta: adesão aos hábitos nos últimos 7 dias e alertas. */
export async function wellSummary(db: DB, code: string, o: { linked: boolean; hasPlan: boolean; planSince: string; hasDraft: boolean }, now = new Date()) {
  const { results } = await db.prepare('SELECT day, data FROM pro_logs WHERE code = ? AND workout = ? AND day >= ? ORDER BY day DESC').bind(code, WELL_LOG, weekAgo(now)).all<{ day: string; data: string }>();
  const days = results.map((r) => { try { return { day: r.day, data: JSON.parse(r.data) as WellDay }; } catch { return null; } }).filter((x): x is { day: string; data: WellDay } => !!x);
  const done = days.reduce((a, d) => a + d.data.done.length, 0);
  const of = days.reduce((a, d) => a + d.data.of, 0);
  const pct = of ? Math.round((done / of) * 100) : null;
  const alerts: { kind: string; text: string }[] = [];
  if (o.hasDraft) alerts.push({ kind: 'enviar', text: 'Plano guardado, ainda não enviado' });
  const since = Math.floor((now.getTime() - new Date(o.planSince).getTime()) / 864e5);
  if (o.linked && o.hasPlan && since >= 3 && !days.length) alerts.push({ kind: 'parado', text: 'Sem hábitos marcados há mais de 3 dias' });
  else if (pct !== null && days.length >= 3 && pct < 40) alerts.push({ kind: 'adesao', text: `Adesão baixa aos hábitos (${pct}%)` });
  const note = days.find((d) => d.data.note)?.data.note;
  return { wellWeek: days.length, wellPct: pct, wellNote: note ?? null, alerts };
}

/** Para a equipa do paciente (com autorização): o essencial do plano de bem-estar. */
export function wellTeamSummary(plan: { bemestar?: WellPlan } | null) {
  const w = plan?.bemestar;
  if (!w) return ['Plano de bem-estar ainda não enviado.'];
  const out: string[] = [];
  if (w.goals) out.push(`Objetivos: ${w.goals}`);
  if (w.habits.length) out.push(`Hábitos: ${w.habits.map((h) => h.text).join(', ')}`);
  return out;
}
