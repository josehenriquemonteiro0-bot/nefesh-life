/**
 * Saúde da mulher: ciclo menstrual, gravidez e menopausa, ligados à energia e ao sono.
 * Tudo fica no telemóvel (e na conta, se tiver); nunca vai para a comunidade.
 * Estimativas gerais: não servem como método contracetivo nem substituem o médico.
 */
import { dayKey, keyDaysAgo } from './dates';
import type { AppState, DayLog } from './types';
import { HORMONAL, MAY_STOP, METHODS, type Method } from './cycleData';

export type WomenMode = 'ciclo' | 'gravidez' | 'menopausa' | 'nao';
export type Phase = 'menstrual' | 'folicular' | 'ovulatoria' | 'lutea';

export const PHASE_LABEL: Record<Phase, string> = { menstrual: 'Menstruação', folicular: 'Fase folicular', ovulatoria: 'Ovulação (estimada)', lutea: 'Fase lútea' };
export const PHASE_TIP: Record<Phase, string> = {
  menstrual: 'Menos energia é normal nestes dias. Priorize o sono, a água e alimentos ricos em ferro (leguminosas, folhas verdes); um treino leve ou caminhada pode aliviar as cólicas.',
  folicular: 'A energia costuma subir: boa altura para treinos mais intensos e para começar coisas novas.',
  ovulatoria: 'Pico de energia para muitas mulheres. Aproveite para o treino de força e mantenha a hidratação.',
  lutea: 'Mais fome, inchaço ou irritabilidade podem aparecer. Refeições regulares com proteína e fibra, menos sal e cafeína, e deitar a horas ajudam.',
};

export { CYCLE_SYMPTOMS } from './cycleData';
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
  return cycleContext(S, dayKey(now));
}

/* ───────────── ciclo: previsões, histórico, alertas, padrões e avisos ───────────── */

export const methodOf = (S: Pick<AppState, 'women'>): Method => S.women?.method ?? 'nenhum';
export const isHormonal = (S: Pick<AppState, 'women'>) => HORMONAL.includes(methodOf(S));
export const methodLabel = (m: Method) => METHODS.find(([k]) => k === m)?.[1] ?? m;

export interface CycleRec {
  start: string;
  /** dias até à menstruação seguinte (null no ciclo atual) */
  len: number | null;
  /** dias de menstruação */
  period: number;
  maxFlow: number;
  maxPain: number;
  /** dias com fluxo muito intenso */
  heavyDays: number;
  symptoms: [string, number][];
}

/** Ciclos registados (do mais antigo para o atual), com o que se passou em cada um. */
export function cycleHistory(S: Pick<AppState, 'logs'>): CycleRec[] {
  const st = periodStarts(S);
  return st.map((start, i) => {
    const end = st[i + 1] ?? addDays(start, 45);
    let period = 0;
    while (S.logs[addDays(start, period)]?.cycle?.p && period < 15) period++;
    let maxFlow = 0, maxPain = 0, heavyDays = 0;
    const sy: Record<string, number> = {};
    for (let k = start; k < end; k = addDays(k, 1)) {
      const c = S.logs[k]?.cycle;
      if (!c) continue;
      if (c.p) {
        maxFlow = Math.max(maxFlow, c.flow ?? 0);
        if (c.flow === 4) heavyDays++;
      }
      maxPain = Math.max(maxPain, c.pain ?? 0);
      for (const x of c.sy ?? []) sy[x] = (sy[x] ?? 0) + 1;
    }
    return { start, len: st[i + 1] ? diff(start, st[i + 1]) : null, period, maxFlow, maxPain, heavyDays, symptoms: Object.entries(sy).sort((a, b) => b[1] - a[1]) };
  });
}

/** Duração dos ciclos: média, variação e regularidade (últimos 12 ciclos completos). */
export function cycleStats(S: Pick<AppState, 'logs' | 'women'>) {
  const lens = cycleHistory(S).map((c) => c.len).filter((l): l is number => l !== null && l >= 15 && l <= 90).slice(-12);
  if (!lens.length) return null;
  const m = mean(lens)!;
  const sd = Math.sqrt(mean(lens.map((x) => (x - m) ** 2))!);
  const min = Math.min(...lens), max = Math.max(...lens);
  return { n: lens.length, lens, mean: r1(m)!, sd: r1(sd)!, min, max, regular: lens.length >= 3 ? max - min <= 7 : null, period: periodLength(S) };
}

