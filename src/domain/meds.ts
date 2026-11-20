/**
 * Medicação e outros suplementos: lembretes por hora, marcar a toma e avisos de interação
 * com a Spirulina e com os cuidados declarados na avaliação. Os avisos são gerais: a decisão
 * é sempre do médico ou do farmacêutico. Os nomes nunca saem do telemóvel nos lembretes.
 */
import type { AppState, DayLog } from './types';

export interface Med {
  id: string;
  name: string;
  dose?: string;
  kind: 'medicamento' | 'suplemento';
  /** horas da toma (HH:MM) */
  times: string[];
  active: boolean;
  /** quem receitou (opcional) */
  by?: string;
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Grupos de medicamentos com cuidado especial com a Spirulina (nomes genéricos e comerciais comuns). */
const RULES: { test: RegExp; text: string; level: 'alto' | 'medio' }[] = [
  {
    test: /varfarin|acenocumarol|sintrom|rivaroxaban|xarelto|apixaban|eliquis|dabigatran|pradaxa|edoxaban|lixiana|heparin|enoxaparin|clopidogrel|plavix|ticagrelor|aspirin|acido acetilsalicilico|\baas\b/,
    text: 'Anticoagulante ou antiagregante: a Spirulina tem vitamina K e pode mexer com o efeito. Confirme com o seu médico antes de tomar Spirulina, e não mude a dose de nenhum dos dois por conta própria.',
    level: 'alto',
  },
  {
    test: /ciclosporin|tacrolim|micofenol|azatioprin|metotrexat|sirolim|everolim|prednis|metilprednis|hidrocortison|dexametason|corticoid/,
    text: 'Imunossupressor ou corticoide: a Spirulina pode estimular o sistema imunitário e contrariar o efeito. Fale com o seu médico antes de a tomar.',
    level: 'alto',
  },
  {
    test: /metformin|insulin|gliclazid|glimepirid|sitagliptin|vildagliptin|empagliflozin|dapagliflozin|semaglutid|ozempic|liraglutid|dulaglutid/,
    text: 'Medicação para a diabetes: vigie a glicemia nas primeiras semanas de Spirulina e partilhe os valores com o seu médico.',
    level: 'medio',
  },
  {
    test: /levotiroxin|euthyrox|letter|synthroid/,
    text: 'Levotiroxina: tome em jejum e afaste suplementos (incluindo Spirulina, ferro e cálcio) pelo menos 4 horas.',
    level: 'medio',
  },
  {
    test: /\bferro\b|ferroso|ferrico|\bcalcio\b|magnesio|zinco/,
    text: 'Minerais: tome afastado de outros medicamentos (cerca de 2 horas), salvo indicação diferente.',
    level: 'medio',
  },
];

/** Avisos para um medicamento ou suplemento. */
export function medWarnings(name: string) {
  const n = norm(name);
  return RULES.filter((r) => r.test.test(n)).map((r) => ({ text: r.text, level: r.level }));
}

/** Avisos gerais pelos cuidados declarados na avaliação (mesmo sem a medicação registada). */
export function declaredWarnings(S: Pick<AppState, 'ans' | 'care'>) {
  const safe = S.ans?.safe ?? [];
  const meds = S.care?.meds ?? [];
  const has = (re: RegExp) => meds.some((m) => re.test(norm(m.name)));
  const out: string[] = [];
  if (safe.includes('antico') && !has(RULES[0].test) && !has(RULES[1].test))
    out.push('Indicou que toma anticoagulantes ou imunossupressores. Registe-os aqui para a app o lembrar das tomas e mostrar os cuidados com a Spirulina, e confirme a Spirulina com o seu médico.');
  if (safe.includes('pku')) out.push('Fenilcetonúria: a Spirulina contém fenilalanina. Só com indicação do seu médico.');
  return out;
}

/** Chave da toma de um dia: id do medicamento e hora. */
export const doseKey = (id: string, time: string) => `${id}@${time}`;

/** Tomas de hoje, por hora, com o estado. */
export function medsToday(S: Pick<AppState, 'care'>, l: DayLog | undefined, now = new Date()) {
  const hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return (S.care?.meds ?? [])
    .filter((m) => m.active)
    .flatMap((m) => m.times.map((t) => ({ med: m, time: t, key: doseKey(m.id, t), taken: !!l?.meds?.[doseKey(m.id, t)], due: t <= hm })))
    .sort((a, b) => a.time.localeCompare(b.time));
}

/** Horas de lembrete (sem nomes) para o servidor enviar as notificações. */
export const reminderTimes = (S: Pick<AppState, 'care'>) => [...new Set((S.care?.meds ?? []).filter((m) => m.active).flatMap((m) => m.times))].sort();

/** Adesão à medicação nos últimos n dias (%), ou null sem medicação. */
export function medAdherence(S: Pick<AppState, 'care' | 'logs'>, keys: string[]) {
  const meds = (S.care?.meds ?? []).filter((m) => m.active);
  const total = meds.reduce((t, m) => t + m.times.length, 0) * keys.length;
  if (!total) return null;
  const done = keys.reduce((t, k) => t + Object.values(S.logs[k]?.meds ?? {}).filter(Boolean).length, 0);
  return Math.min(100, Math.round((done / total) * 100));
}
