/**
 * Relatório semanal (especificação v2, secção 8).
 *
 * Índice de consistência 0–100 da semana (segunda a domingo), com 5 sub-pontuações:
 * Movimento, Nutrição, Sono, Hábitos e Spirulina. Dados em falta NÃO contam como falha:
 * uma área sem registos fica de fora do índice. Não é uma avaliação clínica.
 */
import { GLASS_ML, GOAL_LABEL, STEP_GOAL } from './content';
import { dayKey, fmtNum } from './dates';
import { targetsFor } from './body';
import { totals } from './foods';
import { planFor } from './plan';
import { weekAdherence } from './planAdherence';
import { took } from './stats';
import type { AppState, DayLog } from './types';

export type ReportArea = 'movimento' | 'nutricao' | 'sono' | 'habitos' | 'spirulina';
export const REPORT_AREAS: [ReportArea, string][] = [
  ['spirulina', 'Spirulina'],
  ['movimento', 'Movimento'],
  ['nutricao', 'Nutrição'],
  ['sono', 'Sono'],
  ['habitos', 'Hábitos'],
];

export interface WeekReport {
  /** segunda-feira da semana (AAAA-MM-DD) */
  week: string;
  days: string[];
  index: number | null;
  scores: Record<ReportArea, number | null>;
  /** números da semana, para a IA e para o ecrã */
  facts: {
    spirulinaDays: number;
    mvpa: number;
    strengthDays: number;
    stepsAvg: number | null;
    mealDays: number;
    kcalAvg: number | null;
    proteinPct: number | null;
    sleepAvg: number | null;
    sleepNights: number;
    waterDays: number;
    waterLogged: number;
    checkins: number;
    energyAvg: number | null;
    energyPrev: number | null;
  };
  priority: { area: ReportArea; text: string } | null;
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const r1 = (n: number | null) => (n === null ? null : Math.round(n * 10) / 10);

/** Segunda-feira de uma data (local). */
export function mondayOf(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

/**
 * Semana do relatório: ao domingo a partir das 18h, a semana atual; nos outros dias,
 * a última semana completa.
 */
export function reportWeek(now = new Date()) {
  const sundayEvening = now.getDay() === 0 && now.getHours() >= 18;
  const mon = mondayOf(now);
  if (!sundayEvening) mon.setDate(mon.getDate() - 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    return dayKey(d);
  });
}

/** Prioridade para a próxima semana: a área mais fraca, com uma ação concreta. */
const PRIORITY: Record<ReportArea, (r: WeekReport, S: AppState) => string> = {
  spirulina: (r) =>
    `Spirulina todos os dias: tomou em ${r.facts.spirulinaDays} de 7. Deixe o frasco à vista no sítio onde toma o pequeno-almoço e ative o lembrete no Perfil.`,
  movimento: (r) =>
    r.facts.mvpa < 75
      ? 'Mexer-se mais: 3 caminhadas rápidas de 25 minutos já a aproximam da meta de 150 minutos.'
      : `Força 2 vezes: já faz ${r.facts.mvpa} min de atividade; acrescente 2 treinos de força curtos (Saúde → Treino).`,
  nutricao: (r) =>
    r.facts.proteinPct !== null && r.facts.proteinPct < 80
      ? 'Proteína em todas as refeições: um ovo, iogurte, leguminosas ou peixe em cada prato.'
      : 'Refeições regulares: registe pelo menos o almoço e o jantar, com metade do prato de legumes.',
  sono: (r) =>
    `Dormir 7 horas: a média foi ${r.facts.sleepAvg !== null ? fmtNum(r.facts.sleepAvg) : '—'} h. Escolha uma hora fixa para se deitar e desligue os ecrãs 30 minutos antes.`,
  habitos: (r, S) =>
    `Água e check-in: atingiu a meta de água em ${r.facts.waterDays} dias. Beba 1 copo ao acordar e a cada refeição (${S.ans ? planFor(S).water : 8} copos de ${GLASS_ML} ml).`,
};

export function weeklyReport(S: AppState, now = new Date()): WeekReport {
  const days = reportWeek(now);
  const prev = days.map((k) => {
    const d = new Date(`${k}T12:00:00`);
    d.setDate(d.getDate() - 7);
    return dayKey(d);
  });
  const logs = days.map((k) => S.logs[k]) as (DayLog | undefined)[];
  const ref = new Date(`${days[6]}T23:00:00`);

  // Spirulina: dias com o ritual cumprido (só com plano)
  const spirulinaDays = days.filter((k) => took(S, S.logs[k], ref)).length;
  // sem nenhum registo na semana (app não usada), a Spirulina também fica de fora
  const spirulina = S.ans && logs.some((l) => l && Object.keys(l).length) ? clamp((spirulinaDays / 7) * 100) : null;

  // Movimento: minutos (meta OMS 150) + força (2 dias) ou passos (meta 8000)
  const mvpa = logs.reduce((t, l) => t + (l?.workouts ?? []).reduce((a, w) => a + w.mvpa, 0), 0);
  const strengthDays = logs.filter((l) => (l?.workouts ?? []).some((w) => w.strength)).length;
  const steps = logs.map((l) => l?.steps).filter((v): v is number => typeof v === 'number');
  const stepsAvg = mean(steps);
  const hasMove = mvpa > 0 || steps.length > 0 || logs.some((l) => (l?.t ?? 0) > 0);
  const byWorkouts = (Math.min(1, mvpa / 150) * 70 + (Math.min(2, strengthDays) / 2) * 30);
  const bySteps = stepsAvg !== null ? Math.min(1, stepsAvg / STEP_GOAL) * 100 : 0;
  const movimento = hasMove ? clamp(Math.max(byWorkouts, bySteps)) : null;

  // Nutrição: nos dias com registo, proteína e calorias perto da meta (ou o plano do nutricionista)
  const tg = targetsFor(S);
  // refeições registadas por dia (sem as entradas automáticas da Spirulina)
  const mealsOf = (l: DayLog) => Object.values(l.meals ?? {}).filter((m) => (m ?? []).some((e) => !e.auto));
  const mealDays = logs.filter((l): l is DayLog => !!l && mealsOf(l).length > 0);
  const perDay = mealDays.map((l) => {
    const n = mealsOf(l).length;
    const t = totals(mealsOf(l).flat().filter((e) => !e.auto) as never);
    // as metas acompanham as refeições registadas: só o almoço não é "comer pouco"
    const share = Math.min(1, Math.max(0.25, n / 4));
    return { n, t, prot: Math.min(1.2, t.p / (tg.protein * share)), complete: n >= 3 };
  });
  const complete = perDay.filter((d) => d.complete);
  const proteinPct = perDay.length ? Math.round(mean(perDay.map((d) => d.prot))! * 100) : null;
  // calorias só dos dias com o dia quase todo registado (3+ refeições)
  const kcalAvg = mean(complete.map((d) => d.t.kcal));
  let nutricao: number | null = null;
  if (S.nutriPlan) {
    const w = weekAdherence(S, 7, ref);
    if (w.pct !== null) nutricao = clamp(w.pct);
  }
  if (nutricao === null && perDay.length) {
    const per = perDay.map((d) => {
      const prot = Math.min(1, d.prot);
      if (S.hideCalories || !d.complete) return prot * 100;
      const ratio = d.t.kcal / tg.kcal;
      const kcal = ratio >= 0.85 && ratio <= 1.15 ? 1 : Math.max(0, 1 - Math.abs(1 - ratio) * 2);
      return (prot * 0.5 + kcal * 0.5) * 100;
    });
    nutricao = clamp(mean(per)!);
  }

  // Sono: noites registadas, horas (meta 7) e regularidade
  const nights = logs.map((l) => l?.sleepH).filter((v): v is number => typeof v === 'number');
  const sleepAvg = mean(nights);
  let sono: number | null = null;
  if (nights.length) {
    const sd = nights.length >= 3 ? Math.sqrt(mean(nights.map((h) => (h - sleepAvg!) ** 2))!) : 0;
    sono = clamp(mean(nights.map((h) => Math.min(1, h / 7) * 100))! - Math.max(0, sd - 0.75) * 15);
  }

  // Hábitos: água na meta (nos dias com registo de água) e check-ins
  const goalW = S.ans ? planFor(S).water : 8;
  const waterLogged = logs.filter((l) => (l?.water ?? 0) > 0).length;
  const waterDays = logs.filter((l) => (l?.water ?? 0) >= goalW).length;
  const checkins = logs.filter((l) => l?.e).length;
  const habitos = waterLogged || checkins ? clamp((waterLogged ? (waterDays / waterLogged) * 70 : 35) + (Math.min(5, checkins) / 5) * 30) : null;

  const energyAvg = r1(mean(logs.map((l) => l?.e).filter((v): v is number => !!v)));
  const energyPrev = r1(mean(prev.map((k) => S.logs[k]?.e).filter((v): v is number => !!v)));

  const scores: WeekReport['scores'] = { spirulina, movimento, nutricao, sono, habitos };
  const known = Object.values(scores).filter((v): v is number => v !== null);
  const r: WeekReport = {
    week: days[0],
    days,
    index: known.length ? clamp(mean(known)!) : null,
    scores,
    facts: {
      spirulinaDays,
      mvpa,
      strengthDays,
      stepsAvg: stepsAvg === null ? null : Math.round(stepsAvg),
      mealDays: mealDays.length,
      kcalAvg: kcalAvg === null ? null : Math.round(kcalAvg),
      proteinPct,
      sleepAvg: r1(sleepAvg),
      sleepNights: nights.length,
      waterDays,
      waterLogged,
      checkins,
      energyAvg,
      energyPrev,
    },
    priority: null,
  };
  // uma só prioridade: a área com registos mais fraca (a Spirulina primeiro em caso de empate)
  const weakest = REPORT_AREAS.map(([a]) => a)
    .filter((a) => scores[a] !== null && scores[a]! < 85)
    .sort((a, b) => scores[a]! - scores[b]!)[0];
  if (weakest) r.priority = { area: weakest, text: PRIORITY[weakest](r, S) };
  return r;
}

/** Resumo em texto (sem dados de identificação) para a IA escrever "o que percebeu". */
export function reportSummary(S: AppState, r: WeekReport) {
  const f = r.facts;
  const s = (a: ReportArea) => (r.scores[a] === null ? 'sem registos' : `${r.scores[a]}/100`);
  return [
    `Objetivo: ${S.ans?.goal ? GOAL_LABEL[S.ans.goal] : 'bem-estar geral'}.`,
    `Semana de ${r.days[0]} a ${r.days[6]}. Índice de consistência: ${r.index ?? '—'}/100.`,
    `Spirulina ${s('spirulina')}: ritual em ${f.spirulinaDays} de 7 dias.`,
    `Movimento ${s('movimento')}: ${f.mvpa} min de atividade, força em ${f.strengthDays} dias${f.stepsAvg !== null ? `, média de ${f.stepsAvg} passos` : ''}.`,
    `Nutrição ${s('nutricao')}: ${f.mealDays} dias com refeições registadas${f.proteinPct !== null ? `, proteína a ${f.proteinPct}% da meta (proporcional às refeições registadas)` : ''}${f.kcalAvg !== null && !S.hideCalories ? `, média de ${f.kcalAvg} kcal nos dias com o dia todo registado` : ''}.`,
    `Sono ${s('sono')}: ${f.sleepNights} noites registadas${f.sleepAvg !== null ? `, média de ${f.sleepAvg} h` : ''}.`,
    `Hábitos ${s('habitos')}: água na meta em ${f.waterDays} dias (${f.waterLogged} com registo), ${f.checkins} check-ins.`,
    `Energia média (1–5): ${f.energyAvg ?? '—'} esta semana; ${f.energyPrev ?? '—'} na semana anterior.`,
    r.priority ? `Prioridade escolhida pela app: ${r.priority.text}` : 'Sem prioridade: semana muito consistente.',
  ].join('\n');
}