/**
 * Previsão a partir do último início: próxima menstruação com intervalo de certeza (mais estreito
 * com mais ciclos e ciclos regulares), atraso, janela fértil (um teste de ovulação positivo
 * neste ciclo acerta a ovulação) e fase. Com método hormonal não há ovulação nem fases.
 */
export function predict(S: Pick<AppState, 'logs' | 'women'>, today = dayKey(new Date())) {
  const start = periodStarts(S).filter((k) => k <= today).pop() ?? (S.women?.lastStart && S.women.lastStart <= today ? S.women.lastStart : undefined);
  if (!start) return null;
  const len = cycleLength(S);
  const st = cycleStats(S);
  const spread = st && st.n >= 3 ? Math.max(1, Math.min(5, Math.round(st.sd))) : 3;
  const since = diff(start, today);
  const onPeriod = !!S.logs[today]?.cycle?.p;
  const late = !onPeriod && since > len ? since - len : 0;
  const next = since < len ? addDays(start, len) : today;
  const hormonal = isHormonal(S);
  const lh = Object.keys(S.logs).filter((k) => k >= start && k <= today && S.logs[k]?.cycle?.ovt === '+').sort()[0];
  const ovu = lh ? addDays(lh, 1) : addDays(start, len - 14);
  const fertile = hormonal ? null : { from: addDays(ovu, -5), to: addDays(ovu, 1), ovu, lh: !!lh };
  const pl = periodLength(S);
  const phase: Phase | null = hormonal
    ? null
    : onPeriod || since < pl ? 'menstrual' : today < addDays(ovu, -1) ? 'folicular' : today <= addDays(ovu, 1) ? 'ovulatoria' : 'lutea';
  return {
    start, day: since + 1, len, spread, next, range: [addDays(next, -spread), addDays(next, spread)] as [string, string],
    inDays: diff(today, next), late, stale: since > len + 60, onPeriod, hormonal, phase, fertile,
    fertileToday: !!fertile && today >= fertile.from && today <= fertile.to,
  };
}

/** Marcas do calendário: menstruações previstas (3 ciclos), janelas férteis e ovulação estimadas. */
export function calendarMarks(S: Pick<AppState, 'logs' | 'women'>, today = dayKey(new Date()), ahead = 3) {
  const periods = new Set<string>(), fertile = new Set<string>(), ovu = new Set<string>();
  const markFertile = (o: string) => {
    for (let i = -5; i <= 1; i++) fertile.add(addDays(o, i));
    ovu.add(o);
  };
  const p = predict(S, today);
  const hormonal = isHormonal(S);
  if (!hormonal) for (const c of cycleHistory(S)) if (c.len && c.len >= 21 && c.len <= 45) markFertile(addDays(c.start, c.len - 14));
  if (p && !p.stale) {
    const pl = periodLength(S);
    if (p.fertile) markFertile(p.fertile.ovu);
    for (let i = 0; i < ahead; i++) {
      const s = addDays(p.next, p.len * i);
      if (!(i === 0 && p.late > 0))
        for (let d = 0; d < pl; d++) {
          const k = addDays(s, d);
          if (k > today && !S.logs[k]?.cycle?.p) periods.add(k);
        }
      if (!hormonal) markFertile(addDays(s, p.len - 14));
    }
  }
  return { periods, fertile, ovu };
}

const DISCREET = '🌸 Lembrete do seu ciclo';

/** Avisos do ciclo para o servidor de notificações (texto discreto por defeito). */
export function cycleReminders(S: Pick<AppState, 'logs' | 'women'>, today = dayKey(new Date())) {
  const w = S.women;
  if (!w || w.mode !== 'ciclo') return [];
  const n = w.notif ?? {};
  const p = predict(S, today);
  if (!p || p.stale) return [];
  const time = n.time ?? '09:00';
  const out: { id: string; date: string; time: string; text: string }[] = [];
  const push = (t: string, date: string, text: string) => {
    if (date >= today) out.push({ id: `ciclo${t}${date.replace(/-/g, '')}`, date, time, text: n.plain ? text : DISCREET });
  };
  if (n.period !== false && p.late === 0) push('p', addDays(p.next, -2), '🌸 A menstruação deve começar daqui a 2 dias');
  if ((n.fertile ?? w.goal === 'engravidar') && p.fertile) {
    const from = p.fertile.from >= today ? p.fertile.from : addDays(p.next, p.len - 19);
    push('f', from, '🌸 A janela fértil começa hoje (estimativa)');
  }
  if (n.late !== false && p.late === 0 && !MAY_STOP.includes(methodOf(S))) push('l', addDays(p.next, 3), '🌸 A menstruação está 3 dias atrasada');
  return out;
}

