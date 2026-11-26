/**
 * Início inteligente: a app aprende os hábitos da pessoa (no próprio telemóvel, sem IA nem servidor).
 *
 * - Eventos: quando algo é registado (treino, água, check-in, respiração…), guarda-se o tipo, o dia e o minuto.
 * - Rotinas: com 4 dias ou mais, a hora habitual de cada coisa (separando dias úteis e fim de semana).
 *   Perto dessa hora, o "A seguir" sugere-a; se a pessoa a dispensar 3 vezes seguidas, deixa de sugerir.
 * - Atalhos: ações diretas (+1 copo, respiração de 5 min, foto do prato…), ordenadas pelo que a pessoa
 *   mais usa àquela hora, com favoritos fixos.
 * - Insights: comparações com os dados da própria pessoa (treino → sono, sono → energia, dia com menos água…),
 *   um por dia, com 👍/👎 para aprender o que lhe interessa.
 * - Descobrir: uma vez por semana, uma função que ainda não usou e que combina com o objetivo.
 * - Início adaptativo: cartões que não abre há 14 dias recolhem-se em "Mais".
 */
import { dayKey, keyDaysAgo } from './dates';
import { planFor } from './plan';
import type { AppState, DayLog } from './types';

export type HabitEv = 'treino' | 'refeicao' | 'agua' | 'dose' | 'checkin' | 'respiracao' | 'meditacao' | 'diario' | 'med' | 'ritual';
export interface SmartEvent { k: HabitEv; d: string; m: number }
export interface SmartState {
  /** eventos com hora (últimos 60 dias, no máximo 600) */
  ev?: SmartEvent[];
  /** uso dos atalhos: id → minutos do dia de cada uso (últimos 40) */
  use?: Record<string, number[]>;
  /** atalhos favoritos (até 6, pela ordem escolhida) */
  fav?: string[];
  /** sugestões dispensadas: rotina → vezes seguidas e último dia */
  skip?: Partial<Record<HabitEv, { n: number; d: string }>>;
  /** reação aos insights: id → +1 / -1 (e quando) */
  fb?: Record<string, { v: 1 | -1; d: string }>;
  /** insight mostrado hoje */
  ins?: { d: string; id: string };
  /** último dia em que cada cartão do Início foi usado */
  seen?: Record<string, string>;
  /** Descobrir: sugestão da semana e as já vistas */
  disc?: { d: string; id: string; done: string[] };
  /** lembretes nos horários aprendidos (só na app do iPhone) */
  remind?: boolean;
  /** Início com todos os cartões, sem recolher */
  all?: boolean;
  /** primeiro dia com o Início inteligente (o Início adaptativo só observa a partir daqui) */
  since?: string;
}

const MAX_EV = 600;
const minuteOf = (d: Date) => d.getHours() * 60 + d.getMinutes();
export const hhmm = (m: number) => `${String(Math.floor(((m % 1440) + 1440) % 1440 / 60)).padStart(2, '0')}:${String(Math.round(m) % 60).padStart(2, '0')}`;

/* ───────── eventos ───────── */

const nTrue = (a?: (boolean | undefined)[] | Record<string, boolean>) => (Array.isArray(a) ? a.filter(Boolean).length : Object.values(a ?? {}).filter(Boolean).length);
const nMeals = (l?: DayLog) => Object.values(l?.meals ?? {}).flat().filter((e) => e && !e.auto).length;

/** O que acabou de ser registado (comparando o dia antes e depois de uma alteração). */
export function detectEvents(prev: DayLog | undefined, next: DayLog | undefined): HabitEv[] {
  if (!next) return [];
  const p = prev ?? {};
  const out: HabitEv[] = [];
  if ((next.workouts?.length ?? 0) > (p.workouts?.length ?? 0)) out.push('treino');
  if (nMeals(next) > nMeals(p)) out.push('refeicao');
  if ((next.water ?? 0) > (p.water ?? 0)) out.push('agua');
  if (nTrue(next.doses) > nTrue(p.doses)) out.push('dose');
  if (next.e && !p.e) out.push('checkin');
  if ((next.breath ?? 0) > (p.breath ?? 0)) out.push('respiracao');
  if ((next.medit ?? 0) > (p.medit ?? 0)) out.push('meditacao');
  if (next.sleepD && !p.sleepD) out.push('diario');
  if (nTrue(next.meds) > nTrue(p.meds)) out.push('med');
  if (next.ritual && !p.ritual) out.push('ritual');
  return out;
}

