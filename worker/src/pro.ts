/**
 * NEFESH Life Pro (fase A): o profissional (personal) monta o treino do aluno na app,
 * envia-lhe um código, o aluno liga-se com o código e o plano carrega na app; quando o
 * aluno conclui um treino, o profissional recebe um aviso e vê o registo.
 * Os profissionais são aprovados pela equipa NEFESH (página da equipa) antes de usar.
 * Tabelas: pros, pro_students, pro_logs (CREATE IF NOT EXISTS; reversível com DROP TABLE).
 */
import { localNow, sendPush, type KeyStore } from './push';
import { cleanTrack, intakeOf, isWellPro, logSymptoms, logWellDay, saveIntake, wellSummary, wellTeamSummary, cleanWell } from './proWell';
import type { DB } from './social';
import { isQuiet } from './notify';
import { cleanProfile, profileEmpty, type StudentProfile } from '../../src/domain/proProfile';
import { POSES, cleanAssessment, results } from '../../src/domain/proAssess';
import { checkinConcern, cleanCheckin, cleanDayLog, cleanNutri, nutriAttention, nutriFilled, type Checkin, type NutriDayLog } from '../../src/domain/proNutri';

/** Nutricionistas e médicos: plano alimentar, jejum e anamnese. */
export const isNutriPro = (kind?: string | null) => kind === 'nutricionista' || kind === 'medico';
/** Registo diário de alimentação do paciente (na tabela pro_logs, com este nome de 'treino'). */
export const NUTRI_LOG = '__nutri';
/** Módulo de cada área: personal (treino), nutri (nutricionista e médico) ou integrativo (terapias integrativas). */
export const moduleOf = (kind?: string | null) => (isNutriPro(kind) ? 'nutri' : isWellPro(kind) ? 'integrativo' : 'personal');

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
/** Só links https (YouTube, Instagram, Vimeo, Drive…) para o vídeo do exercício. */
export function videoUrl(v: unknown): string {
  const t = String(v ?? '').trim().slice(0, 300);
  try {
    const u = new URL(t);
    return u.protocol === 'https:' ? u.toString() : '';
  } catch {
    return '';
  }
}

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
          ...(videoUrl(y.video) ? { video: videoUrl(y.video) } : {}),
        };
      }).filter((e) => e.name),
    };
  }).filter((w) => w.exercises.length);
  const phases = (Array.isArray(o.phases) ? o.phases : []).slice(0, 8).map((x) => {
    const y = (x ?? {}) as Record<string, unknown>;
    return { name: str(y.name, 40), weeks: Math.max(1, Math.min(26, Math.round(Number(y.weeks) || 1))), notes: str(y.notes, 300) };
  }).filter((x) => x.name || x.notes);
  const fromPhases = phases.reduce((a, x) => a + x.weeks, 0);
  const weeks = Math.max(0, Math.min(52, Math.round(Number(o.weeks) || fromPhases || 0)));
  const start = /^\d{4}-\d{2}-\d{2}$/.test(String(o.start ?? '')) ? String(o.start) : '';
  // jejum intermitente prescrito (só nutricionistas e médicos: ver savePlan)
  const j = (o.jejum ?? null) as Record<string, unknown> | null;
  const jp = String(j?.protocol ?? '');
  const lowDays = (Array.isArray(j?.lowDays) ? j!.lowDays : []).map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6).slice(0, 2);
  const jejum = j && ['12:12', '14:10', '16:8', '18:6', '20:4', '5:2'].includes(jp) && /^([01]\d|2[0-3]):[0-5]\d$/.test(String(j.open)) && (jp !== '5:2' || lowDays.length === 2)
    ? { protocol: jp, open: String(j.open), ...(jp === '5:2' ? { lowDays } : {}), notes: str(j.notes, 200) } : null;
  const nutri = cleanNutri(o.nutri);
  const bemestar = cleanWell(o.bemestar);
  return {
    ...(bemestar ? { bemestar } : {}),
    ...(jejum ? { jejum } : {}),
    ...(nutri ? { nutri } : {}),
    is_workout: true, workouts, per_week: Math.max(1, Math.min(7, Math.round(Number(o.per_week) || workouts.length || 3))), professional: str(o.professional, 60), notes: str(o.notes, 600),
    ...(weeks ? { weeks } : {}), ...(start && weeks ? { start } : {}), ...(phases.length ? { phases } : {}),
  };
}

export async function proOf(db: DB, uid: string) {
  return db.prepare('SELECT uid, name, kind, reg, status, created FROM pros WHERE uid = ?').bind(uid).first<{ uid: string; name: string; kind: string; reg: string; status: string; created: string }>();
}

/** Pedido de registo como profissional (fica pendente até a equipa aprovar). */
/**
 * Profissionais já verificados pela equipa (registo profissional visto): entram aprovados logo.
 * Guarda-se só a chave da conta (hash do e-mail, como no KV das contas), nunca o e-mail.
 */
export const PREAPPROVED: { key: string; name: string; reg: string }[] = [
  { key: 'u:8b24f8fc3660492224ab658483b96e0c12c197371b19bb8160cc513785400a7d', name: 'Isabela', reg: 'CREF 008026-G/MT' },
];

/** Esta conta é de um profissional já verificado? */
export async function preapproved(store: { get(k: string): Promise<string | null> }, uid: string) {
  for (const p of PREAPPROVED) {
    const raw = await store.get(p.key);
    try {
      if (raw && (JSON.parse(raw) as { id?: string }).id === uid) return p;
    } catch {
      /* conta ilegível */
    }
  }
  return null;
}

/** Cria (ou aprova) o registo de um profissional já verificado. */
export async function ensurePreapproved(db: DB, uid: string, p: { name: string; reg: string }, now = new Date()) {
  const cur = await proOf(db, uid);
  if (cur?.status === 'aprovado') return;
  if (cur) await db.prepare("UPDATE pros SET status = 'aprovado' WHERE uid = ?").bind(uid).run();
  else await db.prepare("INSERT INTO pros (uid, name, kind, reg, status, created) VALUES (?, ?, 'personal', ?, 'aprovado', ?)").bind(uid, p.name, p.reg, now.toISOString()).run();
}

/** `auto` (só no servidor de teste): o acesso fica aprovado logo, sem passar pela página da equipa. */
/** Versão dos Termos do NEFESH Life Pro e do acordo de tratamento de dados (legal/termos-pro.html). */
export const PRO_TERMS = '2026-11-24';
const TERMS_MSG = 'Para continuar, aceite os Termos do NEFESH Life Pro e o acordo de tratamento de dados.';
async function acceptTerms(db: DB, uid: string, now: Date) {
  await db.prepare('INSERT INTO pro_terms (uid, version, at) VALUES (?, ?, ?) ON CONFLICT(uid, version) DO NOTHING').bind(uid, PRO_TERMS, now.toISOString()).run();
}

export async function registerPro(db: DB, uid: string, b: Record<string, unknown>, now = new Date(), auto = false): Promise<R> {
  const name = str(b.name, 60), reg = str(b.reg, 40) || (auto ? 'teste' : '');
  const kind = ['personal', 'nutricionista', 'medico', 'integrativo', 'outro'].includes(String(b.kind)) ? String(b.kind) : 'personal';
  if (name.length < 2) return bad('Escreva o seu nome profissional.');
  if (reg.length < 3) return bad(kind === 'integrativo' ? 'Escreva a sua formação ou certificação (por exemplo, naturopatia).' : 'Escreva o seu registo profissional (CREF ou título profissional).');
  if (b.terms !== PRO_TERMS) return bad(TERMS_MSG);
  await acceptTerms(db, uid, now);
  const cur = await proOf(db, uid);
  if (cur?.status === 'aprovado') return ok({ pro: cur });
  await db.prepare("INSERT INTO pros (uid, name, kind, reg, status, created) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(uid) DO UPDATE SET name = excluded.name, kind = excluded.kind, reg = excluded.reg, status = CASE WHEN ? THEN 'aprovado' ELSE pros.status END").bind(uid, name, kind, reg, auto ? 'aprovado' : 'pendente', now.toISOString(), auto ? 1 : 0).run();
  return ok({ pro: await proOf(db, uid) });
}

const weekAgo = (now: Date) => new Date(now.getTime() - 7 * 864e5).toISOString().slice(0, 10);

