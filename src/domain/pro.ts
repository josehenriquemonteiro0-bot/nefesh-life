/**
 * NEFESH Life Pro na app: o lado do aluno (código do personal, plano que carrega e se atualiza,
 * aviso ao personal quando conclui um treino) e o lado do profissional (alunos, montar treino,
 * registos). O plano usa o mesmo formato do plano lido de um PDF, para tudo o resto funcionar igual.
 */
import { getAuth } from './account';
import { keyDaysAgo, todayKey } from './dates';
import { fastDays } from './fasting';
import { planFor } from './plan';
import { dayAdherence } from './planAdherence';
import { toDailyPlan, type NutriDayLog } from './proNutri';
import { isNutriKind } from './proNutriClient';
import { PHOTO_API, compressImage, deviceId } from './photo';
import type { ParsedWorkoutPlan, PlanWorkout } from './planRead';
import type { AppState } from './types';

import type { StudentProfile } from './proProfile';
import { shareSummary } from './proShare';

export interface ProStudent {
  /** nutricionistas: último dia registado pelo paciente e dias com registos na última semana */
  nutriLast?: (import('./proNutri').NutriDayLog & { day: string }) | null;
  nutriWeek?: number;
  /** terapias integrativas: dias com hábitos marcados na última semana, adesão (%) e a última nota do paciente */
  wellWeek?: number;
  wellPct?: number | null;
  wellNote?: string | null;
  /** os outros profissionais do mesmo paciente (só com autorização dele) */
  team?: { pro: string; kind: string; summary: string[] }[];
  code: string;
  name: string;
  linked: boolean;
  status: string;
  version: number;
  plan: ParsedWorkoutPlan | null;
  updated: string;
  last: { day: string; workout: string; status: string; minutes: number; note: string } | null;
  week: number;
  profile?: StudentProfile | null;
  /** treino guardado e ainda não enviado ao aluno */
  draft?: ParsedWorkoutPlan | null;
  draftAt?: string | null;
  /** o aluno partilha o relatório de bem-estar (último envio) */
  shareAt?: string | null;
  /** mensagens do aluno por ler */
  unread?: number;
  /** precisa de atenção (calculado no servidor) */
  alerts?: { kind: 'enviar' | 'dor' | 'parado' | 'saltou' | 'dificil' | 'subir' | 'fim'; text: string }[];
}
/** Uma área profissional do profissional (dupla formação): o registo e o estado da validação. */
export interface ProArea { kind: string; reg: string; status: 'aprovado' | 'pendente' | 'recusado' | string }
export interface ProInfo { uid: string; name: string; kind: string; reg: string; status: 'pendente' | 'aprovado' | 'recusado' }
export interface ProLog { day: string; workout: string; at: string; status: string; minutes: number; note: string; changes: string[]; effort?: string; pain?: boolean; exercises: { name: string; sets: number; of: number; reps: string; load: string; effort?: string; pain?: boolean }[] }

export async function proApi<T = Record<string, unknown>>(path: string, body: Record<string, unknown> = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${PHOTO_API.replace(/\/$/, '')}/pro/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, token: getAuth()?.token, device: deviceId() }),
    });
  } catch {
    throw new Error('Sem ligação. Tente outra vez com internet.');
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || 'Não foi possível. Tente outra vez.');
  return data;
}

export const normCode = (v: string) => v.trim().toUpperCase().replace(/\s+/g, '');
export const codeLooksValid = (v: string) => /^NP-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(normCode(v));

/** Jejum prescrito: fica à espera de a pessoa o ativar (só se for novo). */
function applyFastRx(S: AppState, j: ParsedWorkoutPlan['jejum'], pro: string) {
  if (!j) return;
  const same = (x?: { protocol: string; open: string; lowDays?: number[] } | null) => !!x && x.protocol === j.protocol && x.open === j.open && JSON.stringify(x.lowDays ?? []) === JSON.stringify(j.lowDays ?? []);
  if (!(S.fasting?.on && S.fasting.by === pro && same(S.fasting)) && !same(S.fastingRx)) S.fastingRx = { ...j, by: pro, at: todayKey() };
}

/** Põe o plano do personal na app (no mesmo sítio do plano lido de PDF). Códigos de nutricionistas vão para a Nutrição. */
export function applyProPlan(S: AppState, r: { code: string; pro: string; plan: ParsedWorkoutPlan | null; version: number; kind?: string }) {
  if (isNutriKind(r.kind)) return applyNutriPlan(S, r);
  if (r.kind === 'integrativo') {
    // terapias integrativas: o plano de bem-estar vai para a Mente (ver proWell.ts)
    S.wellLink = { code: r.code, pro: r.pro, version: r.version, at: todayKey() };
    if (r.plan?.bemestar) S.wellPlan = r.plan.bemestar;
    return;
  }
  const name = `NEFESH Pro · ${r.pro}`;
  S.proLink = { code: r.code, pro: r.pro, version: r.version, at: todayKey() };
  if (!r.plan) return;
  applyFastRx(S, r.plan.jejum, r.pro);
  if (!r.plan.workouts.length) return;
  S.trainPlan = { ...r.plan, is_workout: true, at: todayKey(), name };
  S.plans = { ...(S.plans ?? {}), treino: { name, type: 'nefesh-pro', size: 0, at: todayKey(), by: r.pro } };
}