export interface CycleAlert { id: string; text: string }

/** Sinais que justificam falar com o médico (nunca diagnósticos). */
export function cycleAlerts(S: Pick<AppState, 'logs' | 'women' | 'care'>, today = dayKey(new Date())): CycleAlert[] {
  const w = S.women;
  if (!w || w.mode !== 'ciclo') return [];
  const out: CycleAlert[] = [];
  const h = cycleHistory(S);
  const done = h.filter((c) => c.len !== null);
  const hormonal = isHormonal(S);
  if (!hormonal) {
    const last3 = done.slice(-3);
    const lens6 = done.slice(-6).map((c) => c.len!);
    if (last3.filter((c) => c.len! < 21 || c.len! > 35).length >= 2)
      out.push({ id: 'ciclos', text: 'Dois ou mais dos últimos ciclos tiveram menos de 21 ou mais de 35 dias. Vale a pena falar com o seu médico ou ginecologista: há várias causas possíveis (stress, peso, tiroide, síndrome do ovário poliquístico) e são simples de avaliar.' });
    else if (lens6.length >= 4 && Math.max(...lens6) - Math.min(...lens6) > 9)
      out.push({ id: 'variacao', text: `A duração dos seus ciclos varia ${Math.max(...lens6) - Math.min(...lens6)} dias entre o mais curto e o mais longo. Uma variação acima de 7 a 9 dias é motivo para conversar com o ginecologista.` });
  }
  // menstruações já terminadas (pelo menos 10 dias depois do início)
  const recent = h.filter((c) => c.start <= addDays(today, -10)).slice(-3);
  if (recent.some((c) => c.period > 7))
    out.push({ id: 'longa', text: 'Registou uma menstruação com mais de 7 dias. Se acontecer com frequência, fale com o seu médico.' });
  const labs = (S.care?.labs ?? []).filter((l) => l.key === 'ferritina').sort((a, b) => a.date.localeCompare(b.date));
  const fer = labs[labs.length - 1];
  const lowFerritin = !!fer && fer.value < (fer.lo ?? 15);
  if (recent.filter((c) => c.heavyDays >= 2).length >= 2 || (lowFerritin && recent.some((c) => c.maxFlow >= 3)))
    out.push({ id: 'fluxo', text: `Fluxo muito intenso${lowFerritin ? ' e ferritina baixa nas suas análises' : ' em vários ciclos'}: pode levar a falta de ferro (anemia), com cansaço e falta de ar. Fale com o seu médico; ele pode pedir análises.` });
  if (recent.filter((c) => c.maxPain >= 7).length >= 2)
    out.push({ id: 'dor', text: 'Dor forte em vários ciclos. Dor menstrual que obriga a parar não é "normal" nem algo a aguentar: fale com o ginecologista, que pode avaliar causas como a endometriose.' });
  const p = predict(S, today);
  const last = h[h.length - 1];
  if (last && diff(last.start, today) > 90 && !MAY_STOP.includes(methodOf(S)))
    out.push({ id: 'ausente', text: 'Não regista menstruação há mais de 90 dias. Se de facto não teve, fale com o seu médico (e, se for possível, faça um teste de gravidez).' });
  else if (p && p.late >= 3) {
    const unprot = Object.keys(S.logs).some((k) => k >= p.start && k <= today && S.logs[k]?.cycle?.sex === 'u');
    const pos = Object.keys(S.logs).some((k) => k >= p.start && S.logs[k]?.cycle?.pt === '+');
    if (pos) out.push({ id: 'gravidez', text: 'Registou um teste de gravidez positivo. Marque consulta com o seu médico de família ou ginecologista; pode mudar a app para o modo Gravidez.' });
    else if (unprot) out.push({ id: 'teste', text: `A menstruação está ${p.late} dias atrasada e registou relações sem proteção neste ciclo. Um teste de gravidez de farmácia já dá uma resposta fiável.` });
  }
  // humor muito em baixo antes da menstruação, em vários ciclos (possível TDPM)
  const MOOD_SY = /Irritabilidade|Ansiedade|Tristeza|Choro/;
  let hard = 0;
  for (const c of done.slice(-4)) {
    let pre = 0, other = 0;
    for (let i = 0; i < c.len!; i++) {
      const l = S.logs[addDays(c.start, i)];
      const bad = (l?.d !== undefined && l.d <= 2) || (l?.cycle?.sy ?? []).some((x) => MOOD_SY.test(x));
      if (!bad) continue;
      if (i >= c.len! - 7) pre++;
      else if (i >= c.period) other++;
    }
    if (pre >= 4 && other <= 1) hard++;
  }
  if (hard >= 2)
    out.push({ id: 'tdpm', text: 'Em vários ciclos, o humor cai muito na semana antes da menstruação e melhora depois. Quando isto afeta o dia a dia, pode ser síndrome pré-menstrual forte ou perturbação disfórica pré-menstrual (TDPM), que tem tratamento: fale com o seu médico.' });
  return out;
}

