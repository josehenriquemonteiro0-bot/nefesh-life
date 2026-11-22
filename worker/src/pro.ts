/**
 * NEFESH Life Pro (fase A): o profissional (personal) monta o treino do aluno na app,
 * envia-lhe um código, o aluno liga-se com o código e o plano carrega na app; quando o
 * aluno conclui um treino, o profissional recebe um aviso e vê o registo.
 * Os profissionais são aprovados pela equipa NEFESH (página da equipa) antes de usar.
 * Tabelas: pros, pro_students, pro_logs (CREATE IF NOT EXISTS; reversível com DROP TABLE).
 */
import { localNow, sendPush, type KeyStore } from './push';
import type { DB } from './social';
import { isQuiet } from './notify';

type R = { status: number; body: Record<string, unknown> };
const ok = (body: Record<string, unknown> = { ok: true }): R => ({ status: 200, body });
const bad = (error: string, status = 400): R => ({ status, body: { error } });

const str = (v: unknown, max: number) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function studentCode() {
  const b = crypto.getRandomValues(new Uint8Array(8));
  const c = Array.from(b, (x) => ALPHA[x % ALPHA.length]).join('');
  return `NP-${c.slice(0, 4)}-${c.slice(4)}`;
}
export const validCode = (v: unknown) => /^NP-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(String(v ?? '').trim().toUpperCase());
const normCode = (v: unknown) => String(v ?? '').trim().toUpperCase();

/** Plano de treino no mesmo formato da app (ParsedWorkoutPlan), validado e com limites. */
export function cleanPlan(p: unknown) {
  const o = (p ?? {}) as Record<string, unknown>;
  const workouts = (Array.isArray(o.workouts) ? o.workouts : []).slice(0, 10).map((w) => {
    const x = (w ?? {}) as Record<string, unknown>;
    return {
      name: str(x.name, 60) || 'Treino',
      focus: str(x.focus, 80),
      day: str(x.day, 30),
      exercises: (Array.isArray(x.exercises) ? x.exercises : []).slice(0, 20).map((e) => {
        const y = (e ?? {}) as Record<string, unknown>;
        return {
          name: str(y.name, 80),
          sets: Math.max(1, Math.min(10, Math.round(Number(y.sets) || 3))),
          reps: str(y.reps, 30),
          load: str(y.load, 30),
          rest: str(y.rest, 30),
          notes: str(y.notes, 240),
        };
      }).filter((e) => e.name),
    };
  }).filter((w) => w.exercises.length);
  return { is_workout: true, workouts, per_week: Math.max(1, Math.min(7, Math.round(Number(o.per_week) || workouts.length || 3))), professional: str(o.professional, 60), notes: str(o.notes, 600) };
}

export async function proOf(db: DB, uid: string) {
  return db.prepare('SELECT uid, name, kind, reg, status, created FROM pros WHERE uid = ?').bind(uid).first<{ uid: string; name: string; kind: string; reg: string; status: string; created: string }>();
}

/** Pedido de registo como profissional (fica pendente até a equipa aprovar). */
export async function registerPro(db: DB, uid: string, b: Record<string, unknown>, now = new Date()): Promise<R> {
  const name = str(b.name, 60), reg = str(b.reg, 40);
  const kind = ['personal', 'nutricionista', 'medico', 'outro'].includes(String(b.kind)) ? String(b.kind) : 'personal';
  if (name.length < 2) return bad('Escreva o seu nome profissional.');
  if (reg.length < 3) return bad('Escreva o seu registo profissional (CREF ou título profissional).');
  const cur = await proOf(db, uid);
  if (cur?.status === 'aprovado') return ok({ pro: cur });
  await db.prepare("INSERT INTO pros (uid, name, kind, reg, status, created) VALUES (?, ?, ?, ?, 'pendente', ?) ON CONFLICT(uid) DO UPDATE SET name = excluded.name, kind = excluded.kind, reg = excluded.reg").bind(uid, name, kind, reg, now.toISOString()).run();
  return ok({ pro: await proOf(db, uid) });
}

