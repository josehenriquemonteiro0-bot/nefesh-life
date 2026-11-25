/**
 * Sono: diário do sono, ritual da noite, programa "Dormir melhor em 14 dias", padrões pessoais,
 * práticas integrativas e sinais de alerta.
 *
 * Base: os componentes da terapia cognitivo-comportamental para a insónia (TCC-I) que se podem
 * fazer sozinho (diário, horário regular, controlo de estímulos, regra dos 20 minutos, relaxamento,
 * reestruturação de pensamentos, higiene do sono). A restrição do sono fica de fora: só com um
 * profissional. Bem-estar, não tratamento: perante sinais de alerta, a app sugere um profissional.
 *
 * Convenção (igual a `sleepH`): o diário de uma noite fica no dia em que a pessoa acorda.
 */
import { addDaysKey, dayKey, keyDaysAgo } from './dates';
import type { AppState, DayLog } from './types';

// ---------- diário do sono ----------
export interface SleepDiary {
  /** hora a que se deitou (HH:MM) */
  bed?: string;
  /** minutos até adormecer */
  lat?: number;
  /** vezes que acordou durante a noite */
  wakes?: number;
  /** minutos acordado durante a noite (somados) */
  waso?: number;
  /** hora a que se levantou (HH:MM) */
  up?: string;
  /** qualidade (1 muito má … 5 muito boa) */
  q?: number;
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
export const validTime = (t: unknown): t is string => typeof t === 'string' && HHMM.test(t);
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
export const fmtTime = (m: number) => {
  const x = ((Math.round(m) % 1440) + 1440) % 1440;
  return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`;
};

/** Contas de uma noite: tempo na cama, tempo a dormir e eficiência (só com as horas de deitar e levantar). */
export function diaryCalc(d: SleepDiary | undefined) {
  if (!d || !validTime(d.bed) || !validTime(d.up)) return null;
  let inBed = toMin(d.up) - toMin(d.bed);
  if (inBed <= 0) inBed += 1440; // deitou-se antes da meia-noite
  if (inBed < 60 || inBed > 16 * 60) return null;
  const awake = Math.max(0, (d.lat ?? 0) + (d.waso ?? 0));
  const asleep = Math.max(0, inBed - awake);
  return { inBed, asleep, hours: Math.round((asleep / 60) * 2) / 2, eff: Math.round((asleep / inBed) * 100) };
}

/** Grava o diário de uma noite; se as horas de sono não vierem do relógio, passam a ser as do diário. */
export function saveDiary(l: DayLog, d: SleepDiary) {
  const clean: SleepDiary = {};
  if (validTime(d.bed)) clean.bed = d.bed;
  if (validTime(d.up)) clean.up = d.up;
  for (const k of ['lat', 'wakes', 'waso'] as const) if (typeof d[k] === 'number' && d[k]! >= 0) clean[k] = Math.min(k === 'wakes' ? 20 : 600, Math.round(d[k]!));
  if (typeof d.q === 'number' && d.q >= 1 && d.q <= 5) clean.q = Math.round(d.q);
  l.sleepD = clean;
  const c = diaryCalc(clean);
  // o relógio (app Saúde) mede melhor: só se escreve por cima das horas escritas à mão
  const fromWatch = !!l.src?.sleepH;
  if (c && !fromWatch) l.sleepH = Math.max(0, Math.min(16, c.hours));
  return c;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const sd = (xs: number[]) => {
  const m = mean(xs);
  return m === null || xs.length < 3 ? null : Math.sqrt(mean(xs.map((v) => (v - m) ** 2))!);
};
/** Horas da noite numa escala contínua (21:00 → -180, 01:00 → 60), para médias que atravessam a meia-noite. */
const nightMin = (t: string) => {
  const m = toMin(t);
  return m >= 12 * 60 ? m - 1440 : m;
};

/** Resumo das últimas n noites do diário (eficiência, tempo a adormecer, regularidade). */
export function diaryStats(S: Pick<AppState, 'logs'>, n = 14, now = new Date()) {
  const nights = Array.from({ length: n }, (_, i) => S.logs[keyDaysAgo(i, now)]?.sleepD).filter((d): d is SleepDiary => !!d);
  const calc = nights.map(diaryCalc).filter((c): c is NonNullable<ReturnType<typeof diaryCalc>> => !!c);
  const ups = nights.filter((d) => validTime(d.up)).map((d) => toMin(d.up!));
  const beds = nights.filter((d) => validTime(d.bed)).map((d) => nightMin(d.bed!));
  const lats = nights.filter((d) => typeof d.lat === 'number').map((d) => d.lat!);
  const qs = nights.filter((d) => d.q).map((d) => d.q!);
  const r = (v: number | null, k = 1) => (v === null ? null : Math.round(v * k) / k);
  return {
    nights: nights.length,
    eff: r(mean(calc.map((c) => c.eff))),
    asleepH: r(mean(calc.map((c) => c.asleep / 60)), 10),
    lat: r(mean(lats)),
    wakes: r(mean(nights.filter((d) => typeof d.wakes === 'number').map((d) => d.wakes!)), 10),
    q: r(mean(qs), 10),
    upAvg: ups.length ? fmtTime(mean(ups)!) : null,
    bedAvg: beds.length ? fmtTime(mean(beds)!) : null,
    /** variação típica da hora de levantar (minutos) */
    upSd: r(sd(ups)),
    bedSd: r(sd(beds)),
  };
}

/** Leitura em linguagem simples (referências usadas na TCC-I: eficiência ≥ 85%, adormecer em menos de 30 min). */
export function diaryReading(st: ReturnType<typeof diaryStats>) {
  const out: string[] = [];
  if (st.nights < 3) return out;
  if (st.eff !== null) out.push(st.eff >= 85 ? `Eficiência do sono de ${st.eff}%: passa a maior parte do tempo na cama a dormir.` : `Eficiência do sono de ${st.eff}%: passa bastante tempo acordado na cama. A regra dos 20 minutos e a hora fixa de levantar costumam ajudar.`);
  if (st.lat !== null) out.push(st.lat <= 30 ? `Demora em média ${st.lat} minutos a adormecer.` : `Demora em média ${st.lat} minutos a adormecer. O ritual da noite e "esvaziar a cabeça" antes de deitar são um bom começo.`);
  if (st.upSd !== null) out.push(st.upSd <= 30 ? 'Levanta-se a horas regulares: é a base de um bom sono.' : `A hora de levantar varia cerca de ${st.upSd} minutos de dia para dia. Fixar a hora de acordar, também ao fim de semana, ajuda o corpo a regular o sono.`);
  return out;
}

// ---------- definições e lembretes ----------
export interface SleepSettings {
  /** hora a que quer deitar-se e a hora fixa de acordar (HH:MM) */
  bed?: string;
  wake?: string;
  /** lembrete para começar o ritual da noite, 60 minutos antes de deitar */
  ritualRemind?: boolean;
  /** lembrete da última cafeína (8 horas antes de deitar) */
  coffeeRemind?: boolean;
  /** lembrete da luz da manhã (à hora de acordar) */
  lightRemind?: boolean;
  /** programa de 14 dias: dia de início e dias concluídos */
  prog?: { start: string; done: number[] };
  /** respostas aos sinais de alerta (e quando) */
  flags?: SleepFlags;
}

export const DEFAULT_BED = '23:00';
export const DEFAULT_WAKE = '07:00';

/** Lembretes diários do sono (hora a hora): ritual, última cafeína e luz da manhã. */
export function sleepReminders(S: Pick<AppState, 'sleep'>) {
  const s = S.sleep ?? {};
  const bed = validTime(s.bed) ? s.bed : DEFAULT_BED;
  const wake = validTime(s.wake) ? s.wake : DEFAULT_WAKE;
  const out: { key: string; time: string; title: string; body: string }[] = [];
  if (s.ritualRemind) out.push({ key: 'sono-ritual', time: fmtTime(toMin(bed) - 60), title: 'Hora de desligar 🌙', body: 'Daqui a uma hora é hora de deitar. Baixe as luzes e comece o ritual da noite.' });
  if (s.coffeeRemind) out.push({ key: 'sono-cafe', time: fmtTime(toMin(bed) - 8 * 60), title: 'Última cafeína de hoje ☕', body: 'A partir de agora, prefira bebidas sem cafeína: ajuda a adormecer melhor logo à noite.' });
  if (s.lightRemind) out.push({ key: 'sono-luz', time: wake, title: 'Bom dia ☀️', body: 'Abra as janelas ou saia uns minutos: a luz da manhã acerta o relógio do corpo e ajuda o sono de logo à noite.' });
  return out;
}

// ---------- ritual da noite ----------
export const RITUAL_PREP = [
  'Luzes baixas na casa',
  'Telemóvel em modo noite, longe da cama',
  'Quarto escuro, fresco e silencioso',
  'Roupa e coisas de amanhã preparadas',
];

/** Técnicas e sessões da noite (ids de mind.TECHNIQUES e de meditations). */
export const NIGHT_BREATH = ['expira', 'suspiro', '478', 'narinas'] as const;
export const NIGHT_MEDITATIONS = ['pmr', 'bodyscan', 'baralhar', 'nidra', 'desligar', '478', 'acordado'] as const;

export function markRitual(l: DayLog, dump?: { worries?: string; tomorrow?: string }) {
  l.ritual = true;
  const w = dump?.worries?.trim().slice(0, 1000);
  const t = dump?.tomorrow?.trim().slice(0, 1000);
  if (w || t) l.nightDump = { ...(w ? { worries: w } : {}), ...(t ? { tomorrow: t } : {}) };
}

// ---------- programa de 14 dias ----------
export interface ProgramDay {
  day: number;
  title: string;
  why: string;
  todo: string[];
  /** sessão ou técnica sugerida para hoje */
  practice?: { kind: 'meditacao' | 'respiracao' | 'ritual' | 'diario' | 'alerta'; id?: string; label: string };
}

export const PROGRAM: ProgramDay[] = [
  {
    day: 1,
    title: 'O ponto de partida',
    why: 'Para melhorar o sono, primeiro é preciso vê-lo. O diário do sono mostra quanto tempo passa na cama, quanto dorme e quanto demora a adormecer.',
    todo: ['Preencher o diário do sono desta noite (leva 30 segundos)', 'Escolher a sua hora fixa de acordar, a mesma todos os dias'],
    practice: { kind: 'diario', label: 'Abrir o diário do sono' },
  },
  {
    day: 2,
    title: 'A hora de acordar manda',
    why: 'O relógio do corpo acerta-se sobretudo pela hora a que acorda e pela luz que recebe de manhã. Uma hora fixa de levantar, mesmo depois de uma noite má, é a base de todo o programa.',
    todo: ['Levantar-se à hora escolhida, mesmo que tenha dormido mal', 'Apanhar 10 a 30 minutos de luz natural na primeira hora do dia'],
    practice: { kind: 'diario', label: 'Registar a noite' },
  },
  {
    day: 3,
    title: 'A cama é para dormir',
    why: 'Quando a cama serve para ver séries, trabalhar ou preocupar-se, o cérebro deixa de a ligar ao sono. Reservar a cama para dormir (e para a intimidade) ensina-o outra vez.',
    todo: ['Nada de ecrãs na cama esta noite', 'Ir para a cama só quando tiver sono, não só cansaço'],
    practice: { kind: 'respiracao', id: 'expira', label: 'Expiração prolongada (4–8)' },
  },
  {
    day: 4,
    title: 'A regra dos 20 minutos',
    why: 'Ficar às voltas na cama aumenta a ansiedade de não dormir. Se não adormecer em cerca de 20 minutos (sem olhar para o relógio), levante-se, faça algo calmo com pouca luz e volte quando o sono chegar.',
    todo: ['Aplicar a regra esta noite, sempre que precisar', 'Ter preparada uma atividade calma: ler em papel, ouvir música suave'],
    practice: { kind: 'meditacao', id: 'acordado', label: 'Acordado a meio da noite' },
  },
  {
    day: 5,
    title: 'O ritual da noite',
    why: 'O corpo precisa de uma transição entre o dia e o sono. Uma rotina igual todas as noites, na última hora antes de deitar, funciona como um sinal: está na hora de abrandar.',
    todo: ['Fazer o ritual da noite completo', 'Ligar o lembrete "Hora de desligar"'],
    practice: { kind: 'ritual', label: 'Começar o ritual da noite' },
  },
  {
    day: 6,
    title: 'Esvaziar a cabeça',
    why: 'Muitas noites sem sono são noites de pensamentos às voltas. Escrever as preocupações e a lista de amanhã antes de deitar tira-as da cabeça e põe-nas no papel; num estudo, ajudou as pessoas a adormecer mais depressa.',
    todo: ['Escrever as preocupações e a lista de amanhã no ritual', 'Se as preocupações voltarem na cama, lembre-se: já estão escritas, tratam-se amanhã'],
    practice: { kind: 'ritual', label: 'Esvaziar a cabeça no ritual' },
  },
  {
    day: 7,
    title: 'Primeira semana: o que mudou',
    why: 'Uma semana de diário já mostra padrões. Compare a eficiência do sono e o tempo a adormecer com o início, sem exigir perfeição: o sono melhora aos poucos.',
    todo: ['Ver o resumo do diário nesta página', 'Escolher uma coisa que correu bem para manter'],
    practice: { kind: 'diario', label: 'Ver o resumo do diário' },
  },
  {
    day: 8,
    title: 'Cafeína, álcool e jantar',
    why: 'A cafeína continua no corpo muitas horas depois do café. O álcool pode ajudar a adormecer, mas torna o sono mais leve e acorda-o a meio da noite. Um jantar pesado mesmo antes de deitar também atrapalha.',
    todo: ['Última cafeína 8 horas antes de deitar (pode ligar o lembrete)', 'Jantar 2 a 3 horas antes de deitar; evitar álcool à noite'],
    practice: { kind: 'respiracao', id: 'suspiro', label: 'Suspiro cíclico' },
  },
  {
    day: 9,
    title: 'Movimento e sono',
    why: 'Mexer-se durante o dia ajuda a dormir melhor à noite. Para algumas pessoas, um treino muito intenso já perto da hora de deitar atrasa o sono; vale a pena observar o seu caso.',
    todo: ['Caminhar ou treinar hoje, de preferência de dia', 'Ver nos padrões do sono se os dias com treino mudam as suas noites'],
    practice: { kind: 'meditacao', id: 'pmr', label: 'Relaxamento muscular progressivo' },
  },
  {
    day: 10,
    title: 'O quarto certo',
    why: 'O sono gosta de escuro, fresco e silêncio. Um quarto entre 18 e 20 °C, sem luzes acesas e com o relógio virado para a parede (para não contar as horas) faz diferença.',
    todo: ['Escurecer o quarto (cortinas, máscara, tapar luzes de aparelhos)', 'Virar o relógio e deixar o telemóvel longe da cama'],
    practice: { kind: 'meditacao', id: 'bodyscan', label: 'Relaxamento do corpo' },
  },
  {
    day: 11,
    title: 'Os pensamentos que tiram o sono',
    why: 'Pensamentos como "se não dormir 8 horas, amanhã vai ser horrível" aumentam a pressão e afastam o sono. Trocá-los por versões mais realistas ("já tive noites assim e o dia correu bem") baixa essa pressão.',
    todo: ['Escrever o pensamento sobre o sono que mais o preocupa', 'Escrever ao lado uma versão mais realista e gentil'],
    practice: { kind: 'meditacao', id: 'baralhar', label: 'Baralhar a mente' },
  },
  {
    day: 12,
    title: 'Relaxar o corpo todos os dias',
    why: 'O relaxamento muscular progressivo é das técnicas mais estudadas para o sono. Como qualquer treino, funciona melhor com prática diária, também nos dias em que dorme bem.',
    todo: ['Fazer o relaxamento muscular progressivo esta noite', 'Repetir nos próximos dias, mesmo sem dificuldade em dormir'],
    practice: { kind: 'meditacao', id: 'pmr', label: 'Relaxamento muscular progressivo' },
  },
  {
    day: 13,
    title: 'Sestas e fins de semana',
    why: 'Uma sesta longa ou ao fim da tarde rouba sono à noite. Ao fim de semana, acordar muito mais tarde desacerta o relógio do corpo, como uma pequena viagem de fuso horário.',
    todo: ['Se fizer sesta: no máximo 20 a 30 minutos e antes das 15h', 'Ao fim de semana: acordar até uma hora depois do habitual'],
    practice: { kind: 'meditacao', id: 'nidra', label: 'Yoga Nidra' },
  },
  {
    day: 14,
    title: 'O seu plano para continuar',
    why: 'Em duas semanas juntou o diário, a hora fixa de acordar, o ritual, a regra dos 20 minutos e o relaxamento. Escolha o que mais o ajudou e mantenha-o. Se o sono continuar difícil, um profissional pode ajudar com a terapia completa.',
    todo: ['Comparar o diário de hoje com o do primeiro dia', 'Escolher os 3 hábitos que vai manter', 'Responder às perguntas "Vale a pena falar com um profissional?"'],
    practice: { kind: 'alerta', label: 'Ver os sinais de alerta' },
  },
];

/** Dia do programa (1–14) em que a pessoa está hoje, ou null se não começou ou já terminou há mais de uma semana. */
export function programDay(S: Pick<AppState, 'sleep'>, now = new Date()) {
  const p = S.sleep?.prog;
  if (!p) return null;
  const start = new Date(`${p.start}T12:00:00`);
  const today = new Date(`${dayKey(now)}T12:00:00`);
  const d = Math.round((today.getTime() - start.getTime()) / 864e5) + 1;
  return { day: Math.max(1, Math.min(14, d)), done: p.done, finished: p.done.length >= 14 || d > 14, over: d > 21 };
}

export const startProgram = (now = new Date()): SleepSettings['prog'] => ({ start: dayKey(now), done: [] });

// ---------- padrões pessoais ----------
/**
 * Como mudam as noites conforme o dia anterior (treino, passos, stress, ritual e relaxamento).
 * O sono do dia k é o da noite anterior: compara-se com o que se passou no dia k-1.
 * Observação sobre a própria pessoa (mínimo de 4 noites de cada lado), não avaliação clínica.
 */
export function sleepPatterns(S: Pick<AppState, 'logs'>, now = new Date(), days = 60) {
  const pairs: { prev: DayLog; night: DayLog }[] = [];
  for (let i = 0; i < days; i++) {
    const k = keyDaysAgo(i, now);
    const night = S.logs[k];
    const prev = S.logs[addDaysKey(k, -1)];
    if (night && prev && typeof night.sleepH === 'number') pairs.push({ prev, night });
  }
  const out: { id: string; text: string; diff: number }[] = [];
  const fmt = (h: number) => {
    const m = Math.round(Math.abs(h) * 60);
    return m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`;
  };
  const test = (id: string, yes: (l: DayLog) => boolean, has: (l: DayLog) => boolean, label: (more: boolean, d: string) => string) => {
    const rel = pairs.filter((p) => has(p.prev));
    const a = rel.filter((p) => yes(p.prev)).map((p) => p.night.sleepH!);
    const b = rel.filter((p) => !yes(p.prev)).map((p) => p.night.sleepH!);
    if (a.length < 4 || b.length < 4) return;
    const diff = mean(a)! - mean(b)!;
    if (Math.abs(diff) < 0.25) return; // menos de 15 minutos: não vale a pena falar
    out.push({ id, text: label(diff > 0, fmt(diff)), diff });
  };
  test('ritual', (l) => !!l.ritual || (l.breath ?? 0) > 0 || (l.medit ?? 0) > 0, () => true, (more, d) => `Nas noites com ritual, respiração ou meditação, dorme ${d} ${more ? 'a mais' : 'a menos'}.`);
  test('treino', (l) => (l.workouts?.length ?? 0) > 0 || (l.t ?? 0) >= 2, () => true, (more, d) => `Depois dos dias com treino, dorme ${d} ${more ? 'a mais' : 'a menos'}.`);
  test('passos', (l) => (l.steps ?? 0) >= 7000, (l) => typeof l.steps === 'number', (more, d) => `Nos dias com 7 mil passos ou mais, dorme ${d} ${more ? 'a mais' : 'a menos'} nessa noite.`);
  test('stress', (l) => (l.stress ?? 0) >= 4, (l) => typeof l.stress === 'number', (more, d) => `Depois de dias de muito stress, dorme ${d} ${more ? 'a mais' : 'a menos'}.`);
  test('dump', (l) => !!l.nightDump, (l) => !!l.ritual, (more, d) => `Quando esvazia a cabeça no ritual, dorme ${d} ${more ? 'a mais' : 'a menos'}.`);
  return out.sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff));
}