/** Guarda os eventos (com a hora) e limpa os que têm mais de 60 dias. */
export function recordEvents(S: AppState, evs: HabitEv[], now = new Date()) {
  if (!evs.length) return;
  const sm = (S.smart = S.smart ?? {});
  const d = dayKey(now);
  const m = minuteOf(now);
  const from = keyDaysAgo(60, now);
  sm.ev = [...(sm.ev ?? []).filter((e) => e.d >= from), ...evs.map((k) => ({ k, d, m }))].slice(-MAX_EV);
  // fez a rotina: deixa de contar como dispensada
  for (const k of evs) if (sm.skip?.[k]) delete sm.skip[k];
}

/* ───────── rotinas ───────── */

/** Rotinas que o "A seguir" pode sugerir (a água, a Spirulina e as refeições já têm as suas regras). */
export const ROUTINE_KINDS: HabitEv[] = ['treino', 'meditacao', 'respiracao', 'checkin', 'diario', 'ritual'];
const weekend = (d: string) => { const w = new Date(`${d}T12:00:00`).getDay(); return w === 0 || w === 6; };
const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); const i = Math.floor(s.length / 2); return s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2; };

export interface Routine { k: HabitEv; m: number; n: number; days: 'uteis' | 'fds' | 'todos' }

/** Hora habitual de cada coisa (primeira vez em cada dia, últimos 28 dias), com pelo menos 4 dias e pouca variação. */
export function routines(S: Pick<AppState, 'smart'>, now = new Date(), kinds: HabitEv[] = ROUTINE_KINDS): Routine[] {
  const from = keyDaysAgo(28, now);
  const today = dayKey(now);
  const isWe = weekend(today);
  const out: Routine[] = [];
  for (const k of kinds) {
    const first = new Map<string, number>();
    for (const e of S.smart?.ev ?? []) if (e.k === k && e.d >= from && e.d < today && (!first.has(e.d) || e.m < first.get(e.d)!)) first.set(e.d, e.m);
    const all = [...first.entries()];
    const same = all.filter(([d]) => weekend(d) === isWe).map(([, m]) => m);
    // primeiro tenta o mesmo tipo de dia (útil ou fim de semana); se houver poucos, usa todos
    for (const [ms, days] of [[same, isWe ? 'fds' : 'uteis'], [all.map(([, m]) => m), 'todos']] as const) {
      if (ms.length < 4) continue;
      const med = median(ms);
      const mad = median(ms.map((x) => Math.abs(x - med)));
      if (mad > 75) continue; // horas muito diferentes de dia para dia: não é uma rotina
      out.push({ k, m: Math.round(med / 5) * 5, n: ms.length, days });
      break;
    }
  }
  return out;
}

const ROUTINE_TEXT: Record<HabitEv, { title: string; detail: string }> = {
  treino: { title: 'Hora do seu treino', detail: 'É mais ou menos a esta hora que costuma treinar.' },
  meditacao: { title: 'A sua meditação', detail: 'Costuma meditar por volta desta hora.' },
  respiracao: { title: 'Uma respiração de 5 minutos', detail: 'Costuma fazer uma pausa para respirar a esta hora.' },
  checkin: { title: 'O seu check-in', detail: 'Costuma fazer o check-in por volta desta hora: 30 segundos.' },
  diario: { title: 'Diário do sono', detail: 'Costuma preencher o diário a esta hora: como dormiu?' },
  ritual: { title: 'Ritual da noite', detail: 'Costuma começar o ritual por volta desta hora.' },
  agua: { title: 'Água', detail: '' }, dose: { title: 'Spirulina', detail: '' }, refeicao: { title: 'Refeição', detail: '' }, med: { title: 'Medicação', detail: '' },
};

