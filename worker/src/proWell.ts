/**
 * NEFESH Life Pro · terapias integrativas (naturopatia e outras práticas complementares).
 *
 * O terapeuta monta um plano de bem-estar: objetivos, hábitos diários (com o momento do dia),
 * práticas guiadas da app (respirações, meditações, relaxamento) e orientações. Não há construtor de
 * plano alimentar nem jejum (no Brasil, a prescrição dietética é exclusiva de nutricionistas).
 * O paciente marca os hábitos de cada dia; o terapeuta vê a adesão.
 */
import type { DB } from './social';
import { INTEG_KEYS, cleanInteg } from '../../src/domain/proInteg';

export const WELL_KIND = 'integrativo';
export const WELL_LOG = '__bemestar';
export const SYM_LOG = '__sintomas';
export const MAX_TRACK = 6;
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
  /** sintomas que o paciente avalia de 0 a 10 uma vez por semana (evolução entre sessões) */
  track?: string[];
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
  const track = cleanTrack(o.track);
  if (!habits.length && !practices.length && !notes && !goals && !track.length) return null;
  return { goals, habits, practices, notes, ...(weeks ? { weeks } : {}), ...(weeks && start ? { start } : {}), ...(track.length ? { track } : {}) };
}

export function cleanTrack(v: unknown): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of Array.isArray(v) ? v : []) {
    const t = str(x, 40);
    if (t.length < 2 || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
    if (out.length >= MAX_TRACK) break;
  }
  return out;
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

/** Avaliação semanal dos sintomas (0 = nada, 10 = muito forte), alinhada com os sintomas do plano. */
export interface SymCheck { labels: string[]; v: (number | null)[]; note?: string }
export function cleanSymptoms(v: unknown, track: string[]): SymCheck | null {
  const o = (v ?? {}) as Record<string, unknown>;
  const vals = Array.isArray(o.v) ? o.v : [];
  const out = track.map((_, i) => { const n = Math.round(Number(vals[i])); return vals[i] !== null && vals[i] !== '' && Number.isFinite(n) && n >= 0 && n <= 10 ? n : null; });
  if (!out.some((x) => x !== null)) return null;
  const note = str(o.note, 200);
  return { labels: track, v: out, ...(note ? { note } : {}) };
}
export async function logSymptoms(db: DB, code: string, track: string[], b: Record<string, unknown>, now = new Date()) {
  const data = cleanSymptoms(b.data, track);
  if (!data) return false;
  const day = now.toISOString().slice(0, 10);
  await db.batch([
    db.prepare('DELETE FROM pro_logs WHERE code = ? AND day = ? AND workout = ?').bind(code, day, SYM_LOG),
    db.prepare('INSERT INTO pro_logs (code, day, workout, data, created) VALUES (?, ?, ?, ?, ?)').bind(code, day, SYM_LOG, JSON.stringify(data), now.toISOString()),
  ]);
  return true;
}

/** Evolução de cada sintoma: a primeira e a última avaliação (pelo nome, mesmo que a ordem mude). */
export async function symptomTrend(db: DB, code: string) {
  const { results } = await db.prepare('SELECT day, data FROM pro_logs WHERE code = ? AND workout = ? ORDER BY day ASC').bind(code, SYM_LOG).all<{ day: string; data: string }>();
  const rows = results.map((r) => { try { return { day: r.day, d: JSON.parse(r.data) as SymCheck }; } catch { return null; } }).filter((x): x is { day: string; d: SymCheck } => !!x);
  const by = new Map<string, { label: string; first: number; last: number; n: number; firstDay: string; lastDay: string }>();
  for (const r of rows) r.d.labels.forEach((label, i) => {
    const val = r.d.v[i];
    if (val === null || val === undefined) return;
    const k = label.toLowerCase();
    const cur = by.get(k);
    if (!cur) by.set(k, { label, first: val, last: val, n: 1, firstDay: r.day, lastDay: r.day });
    else Object.assign(cur, { last: val, n: cur.n + 1, lastDay: r.day });
  });
  return { symptoms: [...by.values()], symAt: rows.length ? rows[rows.length - 1].day : null, symNote: rows.length ? rows[rows.length - 1].d.note ?? null : null };
}

/* ───────── pré-anamnese preenchida pelo paciente na app (antes da consulta) ───────── */

export const INTAKE_KEYS = INTEG_KEYS.filter((k) => k !== 'observacoes');
export function cleanIntake(v: unknown) {
  const o = (v ?? {}) as Record<string, unknown>;
  const all = cleanInteg(o.integ ?? o);
  const integ = Object.fromEntries(INTAKE_KEYS.filter((k) => all[k]).map((k) => [k, all[k]]));
  const idade = Math.round(Number(o.idade));
  return { integ, sexo: o.sexo === 'f' || o.sexo === 'm' ? o.sexo : '', idade: Number.isFinite(idade) && idade >= 8 && idade <= 110 ? idade : null };
}
export async function saveIntake(db: DB, code: string, b: Record<string, unknown>, now = new Date()) {
  const data = cleanIntake(b.data);
  if (!Object.keys(data.integ).length) return false;
  await db.prepare('INSERT INTO pro_intake (code, data, updated) VALUES (?, ?, ?) ON CONFLICT(code) DO UPDATE SET data = excluded.data, updated = excluded.updated').bind(code, JSON.stringify(data), now.toISOString()).run();
  return true;
}
export async function intakeOf(db: DB, code: string) {
  const r = await db.prepare('SELECT data, updated FROM pro_intake WHERE code = ?').bind(code).first<{ data: string; updated: string }>();
  if (!r) return null;
  try { return { ...cleanIntake(JSON.parse(r.data)), at: r.updated }; } catch { return null; }
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
  const sym = await symptomTrend(db, code);
  const worse = sym.symptoms.filter((x) => x.n >= 2 && x.last - x.first >= 2);
  if (worse.length) alerts.push({ kind: 'sintomas', text: `Sintoma a piorar: ${worse.map((x) => `${x.label} ${x.first}→${x.last}`).join(', ')}` });
  const intake = await db.prepare('SELECT updated FROM pro_intake WHERE code = ?').bind(code).first<{ updated: string }>();
  if (intake) alerts.push({ kind: 'anamnese', text: 'Pré-anamnese do paciente recebida: abra a Ficha para juntar' });
  return { wellWeek: days.filter((d) => d.data.done.length > 0).length, wellPct: pct, wellNote: note ?? null, alerts, ...sym, intakeAt: intake?.updated ?? null };
}

/** Para a equipa do paciente (com autorização): o essencial do plano de bem-estar. */
export function wellTeamSummary(plan: { bemestar?: WellPlan } | null) {
  const w = plan?.bemestar;
  if (!w) return ['Plano de bem-estar ainda não enviado.'];
  const out: string[] = [];
  if (w.goals) out.push(`Objetivos: ${w.goals}`);
  if (w.habits.length) out.push(`Hábitos: ${w.habits.map((h) => h.text).join(', ')}`);
  if (w.track?.length) out.push(`Sintomas acompanhados: ${w.track.join(', ')}`);
  return out;
}
