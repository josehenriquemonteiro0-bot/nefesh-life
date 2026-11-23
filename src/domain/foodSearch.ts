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

/** O alimento da base que corresponde a um nome do plano (o mais completo), se houver. */
export function baseFoodOf(name: string): NFood | null {
  const words = norm(name).replace(/[,()]/g, ' ').split(/\s+/).filter((w) => w.length >= 3);
  if (!words.length) return null;
  return [...myFoods(), ...BASE].find((f) => { const n = norm(f.name); return words.every((w) => n.includes(w)); }) ?? null;
}

export interface Equivalent { name: string; grams: number; kcal: number; p: number; c: number; f: number }
/**
 * Substituições equivalentes para um alimento do plano: mesmo grupo, perfil parecido (proteína, hidratos, gordura
 * por kcal) e a quantidade ajustada para as mesmas calorias (ou a mesma proteína, nos alimentos proteicos).
 */
export function equivalents(name: string, grams: number, limit = 4): Equivalent[] {
  const base = baseFoodOf(name);
  if (!base || !base.kcal || !grams) return [];
  const kcal = (base.kcal * grams) / 100;
  const protein = base.p * 4 / base.kcal > 0.45;
  const prof = (f: NFood) => [f.p * 4 / f.kcal, f.c * 4 / f.kcal, f.f * 9 / f.kcal];
  const pb = prof(base);
  const raw = /\bcru[as]?\b/.test(norm(base.name));
  return BASE.filter((f) => f.cat === base.cat && f.kcal > 0 && norm(f.name) !== norm(base.name) && /\bcru[as]?\b/.test(norm(f.name)) === raw && !/frit|empanad|com farinha|enlatad/.test(norm(f.name)))
    .map((f) => { const pf = prof(f); return { f, d: Math.hypot(pf[0] - pb[0], pf[1] - pb[1], pf[2] - pb[2]) }; })
    .sort((a, b) => a.d - b.d)
    .slice(0, limit * 3)
    .map(({ f }) => {
      const g = protein && f.p > 0 ? (base.p * grams) / f.p : (kcal * 100) / f.kcal;
      const gg = Math.round(g / 5) * 5;
      const k = gg / 100;
      return { name: f.name, grams: gg, kcal: Math.round(f.kcal * k), p: Math.round(f.p * k * 10) / 10, c: Math.round(f.c * k * 10) / 10, f: Math.round(f.f * k * 10) / 10 };
    })
    .filter((x) => x.grams >= 10 && x.grams <= 600 && x.grams >= grams * 0.4 && x.grams <= grams * 2.5)
    .slice(0, limit);
}

/** Lista de compras dos próximos dias pelo plano do nutricionista (opção A de cada refeição), por grupo. */
export function shoppingList(rx: import('./proNutri').NutriRx, from = new Date(), days = 7) {
  const sum = new Map<string, { food: string; grams: number; cat: string }>();
  for (let i = 0; i < days; i++) {
    const d = new Date(from.getTime() + i * 864e5);
    const wd = d.getDay();
    const day = rx.days.find((x) => x.weekdays.includes(wd)) ?? rx.days.find((x) => !x.weekdays.length) ?? rx.days[0];
    for (const m of day.meals) for (const it of m.options[0]?.items ?? []) {
      const k = norm(it.food);
      const cur = sum.get(k) ?? { food: it.food, grams: 0, cat: baseFoodOf(it.food)?.cat ?? 'Outros' };
      cur.grams += it.grams;
      sum.set(k, cur);
    }
  }
  const groups = new Map<string, { food: string; grams: number }[]>();
  for (const x of [...sum.values()].sort((a, b) => a.food.localeCompare(b.food))) groups.set(x.cat, [...(groups.get(x.cat) ?? []), { food: x.food, grams: Math.round(x.grams) }]);
  return [...groups.entries()].map(([cat, items]) => ({ cat, items }));
}
/** Quantidade legível: 1250 g → "1,25 kg". */
export const qty = (g: number) => (g >= 1000 ? `${String(Math.round(g / 10) / 100).replace('.', ',')} kg` : `${g} g`);