/** Painel do profissional: o seu estado e os alunos (com o último treino e os da semana). */
export async function proState(db: DB, uid: string, now = new Date(), auto = false): Promise<R> {
  const pro = await proOf(db, uid);
  if (!pro) return ok({ pro: null });
  if (auto && pro.status === 'pendente') {
    await db.prepare("UPDATE pros SET status = 'aprovado' WHERE uid = ?").bind(uid).run();
    pro.status = 'aprovado';
  }
  if (pro.status !== 'aprovado') return ok({ pro });
  const areas = await areasOf(db, uid, now);
  const nutriPro = isNutriPro(pro.kind);
  const { results } = await db.prepare('SELECT s.code, s.name, s.uid, s.plan, s.version, s.status, s.updated, k.kind AS module FROM pro_students s LEFT JOIN pro_student_kind k ON k.code = s.code WHERE s.pro = ? ORDER BY s.created DESC').bind(uid).all<{ code: string; name: string; uid: string | null; plan: string | null; version: number; status: string; updated: string; module: string | null }>();
  const students = [];
  const mine = moduleOf(pro.kind);
  const wellPro = isWellPro(pro.kind);
  for (const s of results) {
    // cada área (personal / nutrição) mostra só os seus; os antigos sem área contam pelo plano
    const module = s.module ?? (s.plan && /"bemestar"/.test(s.plan) ? 'integrativo' : s.plan && /"nutri"|"jejum"/.test(s.plan) && !/"exercises":\[\{/.test(s.plan) ? 'nutri' : 'personal');
    if (module !== mine) continue;
    const { results: recentLogs } = await db.prepare('SELECT day, workout, data, created FROM pro_logs WHERE code = ? ORDER BY day DESC, created DESC LIMIT 12').bind(s.code).all<{ day: string; workout: string; data: string; created: string }>();
    const last = recentLogs[0] ?? null;
    const parsed = recentLogs.filter((l) => !l.workout.startsWith('__')).map((l) => { try { return { day: l.day, data: JSON.parse(l.data) as LogData }; } catch { return null; } }).filter((x): x is { day: string; data: LogData } => !!x);
    const wk = await db.prepare("SELECT COUNT(*) AS n FROM pro_logs WHERE code = ? AND day >= ? AND substr(workout, 1, 2) != '__' AND json_extract(data, '$.status') != 'saltado'").bind(s.code, weekAgo(now)).first<{ n: number }>();
    let plan: ReturnType<typeof cleanPlan> | null = null;
    try { plan = s.plan ? (JSON.parse(s.plan) as ReturnType<typeof cleanPlan>) : null; } catch { plan = null; }
    const pr = await db.prepare('SELECT data FROM pro_profiles WHERE code = ?').bind(s.code).first<{ data: string }>();
    let profile: StudentProfile | null = null;
    try { profile = pr ? cleanProfile(JSON.parse(pr.data)) : null; } catch { profile = null; }
    const dr = await db.prepare('SELECT plan, updated FROM pro_drafts WHERE code = ?').bind(s.code).first<{ plan: string; updated: string }>();
    let draft: ReturnType<typeof cleanPlan> | null = null;
    try { draft = dr ? (JSON.parse(dr.plan) as ReturnType<typeof cleanPlan>) : null; } catch { draft = null; }
    let alerts: { kind: string; text: string }[] = attention(parsed, { linked: !!s.uid, hasPlan: !!plan, planSince: s.updated, endsInDays: planEndsIn(plan, now), hasDraft: !!dr }, now);
    let nutriLast: Record<string, unknown> | null = null;
    let nutriWeek = 0;
    if (nutriPro) {
      const { results: nl } = await db.prepare('SELECT day, data FROM pro_logs WHERE code = ? AND workout = ? ORDER BY day DESC LIMIT 30').bind(s.code, NUTRI_LOG).all<{ day: string; data: string }>();
      const days = nl.map((l) => { try { return { day: l.day, data: JSON.parse(l.data) as NutriDayLog }; } catch { return null; } }).filter((x): x is { day: string; data: NutriDayLog } => !!x);
      const extra = await nutriExtras(db, s.code, now);
      alerts = nutriAttention(days, { linked: !!s.uid, hasPlan: !!plan, planSince: s.updated, hasDraft: !!dr, endsInDays: plan?.nutri ? planEndsIn(plan.nutri, now) : null, ...extra }, now);
      nutriLast = days[0] ? { day: days[0].day, ...days[0].data } : null;
      nutriWeek = days.filter((d) => d.day >= weekAgo(now) && d.data.meals.some((m) => m.status)).length;
    }
    let well: Awaited<ReturnType<typeof wellSummary>> | null = null;
    if (wellPro) {
      well = await wellSummary(db, s.code, { linked: !!s.uid, hasPlan: !!plan?.bemestar, planSince: s.updated, hasDraft: !!dr }, now);
      alerts = well.alerts;
    }
    const unread = await unreadFor(db, s.code, 'pro');
    const sh = await db.prepare('SELECT updated FROM pro_share WHERE code = ?').bind(s.code).first<{ updated: string }>();
    const lastW = recentLogs.find((l) => !l.workout.startsWith('__')) ?? null;
    const team = await teamOf(db, s.uid, s.code, now);
    students.push({ shareAt: sh?.updated ?? null, unread, alerts, profile, draft, draftAt: dr?.updated ?? null, code: s.code, name: s.name, linked: !!s.uid, status: s.status, version: s.version, plan, updated: s.updated, last: lastW ? { day: lastW.day, workout: lastW.workout, ...(JSON.parse(lastW.data) as Record<string, unknown>) } : null, week: wk?.n ?? 0, ...(nutriPro ? { nutriLast, nutriWeek } : {}), ...(well ? { wellWeek: well.wellWeek, wellPct: well.wellPct, wellNote: well.wellNote, symptoms: well.symptoms, symAt: well.symAt, symNote: well.symNote, intakeAt: well.intakeAt } : {}), ...(team.length ? { team } : {}) });
  }
  return ok({ pro, students, areas });
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
    await db.prepare('INSERT OR REPLACE INTO pro_student_kind (code, kind) VALUES (?, ?)').bind(code, moduleOf(pro.kind)).run();
    if (b.profile && !profileEmpty(cleanProfile(b.profile))) await putProfile(db, code, b.profile, now);
    return ok({ code, name });
  }
  return bad('Não foi possível criar o código. Tente outra vez.', 500);
}

/** Guarda (ou atualiza) o treino do aluno; a versão sobe para o aluno receber a mudança. */
export async function savePlan(db: DB, uid: string, b: Record<string, unknown>, now = new Date()): Promise<R> {
  const s = await ownStudent(db, uid, b.code);
  if (!s) return bad('Aluno não encontrado.', 404);
  const pro = await proOf(db, uid);
  const raw = (b.plan ?? {}) as Record<string, unknown>;
  // periodização: o plano começa no dia em que é enviado (a não ser que o profissional diga outra data)
  const plan = cleanPlan({ ...raw, professional: pro?.name, start: raw.start || (Number(raw.weeks) || (Array.isArray(raw.phases) && raw.phases.length) ? now.toISOString().slice(0, 10) : '') });
  // o jejum só pode ser prescrito por nutricionistas e médicos
  if (!isNutriPro(pro?.kind)) { delete (plan as { jejum?: unknown }).jejum; delete (plan as { nutri?: unknown }).nutri; }
  // terapias integrativas: só o plano de bem-estar (sem treino, plano alimentar nem jejum); as outras áreas não o enviam
  if (isWellPro(pro?.kind)) {
    plan.workouts = [];
    if (!plan.bemestar) return bad('Acrescente pelo menos um hábito, uma prática ou uma orientação.');
    if (plan.bemestar.weeks && !plan.bemestar.start) plan.bemestar.start = now.toISOString().slice(0, 10);
  } else delete (plan as { bemestar?: unknown }).bemestar;
  // plano alimentar com duração: começa no dia em que é enviado (se ainda não tinha começado)
  if (plan.nutri?.weeks && !plan.nutri.start) plan.nutri.start = now.toISOString().slice(0, 10);
  if (plan.nutri && !plan.nutri.weeks) delete plan.nutri.start;
  if (plan.nutri && !nutriFilled(plan.nutri)) delete (plan as { nutri?: unknown }).nutri;
  if (!plan.workouts.length && !plan.jejum && !plan.nutri && !plan.bemestar) return bad(isNutriPro(pro?.kind) ? 'Acrescente pelo menos um alimento ao plano.' : 'Acrescente pelo menos um treino com um exercício.');
  await db.batch([
    db.prepare('UPDATE pro_students SET plan = ?, version = version + 1, updated = ? WHERE code = ?').bind(JSON.stringify(plan), now.toISOString(), s.code),
    db.prepare('DELETE FROM pro_drafts WHERE code = ?').bind(s.code),
  ]);
  return ok({ version: s.version + 1 });
}

/** Rascunho: o profissional guarda o treino sem o enviar ao aluno (o aluno continua a ver o último enviado). */
export async function saveDraft(db: DB, uid: string, b: Record<string, unknown>, now = new Date()): Promise<R> {
  const s = await ownStudent(db, uid, b.code);
  if (!s) return bad('Aluno não encontrado.', 404);
  const o = (b.plan ?? {}) as Record<string, unknown>;
  // no rascunho os treinos ainda vazios também ficam (a divisão já escolhida)
  const raw = (Array.isArray(o.workouts) ? o.workouts : []).slice(0, 10) as Record<string, unknown>[];
  const clean = cleanPlan(o);
  const workouts = raw.map((w) => clean.workouts.find((x) => x.name === str(w.name, 60)) ?? { name: str(w.name, 60) || 'Treino', focus: str(w.focus, 80), day: str(w.day, 30), exercises: [] });
  const at = now.toISOString();
  await db.prepare('INSERT INTO pro_drafts (code, plan, updated) VALUES (?, ?, ?) ON CONFLICT(code) DO UPDATE SET plan = excluded.plan, updated = excluded.updated').bind(s.code, JSON.stringify({ ...clean, workouts }), at).run();
  return ok({ at });
}

async function putProfile(db: DB, code: string, p: unknown, now: Date) {
  const prof = cleanProfile(p);
  if (profileEmpty(prof)) await db.prepare('DELETE FROM pro_profiles WHERE code = ?').bind(code).run();
  else await db.prepare('INSERT INTO pro_profiles (code, data, updated) VALUES (?, ?, ?) ON CONFLICT(code) DO UPDATE SET data = excluded.data, updated = excluded.updated').bind(code, JSON.stringify(prof), now.toISOString()).run();
  return profileEmpty(prof) ? null : prof;
}

/** Perfil do aluno (sexo, idade, medidas, objetivo, nível, lesões): guardado pelo profissional. */
export async function saveProfile(db: DB, uid: string, b: Record<string, unknown>, now = new Date()): Promise<R> {
  const s = await ownStudent(db, uid, b.code);
  if (!s) return bad('Aluno não encontrado.', 404);
  return ok({ profile: await putProfile(db, s.code, b.profile, now) });
}

/* ───────── avaliações físicas (histórico, fotos) ───────── */

export async function listAssessments(db: DB, uid: string, b: Record<string, unknown>): Promise<R> {
  const s = await ownStudent(db, uid, b.code);
  if (!s) return bad('Aluno não encontrado.', 404);
  const { results: rows } = await db.prepare('SELECT id, day, data FROM pro_assess WHERE code = ? ORDER BY day DESC, id DESC LIMIT 60').bind(s.code).all<{ id: number; day: string; data: string }>();
  const { results: ph } = await db.prepare('SELECT id, assess, pose FROM pro_photos WHERE code = ?').bind(s.code).all<{ id: number; assess: number; pose: string }>();
  return ok({ list: rows.map((r) => ({ ...(JSON.parse(r.data) as object), id: r.id, day: r.day, photos: ph.filter((p) => p.assess === r.id).map((p) => ({ id: p.id, pose: p.pose })) })) });
}

/** Guarda (nova ou corrigida) e põe os números mais recentes no perfil (a IA usa-os). */
export async function saveAssessment(db: DB, uid: string, b: Record<string, unknown>, now = new Date()): Promise<R> {
  const s = await ownStudent(db, uid, b.code);
  if (!s) return bad('Aluno não encontrado.', 404);
  const a = cleanAssessment(b.assessment, now.toISOString().slice(0, 10));
  const data = JSON.stringify(a);
  let id = Math.round(Number(b.id) || 0);
  if (id) {
    const own = await db.prepare('SELECT id FROM pro_assess WHERE id = ? AND code = ?').bind(id, s.code).first();
    if (!own) return bad('Avaliação não encontrada.', 404);
    await db.prepare('UPDATE pro_assess SET day = ?, data = ? WHERE id = ?').bind(a.day, data, id).run();
  } else {
    const n = await db.prepare('SELECT COUNT(*) AS n FROM pro_assess WHERE code = ?').bind(s.code).first<{ n: number }>();
    if ((n?.n ?? 0) >= 60) return bad('Chegou ao limite de avaliações deste aluno.');
    await db.prepare('INSERT INTO pro_assess (code, day, data, created) VALUES (?, ?, ?, ?)').bind(s.code, a.day, data, now.toISOString()).run();
    id = (await db.prepare('SELECT MAX(id) AS id FROM pro_assess WHERE code = ?').bind(s.code).first<{ id: number }>())?.id ?? 0;
  }
  const latest = await db.prepare('SELECT id FROM pro_assess WHERE code = ? ORDER BY day DESC, id DESC LIMIT 1').bind(s.code).first<{ id: number }>();
  if (latest?.id === id) {
    const pr = await db.prepare('SELECT data FROM pro_profiles WHERE code = ?').bind(s.code).first<{ data: string }>();
    const cur = pr ? cleanProfile(JSON.parse(pr.data)) : cleanProfile({});
    const r = results(a);
    await putProfile(db, s.code, {
      ...cur, sexo: a.sexo || cur.sexo, idade: a.idade ?? cur.idade, altura: a.altura ?? cur.altura, peso: a.peso ?? cur.peso,
      gordura: r.gordura ?? cur.gordura, magra: r.magra ?? cur.magra, fc: a.fc ?? cur.fc, dataAval: a.day,
      medidas: Object.keys(a.medidas).length ? a.medidas : cur.medidas,
    }, now);
  }
  return ok({ id });
}

export async function deleteAssessment(db: DB, uid: string, b: Record<string, unknown>): Promise<R> {
  const s = await ownStudent(db, uid, b.code);
  if (!s) return bad('Aluno não encontrado.', 404);
  const id = Math.round(Number(b.id) || 0);
  await db.batch([db.prepare('DELETE FROM pro_photos WHERE code = ? AND assess = ?').bind(s.code, id), db.prepare('DELETE FROM pro_assess WHERE code = ? AND id = ?').bind(s.code, id)]);
  return ok();
}

const MAX_PHOTO = 400_000; // ~300 KB em base64

/** Foto da avaliação (só com a autorização do aluno): visível apenas para o profissional. */
export async function savePhoto(db: DB, uid: string, b: Record<string, unknown>, now = new Date()): Promise<R> {
  const s = await ownStudent(db, uid, b.code);
  if (!s) return bad('Aluno não encontrado.', 404);
  if (b.consent !== true) return bad('Confirme que o aluno autorizou as fotos.');
  const assess = Math.round(Number(b.assess) || 0);
  if (!(await db.prepare('SELECT id FROM pro_assess WHERE id = ? AND code = ?').bind(assess, s.code).first())) return bad('Avaliação não encontrada.', 404);
  const pose = POSES.includes(b.pose as never) ? String(b.pose) : '';
  const image = String(b.image ?? '');
  if (!pose || !image || image.length > MAX_PHOTO || !/^[A-Za-z0-9+/=]+$/.test(image)) return bad('Foto inválida ou grande demais.');
  await db.batch([
    db.prepare('DELETE FROM pro_photos WHERE code = ? AND assess = ? AND pose = ?').bind(s.code, assess, pose),
    db.prepare('INSERT INTO pro_photos (code, assess, pose, data, created) VALUES (?, ?, ?, ?, ?)').bind(s.code, assess, pose, image, now.toISOString()),
  ]);
  return ok();
}

export async function getPhoto(db: DB, uid: string, b: Record<string, unknown>): Promise<R> {
  const s = await ownStudent(db, uid, b.code);
  if (!s) return bad('Aluno não encontrado.', 404);
  const p = await db.prepare('SELECT data FROM pro_photos WHERE id = ? AND code = ?').bind(Math.round(Number(b.id) || 0), s.code).first<{ data: string }>();
  return p ? ok({ image: p.data }) : bad('Foto não encontrada.', 404);
}

export async function deletePhoto(db: DB, uid: string, b: Record<string, unknown>): Promise<R> {
  const s = await ownStudent(db, uid, b.code);
  if (!s) return bad('Aluno não encontrado.', 404);
  await db.prepare('DELETE FROM pro_photos WHERE id = ? AND code = ?').bind(Math.round(Number(b.id) || 0), s.code).run();
  return ok();
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
  await db.batch([db.prepare('DELETE FROM pro_logs WHERE code = ?').bind(s.code), db.prepare('DELETE FROM pro_profiles WHERE code = ?').bind(s.code), db.prepare('DELETE FROM pro_drafts WHERE code = ?').bind(s.code), db.prepare('DELETE FROM pro_assess WHERE code = ?').bind(s.code), db.prepare('DELETE FROM pro_photos WHERE code = ?').bind(s.code), db.prepare('DELETE FROM pro_msgs WHERE code = ?').bind(s.code), db.prepare('DELETE FROM pro_share WHERE code = ?').bind(s.code), db.prepare('DELETE FROM pro_checkins WHERE code = ?').bind(s.code), db.prepare('DELETE FROM pro_notes WHERE code = ?').bind(s.code), db.prepare('DELETE FROM pro_intake WHERE code = ?').bind(s.code), db.prepare('DELETE FROM pro_student_kind WHERE code = ?').bind(s.code), db.prepare('DELETE FROM pro_students WHERE code = ?').bind(s.code)]);
  return ok();
}

/* ───────── lado do aluno (com conta, ou só com este telemóvel) ───────── */

/** Quem é o aluno: a conta, se tiver; senão, o telemóvel. */
export const studentKey = (uid: string | null, device: unknown) => (uid ? uid : /^[a-z0-9-]{8,64}$/i.test(String(device ?? '')) ? `d:${device}` : null);

async function linkedStudent(db: DB, key: string, code: unknown) {
  return db.prepare('SELECT s.code, s.name, s.uid, s.plan, s.version, s.pro, p.name AS pro_name, p.kind AS pro_kind FROM pro_students s JOIN pros p ON p.uid = s.pro WHERE s.code = ?').bind(normCode(code)).first<{ code: string; name: string; uid: string | null; plan: string | null; version: number; pro: string; pro_name: string; pro_kind: string }>().then((s) => (s && s.uid === key ? s : null));
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

export async function studentPlan(db: DB, key: string, b: Record<string, unknown>, now = new Date()): Promise<R> {
  const s = await linkedStudent(db, key, b.code);
  if (!s) return bad('Código não ligado a este telemóvel.', 404);
  let plan: unknown = null;
  try { plan = s.plan ? JSON.parse(s.plan) : null; } catch { plan = null; }
  const nutri = isNutriPro(s.pro_kind);
  const visit = nutri || isWellPro(s.pro_kind) ? await db.prepare("SELECT day, time, text FROM pro_notes WHERE code = ? AND kind = 'retorno' AND day >= ? ORDER BY day LIMIT 1").bind(s.code, now.toISOString().slice(0, 10)).first<{ day: string; time: string; text: string }>() : null;
  return ok({ code: s.code, pro: s.pro_name, kind: s.pro_kind, plan, version: s.version, unread: await unreadFor(db, s.code, 'aluno'), ...(nutri ? { checkinDue: !!plan && (await checkinDue(db, s.code, now)), nextVisit: visit ?? null } : isWellPro(s.pro_kind) ? { nextVisit: visit ?? null, intakeAt: (await db.prepare('SELECT updated FROM pro_intake WHERE code = ?').bind(s.code).first<{ updated: string }>())?.updated ?? null } : {}) });
}

/** O aluno desliga-se do personal (o histórico do personal fica, sem novos registos). */
export async function unlinkStudent(db: DB, key: string, b: Record<string, unknown>, now = new Date()): Promise<R> {
  const s = await linkedStudent(db, key, b.code);
  if (!s) return ok();
  await db.batch([
    db.prepare("UPDATE pro_students SET uid = NULL, status = 'terminado', updated = ? WHERE code = ?").bind(now.toISOString(), s.code),
    db.prepare('DELETE FROM pro_share WHERE code = ?').bind(s.code),
  ]);
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
    return { name: str(y.name, 80), sets: Math.max(0, Math.min(20, Math.round(Number(y.sets) || 0))), of: Math.max(0, Math.min(20, Math.round(Number(y.of) || 0))), reps: str(y.reps, 60), load: str(y.load, 60), effort: effortOf(y.effort), pain: y.pain === true };
  });
  const pain = b.pain === true || exercises.some((e) => e.pain);
  const data = { status, minutes: Math.max(0, Math.min(300, Math.round(Number(b.minutes) || 0))), note: str(b.note, 300), changes: (Array.isArray(b.changes) ? b.changes : []).slice(0, 10).map((c) => str(c, 120)), exercises, effort: effortOf(b.effort), pain };
  // um registo por treino e dia (corrigir substitui)
  await db.batch([
    db.prepare('DELETE FROM pro_logs WHERE code = ? AND day = ? AND workout = ?').bind(s.code, day, workout),
    db.prepare('INSERT INTO pro_logs (code, day, workout, data, created) VALUES (?, ?, ?, ?, ?)').bind(s.code, day, workout, JSON.stringify(data), now.toISOString()),
  ]);
  const verb = status === 'saltado' ? 'não fez' : status === 'alterado' ? 'fez com alterações' : 'concluiu';
  const painAt = exercises.filter((e) => e.pain).map((e) => e.name);
  const msg = pain
    ? { title: `⚠️ ${s.name} relatou dor no treino`, body: `${workout}${painAt.length ? ` · ${painAt.slice(0, 3).join(', ')}` : ''}${data.note ? ` · "${data.note.slice(0, 80)}"` : ''}`, tag: `nefesh-pro-${s.code}` }
    : { title: `${s.name} ${verb} o treino 💪`, body: `${workout}${data.minutes ? ` · ${data.minutes} min` : ''}${data.effort ? ` · ${EFFORT_TXT[data.effort]}` : ''}${data.note ? ` · "${data.note.slice(0, 80)}"` : ''}`, tag: `nefesh-pro-${s.code}` };
  const sent = await notify(db, store, s.pro, msg, now, fetcher);
  return ok({ sent });
}

