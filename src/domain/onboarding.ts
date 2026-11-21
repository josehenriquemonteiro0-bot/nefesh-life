/**
 * Chegada rápida: a avaliação inicial só tem as perguntas essenciais; as outras são
 * feitas depois, uma de cada vez, como "pergunta do dia" (a partir do 2.º dia), na altura
 * certa (o sono de manhã, a alimentação perto das refeições). O perfil fica igualmente
 * completo, só que distribuído pela primeira semana.
 */
import { QUESTIONS } from './content';
import { daysSince, todayKey } from './dates';
import type { Answers, AppState, AreaKey } from './types';

/** Perguntas da avaliação inicial (e das reavaliações). */
export const ESSENTIAL = ['name', 'goal', 'sexo', 'idade', 'altura', 'peso', 'ativ', 'sonoh', 'energia', 'stress', 'safe'] as const;
export const QUIZ = QUESTIONS.filter((q) => (ESSENTIAL as readonly string[]).includes(q.id));

type When = 'manha' | 'refeicao' | 'qualquer';
/** Perguntas para depois, por ordem, com a altura do dia em que fazem mais sentido. */
export const LATER: { id: keyof Answers; when: When; area?: AreaKey }[] = [
  { id: 'sonoq', when: 'manha', area: 'sono' },
  { id: 'agua', when: 'qualquer', area: 'hidratacao' },
  { id: 'veg', when: 'refeicao', area: 'nutricao' },
  { id: 'proc', when: 'refeicao', area: 'nutricao' },
  { id: 'cafe', when: 'manha', area: 'hidratacao' },
  { id: 'dieta', when: 'refeicao' },
  { id: 'corpo', when: 'qualquer' },
  { id: 'prior', when: 'qualquer' },
  { id: 'cintura', when: 'qualquer' },
];
export const laterQuestion = (id: keyof Answers) => QUESTIONS.find((q) => q.id === id)!;

/** Máximo de perguntas do dia (a pessoa pode pedir "mais uma" até este limite). */
export const PER_DAY = 3;

/** Ainda por responder (as medidas contam como respondidas se a pessoa as saltou). */
export const missingLater = (a: Answers | null | undefined) =>
  LATER.filter((x) => a?.[x.id] === undefined && !(x.id === 'cintura' && a?.medidasSaltadas));

/** Áreas do Índice calculadas com respostas em falta (valor provisório). */
export function provisionalAreas(a: Answers | null | undefined): AreaKey[] {
  const miss = missingLater(a);
  return [...new Set(miss.map((x) => x.area).filter((x): x is AreaKey => !!x))];
}

const windowOf = (h: number): When => (h < 11 ? 'manha' : (h >= 11.5 && h < 15) || (h >= 18.5 && h < 22) ? 'refeicao' : 'qualquer');

/** Próxima pergunta do dia (nenhuma no 1.º dia, nem depois de PER_DAY respostas hoje). */
/** Pergunta que ficou sem resposta num dia anterior (vai para o fim da fila hoje). */
const staleLater = (S: Pick<AppState, 'laterLast'>, today: string) => (S.laterLast ? (S.laterLast.d < today ? S.laterLast.id : S.laterLast.demote) : undefined);

/** Regista a pergunta mostrada hoje (para não ficar presa se não for respondida). */
export function noteLaterShown(S: AppState, id: string, now = new Date()) {
  const today = todayKey(now);
  if (S.laterLast?.id === id && S.laterLast.d === today) return;
  S.laterLast = { id, d: today, demote: staleLater(S, today) };
}

export function nextLaterQuestion(S: Pick<AppState, 'ans' | 'planStart' | 'sample' | 'laterAsk' | 'laterLast'>, now = new Date()) {
  if (!S.ans || S.sample || !S.planStart || daysSince(S.planStart, now) < 1) return null;
  const today = todayKey(now);
  const asked = S.laterAsk?.d === today ? S.laterAsk : { d: today, n: 0, skip: [] as string[] };
  if (asked.n >= PER_DAY) return null;
  const open = missingLater(S.ans).filter((x) => !(asked.skip ?? []).includes(x.id));
  if (!open.length) return null;
  // a pergunta mostrada num dia anterior e não respondida passa para o fim da fila
  const stale = staleLater(S, today);
  const left = [...open.filter((x) => x.id !== stale), ...open.filter((x) => x.id === stale)];
  const w = windowOf(now.getHours() + now.getMinutes() / 60);
  const pick = left.find((x) => x.when === w) ?? left.find((x) => x.when === 'qualquer') ?? left[0];
  return { ...pick, q: laterQuestion(pick.id), left: missingLater(S.ans).length, answeredToday: asked.n };
}

/**
 * Guarda a resposta da pergunta do dia: atualiza o perfil e acerta as áreas provisórias
 * das avaliações já feitas (a comparação antes/depois fica justa).
 */
export function answerLater(S: AppState, patch: Partial<Answers>, now = new Date()) {
  if (!S.ans) return;
  S.ans = { ...S.ans, ...patch };
  const today = todayKey(now);
  const asked = S.laterAsk?.d === today ? S.laterAsk : { d: today, n: 0, skip: [] };
  S.laterAsk = { ...asked, n: asked.n + 1 };
  // a avaliação inicial fica como a pessoa a viu (o Índice vivo já usa as respostas novas)
  const still = provisionalAreas(S.ans);
  S.evals = S.evals.map((e) => (e.prov?.length ? { ...e, prov: e.prov.filter((k) => still.includes(k)) } : e));
}

/** "Agora não": não volta a perguntar isto hoje. */
export function skipLater(S: AppState, id: string, now = new Date()) {
  const today = todayKey(now);
  const asked = S.laterAsk?.d === today ? S.laterAsk : { d: today, n: 0, skip: [] };
  S.laterAsk = { ...asked, skip: [...(asked.skip ?? []), id] };
}

/** Pedido de conta a partir do 3.º dia ("Proteja a sua sequência"), até criar ou adiar. */
export const ACCOUNT_ROUNDS: [number, number][] = [[3, 4], [10, 11], [24, 25]];
export function askAccount(S: Pick<AppState, 'ans' | 'planStart' | 'sample' | 'accountAsk'>, hasAccount: boolean, now = new Date()) {
  if (hasAccount || !S.ans || S.sample || !S.planStart) return false;
  // só em 3 rondas de 2 dias (dias 3-4, 10-11 e 24-25); "Agora não" fecha a ronda
  const day = daysSince(S.planStart, now) + 1;
  const round = ACCOUNT_ROUNDS.find(([a, b]) => day >= a && day <= b);
  if (!round) return false;
  const roundStart = daysSince(S.planStart, now) + 1 - round[0];
  return !S.accountAsk || daysSince(S.accountAsk, now) > roundStart;
}
