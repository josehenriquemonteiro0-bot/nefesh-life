/**
 * Saúde da mulher: ciclo menstrual, gravidez e menopausa, ligados à energia e ao sono.
 * Tudo fica no telemóvel (e na conta, se tiver); nunca vai para a comunidade.
 * Estimativas gerais: não servem como método contracetivo nem substituem o médico.
 */
import { dayKey, keyDaysAgo } from './dates';
import type { AppState, DayLog } from './types';

export type WomenMode = 'ciclo' | 'gravidez' | 'menopausa' | 'nao';
export type Phase = 'menstrual' | 'folicular' | 'ovulatoria' | 'lutea';

export const PHASE_LABEL: Record<Phase, string> = { menstrual: 'Menstruação', folicular: 'Fase folicular', ovulatoria: 'Ovulação (estimada)', lutea: 'Fase lútea' };
export const PHASE_TIP: Record<Phase, string> = {
  menstrual: 'Menos energia é normal nestes dias. Priorize o sono, a água e alimentos ricos em ferro (leguminosas, folhas verdes); um treino leve ou caminhada pode aliviar as cólicas.',
  folicular: 'A energia costuma subir: boa altura para treinos mais intensos e para começar coisas novas.',
  ovulatoria: 'Pico de energia para muitas mulheres. Aproveite para o treino de força e mantenha a hidratação.',
  lutea: 'Mais fome, inchaço ou irritabilidade podem aparecer. Refeições regulares com proteína e fibra, menos sal e cafeína, e deitar a horas ajudam.',
};

export const CYCLE_SYMPTOMS = ['Cólicas', 'Dor de cabeça', 'Inchaço', 'Sensibilidade mamária', 'Irritabilidade', 'Cansaço', 'Acne', 'Desejo de doces'];
export const MENO_SYMPTOMS = ['Afrontamentos', 'Suores noturnos', 'Insónia', 'Alterações de humor', 'Dores articulares', 'Secura', 'Nevoeiro mental'];
export const PREG_SYMPTOMS = ['Náuseas', 'Cansaço', 'Azia', 'Inchaço', 'Dores nas costas', 'Insónia'];

const parse = (k: string) => new Date(`${k}T12:00:00`);
const addDays = (k: string, n: number) => {
  const d = parse(k);
  d.setDate(d.getDate() + n);
  return dayKey(d);
};
const diff = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 86400000);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const r1 = (v: number | null) => (v === null ? null : Math.round(v * 10) / 10);

/** Primeiros dias de cada menstruação registada (do mais antigo para o mais recente). */
export function periodStarts(S: Pick<AppState, 'logs'>) {
  const days = Object.keys(S.logs).filter((k) => S.logs[k]?.cycle?.p).sort();
  return days.filter((k) => !S.logs[addDays(k, -1)]?.cycle?.p);
}

/** Duração média do ciclo (últimos 6 ciclos entre 21 e 40 dias), ou a indicada, ou 28. */
export function cycleLength(S: Pick<AppState, 'logs' | 'women'>) {
  const st = periodStarts(S);
  const gaps = st.slice(1).map((k, i) => diff(st[i], k)).filter((g) => g >= 21 && g <= 40).slice(-6);
  return Math.round(mean(gaps) ?? S.women?.cycleLen ?? 28);
}

/** Duração média da menstruação, ou a indicada, ou 5. */
export function periodLength(S: Pick<AppState, 'logs' | 'women'>) {
  const lens = periodStarts(S).map((k) => {
    let n = 0;
    while (S.logs[addDays(k, n)]?.cycle?.p && n < 12) n++;
    return n;
  });
  return Math.round(mean(lens.slice(-6)) ?? S.women?.periodLen ?? 5);
}

/** Dia e fase do ciclo numa data (estimativa pelo último início de menstruação). */
export function cycleDay(S: Pick<AppState, 'logs' | 'women'>, key = dayKey(new Date())) {
  const start = periodStarts(S).filter((k) => k <= key).pop() ?? S.women?.lastStart;
  if (!start) return null;
  const len = cycleLength(S);
  const day = (diff(start, key) % len) + 1;
  const ovu = len - 14;
  const phase: Phase = day <= periodLength(S) ? 'menstrual' : day < ovu - 1 ? 'folicular' : day <= ovu + 1 ? 'ovulatoria' : 'lutea';
  const next = addDays(start, len * (Math.floor(diff(start, key) / len) + 1));
  return { day, len, phase, next, inDays: diff(key, next), start };
}