/** Fase 2: check-in semanal com valores baixos e próxima consulta (para o painel de atenção). */
async function nutriExtras(db: DB, code: string, now: Date): Promise<{ checkinLow?: string | null; nextVisit?: string | null }> {
  const today = now.toISOString().slice(0, 10);
  const c = await db.prepare("SELECT day, data FROM pro_checkins WHERE code = ? AND json_extract(data, '$.request') IS NULL ORDER BY id DESC LIMIT 1").bind(code).first<{ day: string; data: string }>();
  let checkinLow: string | null = null;
  if (c && c.day >= weekAgo(now)) { try { checkinLow = checkinConcern(JSON.parse(c.data) as Checkin); } catch { checkinLow = null; } }
  const v = await db.prepare("SELECT day FROM pro_notes WHERE code = ? AND kind = 'retorno' AND day >= ? ORDER BY day LIMIT 1").bind(code, today).first<{ day: string }>();
  return { checkinLow, nextVisit: v?.day ?? null };
}

/* ───────── check-in semanal, notas da consulta e retornos (nutricionistas) ───────── */

/** Check-in em falta: nenhum nos últimos 7 dias, ou o nutricionista pediu um depois do último. */
async function checkinDue(db: DB, code: string, now: Date) {
  const { results } = await db.prepare('SELECT day, data FROM pro_checkins WHERE code = ? ORDER BY id DESC LIMIT 5').bind(code).all<{ day: string; data: string }>();
  const last = results.find((r) => !r.data.includes('"request"'));
  const req = results.find((r) => r.data.includes('"request"'));
  if (req && (!last || results.indexOf(req) < results.indexOf(last))) return true;
  return !last || last.day < weekAgo(now);
}

