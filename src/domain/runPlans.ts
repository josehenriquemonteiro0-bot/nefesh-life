/**
 * Planos de corrida que se ajustam ao que a pessoa faz:
 * - "Do sofá aos 5 km": 8 semanas, 3 sessões por semana, de correr/caminhar a 30 min seguidos;
 * - "Rumo aos 10 km": 8 semanas para quem já corre 5 km (fácil, ritmo e longo, com semana leve).
 * Regras: sessão completa e não difícil → avança; difícil ou incompleta → repete;
 * duas falhas seguidas → volta uma semana; duas fáceis seguidas → salta para a semana seguinte;
 * mais de 10 dias parado → repete a sessão anterior para voltar com calma.
 */
import { daysSince, todayKey } from './dates';

export type Seg = { k: 'aquecer' | 'corre' | 'caminha' | 'arrefecer'; secs?: number; km?: number };
export type PlanId = 'c5k' | 'k10';
export interface RunPlanState {
  id: PlanId;
  week: number; // 1…8
  session: number; // 1…3
  started: string;
  log: { d: string; week: number; session: number; done: boolean; feel: 'facil' | 'certo' | 'dificil' }[];
}

const W = (s: number): Seg => ({ k: 'caminha', secs: s });
const C = (s: number): Seg => ({ k: 'corre', secs: s });
const reps = (n: number, run: number, walk: number): Seg[] => Array.from({ length: n }, (_, i) => (i < n - 1 ? [C(run), W(walk)] : [C(run)])).flat();
const wrap = (main: Seg[]): Seg[] => [{ k: 'aquecer', secs: 300 }, ...main, { k: 'arrefecer', secs: 300 }];

/** Do sofá aos 5 km: semanas 1 a 8 (as 3 sessões da semana iguais, salvo na 5.ª). */
const C5K: Seg[][][] = [
  [reps(6, 60, 90)],
  [reps(6, 90, 120)],
  [reps(4, 180, 120)],
  [reps(3, 300, 150)],
  [reps(3, 480, 180), reps(2, 600, 180), [C(1200)]],
  [reps(2, 720, 180), [C(1380)], [C(1500)]],
  [[C(1500)]],
  [[C(1800)]],
].map((wk) => [0, 1, 2].map((i) => wrap(wk[Math.min(i, wk.length - 1)])));

const E = (km: number): Seg => ({ k: 'corre', km });
const tempo = (min: number): Seg[] => [E(1), { k: 'corre', secs: min * 60 }, E(1)];
/** Rumo aos 10 km: fácil, ritmo (mais rápido) e longo; semana 4 leve. */
const K10: Seg[][][] = [
  [[E(4)], tempo(10), [E(5)]],
  [[E(4)], tempo(12), [E(6)]],
  [[E(5)], tempo(15), [E(7)]],
  [[E(4)], tempo(10), [E(5)]],
  [[E(5)], tempo(18), [E(8)]],
  [[E(5)], tempo(20), [E(8.5)]],
  [[E(6)], tempo(20), [E(9)]],
  [[E(5)], tempo(12), [E(10)]],
].map((wk) => wk.map((s) => [{ k: 'aquecer', secs: 300 } as Seg, ...s, { k: 'arrefecer', secs: 300 } as Seg]));

export const RUN_PLANS: Record<PlanId, { title: string; desc: string; weeks: Seg[][][] }> = {
  c5k: { title: 'Do sofá aos 5 km', desc: '8 semanas, 3 vezes por semana: de correr 1 minuto a correr 30 minutos seguidos.', weeks: C5K },
  k10: { title: 'Rumo aos 10 km', desc: 'Para quem já corre 5 km: 8 semanas com corrida fácil, de ritmo e uma mais longa por semana.', weeks: K10 },
};

export const planSegments = (st: RunPlanState) => RUN_PLANS[st.id].weeks[st.week - 1][st.session - 1];

