/**
 * NEFESH Life Pro na app: o lado do aluno (código do personal, plano que carrega e se atualiza,
 * aviso ao personal quando conclui um treino) e o lado do profissional (alunos, montar treino,
 * registos). O plano usa o mesmo formato do plano lido de um PDF, para tudo o resto funcionar igual.
 */
import { getAuth } from './account';
import { todayKey } from './dates';
import { PHOTO_API, compressImage, deviceId } from './photo';
import type { ParsedWorkoutPlan, PlanWorkout } from './planRead';
import type { AppState } from './types';

import type { StudentProfile } from './proProfile';

export interface ProStudent {
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
}
export interface ProInfo { uid: string; name: string; kind: string; reg: string; status: 'pendente' | 'aprovado' | 'recusado' }
export interface ProLog { day: string; workout: string; at: string; status: string; minutes: number; note: string; changes: string[]; exercises: { name: string; sets: number; of: number; reps: string; load: string }[] }

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

/** Põe o plano do personal na app (no mesmo sítio do plano lido de PDF). */
export function applyProPlan(S: AppState, r: { code: string; pro: string; plan: ParsedWorkoutPlan | null; version: number }) {
  const name = `NEFESH Pro · ${r.pro}`;
  S.proLink = { code: r.code, pro: r.pro, version: r.version, at: todayKey() };
  if (!r.plan) return;
  S.trainPlan = { ...r.plan, is_workout: true, at: todayKey(), name };
  S.plans = { ...(S.plans ?? {}), treino: { name, type: 'nefesh-pro', size: 0, at: todayKey(), by: r.pro } };
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
  return proApi<{ code: string; pro: string; plan: ParsedWorkoutPlan | null; version: number }>('aluno/plano', { code });
}

/** Resumo do treino feito, para o personal. */
export function workoutReport(w: PlanWorkout, log: { status: string; minutes?: number; note?: string; changes?: string[]; sets: { ex: number; done: boolean; reps?: string; load?: string }[] }) {
  return {
    workout: w.name,
    status: log.status,
    minutes: log.minutes ?? 0,
    note: log.note ?? '',
    changes: log.changes ?? [],
    exercises: w.exercises.map((e, i) => {
      const s = log.sets.filter((x) => x.ex === i);
      const done = s.filter((x) => x.done);
      const loads = [...new Set(done.map((x) => x.load).filter(Boolean))];
      const reps = [...new Set(done.map((x) => x.reps).filter(Boolean))];
      return { name: e.name, sets: done.length, of: e.sets || s.length, reps: reps.join(' / '), load: loads.join(' / ') };
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
  return proApi('ia/avaliacao', body);
}