/** Padrões pessoais do ciclo (precisa de pelo menos 2 ciclos completos). */
export function cycleInsights(S: Pick<AppState, 'logs' | 'women'>): string[] {
  const done = cycleHistory(S).filter((c) => c.len !== null && c.len >= 18 && c.len <= 45);
  if (done.length < 2) return [];
  const out: string[] = [];
  const pre: number[] = [], rest: number[] = [];
  let lut = 0, crav = 0;
  for (const c of done)
    for (let i = 0; i < c.len!; i++) {
      const l = S.logs[addDays(c.start, i)];
      if (!l) continue;
      if (typeof l.sleepH === 'number') (i >= c.len! - 3 ? pre : i >= c.period ? rest : []).push(l.sleepH);
      if ((l.cycle?.sy ?? []).some((x) => x === 'Desejo de doces' || x === 'Mais fome')) {
        crav++;
        if (i >= c.len! - 14) lut++;
      }
    }
  if (pre.length >= 4 && rest.length >= 6) {
    const dm = Math.round((mean(rest)! - mean(pre)!) * 60);
    if (dm >= 25) out.push(`Nos 3 dias antes da menstruação dorme, em média, ${dm} minutos a menos. Nesses dias, deitar mais cedo e menos cafeína ao fim do dia ajudam.`);
  }
  const ph = (byPhase(S) ?? []).filter((x) => x.energy !== null);
  if (!isHormonal(S) && ph.length >= 2) {
    const hi = ph.reduce((a, b) => (b.energy! > a.energy! ? b : a));
    const lo = ph.reduce((a, b) => (b.energy! < a.energy! ? b : a));
    if (hi.energy! - lo.energy! >= 0.5)
      out.push(`A sua energia é mais alta na ${PHASE_LABEL[hi.phase].toLowerCase()} (${String(hi.energy).replace('.', ',')}) e mais baixa na ${PHASE_LABEL[lo.phase].toLowerCase()} (${String(lo.energy).replace('.', ',')}): pode planear os treinos mais fortes para a fase de mais energia.`);
  }
  if (crav >= 3 && lut / crav >= 0.6) out.push('O desejo de doces e a fome aparecem sobretudo na segunda metade do ciclo. Proteína e fibra em cada refeição e um lanche planeado ajudam a passar esses dias.');
  const withPain = done.filter((c) => c.maxPain > 0);
  if (withPain.length >= 4) {
    const tr = withPain.map((c) => {
      let m = 0;
      for (let i = 1; i <= 7; i++) for (const w of S.logs[addDays(c.start, -i)]?.workouts ?? []) m += w.minutes;
      return { m, pain: c.maxPain };
    });
    const med = [...tr].sort((a, b) => a.m - b.m)[Math.floor(tr.length / 2)].m;
    const more = tr.filter((x) => x.m >= med && x.m > 0), less = tr.filter((x) => x.m < med || x.m === 0);
    if (more.length >= 2 && less.length >= 2) {
      const a = mean(more.map((x) => x.pain))!, b = mean(less.map((x) => x.pain))!;
      if (b - a >= 1.5) out.push(`Nos ciclos em que treinou mais na semana antes da menstruação, a dor foi menor (${fmt1(a)} contra ${fmt1(b)} em 10).`);
    }
  }
  return out;
}
const fmt1 = (v: number) => String(Math.round(v * 10) / 10).replace('.', ',');