export async function studentCheckin(db: DB, store: KeyStore, key: string, b: Record<string, unknown>, now = new Date(), fetcher: typeof fetch = fetch): Promise<R> {
  const s = await linkedStudent(db, key, b.code);
  if (!s) return bad('Código não ligado a este telemóvel.', 404);
  const c = cleanCheckin(b.checkin);
  if (!c) return bad('Responda pelo menos a uma pergunta.');
  await db.prepare('INSERT INTO pro_checkins (code, day, data, created) VALUES (?, ?, ?, ?)').bind(s.code, now.toISOString().slice(0, 10), JSON.stringify(c), now.toISOString()).run();
  const concern = checkinConcern(c);
  await notify(db, store, s.pro, { title: `${s.name} respondeu ao check-in semanal`, body: concern ?? `Adesão ${c.adesao}/10${c.nota ? ` · "${c.nota.slice(0, 80)}"` : ''}`, tag: `nefesh-pro-${s.code}` }, now, fetcher);
  return ok();
}

export async function listCheckins(db: DB, uid: string, b: Record<string, unknown>): Promise<R> {
  const s = await ownStudent(db, uid, b.code);
  if (!s) return bad('Paciente não encontrado.', 404);
  const { results } = await db.prepare('SELECT id, day, data FROM pro_checkins WHERE code = ? ORDER BY id DESC LIMIT 30').bind(s.code).all<{ id: number; day: string; data: string }>();
  return ok({ list: results.map((r) => ({ id: r.id, day: r.day, ...(JSON.parse(r.data) as object) })) });
}