/** A rotina aprendida a sugerir agora (de 45 min antes a 45 min depois da hora habitual), se ainda não foi feita hoje. */
export function learnedNext(S: AppState, l: DayLog, now = new Date()): (Routine & { title: string; detail: string; when: string }) | null {
  const m = minuteOf(now);
  const today = dayKey(now);
  const doneToday = new Set((S.smart?.ev ?? []).filter((e) => e.d === today).map((e) => e.k));
  if (l.e) doneToday.add('checkin');
  if (l.sleepD) doneToday.add('diario');
  if (l.ritual) doneToday.add('ritual');
  if (l.workouts?.length) doneToday.add('treino');
  const cands = routines(S, now).filter((r) => {
    if (doneToday.has(r.k)) return false;
    const sk = S.smart?.skip?.[r.k];
    if (sk && (sk.d === today || sk.n >= 3)) return false;
    return m >= r.m - 45 && m <= r.m + 45;
  }).sort((a, b) => Math.abs(a.m - m) - Math.abs(b.m - m));
  const r = cands[0];
  return r ? { ...r, ...ROUTINE_TEXT[r.k], when: hhmm(r.m) } : null;
}

export function skipRoutine(S: AppState, k: HabitEv, now = new Date()) {
  const sm = (S.smart = S.smart ?? {});
  const cur = sm.skip?.[k];
  sm.skip = { ...(sm.skip ?? {}), [k]: { n: (cur?.n ?? 0) + 1, d: dayKey(now) } };
}

/* ───────── atalhos ───────── */

export type ShortcutId = 'agua' | 'dose' | 'foto' | 'rotulo' | 'respirar' | 'meditar' | 'treino' | 'checkin' | 'diario' | 'jejum' | 'med' | 'pros' | 'coach' | 'ciclo' | 'evolucao' | 'receitas' | 'corpo' | 'comunidade';
export interface Shortcut { id: ShortcutId; label: string; icon: string; /** de que horas a que horas faz mais sentido (para a ordem automática) */ hours?: [number, number] }
export const SHORTCUTS: Shortcut[] = [
  { id: 'agua', label: '+1 copo', icon: '💧', hours: [7, 21] },
  { id: 'dose', label: 'Tomei a Spirulina', icon: '🌿', hours: [6, 14] },
  { id: 'foto', label: 'Foto do prato', icon: '📷', hours: [11.5, 22] },
  { id: 'respirar', label: 'Respirar 5 min', icon: '😮‍💨' },
  { id: 'meditar', label: 'Meditar', icon: '🧘' },
  { id: 'treino', label: 'Treinar', icon: '🏋️', hours: [6, 21] },
  { id: 'checkin', label: 'Check-in', icon: '✅', hours: [18, 24] },
  { id: 'diario', label: 'Diário do sono', icon: '🌙', hours: [5, 12] },
  { id: 'jejum', label: 'Jejum', icon: '⏱️' },
  { id: 'med', label: 'Medicação', icon: '💊' },
  { id: 'pros', label: 'Os meus profissionais', icon: '🩺' },
  { id: 'coach', label: 'Assistente', icon: '🎙️' },
  { id: 'rotulo', label: 'Ler um rótulo', icon: '🏷️' },
  { id: 'receitas', label: 'Receitas', icon: '🥗' },
  { id: 'corpo', label: 'Peso e medidas', icon: '📏' },
  { id: 'ciclo', label: 'Ciclo', icon: '🌸' },
  { id: 'evolucao', label: 'Evolução', icon: '📈' },
  { id: 'comunidade', label: 'Comunidade', icon: '🏆' },
];
export const shortcutOf = (id: string) => SHORTCUTS.find((s) => s.id === id);
export const MAX_FAV = 6;

export function noteUse(S: AppState, id: string, now = new Date()) {
  const sm = (S.smart = S.smart ?? {});
  sm.use = { ...(sm.use ?? {}), [id]: [...(sm.use?.[id] ?? []), minuteOf(now)].slice(-40) };
}

