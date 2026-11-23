/**
 * Jejum intermitente: protocolos, segurança, janela de alimentação, jejum em curso e resumo.
 *
 * - Janela diária (12:12 a 20:4): o jejum começa quando a janela fecha (ou quando a pessoa diz que começou)
 *   e termina com a primeira refeição registada (ou com o botão "Terminar").
 * - 5:2: dois dias por semana com cerca de 500 kcal (mulheres) ou 600 kcal (homens); sem janela diária.
 * Para perder peso, o jejum intermitente tem resultados parecidos com os de reduzir as calorias todos os dias:
 * ajuda sobretudo porque facilita comer menos. A app di-lo com clareza.
 */
import { ageOf, bmiOf } from './body';
import { addDaysKey, dayKey, todayKey } from './dates';
import type { AppState } from './types';

export type FastProtocol = '12:12' | '14:10' | '16:8' | '18:6' | '20:4' | '5:2';
export const PROTOCOLS: { id: FastProtocol; fast: number; label: string; note: string }[] = [
  { id: '12:12', fast: 12, label: '12:12', note: 'Para começar: 12 horas de jejum, quase todas a dormir.' },
  { id: '14:10', fast: 14, label: '14:10', note: 'Um passo a seguir: 14 horas de jejum, janela de 10 horas.' },
  { id: '16:8', fast: 16, label: '16:8', note: 'O mais conhecido: 16 horas de jejum, janela de 8 horas.' },
  { id: '18:6', fast: 18, label: '18:6', note: 'Mais exigente: janela de 6 horas. Atenção à proteína.' },
  { id: '20:4', fast: 20, label: '20:4', note: 'Muito restritivo: só com acompanhamento de um profissional.' },
  { id: '5:2', fast: 0, label: '5:2', note: '5 dias a comer normalmente e 2 dias (não seguidos) com cerca de 500–600 kcal.' },
];
export const protocolOf = (id: FastProtocol) => PROTOCOLS.find((p) => p.id === id)!;

export interface FastingSettings {
  on: boolean;
  protocol: FastProtocol;
  /** hora a que a janela de alimentação abre (HH:MM) */
  open: string;
  /** ao fim de semana a janela pode abrir a outra hora */
  weekendOpen?: string;
  /** 5:2: dias da semana com poucas calorias (0 = domingo) */
  lowDays?: number[];
  /** a Spirulina passa para a primeira refeição da janela */
  spirulinaInWindow?: boolean;
  /** lembretes: a janela abre / faltam 30 min para fechar */
  reminders?: boolean;
  /** respostas da segurança */
  diabetesMeds?: boolean;
  eatingDisorder?: boolean;
  /** o médico ou nutricionista acompanha (permite protocolos com aviso) */
  supervised?: boolean;
  /** prescrito por um profissional (NEFESH Pro) */
  by?: string;
  since: string;
}

/** Jejuns feitos: início e fim (ISO). O em curso não tem fim. */
export interface FastSession { start: string; end?: string; target: number }

/** Prescrição de um nutricionista/médico (NEFESH Pro), à espera de a pessoa ativar. */
export interface FastingRx { protocol: FastProtocol; open: string; lowDays?: number[]; notes?: string; by: string; at: string }

/* ───────── segurança ───────── */

export interface SafetyResult {
  /** não pode ativar */
  block: string[];
  /** só com acompanhamento (com "o meu médico/nutricionista acompanha" passa a aviso) */
  needsPro: string[];
  /** pode ativar, mas deve saber */
  warn: string[];
}

export function fastingSafety(S: Pick<AppState, 'ans' | 'women' | 'care'>, f: Pick<FastingSettings, 'protocol' | 'diabetesMeds' | 'eatingDisorder' | 'supervised'>): SafetyResult {
  const block: string[] = [];
  const needsPro: string[] = [];
  const warn: string[] = [];
  const a = S.ans;
  if ((a?.safe ?? []).includes('gravidez') || S.women?.mode === 'gravidez') block.push('Na gravidez e na amamentação não se faz jejum: o bebé precisa de energia e nutrientes ao longo do dia.');
  if (a && ageOf(a) < 18) block.push('Abaixo dos 18 anos o jejum intermitente não é recomendado.');
  if (a?.peso && a.altura && bmiOf(a.peso, a.altura) < 18.5) block.push('Com o IMC abaixo de 18,5 não é recomendado fazer jejum.');
  if (f.eatingDisorder) block.push('Com historial de distúrbio alimentar, o jejum pode fazer recair. Fale com o seu médico ou psicólogo antes de qualquer restrição.');
  if (f.diabetesMeds) needsPro.push('Com insulina ou medicamentos que baixam o açúcar, o jejum pode provocar hipoglicemias. Só com o seu médico a ajustar a medicação.');
  if (f.protocol === '20:4') needsPro.push('O 20:4 é muito restritivo: é difícil comer o suficiente (sobretudo proteína) em 4 horas.');
  if (f.protocol === '18:6') warn.push('Em 6 horas é preciso planear bem a proteína e os legumes.');
  if ((S.care?.meds ?? []).length) warn.push('Confirme com o médico ou farmacêutico se algum dos seus medicamentos tem de ser tomado com comida.');
  if ((a?.safe ?? []).includes('renal')) warn.push('Com doença renal ou gota, beba bem ao longo do dia e fale com o seu médico.');
  return { block, needsPro: f.supervised ? [] : needsPro, warn: f.supervised ? [...needsPro, ...warn] : warn };
}
export const canActivate = (r: SafetyResult) => !r.block.length && !r.needsPro.length;

