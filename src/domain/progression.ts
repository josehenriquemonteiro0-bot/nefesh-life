/**
 * Progressão automática: depois de cada exercício a pessoa diz como correu (fácil, certo,
 * difícil, não consegui) e a app decide o passo seguinte.
 * - Ginásio: sobe a carga (passo por exercício) quando foi fácil, ou certo duas vezes seguidas;
 *   mantém quando foi difícil; baixa cerca de 10% depois de duas falhas seguidas.
 * - Em casa (peso do corpo): sobe repetições ou segundos por etapas; no topo, sugere uma
 *   variação mais difícil; com dificuldade repetida, volta uma etapa (ou a variação mais fácil).
 * - Semana leve a cada 5 semanas de força, ou antes, com sono e energia em baixo.
 * - Dor registada hoje no ciclo: não sobe nada nesse dia.
 * Nunca altera o plano de um personal: isso fica com o profissional.
 */
import { addDaysKey, keyDaysAgo, todayKey } from './dates';
import type { AppState } from './types';

export type Feel = 'facil' | 'certo' | 'dificil' | 'falhei';
export const FEELS: [Feel, string][] = [['facil', 'Fácil'], ['certo', 'Certo'], ['dificil', 'Difícil'], ['falhei', 'Não consegui']];

export interface ProgEntry { d: string; feel: Feel; kg?: number; stage?: number }
export interface ProgState { kg?: number; stage?: number; hist: ProgEntry[] }
export type Prog = Record<string, ProgState>;

/** Passo de carga por exercício do ginásio (kg); prancha sobe em segundos. */
const STEP: Record<string, number> = {
  legpress: 5, gemeos: 5, elevacao_pelvica: 5,
  supino_maq: 2.5, puxada: 2.5, remada_sentada: 2.5, supino_barra: 2.5, remada_curvada: 2.5, agachamento_barra: 2.5, triceps: 2.5,
  agachamento_goblet: 2, peso_morto_romeno: 2, remada_halter: 2, afundos_halteres: 2,
  press_ombros: 1, biceps: 1,
};
export const stepOf = (id: string) => STEP[id] ?? 2.5;

const roundTo = (v: number, s: number) => Math.round(v / s) * s;
const fmt = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',');

/** Dor ou cólicas registadas hoje (no ciclo): dia para manter, não para subir. */
export function painToday(S: Pick<AppState, 'logs'>, today = todayKey()) {
  const c = S.logs[today]?.cycle;
  return (c?.pain ?? 0) >= 6 || (c?.sy ?? []).includes('Cólicas');
}

/** Semana leve em curso? */
export const inDeload = (S: Pick<AppState, 'trainDeload'>, today = todayKey()) => !!S.trainDeload && today >= S.trainDeload.from && today <= S.trainDeload.to;

/**
 * Próxima carga (ginásio). base = última carga registada (kg) quando ainda não há progressão.
 * Devolve a carga e a explicação do porquê.
 */
export function nextLoad(S: Pick<AppState, 'prog' | 'logs' | 'trainDeload'>, id: string, base: number | null, today = todayKey()) {
  const st = S.prog?.[id];
  const kg = st?.kg ?? base;
  if (kg === null || kg === undefined) return null;
  const last = st?.hist[st.hist.length - 1];
  const prev = st?.hist[st.hist.length - 2];
  if (!last || last.d === today) return { kg, why: '' };
  if (inDeload(S, today)) return { kg, why: 'Semana leve: mantenha a carga e faça menos uma série.' };
  if (painToday(S, today)) return { kg, why: 'Hoje registou dor: mantenha a carga.' };
  const step = stepOf(id);
  if (last.feel === 'facil' || (last.feel === 'certo' && prev?.feel === 'certo'))
    return { kg: roundTo(kg + step, step >= 2 ? 0.5 : 0.25), why: `Sobe ${fmt(step)} kg: ${last.feel === 'facil' ? 'da última vez foi fácil' : 'duas vezes seguidas no ponto certo'}.` };
  if (last.feel === 'falhei' && prev?.feel === 'falhei') {
    const down = Math.max(step, roundTo(kg * 0.1, step));
    return { kg: Math.max(0, roundTo(kg - down, step >= 2 ? 0.5 : 0.25)), why: `Baixa ${fmt(down)} kg: não conseguiu duas vezes seguidas. Recupere a técnica e volte a subir.` };
  }
  return { kg, why: last.feel === 'dificil' ? 'Mantém: da última vez foi difícil.' : last.feel === 'falhei' ? 'Mantém e tente outra vez.' : 'Mantém: mais uma vez no ponto certo e sobe.' };
}

/** Guarda como correu cada exercício (e a carga usada) e calcula o ponto de partida seguinte. */
export function recordProgress(prog: Prog | undefined, items: { id: string; feel: Feel; kg?: number | null }[], day: string): Prog {
  const out: Prog = { ...(prog ?? {}) };
  for (const it of items) {
    const st: ProgState = { ...(out[it.id] ?? { hist: [] }) };
    const hist = st.hist.filter((h) => h.d !== day);
    if (typeof it.kg === 'number' && it.kg > 0) st.kg = it.kg;
    hist.push({ d: day, feel: it.feel, ...(st.kg !== undefined ? { kg: st.kg } : {}), ...(st.stage !== undefined ? { stage: st.stage } : {}) });
    st.hist = hist.slice(-20);
    if (it.id.startsWith('casa:')) st.stage = nextStage(st);
    out[it.id] = st;
  }
  return out;
}

/* ───────── em casa (peso do corpo) ───────── */