// ---------- práticas integrativas ----------
export interface Integrative {
  id: string;
  title: string;
  how: string;
  evidence: 'moderada' | 'limitada';
  caution: string;
}

/** Práticas complementares com alguma evidência, sempre com avisos (nada substitui o médico). */
export const INTEGRATIVE: Integrative[] = [
  { id: 'yoga', title: 'Yoga suave e alongamentos', how: '10 a 15 minutos de posturas suaves ao fim do dia (por exemplo, pernas na parede, postura da criança), com respiração lenta.', evidence: 'moderada', caution: 'Sem posturas invertidas ou intensas se tiver tensão alta, glaucoma, problemas de coluna ou estiver grávida, sem orientação.' },
  { id: 'acupressao', title: 'Acupressão (ponto Shenmen, HT7)', how: 'Na prega do pulso, do lado do dedo mindinho, na pequena depressão junto ao tendão. Pressão suave, em círculos, 1 a 2 minutos em cada pulso, ao deitar.', evidence: 'limitada', caution: 'Pressão suave; não usar sobre pele ferida. É um complemento, não um tratamento.' },
  { id: 'lavanda', title: 'Aroma de lavanda', how: 'Umas gotas de óleo essencial de lavanda num difusor ou num lenço perto da almofada (não diretamente na pele sem diluir).', evidence: 'limitada', caution: 'Evitar com asma ou alergia a fragrâncias, em bebés e crianças pequenas e na gravidez sem orientação. Nunca ingerir óleos essenciais.' },
  { id: 'chas', title: 'Chás calmantes (camomila, melissa, maracujá/passiflora)', how: 'Uma chávena morna 30 a 60 minutos antes de deitar, sem cafeína, como parte do ritual.', evidence: 'limitada', caution: 'A passiflora e outras plantas podem somar ao efeito de calmantes, antidepressivos ou anticoagulantes; fale com o médico ou farmacêutico se toma medicação, está grávida ou a amamentar. A camomila pode dar alergia a quem é alérgico a plantas da família das margaridas.' },
  { id: 'banho', title: 'Banho morno 1 a 2 horas antes de deitar', how: 'Um duche ou banho morno de 10 minutos. Ao sair, o corpo arrefece e isso ajuda a chegar o sono.', evidence: 'moderada', caution: 'Água morna, não quente, sobretudo se tiver tensão baixa ou problemas de circulação.' },
  { id: 'musica', title: 'Música calma ou sons da natureza', how: 'Música lenta e sem letra, ou chuva e mar, 20 a 45 minutos com o volume baixo e um temporizador.', evidence: 'moderada', caution: 'Volume baixo; prefira o altifalante a auscultadores durante a noite inteira.' },
];