/** Plano do nutricionista: o plano do dia vai para o diário (refeições, opções, segui/alterei), com as metas e a dose. */
export function applyNutriPlan(S: AppState, r: { code: string; pro: string; plan: ParsedWorkoutPlan | null; version: number }, now = new Date()) {
  S.nutriLink = { code: r.code, pro: r.pro, version: r.version, at: todayKey(now) };
  if (!r.plan) return;
  applyFastRx(S, r.plan.jejum, r.pro);
  const rx = r.plan.nutri;
  if (!rx) return;
  const name = `NEFESH Pro · ${r.pro}`;
  const before = S.nutriPlan?.meals.map((m) => m.label) ?? [];
  S.proNutriRx = rx;
  S.nutriPlan = { ...toDailyPlan(rx, now, r.pro), at: todayKey(now), name };
  // plano atualizado a meio do dia: as refeições já marcadas hoje seguem a refeição com o mesmo nome
  const day = S.logs[todayKey(now)];
  if (day?.planLog && before.length) {
    const after = S.nutriPlan.meals.map((m) => m.label);
    const moved: typeof day.planLog = {};
    for (const [i, v] of Object.entries(day.planLog)) { const j = after.indexOf(before[Number(i)]); if (j >= 0) moved[String(j)] = v; }
    S.logs[todayKey(now)] = { ...day, planLog: moved };
  }
  S.plans = { ...(S.plans ?? {}), nutri: { name, type: 'nefesh-pro', size: 0, at: todayKey(now), by: r.pro } };
  if (rx.targets.kcal || rx.targets.protein) S.nutriPro = { kcal: rx.targets.kcal || undefined, protein: rx.targets.protein || undefined, by: r.pro, at: todayKey(now) };
  if (rx.spirulina) S.proDose = { g: rx.spirulina, by: r.pro, at: todayKey(now) };
}

/** Planos com vários tipos de dia: o plano do diário muda à meia-noite. Devolve true se mudou. */
export function refreshNutriDay(S: AppState, now = new Date()): boolean {
  const rx = S.proNutriRx;
  if (!rx || !S.nutriLink || S.plans?.nutri?.type !== 'nefesh-pro' || S.nutriPlan?.at === todayKey(now)) return false;
  S.nutriPlan = { ...toDailyPlan(rx, now, S.nutriLink.pro), at: todayKey(now), name: S.plans.nutri.name };
  return true;
}

/** Desligar do nutricionista: o plano dele sai do diário (as metas e a dose voltam às da app). */
export function clearNutriPlan(S: AppState) {
  const pro = S.nutriLink?.pro;
  if (S.plans?.nutri?.type === 'nefesh-pro') {
    const p = { ...S.plans };
    delete p.nutri;
    S.plans = p;
    S.nutriPlan = null;
  }
  if (pro && S.nutriPro?.by === pro) S.nutriPro = null;
  if (pro && S.proDose?.by === pro) S.proDose = null;
  S.proNutriRx = null;
  delete S.nutriLink;
  S.nutriShare = { on: false };
}

/** O dia de alimentação para o nutricionista: refeições do plano marcadas, adesão, fome, água, jejum, peso. */
export function nutriDayLog(S: AppState, day: string): NutriDayLog | null {
  const l = S.logs[day];
  const plan = S.nutriPlan;
  if (!l || !plan) return null;
  const log = l.planLog ?? {};
  const meals = plan.meals.map((m, i) => ({ label: m.label, status: (log[String(i)]?.status ?? '') as NutriDayLog['meals'][number]['status'], changes: log[String(i)]?.changes ?? [] }));
  const adh = dayAdherence(S, day);
  const entries = Object.values(l.meals ?? {}).flat().filter(Boolean) as { kcal?: number; p?: number }[];
  const kcal = Math.round(entries.reduce((t, x) => t + (x.kcal ?? 0), 0));
  const prot = Math.round(entries.reduce((t, x) => t + (x.p ?? 0), 0));
  const fast = fastDays(S, 30).find((f) => f.date === day);
  const weight = (S.bodyLog ?? []).find((b) => b.date === day)?.peso;
  if (!meals.some((m) => m.status) && !kcal && !l.hunger && l.water === undefined) return null;
  return {
    meals, pct: adh.pct,
    ...(kcal ? { kcal } : {}), ...(prot ? { prot } : {}),
    ...(l.water !== undefined ? { water: (l.water ?? 0) >= planFor(S).water } : {}),
    ...(l.hunger ? { hunger: l.hunger } : {}), ...(fast ? { fastH: fast.hours } : {}), ...(weight ? { weight } : {}),
  };
}

