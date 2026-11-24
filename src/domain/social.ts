/**
 * Comunidade: chamadas ao servidor, mensagens prontas e o estado mais recente (em memória).
 */
import { appUrl } from './platform';
import { useEffect, useSyncExternalStore } from 'react';
import { AccountError, getAuth } from './account';
import { PHOTO_API } from './photo';
import { RECIPES } from './recipes';

export const LEAGUES = ['Bronze', 'Prata', 'Ouro', 'Esmeralda', 'Diamante'];
export const LEAGUE_COLORS = ['#c58b5a', '#b8c2c8', '#e2c15b', '#3fd59a', '#8fd3ff'];

/** Mensagens prontas entre amigos (o servidor só aceita estas). */
export const MESSAGES: Record<string, string> = {
  aplauso: '👏 Aplausos! Que semana!',
  parabens_spirulina: '🌿 Parabéns, Spirulina tomada! Continue assim.',
  lembrete_spirulina: '🌿 Já tomou a sua Spirulina hoje?',
  lembrete_agua: '💧 Lembrete amigo: beba água!',
  lembrete_treino: '💪 Hoje é dia de mexer o corpo!',
  forca: '💚 Força! Estou a torcer por si.',
  sequencia: '🔥 Que sequência incrível!',
  evolucao: '📈 Parabéns pela evolução no Índice NEFESH!',
  volta: '👋 Tenho saudades suas no ritual! Bora voltar?',
};

export const CHALLENGES: Record<string, { title: string; text: string; icon: string }> = {
  ritual_agua: { title: 'Spirulina e hidratação', text: 'Spirulina e meta de água no mesmo dia', icon: '🌿💧' },
  ritual_treino: { title: 'Spirulina e movimento', text: 'Spirulina e treino ou atividade no mesmo dia', icon: '🌿💪' },
  ritual_checkin: { title: 'Spirulina e check-in', text: 'Spirulina e check-in no mesmo dia', icon: '🌿📝' },
  ritual_refeicoes: { title: 'Spirulina e boa alimentação', text: 'Spirulina e 3 refeições registadas', icon: '🌿🍽️' },
  reset21: { title: 'NEFESH 21 Day Reset', text: 'Spirulina e meta de água no mesmo dia', icon: '🌿💧' },
  ritual: { title: 'Ritual de 7 dias', text: 'Spirulina todos os dias', icon: '🌿' },
  agua: { title: 'Semana da hidratação', text: 'Meta de água', icon: '💧' },
  treino: { title: 'Corpo em movimento', text: 'Dias com treino ou atividade', icon: '💪' },
  checkin: { title: 'Ouvir o corpo', text: 'Check-in diário', icon: '📝' },
  passos: { title: 'Semana dos passos', text: 'Meta de passos', icon: '👟' },
};

export interface Member {
  id?: string;
  rank?: number;
  me?: boolean;
  nick: string;
  avatar: string | null;
  points: number;
  streak?: number;
  level?: number;
  league?: number;
  /** letras dos hábitos cumpridos hoje (só amigos) */
  today?: string;
}

export interface SocialState {
  joined: boolean;
  me?: { nick: string; avatar: string | null; code: string; league: number; evo: boolean; streak: number; level: number; points: number; result: { week: string; rank: number; n: number; points: number; from: number; to: number } | null };
  week?: string;
  leagueName?: string;
  league?: Member[];
  friends?: (Member & { id: string; today: string })[];
  messages?: { id: number; kind: string; created: string; seen: boolean; nick: string; avatar: string | null; from: string }[];
  challenges?: { id: string; kind: string; level?: 'leve' | 'firme'; day?: number; start: string; end: string; target: number; days: number; mine: boolean; members: { id: string; me: boolean; nick: string; avatar: string | null; done: number }[] }[];
  official?: { kind: string; target: number; done: number; bonus: number };
  feed?: FeedItem[];
  photos?: PhotoMoment[];
  /** pessoas que bloqueei */
  blocked?: { id: string; nick: string }[];
  team?: TeamInfo | null;
  teams?: { rank: number; name: string; members: number; avg: number; mine: boolean }[];
  partner?: { status: 'ativo' | 'enviado' | 'recebido'; nick: string; avatar: string | null; streak: number; todayMe: boolean; todayThem: boolean } | null;
  /** ranking semanal global e cupão NEFESH15 */
  prize?: PrizeState;
  /** pontos de hoje calculados pelo servidor, com as provas */
  verify?: { points: number; verified: number; declared: number; v: string; checkDay: boolean; spirulinaPhoto: boolean; meals: number; review: boolean };
}