/** Descrição curta de uma sessão. */
export function sessionText(segs: Seg[]) {
  const main = segs.filter((s) => s.k === 'corre' || s.k === 'caminha');
  const mm = (s: number) => (s % 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s / 60}`);
  const runs = main.filter((s) => s.k === 'corre');
  if (runs.every((s) => s.km)) return `${runs.map((s) => `${String(s.km).replace('.', ',')} km`).join(' + ')} a correr (fácil)`;
  if (runs.length === 1 && runs[0].secs) return `${mm(runs[0].secs)} min a correr sem parar`;
  if (runs.some((s) => s.km)) return `1 km fácil, ${mm(runs.find((s) => s.secs)!.secs!)} min em ritmo mais rápido, 1 km fácil`;
  const walk = main.find((s) => s.k === 'caminha');
  return `${runs.length} × ${mm(runs[0].secs!)} min a correr${walk ? ` com ${mm(walk.secs!)} min a caminhar` : ''}`;
}

/** Tempo estimado da sessão (min); km a ~6:30 /km. */
export const sessionMinutes = (segs: Seg[]) => Math.round(segs.reduce((t, s) => t + (s.secs ?? (s.km ?? 0) * 390), 0) / 60);

export function startPlan(id: PlanId, today = todayKey()): RunPlanState {
  return { id, week: 1, session: 1, started: today, log: [] };
}

/** Sessão que toca agora (com a regra de "mais de 10 dias parado"). */
export function currentSession(st: RunPlanState, now = new Date()) {
  const last = st.log[st.log.length - 1];
  if (last && daysSince(last.d, now) > 10 && last.done) return { week: last.week, session: last.session, back: true };
  return { week: st.week, session: st.session, back: false };
}

/** Regista a sessão e decide a seguinte. Devolve o novo estado e a explicação. */
export function advancePlan(st: RunPlanState, done: boolean, feel: 'facil' | 'certo' | 'dificil', today = todayKey(), now = new Date()): { state: RunPlanState; why: string } {
  const cur = currentSession(st, now);
  const log = [...st.log, { d: today, week: cur.week, session: cur.session, done, feel }].slice(-60);
  const total = RUN_PLANS[st.id].weeks.length;
  const next = (w: number, s: number) => (s < 3 ? { week: w, session: s + 1 } : { week: Math.min(total + 1, w + 1), session: 1 });
  const prev = st.log[st.log.length - 1];
  let pos: { week: number; session: number };
  let why: string;
  if (!done || feel === 'dificil') {
    if (prev && (!prev.done || prev.feel === 'dificil') && prev.week === cur.week) {
      pos = { week: Math.max(1, cur.week - 1), session: 1 };
      why = cur.week > 1 ? 'Duas sessões difíceis seguidas: volta uma semana para ganhar base. Sem pressa.' : 'Repete esta semana com calma.';
    } else {
      pos = { week: cur.week, session: cur.session };
      why = 'Repete esta sessão na próxima vez: quando ficar no ponto certo, avança.';
    }
  } else if (feel === 'facil' && prev?.done && prev.feel === 'facil' && cur.session < 3 && cur.week < total) {
    pos = { week: cur.week + 1, session: 1 };
    why = 'Duas sessões fáceis seguidas: salta para a semana seguinte.';
  } else {
    pos = next(cur.week, cur.session);
    why = pos.week > total ? 'Plano concluído! 🎉' : pos.session === 1 ? `Semana ${cur.week} feita: segue para a semana ${pos.week}.` : 'Sessão feita: segue para a próxima.';
  }
  return { state: { ...st, ...pos, log }, why };
}

export const planDone = (st: RunPlanState) => st.week > RUN_PLANS[st.id].weeks.length;

/** Voz durante a sessão: o que dizer no início de cada bloco. */
export function segCue(s: Seg, i: number, segs: Seg[]) {
  const t = s.secs ? (s.secs % 60 ? `${Math.floor(s.secs / 60)} minutos e ${s.secs % 60} segundos` : `${s.secs / 60} ${s.secs === 60 ? 'minuto' : 'minutos'}`) : `${String(s.km).replace('.', ',')} quilómetros`;
  const lastRun = s.k === 'corre' && !segs.slice(i + 1).some((x) => x.k === 'corre');
  if (s.k === 'aquecer') return `Aquecimento: caminhe a bom ritmo durante ${t}.`;
  if (s.k === 'arrefecer') return `Muito bem! Agora caminhe devagar ${t} para arrefecer.`;
  if (s.k === 'caminha') return `Caminhe ${t}.`;
  const tempoRun = !!s.secs && segs.some((x) => x.km);
  return `${lastRun ? 'Último bloco! ' : ''}Agora corra ${t}${s.km ? ', num ritmo em que consegue falar' : tempoRun ? ' num ritmo mais rápido, ainda controlado' : ''}.`;
}