const NUTRI_SENT = 'nefesh-life-nutri-dias';
/** Envia ao nutricionista os dias de hoje e de ontem, se mudaram desde o último envio. */
export async function sendNutriDays(S: AppState, now = new Date()) {
  if (!S.nutriLink || !S.nutriPlan) return;
  let sent: Record<string, string> = {};
  try { sent = JSON.parse(localStorage.getItem(NUTRI_SENT) || '{}'); } catch { sent = {}; }
  for (const day of [keyDaysAgo(1, now), todayKey(now)]) {
    const data = nutriDayLog(S, day);
    if (!data) continue;
    const mark = JSON.stringify(data);
    if (sent[`${S.nutriLink.code}|${day}`] === mark) continue;
    try {
      await proApi('aluno/dia', { code: S.nutriLink.code, day, data });
      sent[`${S.nutriLink.code}|${day}`] = mark;
    } catch { /* sem rede: tenta na próxima vez */ }
  }
  const keep = Object.fromEntries(Object.entries(sent).filter(([k]) => k.split('|')[1] >= keyDaysAgo(7, now)));
  try { localStorage.setItem(NUTRI_SENT, JSON.stringify(keep)); } catch { /* sem armazenamento */ }
}

/** Liga/desliga a partilha do resumo com o nutricionista (com as medidas e as análises só se autorizado). */
export async function syncNutriShare(S: AppState, on: boolean) {
  if (!S.nutriLink) return;
  await proApi('aluno/partilha', on ? { code: S.nutriLink.code, on: true, summary: shareSummary(S, new Date(), { body: !!S.nutriShare?.body, labs: !!S.nutriShare?.labs, nutri: true }) } : { code: S.nutriLink.code, on: false });
}

export function clearProPlan(S: AppState) {
  if (S.plans?.treino?.type === 'nefesh-pro') {
    const p = { ...S.plans };
    delete p.treino;
    S.plans = p;
    S.trainPlan = null;
  }
  delete S.proLink;
}

/** Ao abrir a app: há versão nova do plano? */
export async function checkProPlan(code: string) {
  return proApi<{ code: string; pro: string; kind?: string; plan: ParsedWorkoutPlan | null; version: number; unread?: number; checkinDue?: boolean; nextVisit?: { day: string; time: string; text: string } | null }>('aluno/plano', { code });
}

/** Resumo do treino feito, para o personal. */
export function workoutReport(w: PlanWorkout, log: { status: string; minutes?: number; note?: string; changes?: string[]; sets: { ex: number; done: boolean; reps?: string; load?: string }[]; effort?: string; pain?: boolean; fx?: Record<number, { effort?: string; pain?: boolean }> }) {
  const fx = log.fx ?? {};
  return {
    workout: w.name,
    status: log.status,
    minutes: log.minutes ?? 0,
    note: log.note ?? '',
    changes: log.changes ?? [],
    effort: log.effort ?? '',
    pain: !!log.pain || Object.values(fx).some((x) => x.pain),
    exercises: w.exercises.map((e, i) => {
      const s = log.sets.filter((x) => x.ex === i);
      const done = s.filter((x) => x.done);
      const loads = [...new Set(done.map((x) => x.load).filter(Boolean))];
      const reps = [...new Set(done.map((x) => x.reps).filter(Boolean))];
      return { name: e.name, sets: done.length, of: e.sets || s.length, reps: reps.join(' / '), load: loads.join(' / '), effort: fx[i]?.effort ?? (log.status === 'saltado' ? '' : log.effort ?? ''), pain: !!fx[i]?.pain };
    }),
  };
}

/** Envia o treino ao personal (sem rede: fica para enviar depois). */
const OUTBOX = 'nefesh-life-pro-pendentes';
export async function sendWorkout(code: string, day: string, report: ReturnType<typeof workoutReport>) {
  const item = { code, day, ...report };
  try {
    await proApi('aluno/treino', item);
  } catch {
    try {
      const q = JSON.parse(localStorage.getItem(OUTBOX) || '[]') as unknown[];
      localStorage.setItem(OUTBOX, JSON.stringify([...q, item].slice(-20)));
    } catch {
      /* sem armazenamento */
    }
  }
}
export async function flushWorkouts() {
  let q: Record<string, unknown>[] = [];
  try {
    q = JSON.parse(localStorage.getItem(OUTBOX) || '[]');
  } catch {
    return;
  }
  const left: Record<string, unknown>[] = [];
  for (const item of q) await proApi('aluno/treino', item).catch(() => left.push(item));
  try {
    localStorage.setItem(OUTBOX, JSON.stringify(left));
  } catch {
    /* sem armazenamento */
  }
}