export interface PrizeCoupon {
  code: string;
  week: string;
  rank: number;
  status: string;
  expires: string;
  seen: boolean;
  expired: boolean;
}
export interface PrizeState {
  percent: number;
  winners: number;
  top: { rank: number; nick: string; avatar: string | null; points: number; me: boolean; eligible: boolean }[];
  me: { rank: number | null; prizeRank: number | null; points: number; eligible: boolean; daysIn: number; checkins: number; reasons: string[] };
  rules: { minDays: number; minCheckins: number; validDays: number; cooldownWeeks: number };
  coupons: PrizeCoupon[];
}

export interface FeedItem {
  id: number;
  me: boolean;
  /** id de quem publicou (só nos outros), para bloquear */
  uid?: string;
  kind: string;
  value: number;
  created: string;
  nick: string;
  avatar: string | null;
  cheers: number;
  cheered: boolean;
  reactions?: Record<string, number>;
  myReaction?: string | null;
  replies?: { nick: string; kind: string }[];
}

export const REACTIONS = ['👏', '💚', '🔥'];
export const REPLIES: Record<string, string> = {
  parabens: 'Parabéns! 🎉',
  bora: 'Bora! 💪',
  orgulho: 'Que orgulho! 💚',
  inspiras: 'Inspiraste-me hoje 🌿',
  continua: 'Continua assim! 🔥',
};

export interface PhotoMoment {
  id: string;
  fid: number;
  me: boolean;
  uid?: string;
  kind: 'treino' | 'receita' | 'spirulina' | 'refeicao';
  created: string;
  nick: string;
  avatar: string | null;
  reactions: Record<string, number>;
  myReaction: string | null;
}

export const PHOTO_LABEL: Record<PhotoMoment['kind'], string> = { treino: '💪 Treino', receita: '🥤 Receita', spirulina: '🌿 Spirulina', refeicao: '🍽️ Refeição' };
export const photoUrl = (id: string) => `${PHOTO_API}/foto/${id}`;

export interface TeamInfo {
  name: string;
  kind?: CircleKind;
  code: string;
  mine: boolean;
  members: { id: string; me: boolean; nick: string; avatar: string | null; streak: number; points: number; ritualDays: number; today: boolean }[];
  goal: number;
  done: number;
  total: number;
}

/** Circles: grupos privados por tipo. */
export type CircleKind = 'familia' | 'amigos' | 'casal' | 'equipa';
export const CIRCLE_KINDS: [CircleKind, string, string][] = [
  ['familia', 'Família', '🏡'],
  ['amigos', 'Amigos', '🤝'],
  ['casal', 'Casal', '💞'],
  ['equipa', 'Equipa', '🏅'],
];
export const circleOf = (k?: string) => CIRCLE_KINDS.find((c) => c[0] === k) ?? CIRCLE_KINDS[1];

/** Durações e níveis dos desafios. */
export const DURATIONS = [7, 21, 30, 90] as const;
export const LEVELS: ['leve' | 'firme', string][] = [['leve', 'Leve'], ['firme', 'Firme']];

const LEVEL_NAMES = ['Semente', 'Broto', 'Folha', 'Raiz', 'Árvore', 'Floresta', 'Oceano', 'Nefesh'];