const weekAgo = (now: Date) => new Date(now.getTime() - 7 * 864e5).toISOString().slice(0, 10);

/** Painel do profissional: o seu estado e os alunos (com o último treino e os da semana). */
export async function proState(db: DB, uid: string, now = new Date()): Promise<R> {
  const pro = await proOf(db, uid);
  if (!pro) return ok({ pro: null });
  if (pro.status !== 'aprovado') return ok({ pro });
  const { results } = await db.prepare('SELECT code, name, uid, plan, version, status, updated FROM pro_students WHERE pro = ? ORDER BY created DESC').bind(uid).all<{ code: string; name: string; uid: string | null; plan: string | null; version: number; status: string; updated: string }>();
  const students = [];
  for (const s of results) {
    const last = await db.prepare('SELECT day, workout, data, created FROM pro_logs WHERE code = ? ORDER BY created DESC LIMIT 1').bind(s.code).first<{ day: string; workout: string; data: string; created: string }>();
    const wk = await db.prepare('SELECT COUNT(*) AS n FROM pro_logs WHERE code = ? AND day >= ?').bind(s.code, weekAgo(now)).first<{ n: number }>();
    let plan: ReturnType<typeof cleanPlan> | null = null;
    try { plan = s.plan ? (JSON.parse(s.plan) as ReturnType<typeof cleanPlan>) : null; } catch { plan = null; }
    students.push({ code: s.code, name: s.name, linked: !!s.uid, status: s.status, version: s.version, plan, updated: s.updated, last: last ? { day: last.day, workout: last.workout, ...(JSON.parse(last.data) as Record<string, unknown>) } : null, week: wk?.n ?? 0 });
  }
  return ok({ pro, students });
}

async function ownStudent(db: DB, uid: string, code: unknown) {
  const pro = await proOf(db, uid);
  if (pro?.status !== 'aprovado') return null;
  return db.prepare('SELECT code, name, uid, plan, version FROM pro_students WHERE code = ? AND pro = ?').bind(normCode(code), uid).first<{ code: string; name: string; uid: string | null; plan: string | null; version: number }>();
}

/** Novo aluno: um código para lhe enviar. */
export async function newStudent(db: DB, uid: string, b: Record<string, unknown>, now = new Date()): Promise<R> {
  const pro = await proOf(db, uid);
  if (pro?.status !== 'aprovado') return bad('A sua conta de profissional ainda não foi aprovada pela equipa NEFESH.', 403);
  const name = str(b.name, 40);
  if (name.length < 2) return bad('Escreva o nome do aluno.');
  const n = await db.prepare('SELECT COUNT(*) AS n FROM pro_students WHERE pro = ?').bind(uid).first<{ n: number }>();
  if ((n?.n ?? 0) >= 200) return bad('Chegou ao limite de alunos desta fase de teste.');
  const at = now.toISOString();
  for (let i = 0; i < 5; i++) {
    const code = studentCode();
    if (await db.prepare('SELECT 1 FROM pro_students WHERE code = ?').bind(code).first()) continue;
    await db.prepare("INSERT INTO pro_students (code, pro, name, version, status, created, updated) VALUES (?, ?, ?, 0, 'convite', ?, ?)").bind(code, uid, name, at, at).run();
    return ok({ code, name });
  }
  return bad('Não foi possível criar o código. Tente outra vez.', 500);
}

