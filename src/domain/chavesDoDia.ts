import dados from './chavesDoDia.json';
import { parseKey, todayKey } from './dates';

/** Uma "Chave do Dia" da seção Mente: frase de reflexão + referência bíblica. */
export interface ChaveDoDia {
  id: string;
  texto: string;
  referencia: string;
  /** 'nota': o versículo já vinha na nota original; 'sugerida': escolhido para combinar com a frase. */
  referenciaOrigem: 'nota' | 'sugerida';
  temas: string[];
}

interface ChaveBruta {
  id: string;
  texto: string;
  referencia: string;
  referencia_origem: string;
  temas: string[];
  origem_interna?: string;
}

/** Lista para o app. O campo `origem_interna` do JSON é só de controlo interno e nunca é exposto. */
export const CHAVES: ChaveDoDia[] = (dados.chaves as ChaveBruta[]).map((c) => ({
  id: c.id,
  texto: c.texto,
  referencia: c.referencia,
  referenciaOrigem: c.referencia_origem === 'nota' ? 'nota' : 'sugerida',
  temas: c.temas,
}));

/** Gerador pseudoaleatório determinístico (mulberry32). */
const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** Ordem embaralhada das chaves para um ciclo; muda a cada ciclo completo. */
const ordemDoCiclo = (ciclo: number, n: number, pessoa = 0) => {
  const ordem = Array.from({ length: n }, (_, i) => i);
  const r = rng(((ciclo + 1) ^ pessoa) | 0);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [ordem[i], ordem[j]] = [ordem[j], ordem[i]];
  }
  return ordem;
};

const INICIO = parseKey('2026-01-01');

/** Número a partir da semente pessoal (FNV-1a de 32 bits). */
const hashSemente = (s: string) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h | 0;
};

/** Semente pessoal nova (guardada no estado da pessoa, vai com a conta para outros aparelhos). */
export const novaSemente = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('');

/**
 * Chave do dia: uma por dia, sem repetir até todas terem aparecido; depois recomeça noutra ordem.
 * Com a semente pessoal, cada pessoa tem a sua ordem (e por isso, quase sempre, uma chave diferente da
 * dos amigos no mesmo dia), estável ao longo do dia e igual em todos os seus aparelhos.
 * Sem semente, é igual para todos.
 */
export const chaveDoDia = (dia = todayKey(), lista: ChaveDoDia[] = CHAVES, semente = ''): ChaveDoDia => {
  const n = lista.length;
  const dias = Math.round((parseKey(dia).getTime() - INICIO.getTime()) / 864e5);
  const d = ((dias % n) + n) % n;
  const ciclo = Math.floor((dias - d) / n);
  return lista[ordemDoCiclo(ciclo, n, semente ? hashSemente(semente) : 0)[d]];
};

/** Todos os temas existentes, por ordem alfabética. */
export const temasDasChaves = (lista: ChaveDoDia[] = CHAVES) =>
  [...new Set(lista.flatMap((c) => c.temas))].sort((a, b) => a.localeCompare(b, 'pt'));

/** Chaves de um tema, para a pessoa ver e ler. */
export const chavesPorTema = (tema: string, lista: ChaveDoDia[] = CHAVES) =>
  lista.filter((c) => c.temas.includes(tema));