export async function requestCheckin(db: DB, uid: string, b: Record<string, unknown>, now = new Date()): Promise<R> {
  const s = await ownStudent(db, uid, b.code);
  if (!s) return bad('Paciente não encontrado.', 404);
  await db.prepare('INSERT INTO pro_checkins (code, day, data, created) VALUES (?, ?, ?, ?)').bind(s.code, now.toISOString().slice(0, 10), JSON.stringify({ request: true }), now.toISOString()).run();
  return ok();
}

/** Notas da consulta (só o profissional vê) e consultas de retorno (o paciente vê a data). */
export async function listNotes(db: DB, uid: string, b: Record<string, unknown>): Promise<R> {
  const s = await ownStudent(db, uid, b.code);
  if (!s) return bad('Paciente não encontrado.', 404);
  const { results } = await db.prepare('SELECT id, kind, day, time, text, created FROM pro_notes WHERE code = ? ORDER BY day DESC, id DESC LIMIT 100').bind(s.code).all<{ id: number; kind: string; day: string; time: string; text: string; created: string }>();
  return ok({ list: results });
}

export async function addNote(db: DB, uid: string, b: Record<string, unknown>, now = new Date()): Promise<R> {
  const s = await ownStudent(db, uid, b.code);
  if (!s) return bad('Paciente não encontrado.', 404);
  const kind = b.kind === 'retorno' ? 'retorno' : 'nota';
  const day = /^\d{4}-\d{2}-\d{2}$/.test(String(b.day)) ? String(b.day) : now.toISOString().slice(0, 10);
  const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(String(b.time)) ? String(b.time) : '';
  const text = str(b.text, kind === 'nota' ? 2000 : 200);
  if (kind === 'nota' && text.length < 2) return bad('Escreva a nota.');
  // só uma consulta de retorno marcada de cada vez: a nova substitui as futuras
  if (kind === 'retorno') await db.prepare("DELETE FROM pro_notes WHERE code = ? AND kind = 'retorno' AND day >= ?").bind(s.code, now.toISOString().slice(0, 10)).run();
  await db.prepare('INSERT INTO pro_notes (code, kind, day, time, text, created) VALUES (?, ?, ?, ?, ?, ?)').bind(s.code, kind, day, time, text, now.toISOString()).run();
  return ok();
}

export async function deleteNote(db: DB, uid: string, b: Record<string, unknown>): Promise<R> {
  const s = await ownStudent(db, uid, b.code);
  if (!s) return bad('Paciente não encontrado.', 404);
  await db.prepare('DELETE FROM pro_notes WHERE id = ? AND code = ?').bind(Math.round(Number(b.id) || 0), s.code).run();
  return ok();
}

/** Dia de alimentação do paciente (refeições do plano, adesão, fome…): um registo por dia, corrigir substitui. */
export async function logWellnessDay(db: DB, key: string, b: Record<string, unknown>, now = new Date()): Promise<R> {
  const s = await linkedStudent(db, key, b.code);
  if (!s) return bad('Código não ligado a este telemóvel.', 404);
  await logWellDay(db, s.code, b, now);
  return ok();
}

/** O paciente avalia os sintomas que o terapeuta escolheu (0 a 10), uma vez por semana. */
export async function logSymptomCheck(db: DB, key: string, b: Record<string, unknown>, now = new Date()): Promise<R> {
  const s = await linkedStudent(db, key, b.code);
  if (!s) return bad('Código não ligado a este telemóvel.', 404);
  const plan = s.plan ? (JSON.parse(s.plan) as { bemestar?: { track?: string[] } }) : null;
  const track = cleanTrack(plan?.bemestar?.track);
  if (!track.length) return bad('O terapeuta ainda não escolheu sintomas para acompanhar.');
  if (!(await logSymptoms(db, s.code, track, b, now))) return bad('Avalie pelo menos um sintoma.');
  return ok({ day: now.toISOString().slice(0, 10) });
}

/** O paciente envia a pré-anamnese (antes da consulta). Substitui a anterior. */
export async function sendIntake(db: DB, key: string, b: Record<string, unknown>, now = new Date()): Promise<R> {
  const s = await linkedStudent(db, key, b.code);
  if (!s) return bad('Código não ligado a este telemóvel.', 404);
  if (!isWellPro(s.pro_kind)) return bad('Só para terapeutas de práticas integrativas.');
  if (!(await saveIntake(db, s.code, b, now))) return bad('Responda a pelo menos uma pergunta.');
  return ok({ at: now.toISOString() });
}

/** O terapeuta lê a pré-anamnese do paciente e, depois de a juntar à ficha, arquiva-a. */
export async function readIntake(db: DB, uid: string, b: Record<string, unknown>): Promise<R> {
  const s = await ownStudent(db, uid, b.code);
  if (!s) return bad('Paciente não encontrado.', 404);
  return ok({ intake: await intakeOf(db, s.code) });
}
export async function archiveIntake(db: DB, uid: string, b: Record<string, unknown>): Promise<R> {
  const s = await ownStudent(db, uid, b.code);
  if (!s) return bad('Paciente não encontrado.', 404);
  await db.prepare('DELETE FROM pro_intake WHERE code = ?').bind(s.code).run();
  return ok();
}

export async function logNutriDay(db: DB, key: string, b: Record<string, unknown>, now = new Date()): Promise<R> {
  const s = await linkedStudent(db, key, b.code);
  if (!s) return bad('Código não ligado a este telemóvel.', 404);
  const day = /^\d{4}-\d{2}-\d{2}$/.test(String(b.day)) ? String(b.day) : now.toISOString().slice(0, 10);
  const data = cleanDayLog(b.data);
  await db.batch([
    db.prepare('DELETE FROM pro_logs WHERE code = ? AND day = ? AND workout = ?').bind(s.code, day, NUTRI_LOG),
    db.prepare('INSERT INTO pro_logs (code, day, workout, data, created) VALUES (?, ?, ?, ?, ?)').bind(s.code, day, NUTRI_LOG, JSON.stringify(data), now.toISOString()),
  ]);
  return ok();
}

/** Aviso no telemóvel (fora das 22h-8h): a conta (uid) ou, sem conta, o telemóvel ("d:<device>"). */
async function notify(db: DB, store: KeyStore, who: string, msg: { title: string; body: string; tag: string }, now: Date, fetcher: typeof fetch) {
  const q = who.startsWith('d:') ? db.prepare('SELECT endpoint, tz FROM push_subs WHERE device = ?').bind(who.slice(2)) : db.prepare('SELECT endpoint, tz FROM push_subs WHERE uid = ?').bind(who);
  const { results: subs } = await q.all<{ endpoint: string; tz: string | null }>();
  let sent = 0;
  for (const sub of subs) {
    if (isQuiet(Number(localNow(sub.tz || 'Europe/Lisbon', now).time.slice(0, 2)))) continue;
    await sendPush(db, store, sub.endpoint, msg, fetcher).catch(() => undefined);
    sent++;
  }
  return sent;
}

/* ───────── relatório de bem-estar partilhado pelo aluno (autorização revogável) ───────── */