/** Variações por ordem de dificuldade (a do plano é a do meio, índice 1). */
export const VARIANTS: Record<string, string[]> = {
  agachamento: ['Sentar e levantar da cadeira', 'Agachamento', 'Agachamento búlgaro (pé de trás num banco)'],
  flexoes: ['Flexões com as mãos numa mesa', 'Flexões', 'Flexões com os pés elevados'],
  ponte: ['Ponte de glúteos curta', 'Ponte de glúteos', 'Ponte de glúteos com uma perna'],
  prancha: ['Prancha com os joelhos no chão', 'Prancha', 'Prancha com elevação alternada de braço'],
  afundos: ['Afundos com apoio na parede', 'Afundos', 'Afundos a andar'],
  remada: ['Remada com mochila leve', 'Remada com mochila', 'Remada com mochila pesada, uma mão de cada vez'],
  superman: ['Super-homem só com os braços', 'Super-homem', 'Super-homem com 3 s em cima'],
  escalador: ['Escalador lento', 'Escalador', 'Escalador cruzado (joelho ao cotovelo oposto)'],
  polichinelos: ['Polichinelos sem salto', 'Polichinelos', 'Polichinelos com agachamento'],
};

/** Etapa seguinte: −2 … 4 (0 = dose do plano; cada etapa = +2 repetições ou +10 s; 4 = variação mais difícil). */
function nextStage(st: ProgState) {
  const s = st.stage ?? 0;
  const [a, b] = st.hist.slice(-2).reverse();
  if (!a) return s;
  if (a.feel === 'facil' || (a.feel === 'certo' && b?.feel === 'certo' && (b.stage ?? 0) === s)) return Math.min(4, s + 1);
  if ((a.feel === 'falhei') || (a.feel === 'dificil' && b?.feel === 'dificil')) return Math.max(-2, s - 1);
  return s;
}

/** Dose ajustada de um exercício em casa: número do plano + etapa, e a variação quando muda. */
export function homeDose(S: Pick<AppState, 'prog' | 'trainDeload'>, id: string, dose: string, name: string, today = todayKey()) {
  const stage = S.prog?.[`casa:${id}`]?.stage ?? 0;
  const timed = /segundo|\bs\b/.test(dose);
  const v = VARIANTS[id];
  if (stage >= 4 && v) return { dose, name: v[2], stage, note: 'Passou para a variação mais difícil: recomece na dose base.' };
  if (stage <= -2 && v) return { dose, name: v[0], stage, note: 'Variação mais fácil por agora: volte à normal quando ficar fácil.' };
  if (!stage || inDeload(S, today)) return { dose, name, stage, note: inDeload(S, today) && stage ? 'Semana leve: dose do plano.' : '' };
  const add = stage * (timed ? 10 : 2);
  const d = dose.replace(/\d+/, (n) => String(Math.max(timed ? 10 : 3, Number(n) + add)));
  return { dose: d, name, stage, note: stage > 0 ? `+${Math.abs(add)} ${timed ? 's' : 'repetições'}: tem estado fácil.` : `${add} ${timed ? 's' : 'repetições'} por agora.` };
}

/* ───────── semana leve ───────── */

/**
 * Sugere uma semana leve: 5 semanas seguidas com força, ou sono e energia em baixo
 * (média da energia ≤ 2,5 e do sono < 6,5 h nos últimos 7 dias, com pelo menos 4 registos).
 */
export function deloadSuggestion(S: Pick<AppState, 'logs' | 'trainDeload'>, now = new Date()) {
  const today = todayKey(now);
  if (inDeload(S, today)) return null;
  if (S.trainDeload && S.trainDeload.to >= keyDaysAgo(28, now)) return null;
  let e = 0, ne = 0, sl = 0, ns = 0;
  for (let i = 0; i < 7; i++) {
    const l = S.logs[keyDaysAgo(i, now)];
    if (l?.e) { e += l.e; ne++; }
    if (typeof l?.sleepH === 'number') { sl += l.sleepH; ns++; }
  }
  if (ne >= 4 && ns >= 4 && e / ne <= 2.5 && sl / ns < 6.5)
    return { reason: 'Nos últimos dias o sono e a energia estão em baixo. Uma semana mais leve ajuda o corpo a recuperar e a voltar mais forte.' };
  let weeks = 0;
  for (let w = 0; w < 6; w++) {
    let strength = false;
    for (let i = w * 7; i < w * 7 + 7; i++) if ((S.logs[keyDaysAgo(i, now)]?.workouts ?? []).some((x) => x.strength)) strength = true;
    if (!strength) break;
    weeks++;
  }
  if (weeks >= 5) return { reason: `Já leva ${weeks} semanas seguidas de treino de força. Uma semana leve (mesmas cargas, menos uma série) a cada 4 a 6 semanas evita a fadiga e as lesões.` };
  return null;
}

export const startDeload = (today = todayKey()) => ({ from: today, to: addDaysKey(today, 6) });

/** Resumo para o assistente: as cargas e etapas atuais, e a semana leve. */
export function progContext(S: Pick<AppState, 'prog' | 'logs' | 'trainDeload'>, names: Record<string, string>, today = todayKey()) {
  const lines: string[] = [];
  for (const [id, st] of Object.entries(S.prog ?? {})) {
    const last = st.hist[st.hist.length - 1];
    if (!last || last.d < keyDaysAgo(30)) continue;
    if (id.startsWith('casa:')) {
      if (st.stage) lines.push(`${names[id] ?? id.slice(5)}: etapa ${st.stage > 0 ? '+' : ''}${st.stage}`);
      continue;
    }
    const n = nextLoad(S, id, st.kg ?? null, today);
    if (n) lines.push(`${names[id] ?? id}: próxima ${fmt(n.kg)} kg${n.why ? ` (${n.why})` : ''}`);
  }
  if (inDeload(S, today)) lines.push('Está numa semana leve.');
  return lines.slice(0, 8);
}
