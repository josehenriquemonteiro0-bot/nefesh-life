/**
 * Personal Health Timeline: o histórico de saúde da pessoa numa linha do tempo
 * (avaliações, ritual, frascos, planos, análises, consultas, prevenção, corpo e marcos).
 */
import { PREVENTION, labSeries } from './care';
import { dayKey } from './dates';
import { PRODUCTS } from './lots';
import { indexOf } from './plan';
import { took } from './stats';
import type { AppState } from './types';

export type TimelineCat = 'saude' | 'spirulina' | 'corpo' | 'marcos';
export interface TimelineEvent {
  date: string;
  cat: TimelineCat;
  icon: string;
  title: string;
  detail?: string;
  future?: boolean;
}

export const CAT_LABEL: [TimelineCat | 'tudo', string][] = [
  ['tudo', 'Tudo'],
  ['saude', 'Saúde'],
  ['spirulina', 'Spirulina'],
  ['corpo', 'Corpo'],
  ['marcos', 'Marcos'],
];

const RITUAL_MARKS = [7, 21, 30, 60, 90, 180, 365];
const fmtN = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',');

export function timeline(S: AppState, now = new Date()): TimelineEvent[] {
  const today = dayKey(now);
  const ev: TimelineEvent[] = [];
  if (S.planStart) ev.push({ date: S.planStart.slice(0, 10), cat: 'spirulina', icon: '🌿', title: 'Início do ritual NEFESH' });
  S.evals.forEach((e, i) => {
    const idx = indexOf(e.sc);
    const prev = i ? indexOf(S.evals[i - 1].sc) : null;
    ev.push({ date: e.date.slice(0, 10), cat: 'saude', icon: '📊', title: i ? 'Reavaliação' : 'Primeira avaliação', detail: `Índice NEFESH ${idx}${prev !== null ? ` (${idx - prev >= 0 ? '+' : ''}${idx - prev})` : ''}` });
  });
  for (const b of S.bottles ?? []) ev.push({ date: b.at.slice(0, 10), cat: 'spirulina', icon: '🫙', title: 'Frasco novo', detail: PRODUCTS[b.product]?.name });
  if (S.plans?.nutri) ev.push({ date: S.plans.nutri.at.slice(0, 10), cat: 'saude', icon: '🥗', title: 'Plano alimentar carregado', detail: S.plans.nutri.by ? `de ${S.plans.nutri.by}` : undefined });
  if (S.plans?.treino) ev.push({ date: S.plans.treino.at.slice(0, 10), cat: 'saude', icon: '🏋️', title: 'Plano de treino carregado', detail: S.plans.treino.by ? `de ${S.plans.treino.by}` : undefined });
  // análises: um evento por data
  const labsByDate = new Map<string, string[]>();
  for (const s of labSeries(S)) for (const r of s.list) labsByDate.set(r.date, [...(labsByDate.get(r.date) ?? []), `${r.name} ${fmtN(r.value)} ${r.unit}`]);
  for (const [date, items] of labsByDate) ev.push({ date, cat: 'saude', icon: '🧪', title: 'Análises', detail: items.join(' · ') });
  for (const v of S.care?.visits ?? []) ev.push({ date: v.date, cat: 'saude', icon: '🩺', title: `Consulta: ${v.kind}`, detail: [v.who, v.note].filter(Boolean).join(' · ') || undefined, future: v.date > today });
  for (const [id, date] of Object.entries(S.care?.prev ?? {})) {
    const p = PREVENTION.find((x) => x.id === id);
    if (p) ev.push({ date, cat: 'saude', icon: p.kind === 'vacina' ? '💉' : '🔎', title: p.label });
  }
  // corpo: cada registo de peso, com a variação desde o anterior
  let prevKg: number | null = null;
  for (const e of [...(S.bodyLog ?? [])].sort((a, b) => a.date.localeCompare(b.date))) {
    if (e.peso === undefined) continue;
    ev.push({ date: e.date, cat: 'corpo', icon: '⚖️', title: `Peso: ${fmtN(e.peso)} kg`, detail: prevKg !== null ? `${e.peso - prevKg >= 0 ? '+' : ''}${fmtN(e.peso - prevKg)} kg` : undefined });
    prevKg = e.peso;
  }
  for (const p of S.progressPhotos ?? []) ev.push({ date: p.date, cat: 'corpo', icon: '📸', title: `Foto de progresso (${p.pose})` });
  // marcos do ritual: dias com a Spirulina tomada (acumulados)
  let n = 0;
  for (const k of Object.keys(S.logs).sort()) {
    if (!took(S, S.logs[k], now)) continue;
    n++;
    if (RITUAL_MARKS.includes(n)) ev.push({ date: k, cat: 'marcos', icon: '🏅', title: `${n} dias de ritual da Spirulina` });
  }
  if (S.women?.mode === 'gravidez' && S.women.due) ev.push({ date: S.women.due, cat: 'saude', icon: '👶', title: 'Data prevista do parto', future: S.women.due > today });
  return ev.sort((a, b) => b.date.localeCompare(a.date));
}

export const MONTH_NAMES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