/**
 * Os atalhos a mostrar: os favoritos (pela ordem escolhida) e, depois, os automáticos, pelo uso
 * à volta desta hora (±2 h) e pelo momento do dia em que fazem sentido. Total: 6.
 */
export function smartShortcuts(S: AppState, now = new Date(), n = 6): { id: ShortcutId; fav: boolean }[] {
  const m = minuteOf(now);
  const h = m / 60;
  const fav = (S.smart?.fav ?? []).filter((id) => shortcutOf(id)) as ShortcutId[];
  const avail = (s: Shortcut) => (s.id !== 'ciclo' || S.ans?.sexo === 'f') && (s.id !== 'jejum' || !!S.fasting?.on);
  const score = (s: Shortcut) => {
    const uses = S.smart?.use?.[s.id] ?? [];
    const near = uses.filter((x) => Math.min(Math.abs(x - m), 1440 - Math.abs(x - m)) <= 120).length;
    const inHours = s.hours ? (h >= s.hours[0] && h < s.hours[1] ? 1 : -2) : 0;
    const base = ['agua', 'foto', 'respirar', 'treino'].includes(s.id) ? 0.5 : 0; // para quem ainda não usou nada
    return near * 2 + uses.length * 0.1 + inHours + base;
  };
  const auto = SHORTCUTS.filter((s) => avail(s) && !fav.includes(s.id)).map((s) => ({ s, v: score(s) })).sort((a, b) => b.v - a.v).map((x) => x.s.id);
  return [...fav.map((id) => ({ id, fav: true })), ...auto.map((id) => ({ id, fav: false }))].slice(0, Math.max(n, fav.length));
}

export function toggleFav(S: AppState, id: ShortcutId) {
  const sm = (S.smart = S.smart ?? {});
  const cur = sm.fav ?? [];
  sm.fav = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id].slice(0, MAX_FAV);
}
export function moveFav(S: AppState, id: ShortcutId, dir: -1 | 1) {
  const sm = (S.smart = S.smart ?? {});
  const a = [...(sm.fav ?? [])];
  const i = a.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= a.length) return;
  [a[i], a[j]] = [a[j], a[i]];
  sm.fav = a;
}

/* ───────── insights ───────── */

export interface Insight { id: string; icon: string; text: string; /** força da diferença (0–1), para escolher */ w: number }
const avg = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
const fmt1 = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',');
const WD = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const MIN_EACH = 4;

