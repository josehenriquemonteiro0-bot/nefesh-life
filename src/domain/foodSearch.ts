/**
 * Pesquisa de alimentos para o construtor de planos do nutricionista:
 * TACO (Brasil, por 100 g), a base da app (Portugal, com porção habitual) e os alimentos próprios
 * que o nutricionista criou (guardados neste telemóvel).
 */
import { FOODS } from './foods';
import { TACO, TACO_CATS } from './taco';

export interface NFood { name: string; src: 'TACO' | 'NEFESH' | 'Meu'; cat: string; kcal: number; p: number; c: number; f: number; fib: number; portion?: string; grams?: number }

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const BASE: NFood[] = [
  ...FOODS.filter((f) => f.cat !== 'NEFESH').map((f) => ({ name: f.name, src: 'NEFESH' as const, cat: f.cat, kcal: f.kcal, p: f.p, c: f.c, f: f.f, fib: 0, portion: f.portion, grams: f.grams })),
  ...TACO.map(([name, cat, kcal, p, c, f, fib]) => ({ name, src: 'TACO' as const, cat: TACO_CATS[cat - 1] ?? 'Outros', kcal, p, c, f, fib })),
];

const MINE = 'nefesh-life-pro-alimentos';
export function myFoods(): NFood[] {
  try { return (JSON.parse(localStorage.getItem(MINE) || '[]') as NFood[]).map((x) => ({ ...x, src: 'Meu' as const })); } catch { return []; }
}
export function saveMyFood(f: Omit<NFood, 'src'>) {
  try { localStorage.setItem(MINE, JSON.stringify([{ ...f, src: 'Meu' }, ...myFoods().filter((x) => norm(x.name) !== norm(f.name))].slice(0, 300))); } catch { /* sem armazenamento */ }
}

/** Pesquisa sem acentos; todas as palavras têm de aparecer; os que começam pela pesquisa e os próprios primeiro. */
export function searchNFoods(q: string, limit = 30): NFood[] {
  const words = norm(q.trim()).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const pool = [...myFoods(), ...BASE];
  const score = (x: NFood) => (x.src === 'Meu' ? 4 : 0) + (norm(x.name).startsWith(words[0]) ? 2 : 0) + (/cozid|grelhad|assad|cru\b|natural/.test(norm(x.name)) ? 1 : 0) - norm(x.name).length / 100;
  const hits = (x: NFood) => { const n = norm(`${x.name} ${x.cat}`); return words.filter((w) => n.includes(w)).length; };
  const all = pool.filter((x) => hits(x) === words.length).sort((a, b) => score(b) - score(a));
  if (all.length >= 5 || words.length === 1) return all.slice(0, limit);
  // poucas correspondências completas: junta as que têm parte das palavras (as mais completas primeiro)
  const some = pool.filter((x) => { const h = hits(x); return h > 0 && h < words.length && words.some((w) => w.length >= 3 && norm(x.name).includes(w)); })
    .sort((a, b) => hits(b) - hits(a) || score(b) - score(a));
  return [...all, ...some].slice(0, limit);
}