/** Texto de uma conquista do mural. */
export function feedText(f: FeedItem) {
  const who = f.me ? 'Chegou' : `${f.nick} chegou`;
  switch (f.kind) {
    case 'ritual':
      return `🌿 ${who} aos ${f.value} dias de ritual da Spirulina!`;
    case 'nivel':
      return `🌱 ${f.me ? 'Subiu' : `${f.nick} subiu`} ao nível ${LEVEL_NAMES[f.value] ?? f.value}`;
    case 'indice':
      return f.me ? `📈 O seu Índice NEFESH subiu ${f.value} pontos` : `📈 O Índice NEFESH de ${f.nick} subiu ${f.value} pontos`;
    case 'liga':
      return `🏆 ${f.me ? 'Subiu' : `${f.nick} subiu`} para a liga ${LEAGUES[f.value] ?? ''}`;
    case 'receita':
      return `🥤 ${f.me ? 'Fez' : `${f.nick} fez`} a receita ${RECIPES[f.value]?.title ?? 'com Spirulina'}`;
    case 'treino':
      return `💪 ${f.me ? 'Concluiu' : `${f.nick} concluiu`} um treino${f.value ? ` de ${f.value} min` : ''}`;
    case 'frasco':
      return `🌿 ${f.me ? 'Começou' : `${f.nick} começou`} um frasco novo de Spirulina NEFESH`;
    case 'desafio':
      return `🏅 ${f.me ? 'Cumpriu' : `${f.nick} cumpriu`} o desafio NEFESH da semana`;
    case 'dupla':
      return `🤝 ${f.me ? 'Você e o seu parceiro' : `${f.nick} e o parceiro de ritual`} chegaram a ${f.value} dias de ritual juntos`;
    case 'reset':
      return `🌿 ${f.me ? 'Concluiu' : `${f.nick} concluiu`} o NEFESH 21 Day Reset!`;
    case 'entrou':
      return `👋 ${f.me ? 'Entrou' : `${f.nick} entrou`} na comunidade NEFESH`;
    default:
      return '';
  }
}

