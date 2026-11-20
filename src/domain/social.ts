/**
 * Comunidade: chamadas ao servidor, mensagens prontas e o estado mais recente (em memória).
 */
import { useEffect, useSyncExternalStore } from 'react';
import { AccountError, getAuth } from './account';
import { PHOTO_API } from './photo';

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
  challenges?: { id: string; kind: string; start: string; end: string; target: number; days: number; mine: boolean; members: { id: string; me: boolean; nick: string; avatar: string | null; done: number }[] }[];
  official?: { kind: string; target: number; done: number; bonus: number };
  feed?: FeedItem[];
  /** pontos de hoje calculados pelo servidor, com as provas */
  verify?: { points: number; verified: number; declared: number; v: string; checkDay: boolean; spirulinaPhoto: boolean; meals: number; review: boolean };
}

export interface FeedItem {
  id: number;
  me: boolean;
  kind: string;
  value: number;
  created: string;
  nick: string;
  avatar: string | null;
  cheers: number;
  cheered: boolean;
}

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
export const syncWeek = (payload: Record<string, unknown>) => call<{ points: number; league: number; bonus: number }>('sincronizar', payload);
export const addFriend = (code: string) => call<{ nick: string }>('amigo', { code });
export const removeFriend = (id: string) => call('remover-amigo', { id });
export const sendMessage = (to: string, kind: string) => call('mensagem', { to, kind });
export const markSeen = () => call('lidas');
export const cheer = (id: number) => call('aplaudir', { id });
export const registerBottle = (code: string | null, product: string) => call<{ ok: boolean; verified: boolean; note?: string }>('frasco', { code, product });
export const proveHealth = (image: string, media_type: string) =>
  call<{ ok: boolean; note: string; steps?: number; exMin?: number; sleepH?: number }>('prova-saude', { image, media_type });
export const proveSpirulina = (image: string, media_type: string) => call<{ ok: boolean; note: string }>('prova-spirulina', { image, media_type });
export const resultSeen = () => call('resultado-visto');
export const createChallenge = (kind: string, friends: string[]) => call('desafio', { kind, friends });
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
  const url = `${location.origin}${import.meta.env.BASE_URL}?amigo=${code}`;
  return `${nick} convidou-te para a comunidade NEFESH Life 🌿\nAbre a app, vai a Comunidade → Amigos e usa o código ${code}\n${url}`;
}