// ---------- sinais de alerta ----------
export interface SleepFlags {
  /** ressona alto e alguém já viu pausas na respiração, ou acorda sufocado */
  apnea?: boolean;
  /** dificuldade em dormir 3 ou mais noites por semana há 3 meses ou mais */
  chronic?: boolean;
  /** adormece sem querer durante o dia (a conduzir, em reuniões) */
  sleepy?: boolean;
  /** vontade irresistível de mexer as pernas ao fim do dia, que alivia ao mexer */
  legs?: boolean;
  /** tristeza, ansiedade ou preocupações que não deixam dormir há semanas */
  mood?: boolean;
  at?: string;
}

export const FLAG_QUESTIONS: [keyof Omit<SleepFlags, 'at'>, string][] = [
  ['apnea', 'Ressona alto e alguém já reparou em pausas na sua respiração, ou acorda a sentir falta de ar?'],
  ['chronic', 'Tem dificuldade em dormir 3 ou mais noites por semana, há 3 meses ou mais?'],
  ['sleepy', 'Adormece sem querer durante o dia (a ler, em reuniões, ao volante)?'],
  ['legs', 'Ao fim do dia sente uma vontade forte de mexer as pernas, que só passa ao mexê-las?'],
  ['mood', 'A tristeza, a ansiedade ou as preocupações não o deixam dormir há semanas?'],
];