const ADVICE: Record<Phase, { train: string; food: string }> = {
  menstrual: {
    train: 'Menstruação: ouça o corpo. Caminhada, mobilidade, yoga ou força leve costumam aliviar as cólicas; nos dias de mais fluxo ou dor, baixe a intensidade sem culpa.',
    food: 'Menstruação: reforce o ferro (leguminosas, carne vermelha magra, folhas verdes) com vitamina C na mesma refeição, e beba água. Calor na barriga e uma tisana ajudam nas cólicas.',
  },
  folicular: {
    train: 'Fase folicular: a energia e a recuperação costumam estar no melhor. Boa altura para treinos mais intensos e para subir cargas.',
    food: 'Fase folicular: proteína em todas as refeições para aproveitar os treinos mais fortes, e hidratos à volta do treino.',
  },
  ovulatoria: {
    train: 'Ovulação (estimada): pico de força para muitas mulheres. Aqueça bem e cuide da técnica nos saltos e mudanças de direção.',
    food: 'Ovulação: refeições leves e coloridas, boa hidratação e fibra.',
  },
  lutea: {
    train: 'Fase lútea: a temperatura do corpo sobe e o esforço parece maior. Mantenha a força com mais descanso entre séries; nos últimos dias, prefira intensidade moderada.',
    food: 'Fase lútea: a fome aumenta (o corpo gasta um pouco mais). Proteína e fibra em cada refeição, um lanche planeado, menos sal (inchaço) e menos cafeína ao fim do dia; magnésio em frutos secos, cacau e leguminosas.',
  },
};

/** Conselho de treino e alimentação para a fase de hoje (só ciclo natural, com dados). */
export function phaseAdvice(S: Pick<AppState, 'logs' | 'women'>, today = dayKey(new Date())) {
  if (S.women?.mode !== 'ciclo') return null;
  const p = predict(S, today);
  if (!p || p.stale || !p.phase) return null;
  const a = ADVICE[p.phase];
  const c = S.logs[today]?.cycle;
  const pain = (c?.pain ?? 0) >= 6 || (c?.sy ?? []).includes('Cólicas');
  return {
    phase: p.phase,
    day: p.day,
    train: pain ? 'Hoje registou dor ou cólicas: prefira caminhada, mobilidade ou alongamentos, e guarde o treino forte para outro dia.' : a.train,
    food: a.food,
  };
}

/** Resumo do ciclo para o assistente (datas relativas; sem datas exatas). */
export function cycleContext(S: AppState, today: string) {
  const p = predict(S, today);
  if (!p) return null;
  const parts: string[] = [];
  const m = methodOf(S);
  if (p.hormonal) parts.push(`Método contracetivo hormonal (${methodLabel(m)}): não há ovulação nem fases a estimar. Dia ${p.day} desde o início do último sangramento.`);
  else parts.push(`Ciclo menstrual: dia ${p.day} de ~${p.len}, ${PHASE_LABEL[p.phase!].toLowerCase()} (estimativa).${m !== 'nenhum' ? ` Método: ${methodLabel(m)}.` : ''}`);
  if (p.onPeriod) parts.push('Está com menstruação hoje.');
  else if (p.late > 0) parts.push(`Menstruação atrasada ${p.late} ${p.late === 1 ? 'dia' : 'dias'}.`);
  else parts.push(`Próxima menstruação prevista daqui a ${p.inDays} dias (± ${p.spread}).`);
  if (p.fertile) {
    if (p.fertileToday) parts.push('Hoje está na janela fértil estimada.');
    else if (p.fertile.from > today) parts.push(`Janela fértil estimada daqui a ${diff(today, p.fertile.from)} dias.`);
  }
  if (S.women?.goal === 'engravidar') parts.push('Objetivo: tentar engravidar.');
  if (S.women?.goal === 'evitar') parts.push('Objetivo: evitar gravidez. A app NÃO é método contracetivo: nunca digas que um dia é "seguro".');
  const st = cycleStats(S);
  if (st && st.n >= 3) parts.push(`Ciclos ${st.regular ? 'regulares' : 'variáveis'} (${st.min}–${st.max} dias).`);
  const sy = (S.logs[today]?.cycle?.sy ?? []).slice(0, 4);
  if (sy.length) parts.push(`Sintomas hoje: ${sy.join(', ').toLowerCase()}.`);
  const ins = cycleInsights(S).slice(0, 2);
  if (ins.length) parts.push(`Padrões: ${ins.join(' ')}`);
  const al = cycleAlerts(S, today).map((a) => a.id);
  if (al.length) parts.push(`Sinais a falar com o médico já mostrados na app: ${al.join(', ')}.`);
  return parts.join(' ');
}