/* ───────── janela ───────── */

const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const hhmm = (min: number) => { const m = ((min % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
const atTime = (date: Date, min: number) => { const d = new Date(date); d.setHours(0, 0, 0, 0); d.setMinutes(min); return d; };

export const isDaily = (f?: FastingSettings | null) => !!f?.on && f.protocol !== '5:2';
export const eatHours = (f: FastingSettings) => 24 - protocolOf(f.protocol).fast;
const openOn = (f: FastingSettings, d: Date) => (f.weekendOpen && (d.getDay() === 0 || d.getDay() === 6) ? f.weekendOpen : f.open);

/** Janela de alimentação de um dia: abre e fecha (como Date). */
export function windowOn(f: FastingSettings, day: Date) {
  const o = toMin(openOn(f, day));
  const open = atTime(day, o);
  const close = new Date(open.getTime() + eatHours(f) * 3600e3);
  return { open, close, openText: hhmm(o), closeText: hhmm(o + eatHours(f) * 60) };
}

/** A janela relevante agora: a de hoje, ou a de ontem se ainda estiver aberta depois da meia-noite. */
export function currentWindow(f: FastingSettings, now = new Date()) {
  const y = windowOn(f, new Date(now.getTime() - 864e5));
  if (now < y.close) return y;
  return windowOn(f, now);
}

/** Estado agora: em jejum (desde quando, meta) ou com a janela aberta (até quando). */
export type FastState =
  | { kind: 'jejum'; since: Date; target: number; hours: number; endsAt: Date; reached: boolean }
  | { kind: 'janela'; closes: Date; closeText: string; lastFast?: { hours: number; reached: boolean } };

export function fastState(f: FastingSettings, sessions: FastSession[], now = new Date()): FastState {
  const target = protocolOf(f.protocol).fast;
  // um jejum "em curso" com mais de 48 h foi esquecido (ninguém registou a refeição): ignora-o
  const active = sessions.find((s) => !s.end && now.getTime() - Date.parse(s.start) < 48 * 3600e3);
  if (active) {
    const since = new Date(active.start);
    const hours = (now.getTime() - since.getTime()) / 3600e3;
    return { kind: 'jejum', since, target: active.target, hours, endsAt: new Date(since.getTime() + active.target * 3600e3), reached: hours >= active.target };
  }
  const w = currentWindow(f, now);
  const last = [...sessions].reverse().find((s) => s.end);
  const lastEnd = last?.end ? new Date(last.end) : null;
  const lastFast = last ? { hours: (Date.parse(last.end!) - Date.parse(last.start)) / 3600e3, reached: (Date.parse(last.end!) - Date.parse(last.start)) / 3600e3 >= last.target } : undefined;
  const fasting = (since: Date): FastState => {
    const hours = (now.getTime() - since.getTime()) / 3600e3;
    return { kind: 'jejum', since, target, hours, endsAt: new Date(since.getTime() + target * 3600e3), reached: hours >= target };
  };
  if (now >= w.close) {
    // depois de a janela fechar: em jejum desde o fecho (ou desde o último petisco registado depois do fecho)
    return fasting(lastEnd && lastEnd > w.close ? lastEnd : w.close);
  }
  // antes ou dentro da janela: se já comeu desde o fecho anterior, a janela está aberta até fechar;
  // se ainda não comeu, o jejum continua (com a meta cumprida) até à primeira refeição
  const prevClose = windowOn(f, new Date(w.open.getTime() - 864e5)).close;
  if (lastEnd && lastEnd > prevClose) return { kind: 'janela', closes: w.close, closeText: w.closeText, lastFast };
  return fasting(prevClose);
}

/**
 * Garante que o jejum que a app mostra (fora da janela) fica registado: cria a sessão com o início
 * na hora a que a janela fechou. Devolve true se mudou alguma coisa.
 */
export function ensureSession(S: AppState, now = new Date()): boolean {
  const f = S.fasting;
  if (!isDaily(f)) return false;
  const sessions = S.fastSessions ?? [];
  if (sessions.some((s) => !s.end)) return false;
  const st = fastState(f!, sessions, now);
  if (st.kind !== 'jejum') return false;
  if (sessions.some((s) => s.start === st.since.toISOString())) return false;
  S.fastSessions = [...sessions, { start: st.since.toISOString(), target: st.target }].slice(-90);
  return true;
}

/** Começar o jejum (agora ou a uma hora indicada). Sem jejum configurado é um jejum pontual (meta indicada ou 16 h). */
export function startFast(S: AppState, at = new Date(), target?: number) {
  const sessions = (S.fastSessions ?? []).filter((s) => s.end);
  const t = target && target > 0 ? Math.min(48, target) : isDaily(S.fasting) ? protocolOf(S.fasting!.protocol).fast : 16;
  S.fastSessions = [...sessions, { start: at.toISOString(), target: t }].slice(-90);
}

/** Jejum explícito em curso (pontual ou do protocolo), se houver. */
export function activeFast(sessions: FastSession[] | undefined, now = new Date()) {
  const s = (sessions ?? []).find((x) => !x.end && now.getTime() - Date.parse(x.start) < 48 * 3600e3);
  if (!s) return null;
  const since = new Date(s.start);
  const hours = (now.getTime() - since.getTime()) / 3600e3;
  return { since, hours, target: s.target, endsAt: new Date(since.getTime() + s.target * 3600e3), reached: hours >= s.target };
}

/** Terminar o jejum em curso (primeira refeição ou botão). Devolve as horas feitas. */
export function endFast(S: AppState, at = new Date()): { hours: number; reached: boolean } | null {
  const sessions = S.fastSessions ?? [];
  const i = sessions.findIndex((s) => !s.end);
  if (i < 0) return null;
  const s = sessions[i];
  const hours = (at.getTime() - Date.parse(s.start)) / 3600e3;
  // menos de 1 hora: foi engano, apaga
  S.fastSessions = hours < 1 ? sessions.filter((_, j) => j !== i) : sessions.map((x, j) => (j === i ? { ...x, end: at.toISOString() } : x));
  return { hours, reached: hours >= s.target };
}

/** Ajustar a hora de início do jejum em curso. */
export function setFastStart(S: AppState, at: Date) {
  S.fastSessions = (S.fastSessions ?? []).map((s) => (s.end ? s : { ...s, start: at.toISOString() }));
}

/* ───────── refeições, metas e Spirulina ───────── */

/** Horas sugeridas para as refeições dentro da janela (pela ordem pequeno-almoço, almoço, lanche, jantar). */
export function mealPlan(f: FastingSettings, day = new Date()): { key: 'pa' | 'almoco' | 'lanche' | 'jantar'; time: string; first?: boolean; last?: boolean }[] {
  const o = toMin(openOn(f, day));
  const len = eatHours(f) * 60;
  const n = len <= 4 * 60 ? 2 : len <= 8 * 60 ? 3 : 4;
  // com a janela a abrir depois das 11h, o pequeno-almoço desaparece (a 1.ª refeição é o almoço)
  const keys = (n === 4 && o < 11 * 60 ? ['pa', 'almoco', 'lanche', 'jantar'] : n === 2 ? ['almoco', 'jantar'] : o < 11 * 60 ? ['pa', 'almoco', 'jantar'] : ['almoco', 'lanche', 'jantar']) as ('pa' | 'almoco' | 'lanche' | 'jantar')[];
  return keys.map((key, i) => ({ key, time: hhmm(o + Math.round((i / Math.max(1, keys.length - 1)) * (len - 30))), first: i === 0, last: i === keys.length - 1 }));
}

/** Proteína por refeição na janela (e aviso se for difícil de atingir). */
export function proteinPerMeal(protein: number, meals: number) {
  const per = Math.round(protein / Math.max(1, meals));
  return { per, hard: per > 50 };
}

/** 5:2: hoje é dia de poucas calorias? Meta do dia. */
export function lowDayToday(S: Pick<AppState, 'fasting' | 'ans'>, now = new Date()): number | null {
  const f = S.fasting;
  if (!f?.on || f.protocol !== '5:2' || !(f.lowDays ?? []).includes(now.getDay())) return null;
  return S.ans?.sexo === 'm' ? 600 : 500;
}

/** Lembretes dos próximos 7 dias: a janela abre e faltam 30 min para fechar. */
export function fastingReminders(S: Pick<AppState, 'fasting'>, now = new Date()) {
  const f = S.fasting;
  if (!isDaily(f) || !f!.reminders) return [];
  const out: { id: string; date: string; time: string; text: string }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(now.getTime() + i * 864e5);
    const w = windowOn(f!, d);
    const cl = new Date(w.close.getTime() - 30 * 60e3);
    if (w.open > now) out.push({ id: `jo${dayKey(w.open).replace(/-/g, '')}`, date: dayKey(w.open), time: w.openText, text: 'A sua janela de alimentação abriu. Comece com proteína e água 🍽️' });
    if (cl > now) out.push({ id: `jf${dayKey(cl).replace(/-/g, '')}`, date: dayKey(cl), time: `${String(cl.getHours()).padStart(2, '0')}:${String(cl.getMinutes()).padStart(2, '0')}`, text: 'Faltam 30 min para fechar a sua janela de alimentação.' });
  }
  return out.slice(0, 12);
}

/* ───────── resumo (Evolução) ───────── */

export interface FastDay { date: string; hours: number; target: number; reached: boolean }

/** Jejuns terminados nos últimos n dias (um por dia: o mais longo que terminou nesse dia). */
export function fastDays(S: Pick<AppState, 'fastSessions'>, n = 7, now = new Date()): FastDay[] {
  const from = addDaysKey(todayKey(now), -(n - 1));
  const by = new Map<string, FastDay>();
  for (const s of S.fastSessions ?? []) {
    if (!s.end) continue;
    const date = dayKey(new Date(s.end));
    if (date < from) continue;
    const hours = Math.round(((Date.parse(s.end) - Date.parse(s.start)) / 3600e3) * 10) / 10;
    if ((by.get(date)?.hours ?? 0) < hours) by.set(date, { date, hours, target: s.target, reached: hours >= s.target });
  }
  return [...by.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function fastSummary(S: Pick<AppState, 'fastSessions' | 'logs'>, n = 7, now = new Date()) {
  const days = fastDays(S, n, now);
  const total = days.reduce((t, d) => t + d.hours, 0);
  // energia e fome nos dias com o jejum cumprido e nos outros (só com dados suficientes)
  const mean = (a: (number | undefined)[]) => { const v = a.filter((x): x is number => typeof x === 'number'); return v.length ? Math.round((v.reduce((s, x) => s + x, 0) / v.length) * 10) / 10 : null; };
  const all = fastDays(S, 60, now);
  const yes = all.filter((d) => d.reached).map((d) => S.logs[d.date]);
  const no = all.filter((d) => !d.reached).map((d) => S.logs[d.date]);
  const cmp = yes.length >= 3 && no.length >= 3
    ? { energyYes: mean(yes.map((l) => l?.e)), energyNo: mean(no.map((l) => l?.e)), hungerYes: mean(yes.map((l) => l?.hunger)), hungerNo: mean(no.map((l) => l?.hunger)) }
    : null;
  return { days, reached: days.filter((d) => d.reached).length, total: Math.round(total), avg: days.length ? Math.round((total / days.length) * 10) / 10 : 0, cmp };
}

/** Uma linha para o assistente. */
export function fastingContext(S: AppState, now = new Date()): string {
  const f = S.fasting;
  const pont = activeFast(S.fastSessions, now);
  if (!f?.on && pont) return `Está num jejum pontual há ${Math.floor(pont.hours)} h (meta ${pont.target} h). O jejum regular (protocolo e janela) configura-se em Nutrição.`;
  if (!f?.on) return S.fastingRx ? `Tem uma prescrição de jejum ${S.fastingRx.protocol} de ${S.fastingRx.by} por ativar.` : '';
  if (f.protocol === '5:2') {
    const low = lowDayToday(S, now);
    return `Jejum intermitente 5:2${f.by ? ` (prescrito por ${f.by})` : ''}: dias de poucas calorias ${(f.lowDays ?? []).map((d) => ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][d]).join(' e ')}.${low ? ` Hoje é dia de ${low} kcal.` : ''}`;
  }
  const w = windowOn(f, now);
  const st = fastState(f, S.fastSessions ?? [], now);
  const sm = fastSummary(S, 7, now);
  const state = st.kind === 'jejum' ? `agora em jejum há ${Math.floor(st.hours)} h ${Math.round((st.hours % 1) * 60)} min (meta ${st.target} h)` : `agora com a janela aberta até às ${st.closeText}`;
  return `Jejum intermitente ${f.protocol}${f.by ? ` (prescrito por ${f.by})` : ''}: janela das ${w.openText} às ${w.closeText}; ${state}; nos últimos 7 dias ${sm.reached} jejuns cumpridos, média ${String(sm.avg).replace('.', ',')} h. Não incentives jejuns mais longos do que o protocolo; perante tonturas, fraqueza ou mal-estar, a pessoa deve comer e falar com um profissional.`;
}