/** Padrões nos dados da própria pessoa (últimos 42 dias). Só aparecem com dados suficientes dos dois lados. */
export function insights(S: AppState, now = new Date()): Insight[] {
  const days = Array.from({ length: 42 }, (_, i) => keyDaysAgo(i + 1, now)).map((d) => ({ d, l: S.logs[d] })).filter((x): x is { d: string; l: DayLog } => !!x.l);
  const next = (d: string) => { const t = new Date(`${d}T12:00:00`); t.setDate(t.getDate() + 1); return S.logs[dayKey(t)]; };
  const out: Insight[] = [];
  const trained = (l: DayLog) => !!(l.workouts?.length || (l.t ?? 0) > 0);

  // 1. treino → sono da noite seguinte
  {
    const a = days.filter((x) => trained(x.l)).map((x) => next(x.d)?.sleepH).filter((v): v is number => !!v);
    const b = days.filter((x) => !trained(x.l)).map((x) => next(x.d)?.sleepH).filter((v): v is number => !!v);
    if (a.length >= MIN_EACH && b.length >= MIN_EACH) {
      const diff = (avg(a)! - avg(b)!) * 60;
      if (Math.abs(diff) >= 20) out.push({ id: 'treino-sono', icon: '🏋️🌙', text: diff > 0 ? `Nos dias em que treina, dorme em média ${Math.round(diff)} minutos a mais.` : `Nos dias em que treina, dorme em média ${Math.round(-diff)} minutos a menos. Treinar mais cedo pode ajudar.`, w: Math.min(1, Math.abs(diff) / 60) });
    }
  }
  // 2. sono → energia do dia
  {
    const lo = days.filter((x) => x.l.sleepH && x.l.sleepH < 6.5 && x.l.e).map((x) => x.l.e!);
    const hi = days.filter((x) => x.l.sleepH && x.l.sleepH >= 7 && x.l.e).map((x) => x.l.e!);
    if (lo.length >= MIN_EACH && hi.length >= MIN_EACH && avg(hi)! - avg(lo)! >= 0.5) out.push({ id: 'sono-energia', icon: '🌙⚡', text: `Quando dorme 7 horas ou mais, a sua energia é ${fmt1(avg(hi)!)} em 5; com menos de 6 h 30, desce para ${fmt1(avg(lo)!)}.`, w: Math.min(1, (avg(hi)! - avg(lo)!) / 1.5) });
  }
  // 3. água na meta → energia
  {
    const goal = S.ans ? planFor(S).water : 8;
    const ok = days.filter((x) => x.l.e && (x.l.water ?? 0) >= goal).map((x) => x.l.e!);
    const no = days.filter((x) => x.l.e && (x.l.water ?? 0) < goal).map((x) => x.l.e!);
    if (ok.length >= MIN_EACH && no.length >= MIN_EACH && avg(ok)! - avg(no)! >= 0.5) out.push({ id: 'agua-energia', icon: '💧⚡', text: `Nos dias em que cumpre a meta de água, a sua energia é ${fmt1(avg(ok)!)} em 5; nos outros, ${fmt1(avg(no)!)}.`, w: Math.min(1, (avg(ok)! - avg(no)!) / 1.5) });
  }
  // 4. dia da semana com menos água
  {
    const by = new Map<number, number[]>();
    for (const x of days) if (x.l.water !== undefined) { const w = new Date(`${x.d}T12:00:00`).getDay(); by.set(w, [...(by.get(w) ?? []), x.l.water]); }
    const ok = [...by.entries()].filter(([, v]) => v.length >= 2);
    if (ok.length >= 5) {
      const means = ok.map(([w, v]) => ({ w, m: avg(v)! }));
      const all = avg(means.map((x) => x.m))!;
      const low = means.sort((a, b) => a.m - b.m)[0];
      if (all - low.m >= 1) out.push({ id: 'agua-dia', icon: '💧📅', text: `${WD[low.w][0].toUpperCase()}${WD[low.w].slice(1)} é o dia em que bebe menos água: ${fmt1(low.m)} copos, contra ${fmt1(all)} em média.`, w: Math.min(1, (all - low.m) / 3) });
    }
  }
  // 5. respiração ou meditação → stress
  {
    const yes = days.filter((x) => x.l.stress && ((x.l.breath ?? 0) > 0 || (x.l.medit ?? 0) > 0)).map((x) => x.l.stress!);
    const no = days.filter((x) => x.l.stress && !(x.l.breath ?? 0) && !(x.l.medit ?? 0)).map((x) => x.l.stress!);
    if (yes.length >= MIN_EACH && no.length >= MIN_EACH && avg(no)! - avg(yes)! >= 0.5) out.push({ id: 'mente-stress', icon: '🧘😮‍💨', text: `Nos dias em que respira ou medita, o seu stress é ${fmt1(avg(yes)!)} em 5; nos outros, ${fmt1(avg(no)!)}.`, w: Math.min(1, (avg(no)! - avg(yes)!) / 1.5) });
  }
  // 6. Spirulina → energia
  {
    const yes = days.filter((x) => x.l.e && nTrue(x.l.doses) > 0).map((x) => x.l.e!);
    const no = days.filter((x) => x.l.e && nTrue(x.l.doses) === 0).map((x) => x.l.e!);
    if (yes.length >= MIN_EACH && no.length >= MIN_EACH && avg(yes)! - avg(no)! >= 0.5) out.push({ id: 'spirulina-energia', icon: '🌿⚡', text: `Nos dias em que toma a Spirulina, a sua energia é ${fmt1(avg(yes)!)} em 5; nos outros, ${fmt1(avg(no)!)}.`, w: Math.min(1, (avg(yes)! - avg(no)!) / 1.5) });
  }
  // 7. passos → sono
  {
    const hi = days.filter((x) => (x.l.steps ?? 0) >= 8000).map((x) => next(x.d)?.sleepH).filter((v): v is number => !!v);
    const lo = days.filter((x) => x.l.steps !== undefined && x.l.steps < 5000).map((x) => next(x.d)?.sleepH).filter((v): v is number => !!v);
    if (hi.length >= MIN_EACH && lo.length >= MIN_EACH) {
      const diff = (avg(hi)! - avg(lo)!) * 60;
      if (diff >= 20) out.push({ id: 'passos-sono', icon: '👟🌙', text: `Depois de dias com 8 mil passos ou mais, dorme em média ${Math.round(diff)} minutos a mais.`, w: Math.min(1, diff / 60) });
    }
  }
  // 8. rotina aprendida
  const r = routines(S, now, ['treino']).find((x) => x.k === 'treino');
  if (r) out.push({ id: 'rotina-treino', icon: '🕐', text: `Aprendi que costuma treinar por volta das ${hhmm(r.m)}${r.days === 'uteis' ? ' nos dias úteis' : r.days === 'fds' ? ' ao fim de semana' : ''}. O "A seguir" avisa um pouco antes.`, w: 0.3 });
  return out;
}