const n1 = (v: unknown, max: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max ? Math.round(v * 10) / 10 : undefined);
const iso = (v: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v ?? '')) ? String(v) : '');
/** Só os números esperados (nada de texto livre do aluno). */
export function cleanShare(x: unknown) {
  const o = (x ?? {}) as Record<string, unknown>;
  const a = (o.avg ?? {}) as Record<string, unknown>;
  const w = o.weight as Record<string, unknown> | null;
  const t = o.train as Record<string, unknown> | null;
  return {
    from: iso(o.from), to: iso(o.to), goal: str(o.goal, 20),
    days: (Array.isArray(o.days) ? o.days : []).slice(0, 14).map((d) => {
      const y = (d ?? {}) as Record<string, unknown>;
      return { d: iso(y.d), e: n1(y.e, 5), sleepH: n1(y.sleepH, 16), stress: n1(y.stress, 5), steps: n1(y.steps, 100000), water: y.water === true ? true : y.water === false ? false : undefined, kcal: n1(y.kcal, 10000), prot: n1(y.prot, 500), train: n1(y.train, 600) };
    }).filter((d) => d.d),
    avg: { energy: n1(a.energy, 5) ?? null, sleep: n1(a.sleep, 16) ?? null, stress: n1(a.stress, 5) ?? null, steps: n1(a.steps, 100000) ?? null, kcal: n1(a.kcal, 10000) ?? null, prot: n1(a.prot, 500) ?? null },
    waterDays: n1(o.waterDays, 14) ?? 0, foodDays: n1(o.foodDays, 14) ?? 0, spirulinaDays: n1(o.spirulinaDays, 14) ?? 0, trainMin: n1(o.trainMin, 6000) ?? 0,
    train: t ? { done: n1(t.done, 30) ?? 0, planned: n1(t.planned, 30) ?? 0 } : null,
    weight: w && n1(w.first, 300) && n1(w.last, 300) ? { first: n1(w.first, 300)!, last: n1(w.last, 300)!, from: iso(w.from), to: iso(w.to) } : null,
    ...(Array.isArray(o.body) ? { body: o.body.slice(0, 40).map((x) => {
      const y = (x ?? {}) as Record<string, unknown>;
      const v = (z: unknown) => (typeof z === 'number' && Number.isFinite(z) && Math.abs(z) <= 10000 ? Math.round(z * 1000) / 1000 : null);
      return { label: str(y.label, 40), unit: str(y.unit, 10), first: v(y.first), last: v(y.last), from: iso(y.from), to: iso(y.to), diff: v(y.diff) };
    }).filter((r) => r.label && r.first !== null && r.last !== null && r.first >= 0 && r.last >= 0) } : {}),
    ...(Array.isArray(o.labs) ? { labs: o.labs.slice(0, 30).map((x) => {
      const y = (x ?? {}) as Record<string, unknown>;
      const v = (z: unknown) => (typeof z === 'number' && Number.isFinite(z) && Math.abs(z) <= 100000 ? Math.round(z * 100) / 100 : null);
      return { name: str(y.name, 50), unit: str(y.unit, 15), value: v(y.value), date: iso(y.date), prev: v(y.prev), lo: v(y.lo), hi: v(y.hi) };
    }).filter((r) => r.name && r.value !== null) } : {}),
    ...(o.nutri && typeof o.nutri === 'object' ? { nutri: (() => {
      const y = o.nutri as Record<string, unknown>;
      return {
        adherence: n1(y.adherence, 100) ?? null,
        days: (Array.isArray(y.days) ? y.days : []).slice(0, 14).map((d) => { const z = (d ?? {}) as Record<string, unknown>; return { d: iso(z.d), pct: n1(z.pct, 100) ?? null, hunger: n1(z.hunger, 5) }; }).filter((d) => d.d),
        changes: (Array.isArray(y.changes) ? y.changes : []).slice(0, 20).map((c) => str(c, 160)).filter(Boolean),
        hunger: n1(y.hunger, 5) ?? null, fastAvg: n1(y.fastAvg, 48) ?? null, fastDays: n1(y.fastDays, 14) ?? 0,
      };
    })() } : {}),
    ...(o.sleep && typeof o.sleep === 'object' ? { sleep: (() => {
      const y = o.sleep as Record<string, unknown>;
      const hm = (z: unknown) => (typeof z === 'string' && /^\d{2}:\d{2}$/.test(z) ? z : null);
      return { nights: n1(y.nights, 14) ?? 0, eff: n1(y.eff, 100) ?? null, asleepH: n1(y.asleepH, 16) ?? null, lat: n1(y.lat, 300) ?? null, wakes: n1(y.wakes, 30) ?? null, q: n1(y.q, 5) ?? null, bedAvg: hm(y.bedAvg), upAvg: hm(y.upAvg) };
    })() } : {}),
  };
}

/** Aluno: liga/desliga a partilha e envia o resumo (desligar apaga o que estava partilhado). */
export async function studentShare(db: DB, key: string, b: Record<string, unknown>, now = new Date()): Promise<R> {
  const s = await linkedStudent(db, key, b.code);
  if (!s) return bad('Código não ligado a este telemóvel.', 404);
  if (b.on !== true) {
    await db.prepare('DELETE FROM pro_share WHERE code = ?').bind(s.code).run();
    return ok({ on: false });
  }
  await db.prepare('INSERT INTO pro_share (code, data, updated) VALUES (?, ?, ?) ON CONFLICT(code) DO UPDATE SET data = excluded.data, updated = excluded.updated').bind(s.code, JSON.stringify(cleanShare(b.summary)), now.toISOString()).run();
  return ok({ on: true });
}

export async function shareReport(db: DB, uid: string, b: Record<string, unknown>): Promise<R> {
  const s = await ownStudent(db, uid, b.code);
  if (!s) return bad('Aluno não encontrado.', 404);
  const r = await db.prepare('SELECT data, updated FROM pro_share WHERE code = ?').bind(s.code).first<{ data: string; updated: string }>();
  if (!r) return bad(`${s.name} não está a partilhar o relatório.`, 404);
  return ok({ report: JSON.parse(r.data), updated: r.updated });
}

/* ───────── conversa personal ↔ aluno (com comentários num treino) ───────── */

type Msg = { id: number; sender: 'pro' | 'aluno'; text: string; ref: string; created: string; seen: number };
async function thread(db: DB, code: string, reader: 'pro' | 'aluno') {
  const { results } = await db.prepare('SELECT id, sender, text, ref, created, seen FROM pro_msgs WHERE code = ? ORDER BY id DESC LIMIT 100').bind(code).all<Msg>();
  // o que o outro escreveu fica lido
  await db.prepare('UPDATE pro_msgs SET seen = 1 WHERE code = ? AND sender != ? AND seen = 0').bind(code, reader).run();
  return results.reverse().map((m) => ({ id: m.id, from: m.sender, text: m.text, ref: m.ref, at: m.created }));
}
async function post(db: DB, code: string, sender: 'pro' | 'aluno', b: Record<string, unknown>, now: Date) {
  const text = str(b.text, 1000);
  if (!text) return null;
  const n = await db.prepare('SELECT COUNT(*) AS n FROM pro_msgs WHERE code = ? AND sender = ? AND created >= ?').bind(code, sender, new Date(now.getTime() - 864e5).toISOString()).first<{ n: number }>();
  if ((n?.n ?? 0) >= 100) return 'limite';
  await db.prepare('INSERT INTO pro_msgs (code, sender, text, ref, created) VALUES (?, ?, ?, ?, ?)').bind(code, sender, text, str(b.ref, 80), now.toISOString()).run();
  return text;
}
export const unreadFor = async (db: DB, code: string, reader: 'pro' | 'aluno') =>
  (await db.prepare('SELECT COUNT(*) AS n FROM pro_msgs WHERE code = ? AND sender != ? AND seen = 0').bind(code, reader).first<{ n: number }>())?.n ?? 0;