/** Energia e sono médios por fase (só com 2+ registos por fase). */
export function byPhase(S: Pick<AppState, 'logs' | 'women'>) {
  const acc: Record<Phase, { e: number[]; s: number[] }> = { menstrual: { e: [], s: [] }, folicular: { e: [], s: [] }, ovulatoria: { e: [], s: [] }, lutea: { e: [], s: [] } };
  if (!periodStarts(S).length) return null;
  for (const [k, l] of Object.entries(S.logs)) {
    const c = cycleDay(S, k);
    if (!c || k < periodStarts(S)[0]) continue;
    if (l.e) acc[c.phase].e.push(l.e);
    if (typeof l.sleepH === 'number') acc[c.phase].s.push(l.sleepH);
  }
  return (Object.keys(acc) as Phase[]).map((p) => ({ phase: p, energy: acc[p].e.length >= 2 ? r1(mean(acc[p].e)) : null, sleep: acc[p].s.length >= 2 ? r1(mean(acc[p].s)) : null, n: acc[p].e.length }));
}

/** Gravidez: semana e trimestre pela data prevista do parto (40 semanas). */
export function pregnancy(due: string | undefined, now = new Date()) {
  if (!due) return null;
  const start = addDays(due, -280);
  const days = diff(start, dayKey(now));
  if (days < 0 || days > 300) return null;
  const week = Math.floor(days / 7);
  return { week, days: days % 7, trimester: week < 14 ? 1 : week < 28 ? 2 : 3, toGo: Math.max(0, diff(dayKey(now), due)) };
}

export const TRIMESTER_TIP = [
  '',
  '1.º trimestre: descanso, ácido fólico como indicado pelo médico, refeições pequenas e frequentes para as náuseas e boa hidratação.',
  '2.º trimestre: costuma haver mais energia. Caminhadas e exercício adaptado, com o acordo do médico ou da parteira, e atenção ao ferro e ao cálcio.',
  '3.º trimestre: sono de lado, pausas ao longo do dia, pés para cima ao fim do dia e preparar o plano de parto com a equipa de saúde.',
];

/** Sintomas mais frequentes nos últimos n dias. */
export function topSymptoms(S: Pick<AppState, 'logs'>, n = 30, now = new Date()) {
  const count: Record<string, number> = {};
  for (let i = 0; i < n; i++) for (const s of S.logs[keyDaysAgo(i, now)]?.cycle?.sy ?? []) count[s] = (count[s] ?? 0) + 1;
  return Object.entries(count).sort((a, b) => b[1] - a[1]);
}

/** Menopausa: sono nas noites com e sem afrontamentos/suores (só com 3+ de cada). */
export function menoSleep(S: Pick<AppState, 'logs'>) {
  const withS: number[] = [];
  const without: number[] = [];
  for (const l of Object.values(S.logs) as DayLog[]) {
    if (typeof l.sleepH !== 'number') continue;
    const hot = (l.cycle?.sy ?? []).some((x) => /Afrontamentos|Suores/.test(x));
    (hot ? withS : without).push(l.sleepH);
  }
  if (withS.length < 3 || without.length < 3) return null;
  return { with: r1(mean(withS))!, without: r1(mean(without))! };
}

/** O separador aparece a mulheres (ou a quem o ativou no Perfil). */
export const showWomen = (S: Pick<AppState, 'ans' | 'women'>) => (S.women ? S.women.mode !== 'nao' || S.women.show === true : S.ans?.sexo === 'f');

/** Resumo para o Coach (sem datas exatas). */
export function womenContext(S: AppState, now = new Date()) {
  const w = S.women;
  if (!w || w.mode === 'nao') return null;
  if (w.mode === 'gravidez') {
    const p = pregnancy(w.due, now);
    return p ? `Está grávida: semana ${p.week} (${p.trimester}.º trimestre). Não sugiras mudanças à Spirulina, a suplementos ou a medicação: só com o médico.` : 'Está grávida.';
  }
  if (w.mode === 'menopausa') {
    const t = topSymptoms(S, 14, now).slice(0, 3).map(([s]) => s.toLowerCase());
    return `Está na menopausa/perimenopausa${t.length ? `; sintomas recentes: ${t.join(', ')}` : ''}.`;
  }
  const c = cycleDay(S, dayKey(now));
  return c ? `Ciclo menstrual: dia ${c.day} de ~${c.len}, ${PHASE_LABEL[c.phase].toLowerCase()} (estimativa).` : null;
}