/** O que aconselhar a partir das respostas (encaminhamento, não diagnóstico). */
export function flagAdvice(f: SleepFlags | undefined) {
  if (!f) return null;
  const out: string[] = [];
  if (f.apnea) out.push('Ressonar alto com pausas na respiração pode ser apneia do sono, que tem tratamento. Fale com o seu médico de família, que pode pedir um estudo do sono.');
  if (f.sleepy) out.push('Adormecer sem querer durante o dia merece avaliação médica. Até lá, não conduza com sono.');
  if (f.chronic) out.push('A insónia que dura há 3 meses ou mais tem tratamento eficaz, a terapia cognitivo-comportamental para a insónia (TCC-I), feita com um psicólogo ou médico com formação em sono. O programa da app é um bom complemento.');
  if (f.legs) out.push('A vontade de mexer as pernas ao fim do dia pode ser a síndrome das pernas inquietas. Fale com o médico, que pode, por exemplo, verificar o ferro no sangue.');
  if (f.mood) out.push('Quando a tristeza ou a ansiedade tiram o sono há semanas, falar com um psicólogo ou com o médico de família ajuda. Em crise: no Brasil, CVV 188; em Portugal, SNS 24 (808 24 24 24).');
  return out;
}

// ---------- contexto para o assistente ----------
/** Uma linha sobre o sono para o assistente (diário, horário, programa, sinais de alerta), sem o que a pessoa escreveu no ritual. */
export function sleepContext(S: Pick<AppState, 'logs' | 'sleep'>, now = new Date()) {
  const parts: string[] = [];
  const st = diaryStats(S, 14, now);
  if (st.nights >= 3) parts.push(`diário de ${st.nights} noites: eficiência ${st.eff ?? '—'}%, adormece em ${st.lat ?? '—'} min, acordares ${st.wakes ?? '—'}, levanta-se ~${st.upAvg ?? '—'} (varia ${st.upSd ?? '—'} min)`);
  const s = S.sleep;
  if (s?.wake || s?.bed) parts.push(`horário escolhido: deitar ${s.bed ?? DEFAULT_BED}, acordar ${s.wake ?? DEFAULT_WAKE}`);
  const p = programDay(S, now);
  if (p && !p.over) parts.push(p.finished ? 'terminou o programa "Dormir melhor em 14 dias"' : `programa "Dormir melhor em 14 dias": dia ${p.day} (${PROGRAM[p.day - 1].title})`);
  const ritualNights = Array.from({ length: 7 }, (_, i) => S.logs[keyDaysAgo(i, now)]?.ritual).filter(Boolean).length;
  if (ritualNights) parts.push(`ritual da noite em ${ritualNights} dos últimos 7 dias`);
  const f = s?.flags;
  const flagged = f ? FLAG_QUESTIONS.filter(([k]) => f[k]).map(([k]) => ({ apnea: 'ressona com pausas na respiração', chronic: 'insónia há 3+ meses', sleepy: 'adormece sem querer de dia', legs: 'pernas inquietas', mood: 'humor tira-lhe o sono' })[k]) : [];
  if (flagged.length) parts.push(`sinais de alerta assinalados: ${flagged.join(', ')} (já aconselhado a falar com um profissional)`);
  return parts.length ? `Sono: ${parts.join('; ')}.` : '';
}
