/**
 * Código de barras + Open Food Facts (base aberta e gratuita de produtos embalados).
 * Só o número do código sai do telemóvel. Valores do rótulo (não estimativas).
 * Produto que não está na base: a tabela nutricional é lida por foto (IA) e fica guardada.
 */
import type { FoodEntry } from './foods';
import type { AppState } from './types';

export interface ScannedFood {
  code: string;
  name: string;
  brand?: string;
  /** por 100 g (ou 100 ml) */
  kcal: number;
  p: number;
  c: number;
  f: number;
  sugar?: number;
  salt?: number;
  fiber?: number;
  /** porção indicada no rótulo, em gramas */
  serving?: number;
  servingText?: string;
  nutri?: string;
  nova?: number;
  allergens?: string[];
  additives?: string[];
  img?: string;
  source: 'off' | 'rotulo';
}

const num = (v: unknown) => (v === undefined || v === null || v === '' || Number.isNaN(Number(v)) ? undefined : Math.round(Number(v) * 10) / 10);

/** Converte a resposta da Open Food Facts (API v2) num alimento; null se não existir ou não tiver calorias. */
export function parseOff(code: string, json: unknown): ScannedFood | null {
  const j = json as { status?: number; product?: Record<string, unknown> };
  const p = j?.product;
  if (!p || j.status === 0) return null;
  const n = (p.nutriments ?? {}) as Record<string, unknown>;
  const kcal = num(n['energy-kcal_100g']) ?? (num(n['energy_100g']) !== undefined ? Math.round(num(n['energy_100g'])! / 4.184) : undefined);
  if (kcal === undefined) return null;
  const name = String(p.product_name_pt || p.product_name || p.generic_name || '').trim();
  return {
    code,
    name: name || `Produto ${code}`,
    brand: String(p.brands ?? '').split(',')[0].trim() || undefined,
    kcal: Math.round(kcal),
    p: num(n.proteins_100g) ?? 0,
    c: num(n.carbohydrates_100g) ?? 0,
    f: num(n.fat_100g) ?? 0,
    sugar: num(n.sugars_100g),
    salt: num(n.salt_100g),
    fiber: num(n.fiber_100g),
    serving: num(p.serving_quantity),
    servingText: p.serving_size ? String(p.serving_size) : undefined,
    nutri: /^[a-e]$/i.test(String(p.nutriscore_grade ?? '')) ? String(p.nutriscore_grade).toUpperCase() : undefined,
    nova: [1, 2, 3, 4].includes(Number(p.nova_group)) ? Number(p.nova_group) : undefined,
    allergens: Array.isArray(p.allergens_tags) ? (p.allergens_tags as string[]).map((a) => a.replace(/^[a-z]{2}:/, '')) : [],
    additives: Array.isArray(p.additives_tags) ? (p.additives_tags as string[]).map((a) => a.replace(/^[a-z]{2}:/, '')) : [],
    img: typeof p.image_front_small_url === 'string' ? p.image_front_small_url : undefined,
    source: 'off',
  };
}

const OFF = 'https://world.openfoodfacts.org/api/v2/product';
const FIELDS = 'product_name,product_name_pt,generic_name,brands,nutriments,serving_quantity,serving_size,nutriscore_grade,nova_group,allergens_tags,additives_tags,image_front_small_url';

/** Procura o produto (primeiro nos já lidos neste telemóvel). */
export async function findProduct(code: string, S: Pick<AppState, 'scanned'>): Promise<ScannedFood | null> {
  const known = S.scanned?.[code];
  if (known) return known;
  let res: Response;
  try {
    res = await fetch(`${OFF}/${encodeURIComponent(code)}.json?fields=${FIELDS}`);
  } catch {
    throw new Error('Sem ligação à internet. Tente outra vez.');
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('A base de produtos não respondeu. Tente daqui a pouco.');
  return parseOff(code, await res.json().catch(() => null));
}

export const validCode = (c: string) => /^\d{8,14}$/.test(c);

/** Entrada do diário com os valores do rótulo. */
export function scannedEntry(food: ScannedFood, grams: number): FoodEntry {
  const k = grams / 100;
  const r1 = (n: number) => Math.round(n * k * 10) / 10;
  return {
    id: `cb-${food.code}-${Date.now().toString(36)}`,
    name: food.brand ? `${food.name} · ${food.brand}` : food.name,
    grams: Math.round(grams),
    kcal: Math.round(food.kcal * k),
    p: r1(food.p),
    c: r1(food.c),
    f: r1(food.f),
    barcode: food.code,
  };
}

/** Guarda o produto lido (até 80), para a próxima vez não precisar da câmara nem de rede. */
export function rememberScanned(S: AppState, food: ScannedFood) {
  const all = { ...(S.scanned ?? {}), [food.code]: { ...food, at: new Date().toISOString() } as ScannedFood & { at: string } };
  const keep = Object.entries(all)
    .sort((a, b) => String((b[1] as { at?: string }).at ?? '').localeCompare(String((a[1] as { at?: string }).at ?? '')))
    .slice(0, 80);
  S.scanned = Object.fromEntries(keep);
}

/** Avisos para a pessoa: fenilcetonúria + aspartame, alergénios comuns, ultraprocessado, açúcar e sal. */
export function productNotes(food: ScannedFood, S: Pick<AppState, 'ans'>) {
  const notes: { text: string; level: 'alto' | 'medio' | 'info' }[] = [];
  const safe = S.ans?.safe ?? [];
  if (safe.includes('pku') && (food.additives ?? []).some((a) => /e951|e962/.test(a)))
    notes.push({ text: 'Tem aspartame (fonte de fenilalanina): atenção com a fenilcetonúria.', level: 'alto' });
  const al = (food.allergens ?? []).filter((a) => /gluten|milk|eggs|nuts|peanuts|soybeans|fish|crustaceans|sesame/.test(a));
  if (al.length) {
    const pt: Record<string, string> = { gluten: 'glúten', milk: 'leite', eggs: 'ovo', nuts: 'frutos de casca rija', peanuts: 'amendoim', soybeans: 'soja', fish: 'peixe', crustaceans: 'crustáceos', sesame: 'sésamo' };
    notes.push({ text: `Alergénios: ${al.map((a) => pt[a] ?? a).join(', ')}.`, level: 'medio' });
  }
  if (food.nova === 4) notes.push({ text: 'Ultraprocessado (NOVA 4): bom para de vez em quando; no dia a dia, prefira opções simples.', level: 'info' });
  if ((food.sugar ?? 0) >= 22.5) notes.push({ text: `Muito açúcar: ${String(food.sugar).replace('.', ',')} g por 100 g.`, level: 'info' });
  if ((food.salt ?? 0) >= 1.5) notes.push({ text: `Muito sal: ${String(food.salt).replace('.', ',')} g por 100 g.`, level: 'info' });
  return notes;
}