export async function proMessages(db: DB, uid: string, b: Record<string, unknown>): Promise<R> {
  const s = await ownStudent(db, uid, b.code);
  if (!s) return bad('Aluno não encontrado.', 404);
  return ok({ messages: await thread(db, s.code, 'pro') });
}
export async function proWrite(db: DB, store: KeyStore, uid: string, b: Record<string, unknown>, now = new Date(), fetcher: typeof fetch = fetch): Promise<R> {
  const s = await ownStudent(db, uid, b.code);
  if (!s) return bad('Aluno não encontrado.', 404);
  const t = await post(db, s.code, 'pro', b, now);
  if (!t) return bad('Escreva a mensagem.');
  if (t === 'limite') return bad('Muitas mensagens hoje. Tente amanhã.', 429);
  const pro = await proOf(db, uid);
  if (s.uid) await notify(db, store, s.uid, { title: `💬 ${pro?.name ?? 'O seu personal'}`, body: `${b.ref ? `${str(b.ref, 80)}: ` : ''}${t.slice(0, 120)}`, tag: `nefesh-pro-msg-${s.code}` }, now, fetcher);
  return ok({ messages: await thread(db, s.code, 'pro') });
}
export async function studentMessages(db: DB, key: string, b: Record<string, unknown>): Promise<R> {
  const s = await linkedStudent(db, key, b.code);
  if (!s) return bad('Código não ligado a este telemóvel.', 404);
  return ok({ messages: await thread(db, s.code, 'aluno') });
}
export async function studentWrite(db: DB, store: KeyStore, key: string, b: Record<string, unknown>, now = new Date(), fetcher: typeof fetch = fetch): Promise<R> {
  const s = await linkedStudent(db, key, b.code);
  if (!s) return bad('Código não ligado a este telemóvel.', 404);
  const t = await post(db, s.code, 'aluno', b, now);
  if (!t) return bad('Escreva a mensagem.');
  if (t === 'limite') return bad('Muitas mensagens hoje. Tente amanhã.', 429);
  await notify(db, store, s.pro, { title: `💬 ${s.name}`, body: `${b.ref ? `${str(b.ref, 80)}: ` : ''}${t.slice(0, 120)}`, tag: `nefesh-pro-msg-${s.code}` }, now, fetcher);
  return ok({ messages: await thread(db, s.code, 'aluno') });
}

type Effort = '' | 'facil' | 'ok' | 'dificil';
const effortOf = (v: unknown): Effort => (v === 'facil' || v === 'ok' || v === 'dificil' ? v : '');
const EFFORT_TXT: Record<Exclude<Effort, ''>, string> = { facil: 'achou fácil', ok: 'na medida', dificil: 'achou difícil' };

export interface LogData { status: string; minutes: number; note: string; effort?: Effort; pain?: boolean; exercises: { name: string; sets: number; of: number; load: string; effort?: Effort; pain?: boolean }[] }
export interface Alert { kind: 'enviar' | 'dor' | 'parado' | 'saltou' | 'dificil' | 'subir' | 'fim'; text: string }

const daysBetween = (a: string, b: Date) => Math.floor((b.getTime() - new Date(`${a.slice(0, 10)}T12:00:00Z`).getTime()) / 864e5);
const dm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

/**
 * "Precisa de atenção": o que o personal deve olhar neste aluno, do mais importante para o menos.
 * logs: os mais recentes primeiro.
 */
export function attention(logs: { day: string; data: LogData }[], o: { linked: boolean; hasPlan: boolean; planSince?: string; endsInDays?: number | null; hasDraft?: boolean }, now = new Date()): Alert[] {
  const out: Alert[] = [];
  if (o.linked && !o.hasPlan) out.push({ kind: 'enviar', text: o.hasDraft ? 'Já usou o código, mas o treino ainda não foi enviado (está guardado)' : 'Já usou o código e está à espera do treino' });
  const recent = logs.filter((l) => daysBetween(l.day, now) <= 14);
  const pained = recent.find((l) => l.data.pain);
  if (pained) {
    const where = pained.data.exercises.filter((e) => e.pain).map((e) => e.name);
    out.push({ kind: 'dor', text: `Relatou dor${where.length ? ` em ${where.slice(0, 2).join(', ')}` : ''} (${dm(pained.day)})${pained.data.note ? `: "${pained.data.note.slice(0, 60)}"` : ''}` });
  }
  if (o.linked && o.hasPlan) {
    const last = logs.find((l) => l.data.status !== 'saltado');
    const since = last ? daysBetween(last.day, now) : o.planSince ? daysBetween(o.planSince, now) : 0;
    if (since >= 5) out.push({ kind: 'parado', text: last ? `Sem treinar há ${since} dias` : `Ainda não registou nenhum treino (plano enviado há ${since} dias)` });
  }
  if (logs.length >= 2 && logs[0].data.status === 'saltado' && logs[1].data.status === 'saltado') out.push({ kind: 'saltou', text: 'Saltou os 2 últimos treinos' });
  // por exercício: as 2 últimas vezes
  const byEx = new Map<string, { effort?: Effort; full: boolean }[]>();
  for (const l of logs) for (const e of l.data.exercises) {
    if (!e.name || l.data.status === 'saltado') continue;
    const a = byEx.get(e.name) ?? [];
    if (a.length < 2) a.push({ effort: e.effort || l.data.effort, full: e.of > 0 && e.sets >= e.of });
    byEx.set(e.name, a);
  }
  const hard = [...byEx].filter(([, a]) => a.length === 2 && a.every((x) => x.effort === 'dificil')).map(([n]) => n);
  if (hard.length) out.push({ kind: 'dificil', text: `Achou difícil 2 vezes seguidas: ${hard.slice(0, 3).join(', ')}` });
  const up = [...byEx].filter(([, a]) => a.length === 2 && a.every((x) => x.effort === 'facil' && x.full)).map(([n]) => n);
  if (up.length) out.push({ kind: 'subir', text: `Pronto para subir a carga: ${up.slice(0, 3).join(', ')}` });
  if (o.endsInDays !== undefined && o.endsInDays !== null && o.endsInDays <= 7) out.push({ kind: 'fim', text: o.endsInDays < 0 ? `O plano terminou há ${-o.endsInDays} dias` : o.endsInDays === 0 ? 'O plano termina hoje' : `O plano termina em ${o.endsInDays} dias` });
  return out;
}