/** Guarda (ou atualiza) o treino do aluno; a versão sobe para o aluno receber a mudança. */
export async function savePlan(db: DB, uid: string, b: Record<string, unknown>, now = new Date()): Promise<R> {
  const s = await ownStudent(db, uid, b.code);
  if (!s) return bad('Aluno não encontrado.', 404);
  const pro = await proOf(db, uid);
  const plan = cleanPlan({ ...((b.plan ?? {}) as Record<string, unknown>), professional: pro?.name });
  if (!plan.workouts.length) return bad('Acrescente pelo menos um treino com um exercício.');
  await db.prepare('UPDATE pro_students SET plan = ?, version = version + 1, updated = ? WHERE code = ?').bind(JSON.stringify(plan), now.toISOString(), s.code).run();
  return ok({ version: s.version + 1 });
}

export async function studentLogs(db: DB, uid: string, b: Record<string, unknown>): Promise<R> {
  const s = await ownStudent(db, uid, b.code);
  if (!s) return bad('Aluno não encontrado.', 404);
  const { results } = await db.prepare('SELECT day, workout, data, created FROM pro_logs WHERE code = ? ORDER BY created DESC LIMIT 60').bind(s.code).all<{ day: string; workout: string; data: string; created: string }>();
  return ok({ logs: results.map((r) => ({ day: r.day, workout: r.workout, at: r.created, ...(JSON.parse(r.data) as Record<string, unknown>) })) });
}

export async function removeStudent(db: DB, uid: string, b: Record<string, unknown>): Promise<R> {
  const s = await ownStudent(db, uid, b.code);
  if (!s) return bad('Aluno não encontrado.', 404);
  await db.batch([db.prepare('DELETE FROM pro_logs WHERE code = ?').bind(s.code), db.prepare('DELETE FROM pro_students WHERE code = ?').bind(s.code)]);
  return ok();
}

/* ───────── lado do aluno (com conta, ou só com este telemóvel) ───────── */

/** Quem é o aluno: a conta, se tiver; senão, o telemóvel. */
export const studentKey = (uid: string | null, device: unknown) => (uid ? uid : /^[a-z0-9-]{8,64}$/i.test(String(device ?? '')) ? `d:${device}` : null);

async function linkedStudent(db: DB, key: string, code: unknown) {
  return db.prepare('SELECT s.code, s.name, s.uid, s.plan, s.version, s.pro, p.name AS pro_name FROM pro_students s JOIN pros p ON p.uid = s.pro WHERE s.code = ?').bind(normCode(code)).first<{ code: string; name: string; uid: string | null; plan: string | null; version: number; pro: string; pro_name: string }>().then((s) => (s && s.uid === key ? s : null));
}

/** O aluno liga-se com o código: fica associado e recebe o plano. */
export async function linkStudent(db: DB, key: string, b: Record<string, unknown>, now = new Date()): Promise<R> {
  if (!validCode(b.code)) return bad('Código inválido. Confirme o código que o seu personal enviou (NP-XXXX-XXXX).');
  const s = await db.prepare('SELECT code, uid, status FROM pro_students WHERE code = ?').bind(normCode(b.code)).first<{ code: string; uid: string | null; status: string }>();
  if (!s) return bad('Código não encontrado. Confirme com o seu personal.', 404);
  if (s.uid && s.uid !== key) return bad('Este código já está a ser usado por outra pessoa. Peça um código novo ao seu personal.', 409);
  if (!s.uid) await db.prepare("UPDATE pro_students SET uid = ?, status = 'ativo', updated = ? WHERE code = ?").bind(key, now.toISOString(), s.code).run();
  return studentPlan(db, key, b);
}

export async function studentPlan(db: DB, key: string, b: Record<string, unknown>): Promise<R> {
  const s = await linkedStudent(db, key, b.code);
  if (!s) return bad('Código não ligado a este telemóvel.', 404);
  let plan: unknown = null;
  try { plan = s.plan ? JSON.parse(s.plan) : null; } catch { plan = null; }
  return ok({ code: s.code, pro: s.pro_name, plan, version: s.version });
}