/** O insight de hoje: o mesmo durante o dia; mais peso aos tipos que a pessoa marcou como úteis; nunca os que achou inúteis (por 30 dias). */
export function insightOfDay(S: AppState, now = new Date()): Insight | null {
  const today = dayKey(now);
  const list = insights(S, now);
  if (!list.length) return null;
  const keep = S.smart?.ins;
  if (keep?.d === today) return list.find((x) => x.id === keep.id) ?? null;
  const fb = S.smart?.fb ?? {};
  const cut = keyDaysAgo(30, now);
  const ok = list.filter((x) => !(fb[x.id]?.v === -1 && fb[x.id].d >= cut));
  if (!ok.length) return null;
  const yesterday = keep?.id;
  const scored = ok.map((x) => ({ x, v: x.w * (fb[x.id]?.v === 1 ? 1.6 : 1) * (x.id === yesterday && ok.length > 1 ? 0.2 : 1) })).sort((a, b) => b.v - a.v);
  return scored[0].x;
}
export function markInsightShown(S: AppState, id: string, now = new Date()) {
  const sm = (S.smart = S.smart ?? {});
  if (sm.ins?.d !== dayKey(now)) sm.ins = { d: dayKey(now), id };
}
export function rateInsight(S: AppState, id: string, v: 1 | -1, now = new Date()) {
  const sm = (S.smart = S.smart ?? {});
  sm.fb = { ...(sm.fb ?? {}), [id]: { v, d: dayKey(now) } };
}

/* ───────── Descobrir (uma função por semana) ───────── */