/** Dias até ao fim do plano periodizado (negativo: já terminou); null sem periodização. */
export function planEndsIn(plan: { weeks?: number; start?: string } | null, now = new Date()): number | null {
  if (!plan?.weeks || !plan.start) return null;
  const end = new Date(`${plan.start}T12:00:00Z`).getTime() + plan.weeks * 7 * 864e5;
  return Math.ceil((end - now.getTime()) / 864e5) - 1;
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

/* ───────── equipa multidisciplinar (com autorização do paciente) ───────── */

/** O paciente autoriza (ou não) que os profissionais dele vejam o essencial uns dos outros. */
export async function studentTeam(db: DB, key: string, b: Record<string, unknown>, now = new Date()): Promise<R> {
  const s = await linkedStudent(db, key, b.code);
  if (!s) return bad('Código não ligado a este telemóvel.', 404);
  await db.prepare('INSERT INTO pro_team (key, on_, updated) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET on_ = excluded.on_, updated = excluded.updated').bind(key, b.on === true ? 1 : 0, now.toISOString()).run();
  return ok();
}

export interface TeamMember { pro: string; kind: string; summary: string[] }
/** Os outros profissionais do mesmo paciente (só com autorização): o que cada um definiu, em poucas linhas. */
export async function teamOf(db: DB, studentUid: string | null, code: string, now = new Date()): Promise<TeamMember[]> {
  if (!studentUid) return [];
  const t = await db.prepare('SELECT on_ FROM pro_team WHERE key = ?').bind(studentUid).first<{ on_: number }>();
  if (!t?.on_) return [];
  const { results } = await db.prepare('SELECT s.code, s.plan, p.name, p.kind FROM pro_students s JOIN pros p ON p.uid = s.pro WHERE s.uid = ? AND s.code != ?').bind(studentUid, code).all<{ code: string; plan: string | null; name: string; kind: string }>();
  const out: TeamMember[] = [];
  for (const r of results) {
    let plan: ReturnType<typeof cleanPlan> | null = null;
    try { plan = r.plan ? (JSON.parse(r.plan) as ReturnType<typeof cleanPlan>) : null; } catch { plan = null; }
    const summary: string[] = [];
    if (isWellPro(r.kind)) summary.push(...wellTeamSummary(plan as never));
    else if (isNutriPro(r.kind)) {
      const n = plan?.nutri;
      if (n) {
        const tg = n.targets;
        if (tg.kcal || tg.protein) summary.push(`Metas: ${tg.kcal ? `${tg.kcal} kcal` : ''}${tg.kcal && tg.protein ? ' · ' : ''}${tg.protein ? `${tg.protein} g de proteína` : ''}${tg.water ? ` · água ${String(tg.water).replace('.', ',')} L` : ''}`);
        summary.push(`Refeições: ${n.days[0].meals.map((m) => `${m.label} ${m.time}`).join(', ')}`);
        if (n.days.length > 1) summary.push(`Tipos de dia: ${n.days.map((d) => d.name).join(', ')}`);
      } else summary.push('Plano alimentar ainda não enviado.');
      if (plan?.jejum) summary.push(`Jejum ${plan.jejum.protocol}${plan.jejum.protocol !== '5:2' ? ` (janela a partir das ${plan.jejum.open})` : ''}`);
    } else {
      if (plan?.workouts.length) {
        summary.push(`Treino: ${plan.workouts.map((w) => `${w.name}${w.focus ? ` (${w.focus})` : ''}`).join(', ')} · ${plan.per_week}× por semana`);
        const wk = await db.prepare("SELECT COUNT(*) AS n FROM pro_logs WHERE code = ? AND day >= ? AND substr(workout, 1, 2) != '__' AND json_extract(data, '$.status') != 'saltado'").bind(r.code, weekAgo(now)).first<{ n: number }>();
        summary.push(`Treinos feitos nos últimos 7 dias: ${wk?.n ?? 0}`);
      } else summary.push('Treino ainda não enviado.');
    }
    out.push({ pro: r.name, kind: r.kind, summary });
  }
  return out;
}

/* ───────── diretório de profissionais verificados ───────── */

const KINDS = ['personal', 'nutricionista', 'medico', 'integrativo', 'outro'];
/** Contacto público: link https, e-mail ou telefone (só dígitos e +). */
export function cleanContact(v: unknown): string {
  const t = String(v ?? '').trim().slice(0, 200);
  if (/^https:\/\/[^\s<>"']+$/i.test(t)) return t;
  if (/^[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}$/i.test(t)) return t;
  const ph = t.replace(/[^\d+]/g, '');
  return /^\+?\d{9,15}$/.test(ph) ? ph : '';
}

export async function myDirectory(db: DB, uid: string): Promise<R> {
  const r = await db.prepare('SELECT data FROM pro_directory WHERE uid = ?').bind(uid).first<{ data: string }>();
  return ok({ entry: r ? JSON.parse(r.data) : null });
}

export async function saveDirectory(db: DB, uid: string, b: Record<string, unknown>, now = new Date()): Promise<R> {
  const p = await proOf(db, uid);
  if (p?.status !== 'aprovado') return bad('Só profissionais aprovados aparecem no diretório.', 403);
  if (b.on !== true) { await db.prepare('DELETE FROM pro_directory WHERE uid = ?').bind(uid).run(); return ok({ entry: null }); }
  const contact = cleanContact(b.contact);
  if (!contact) return bad('Indique um contacto válido: telefone, e-mail ou link https.');
  const entry = { city: str(b.city, 60), online: b.online === true, areas: str(b.areas, 160), bio: str(b.bio, 300), contact };
  await db.prepare('INSERT INTO pro_directory (uid, data, updated) VALUES (?, ?, ?) ON CONFLICT(uid) DO UPDATE SET data = excluded.data, updated = excluded.updated').bind(uid, JSON.stringify(entry), now.toISOString()).run();
  return ok({ entry });
}

/** Lista pública: só profissionais aprovados que quiseram aparecer. */
export async function directory(db: DB): Promise<R> {
  const { results } = await db.prepare("SELECT p.name, p.kind, p.reg, d.data FROM pro_directory d JOIN pros p ON p.uid = d.uid WHERE p.status = 'aprovado' ORDER BY p.kind, p.name LIMIT 300").all<{ name: string; kind: string; reg: string; data: string }>();
  return ok({ list: results.map((r) => ({ name: r.name, kind: KINDS.includes(r.kind) ? r.kind : 'outro', reg: r.reg, ...(JSON.parse(r.data) as object) })) });
}

/* ───────── áreas profissionais (dupla formação: personal + nutricionista, etc.) ───────── */

const AREA_KINDS = ['personal', 'nutricionista', 'medico', 'integrativo'];
export interface ProArea { kind: string; reg: string; status: string }
/** As áreas do profissional: a atual (a do registo) e as pedidas depois, cada uma com o seu registo e estado. */
export async function areasOf(db: DB, uid: string, now = new Date()): Promise<ProArea[]> {
  const p = await proOf(db, uid);
  if (!p) return [];
  await db.prepare('INSERT OR IGNORE INTO pro_areas (uid, kind, reg, status, created) VALUES (?, ?, ?, ?, ?)').bind(uid, p.kind, p.reg, p.status, now.toISOString()).run();
  // a área atual acompanha o estado do registo principal (aprovação ou suspensão pela equipa)
  await db.prepare('UPDATE pro_areas SET status = ? WHERE uid = ? AND kind = ?').bind(p.status, uid, p.kind).run();
  const { results } = await db.prepare('SELECT kind, reg, status FROM pro_areas WHERE uid = ? ORDER BY created').bind(uid).all<ProArea>();
  return results.filter((r) => AREA_KINDS.includes(r.kind));
}

/** Pedir uma nova área (ex.: personal que também é nutricionista): fica pendente até a equipa validar o registo. */
export async function requestArea(db: DB, uid: string, b: Record<string, unknown>, auto: boolean, now = new Date()): Promise<R> {
  const p = await proOf(db, uid);
  if (p?.status !== 'aprovado') return bad('A sua conta profissional ainda não foi aprovada.', 403);
  const kind = AREA_KINDS.includes(String(b.kind)) ? String(b.kind) : null;
  const reg = str(b.reg, 40);
  if (!kind) return bad('Área inválida.');
  if (b.terms !== PRO_TERMS) return bad(TERMS_MSG);
  if (reg.length < 3) return bad(kind === 'nutricionista' ? 'Escreva o seu registo de nutricionista (CRN ou cédula da Ordem).' : kind === 'medico' ? 'Escreva o seu registo médico (CRM ou cédula da Ordem).' : 'Escreva o seu registo (CREF ou título profissional).');
  await acceptTerms(db, uid, now);
  await areasOf(db, uid, now);
  const cur = await db.prepare('SELECT status FROM pro_areas WHERE uid = ? AND kind = ?').bind(uid, kind).first<{ status: string }>();
  if (cur?.status === 'aprovado') return ok({ areas: await areasOf(db, uid, now) });
  await db.prepare('INSERT INTO pro_areas (uid, kind, reg, status, created) VALUES (?, ?, ?, ?, ?) ON CONFLICT(uid, kind) DO UPDATE SET reg = excluded.reg, status = excluded.status').bind(uid, kind, reg, auto ? 'aprovado' : 'pendente', now.toISOString()).run();
  return ok({ areas: await areasOf(db, uid, now) });
}

/** Trocar de área: só para áreas aprovadas (no servidor de teste, qualquer uma). */
export async function switchArea(db: DB, uid: string, b: Record<string, unknown>, auto: boolean, now = new Date()): Promise<R> {
  const kind = AREA_KINDS.includes(String(b.kind)) ? String(b.kind) : null;
  if (!kind) return bad('Área inválida.');
  const cur = await proOf(db, uid);
  if (!cur) return bad('Ainda não tem acesso profissional.', 404);
  const areas = await areasOf(db, uid, now);
  let area = areas.find((a) => a.kind === kind);
  if (auto && area?.status !== 'aprovado') {
    await db.prepare('INSERT INTO pro_areas (uid, kind, reg, status, created) VALUES (?, ?, ?, ?, ?) ON CONFLICT(uid, kind) DO UPDATE SET status = excluded.status').bind(uid, kind, area?.reg || cur.reg, 'aprovado', now.toISOString()).run();
    area = { kind, reg: area?.reg || cur.reg, status: 'aprovado' };
  }
  if (area?.status !== 'aprovado') return bad('Esta área ainda não foi validada pela equipa NEFESH.', 403);
  await db.prepare('UPDATE pros SET kind = ?, reg = ? WHERE uid = ?').bind(kind, area.reg, uid).run();
  return ok({ pro: await proOf(db, uid), areas: await areasOf(db, uid, now) });
}

/** Página da equipa: pedidos de nova área. */
export async function areaRequests(db: DB) {
  const { results } = await db.prepare("SELECT a.uid, a.kind, a.reg, a.created, p.name, p.kind AS main FROM pro_areas a JOIN pros p ON p.uid = a.uid WHERE a.status = 'pendente' AND a.kind != p.kind ORDER BY a.created").all<{ uid: string; kind: string; reg: string; created: string; name: string; main: string }>();
  return results;
}
export async function setAreaStatus(db: DB, uid: string, kind: string, status: string) {
  if (!['aprovado', 'recusado'].includes(status)) return;
  await db.prepare('UPDATE pro_areas SET status = ? WHERE uid = ? AND kind = ?').bind(status, uid, kind).run();
}