/** Mensagem para o personal enviar o código ao aluno. */
export const inviteText = (student: string, code: string, pro: string, appUrl: string) =>
  `Olá ${student}! O seu treino está na NEFESH Life. Abra a app (${appUrl}), vá a Saúde → Treino → Com personal e escreva o código ${code}. — ${pro}`;

/** Avaliação física (PDF ou foto) → medidas para o perfil do aluno. O documento não é guardado. */
export async function readAssessmentFile(file: File): Promise<{ found: boolean; profile?: StudentProfile }> {
  return proApi('ia/avaliacao', await fileBody(file));
}

/** Relatório de acompanhamento do próprio utilizador (nutricionista, médico, academia). O documento não é guardado. */
export interface HealthReport {
  found: boolean;
  sexo?: '' | 'f' | 'm';
  idade?: number | null;
  by?: string;
  evals?: { date: string; altura: number | null; peso: number | null; gordura: number | null; magra: number | null; fc: number | null; medidas: Partial<Record<import('./proProfile').MeasureKey, number | null>>; extra?: { label: string; v: number; u: string }[] }[];
  kcal?: number | null;
  protein?: number | null;
}
export async function readHealthReport(file: File): Promise<HealthReport> {
  return proApi('corpo/relatorio', await fileBody(file));
}

async function fileBody(file: File): Promise<{ file: string; media_type: string }> {
  const isPdf = file.type === 'application/pdf';
  if (isPdf && file.size > 6 * 1024 * 1024) throw new Error('O PDF é demasiado grande (máximo 6 MB).');
  let body: { file: string; media_type: string };
  if (isPdf) {
    const data = await new Promise<string>((ok, fail) => {
      const r = new FileReader();
      r.onload = () => ok(String(r.result).slice(String(r.result).indexOf(',') + 1));
      r.onerror = () => fail(r.error);
      r.readAsDataURL(file);
    });
    body = { file: data, media_type: 'application/pdf' };
  } else if (file.type.startsWith('image/')) {
    const i = await compressImage(file, 1800);
    body = { file: i.data, media_type: i.media_type };
  } else throw new Error('Use um PDF ou uma fotografia.');
  return body;
}

/** Em que semana do plano periodizado está o aluno (e em que fase). null sem periodização. */
export function planWeek(plan: Pick<ParsedWorkoutPlan, 'weeks' | 'start' | 'phases'> | null | undefined, now = new Date()) {
  if (!plan?.weeks || !plan.start) return null;
  const days = Math.floor((now.getTime() - new Date(`${plan.start}T00:00:00`).getTime()) / 864e5);
  const week = Math.floor(days / 7) + 1;
  const ended = week > plan.weeks;
  let phase: { name: string; notes: string; week: number; of: number } | null = null;
  let acc = 0;
  for (const f of plan.phases ?? []) {
    if (week <= acc + f.weeks) { phase = { name: f.name, notes: f.notes, week: week - acc, of: f.weeks }; break; }
    acc += f.weeks;
  }
  return { week: Math.max(1, Math.min(week, plan.weeks)), of: plan.weeks, ended, daysLeft: plan.weeks * 7 - days - 1, phase: ended ? null : phase };
}

/** Envia (ou apaga, com on=false) o relatório de bem-estar partilhado com o personal. */
export async function syncShare(S: AppState, on: boolean) {
  if (!S.proLink) return;
  await proApi('aluno/partilha', on ? { code: S.proLink.code, on: true, summary: shareSummary(S) } : { code: S.proLink.code, on: false });
}

/** A pessoa autoriza (ou não) que o personal e o nutricionista vejam o essencial um do outro. */
export async function syncTeam(S: AppState, on: boolean) {
  const codes = [S.proLink?.code, S.nutriLink?.code].filter(Boolean) as string[];
  await Promise.all(codes.map((code) => proApi('aluno/equipa', { code, on })));
}

/** Exame do paciente (PDF ou foto) → valores, para a ficha integrativa. O documento não é guardado. */
export async function readExamFile(file: File): Promise<{ found: boolean; exam?: import('./proInteg').Exam }> {
  return proApi('ia/exames', await fileBody(file));
}

/** Notas da consulta (ditadas ou escritas) → campos da anamnese integrativa, alertas e perguntas em falta. */
export interface IntegOrganized { integ: Partial<Record<import('./proInteg').IntegKey, string>>; sexo: '' | 'f' | 'm'; idade: number | null; alerts: string[]; ask: string[]; summary: string }
export async function organizeIntegNotes(body: { text: string; integ: unknown; sexo?: string; idade?: number | null; exams?: string }): Promise<IntegOrganized> {
  return proApi('ia/integrativa', body);
}