export interface Discover { id: string; icon: string; title: string; text: string; go: ShortcutId }
const DISCOVER: (Discover & { used: (S: AppState) => boolean; fits?: (S: AppState) => boolean })[] = [
  { id: 'foto', icon: '📷', title: 'Foto do prato', text: 'Fotografe o almoço: a IA estima as calorias e a proteína em segundos.', go: 'foto', used: (S) => Object.values(S.logs).some((l) => nMeals(l) > 0) },
  { id: 'diario', icon: '🌙', title: 'Diário do sono', text: '30 segundos de manhã: a que horas se deitou e como dormiu. Em duas semanas vê o seu padrão.', go: 'diario', used: (S) => Object.values(S.logs).some((l) => !!l.sleepD) },
  { id: 'respirar', icon: '😮‍💨', title: 'Respiração guiada', text: '5 minutos de respiração com voz baixam o stress. Experimente agora.', go: 'respirar', used: (S) => Object.values(S.logs).some((l) => (l.breath ?? 0) > 0) },
  { id: 'meditar', icon: '🧘', title: 'Meditação guiada', text: 'Sessões curtas com voz e som de chuva ou mar, para o fim do dia.', go: 'meditar', used: (S) => Object.values(S.logs).some((l) => (l.medit ?? 0) > 0) },
  { id: 'treino', icon: '🏋️', title: 'Treino em casa', text: 'Treinos com a animação de cada exercício, que se ajustam a si.', go: 'treino', used: (S) => Object.values(S.logs).some((l) => (l.workouts?.length ?? 0) > 0) },
  { id: 'coach', icon: '🎙️', title: 'Fale com o assistente', text: '"Almocei arroz e frango", "exame na sexta às 9h": ele regista por si.', go: 'coach', used: (S) => !!S.smart?.use?.coach?.length || !!S.memory?.facts?.length || !!S.reminders?.length },
  { id: 'med', icon: '💊', title: 'Lembretes da medicação', text: 'Registe a medicação e os suplementos (até pela foto da receita) e a app lembra-o à hora certa.', go: 'med', used: (S) => !!S.care?.meds?.length },
  { id: 'pros', icon: '🩺', title: 'Traga o seu profissional', text: 'Se o seu nutricionista, médico, terapeuta ou personal usa a NEFESH, use o código que ele lhe enviar.', go: 'pros', used: (S) => !!(S.nutriLink || S.wellLink || S.proLink) },
  { id: 'corpo', icon: '📏', title: 'Peso e medidas', text: 'Registe o peso e as medidas, ou carregue o relatório de bioimpedância: a IA lê os números.', go: 'corpo', used: (S) => !!S.bodyLog?.length },
];

/** A sugestão da semana: muda à segunda-feira, nunca repete uma já vista e só mostra o que ainda não usou. */
export function discoverOfWeek(S: AppState, now = new Date()): Discover | null {
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const wk = dayKey(monday);
  const cur = S.smart?.disc;
  if (cur?.d === wk) {
    const x = DISCOVER.find((d) => d.id === cur.id);
    return x && !cur.done.includes(cur.id) && !x.used(S) ? x : null;
  }
  const done = cur?.done ?? [];
  return DISCOVER.find((d) => !done.includes(d.id) && !d.used(S) && (!d.fits || d.fits(S))) ?? null;
}
export function markDiscover(S: AppState, id: string, closed: boolean, now = new Date()) {
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const sm = (S.smart = S.smart ?? {});
  const done = new Set(sm.disc?.done ?? []);
  if (closed) done.add(id);
  sm.disc = { d: dayKey(monday), id, done: [...done] };
}

/* ───────── Início adaptativo ───────── */

/** Cartões que podem recolher-se (os do dia, como o painel, o A seguir e a Spirulina, ficam sempre). */
export type HomeCardId = 'energia' | 'comunidade' | 'passos' | 'habitos' | 'pros';
export const CARD_LABEL: Record<HomeCardId, string> = { energia: 'Energia da semana', comunidade: 'Comunidade', passos: 'Passos', habitos: 'Hábitos', pros: 'Acompanhamento profissional' };
export function noteCard(S: AppState, id: HomeCardId, now = new Date()) {
  const sm = (S.smart = S.smart ?? {});
  sm.seen = { ...(sm.seen ?? {}), [id]: dayKey(now) };
}
/**
 * Cartões a recolher em "Mais": os que não são abertos há 14 dias. Só depois de 14 dias de uso
 * (até lá, a pessoa ainda está a conhecer a app) e nunca se a pessoa pediu "Mostrar tudo".
 */
export function collapsedCards(S: AppState, now = new Date()): Set<HomeCardId> {
  const out = new Set<HomeCardId>();
  // conta 14 dias desde que o Início inteligente começou a observar (quem já usava a app não perde cartões no primeiro dia)
  if (S.smart?.all || !S.smart?.since || S.smart.since > keyDaysAgo(14, now)) return out;
  const cut = keyDaysAgo(14, now);
  for (const id of Object.keys(CARD_LABEL) as HomeCardId[]) {
    const seen = S.smart?.seen?.[id];
    if (!seen || seen < cut) out.add(id);
  }
  return out;
}