/** O aluno desliga-se do personal (o histórico do personal fica, sem novos registos). */
export async function unlinkStudent(db: DB, key: string, b: Record<string, unknown>, now = new Date()): Promise<R> {
  const s = await linkedStudent(db, key, b.code);
  if (!s) return ok();
  await db.prepare("UPDATE pro_students SET uid = NULL, status = 'terminado', updated = ? WHERE code = ?").bind(now.toISOString(), s.code).run();
  return ok();
}

/** Treino concluído: guarda o registo e avisa o profissional (fora das horas de silêncio). */
export async function logWorkout(db: DB, store: KeyStore, key: string, b: Record<string, unknown>, now = new Date(), fetcher: typeof fetch = fetch): Promise<R> {
  const s = await linkedStudent(db, key, b.code);
  if (!s) return bad('Código não ligado a este telemóvel.', 404);
  const day = /^\d{4}-\d{2}-\d{2}$/.test(String(b.day)) ? String(b.day) : now.toISOString().slice(0, 10);
  const workout = str(b.workout, 60) || 'Treino';
  const status = ['seguido', 'alterado', 'saltado'].includes(String(b.status)) ? String(b.status) : 'seguido';
  const exercises = (Array.isArray(b.exercises) ? b.exercises : []).slice(0, 20).map((e) => {
    const y = (e ?? {}) as Record<string, unknown>;
    return { name: str(y.name, 80), sets: Math.max(0, Math.min(20, Math.round(Number(y.sets) || 0))), of: Math.max(0, Math.min(20, Math.round(Number(y.of) || 0))), reps: str(y.reps, 60), load: str(y.load, 60) };
  });
  const data = { status, minutes: Math.max(0, Math.min(300, Math.round(Number(b.minutes) || 0))), note: str(b.note, 300), changes: (Array.isArray(b.changes) ? b.changes : []).slice(0, 10).map((c) => str(c, 120)), exercises };
  // um registo por treino e dia (corrigir substitui)
  await db.batch([
    db.prepare('DELETE FROM pro_logs WHERE code = ? AND day = ? AND workout = ?').bind(s.code, day, workout),
    db.prepare('INSERT INTO pro_logs (code, day, workout, data, created) VALUES (?, ?, ?, ?, ?)').bind(s.code, day, workout, JSON.stringify(data), now.toISOString()),
  ]);
  const verb = status === 'saltado' ? 'não fez' : status === 'alterado' ? 'fez com alterações' : 'concluiu';
  const msg = { title: `${s.name} ${verb} o treino 💪`, body: `${workout}${data.minutes ? ` · ${data.minutes} min` : ''}${data.note ? ` · "${data.note.slice(0, 80)}"` : ''}`, tag: `nefesh-pro-${s.code}` };
  const { results: subs } = await db.prepare('SELECT endpoint, tz FROM push_subs WHERE uid = ?').bind(s.pro).all<{ endpoint: string; tz: string | null }>();
  let sent = 0;
  for (const sub of subs) {
    if (isQuiet(Number(localNow(sub.tz || 'Europe/Lisbon', now).time.slice(0, 2)))) continue;
    await sendPush(db, store, sub.endpoint, msg, fetcher).catch(() => undefined);
    sent++;
  }
  return ok({ sent });
}

/** Página da equipa: profissionais pendentes e aprovados. */
export async function proList(db: DB) {
  const { results } = await db.prepare('SELECT p.uid, p.name, p.kind, p.reg, p.status, p.created, (SELECT COUNT(*) FROM pro_students s WHERE s.pro = p.uid) AS students FROM pros p ORDER BY p.status DESC, p.created DESC').all<{ uid: string; name: string; kind: string; reg: string; status: string; created: string; students: number }>();
  return results;
}
export async function setProStatus(db: DB, uid: string, status: string) {
  if (!['aprovado', 'pendente', 'recusado'].includes(status)) return;
  await db.prepare('UPDATE pros SET status = ? WHERE uid = ?').bind(status, uid).run();
}