async function call<T = Record<string, unknown>>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  const a = getAuth();
  if (!a && action !== 'evolucao') throw new AccountError('Crie uma conta ou entre primeiro.', 401);
  let res: Response;
  try {
    res = await fetch(`${PHOTO_API}/social/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, token: a?.token }),
    });
  } catch {
    throw new AccountError('Sem ligação à internet.', 0);
  }
  const out = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new AccountError(out.error || `Erro ${res.status}`, res.status);
  return out;
}

/* ---------- estado partilhado entre ecrãs ---------- */

let cache: { at: number; state: SocialState | null; error: string | null; loading: boolean } = { at: 0, state: null, error: null, loading: false };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export async function refresh() {
  if (!getAuth()) {
    cache = { at: Date.now(), state: null, error: null, loading: false };
    emit();
    return;
  }
  cache = { ...cache, loading: true };
  emit();
  try {
    cache = { at: Date.now(), state: await call<SocialState>('estado'), error: null, loading: false };
  } catch (e) {
    cache = { ...cache, at: Date.now(), error: (e as Error).message, loading: false };
  }
  emit();
}

/** Estado da comunidade; volta a pedir ao servidor se tiver mais de `maxAge` ms. */
export function useSocial(maxAge = 60_000) {
  const c = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => cache,
  );
  useEffect(() => {
    if (!cache.loading && Date.now() - cache.at > maxAge) refresh();
  }, [maxAge]);
  return c;
}

export const unreadCount = (s: SocialState | null) => (s?.messages ?? []).filter((m) => !m.seen).length;

/* ---------- ações ---------- */

export const join = (nick: string, avatar: string | undefined, evo: boolean) => call<{ code: string }>('perfil', { nick, avatar, evo });
export const setCommunityPush = (on: boolean) => call('notificacoes-comunidade', { on });
export const updateAvatar = (avatar: string | null) => call('perfil-foto', { avatar });
export const syncWeek = (payload: Record<string, unknown>) => call<{ points: number; league: number; bonus: number }>('sincronizar', payload);
export const addFriend = (code: string) => call<{ nick: string }>('amigo', { code });
export const removeFriend = (id: string) => call('remover-amigo', { id });
/** Bloquear: deixa de ser amigo e nenhum dos dois vê as fotos, conquistas ou mensagens do outro. */
export const blockPerson = (id: string) => call('bloquear', { id });
export const unblockPerson = (id: string) => call('desbloquear', { id });
export const sendMessage = (to: string, kind: string) => call('mensagem', { to, kind });
export const markSeen = () => call('lidas');
export const cheer = (id: number) => call('aplaudir', { id });
export const registerBottle = (code: string | null, product: string) => call<{ ok: boolean; verified: boolean; note?: string }>('frasco', { code, product });
export const createTeam = (name: string, kind: CircleKind = 'amigos') => call<{ code: string }>('equipa-criar', { name, kind });
export const joinTeam = (code: string) => call<{ name: string }>('equipa-entrar', { code });
export const leaveTeam = () => call('equipa-sair');
export const react = (id: number, kind: string) => call('reagir', { id, kind });
export const replyTo = (id: number, kind: string) => call('responder', { id, kind });
export const invitePartner = (id: string) => call('parceiro-convidar', { id });
export const acceptPartner = () => call('parceiro-aceitar');
export const endPartner = () => call('parceiro-terminar');
/** Partilha um momento no mural (receita feita, treino concluído). Falhas são ignoradas. */
export function shareMoment(kind: 'receita' | 'treino', value: number) {
  if (!getAuth()) return;
  call('momento', { kind, value }).then(() => refresh()).catch(() => undefined);
}
export const sharePhoto = (kind: string, image: string, value = 0) => call<{ ok: boolean; note: string; id?: string }>('foto', { kind, image, value });
export const reportPhoto = (id: string) => call('denunciar-foto', { id });
export const deletePhoto = (id: string) => call('apagar-foto', { id });
export const proveHealth = (image: string, media_type: string) =>
  call<{ ok: boolean; note: string; steps?: number; exMin?: number; sleepH?: number }>('prova-saude', { image, media_type });
export const proveSpirulina = (image: string, media_type: string) => call<{ ok: boolean; note: string }>('prova-spirulina', { image, media_type });
export const resultSeen = () => call('resultado-visto');
export const createChallenge = (kind: string, friends: string[]) => call<{ id: string }>('desafio', { kind, friends });
export const acceptInvite = (code: string, cid?: string) => call<{ nick?: string; joined?: boolean; self?: boolean }>('convite', { code, cid });

/* ---------- convites por link (?amigo=CÓDIGO&reset=ID) ---------- */
const INVITE_KEY = 'nefesh-life-convite';
/** Guarda o convite do link (até a pessoa entrar na comunidade) e limpa o endereço. */
export function saveInviteFromUrl() {
  try {
    const p = new URLSearchParams(location.search);
    const code = (p.get('amigo') ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!code) return;
    localStorage.setItem(INVITE_KEY, JSON.stringify({ code, cid: (p.get('reset') ?? '').replace(/[^a-f0-9]/g, '') }));
    p.delete('amigo');
    p.delete('reset');
    history.replaceState(null, '', `${location.pathname}${p.toString() ? `?${p}` : ''}`);
  } catch {
    /* sem armazenamento */
  }
}
export function pendingInvite(): { code: string; cid: string } | null {
  try {
    return JSON.parse(localStorage.getItem(INVITE_KEY) || 'null');
  } catch {
    return null;
  }
}
export const clearInvite = () => {
  try {
    localStorage.removeItem(INVITE_KEY);
  } catch {
    /* sem armazenamento */
  }
};

/** Link de convite (com o 21 Day Reset, se houver). */
export const inviteUrl = (code: string, cid?: string) => `${appUrl()}?amigo=${code}${cid ? `&reset=${cid}` : ''}`;
export const leaveChallenge = (id: string) => call('sair-desafio', { id });
export const leaveCommunity = () => call('sair');
export const evolutionRanking = () => call<{ ranking: { rank: number; nick: string; avatar: string | null; from: number; to: number; gain: number }[] }>('evolucao');

/** Mensagem sugerida para um amigo, conforme o que já fez hoje. */
export function suggestFor(today: string, hour = new Date().getHours()): string {
  if (today.includes('s')) return today.length >= 4 ? 'aplauso' : 'parabens_spirulina';
  if (hour >= 11) return 'lembrete_spirulina';
  return 'forca';
}

/** Link de convite para a app com o código de amigo. */
export function inviteText(code: string, nick: string) {
  return `${nick} convidou-te para a comunidade NEFESH Life 🌿\nToca no link, cria a tua conta e ficamos ligados:\n${inviteUrl(code)}`;
}

/** Convite para o NEFESH 21 Day Reset (equipa até 3 é o objetivo; cabem mais). */
export function resetInviteText(code: string, nick: string, cid: string) {
  return `${nick} desafiou-te para o NEFESH 21 Day Reset 🌿💧\n21 dias de Spirulina e água, juntos. Toca no link, cria a tua conta e entras logo na equipa:\n${inviteUrl(code, cid)}`;
}
