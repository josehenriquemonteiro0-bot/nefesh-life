/**
 * Base de alimentos para o diário nutricional.
 *
 * Valores médios aproximados por 100 g, com base em tabelas de composição de
 * alimentos (INSA, USDA). Variam com a marca, a receita e a confeção:
 * devem ser revistos por um(a) nutricionista antes do lançamento.
 */

export type FoodCat = 'Pequeno-almoço' | 'Cereais e féculas' | 'Proteínas' | 'Leguminosas' | 'Lacticínios' | 'Fruta' | 'Legumes' | 'Gorduras e frutos secos' | 'Bebidas' | 'Snacks e doces' | 'Pratos' | 'NEFESH';

export interface Food {
  id: string;
  name: string;
  cat: FoodCat;
  /** por 100 g: kcal, proteína, hidratos, gordura (g) */
  kcal: number;
  p: number;
  c: number;
  f: number;
  /** porção habitual */
  portion: string;
  grams: number;
}

type Row = [string, string, FoodCat, number, number, number, number, string, number];

const ROWS: Row[] = [
  // NEFESH (rótulo)
  ['spirulina_po', 'Spirulina NEFESH em pó', 'NEFESH', 357, 64, 8.8, 6, 'Colher de chá (3 g)', 3],
  ['spirulina_nibs', 'Spirulina NEFESH em palhinha (Nibs)', 'NEFESH', 357, 64, 8.8, 6, 'Colher de chá (3 g)', 3],
  ['spirulina_caps', 'Spirulina NEFESH cápsulas', 'NEFESH', 357, 64, 8.8, 6, 'Cápsula (0,5 g)', 0.5],
  // Pequeno-almoço
  ['pao_trigo', 'Pão de trigo', 'Pequeno-almoço', 265, 9, 49, 3.2, 'Pão (50 g)', 50],
  ['pao_integral', 'Pão integral', 'Pequeno-almoço', 247, 13, 41, 3.4, 'Fatia (40 g)', 40],
  ['pao_forma', 'Pão de forma', 'Pequeno-almoço', 265, 8, 49, 3.5, 'Fatia (30 g)', 30],
  ['aveia', 'Flocos de aveia', 'Pequeno-almoço', 379, 13, 67, 6.5, 'Porção (40 g)', 40],
  ['granola', 'Granola', 'Pequeno-almoço', 471, 10, 64, 20, 'Porção (40 g)', 40],
  ['cereais_milho', 'Cereais de milho', 'Pequeno-almoço', 357, 7.5, 84, 0.4, 'Taça (30 g)', 30],
  ['croissant', 'Croissant', 'Pequeno-almoço', 406, 8, 46, 21, 'Unidade (60 g)', 60],
  ['pao_queijo', 'Pão de queijo', 'Pequeno-almoço', 300, 6, 35, 15, 'Unidade (25 g)', 25],
  ['tapioca', 'Tapioca (goma hidratada)', 'Pequeno-almoço', 240, 0, 60, 0, 'Unidade (60 g)', 60],
  ['mel', 'Mel', 'Pequeno-almoço', 304, 0.3, 82, 0, 'Colher de chá (7 g)', 7],
  ['doce_fruta', 'Doce de fruta', 'Pequeno-almoço', 250, 0.4, 62, 0.1, 'Colher de chá (10 g)', 10],
  // Cereais e féculas
  ['arroz_branco', 'Arroz branco cozido', 'Cereais e féculas', 130, 2.7, 28, 0.3, 'Prato (150 g)', 150],
  ['arroz_integral', 'Arroz integral cozido', 'Cereais e féculas', 123, 2.7, 26, 1, 'Prato (150 g)', 150],
  ['massa', 'Massa cozida', 'Cereais e féculas', 158, 5.8, 31, 0.9, 'Prato (180 g)', 180],
  ['massa_integral', 'Massa integral cozida', 'Cereais e féculas', 149, 6, 30, 1.7, 'Prato (180 g)', 180],
  ['batata_cozida', 'Batata cozida', 'Cereais e féculas', 86, 1.7, 20, 0.1, 'Média (150 g)', 150],
  ['batata_frita', 'Batata frita', 'Cereais e féculas', 312, 3.4, 41, 15, 'Dose (120 g)', 120],
  ['batata_doce', 'Batata-doce assada', 'Cereais e féculas', 90, 2, 21, 0.2, 'Média (150 g)', 150],
  ['quinoa', 'Quinoa cozida', 'Cereais e féculas', 120, 4.4, 21, 1.9, 'Porção (150 g)', 150],
  ['cuscuz', 'Cuscuz cozido', 'Cereais e féculas', 112, 3.8, 23, 0.2, 'Porção (150 g)', 150],
  ['farofa', 'Farofa', 'Cereais e féculas', 400, 2, 70, 12, 'Colher de sopa (15 g)', 15],
  // Proteínas
  ['frango_peito', 'Peito de frango grelhado', 'Proteínas', 165, 31, 0, 3.6, 'Bife (120 g)', 120],
  ['frango_coxa', 'Coxa de frango assada', 'Proteínas', 209, 26, 0, 11, 'Coxa (100 g)', 100],
  ['peru', 'Peito de peru grelhado', 'Proteínas', 135, 30, 0, 1, 'Bife (120 g)', 120],
  ['vaca_bife', 'Bife de vaca grelhado', 'Proteínas', 217, 26, 0, 12, 'Bife (120 g)', 120],
  ['vaca_picada', 'Carne picada de vaca cozinhada', 'Proteínas', 250, 26, 0, 15, 'Porção (100 g)', 100],
  ['porco_lombo', 'Lombo de porco grelhado', 'Proteínas', 200, 28, 0, 9, 'Bife (120 g)', 120],
  ['salmao', 'Salmão grelhado', 'Proteínas', 206, 22, 0, 12, 'Posta (130 g)', 130],
  ['bacalhau', 'Bacalhau cozido', 'Proteínas', 105, 23, 0, 0.9, 'Posta (150 g)', 150],
  ['pescada', 'Pescada cozida', 'Proteínas', 92, 20, 0, 1, 'Posta (150 g)', 150],
  ['atum_natural', 'Atum ao natural (escorrido)', 'Proteínas', 116, 26, 0, 1, 'Lata (56 g)', 56],
  ['atum_oleo', 'Atum em óleo (escorrido)', 'Proteínas', 198, 29, 0, 8, 'Lata (56 g)', 56],
  ['sardinha', 'Sardinha grelhada', 'Proteínas', 208, 25, 0, 12, '3 sardinhas (120 g)', 120],
  ['camarao', 'Camarão cozido', 'Proteínas', 99, 24, 0.2, 0.3, 'Porção (100 g)', 100],
  ['ovo', 'Ovo cozido', 'Proteínas', 155, 13, 1.1, 11, '1 ovo (55 g)', 55],
  ['omelete', 'Omelete', 'Proteínas', 154, 11, 1, 12, '2 ovos (110 g)', 110],
  ['fiambre', 'Fiambre de peru', 'Proteínas', 110, 18, 2, 3, 'Fatia (20 g)', 20],
  ['presunto', 'Presunto', 'Proteínas', 250, 30, 0, 14, 'Fatia (15 g)', 15],
  ['tofu', 'Tofu', 'Proteínas', 120, 13, 2, 7, 'Porção (100 g)', 100],
  ['whey', 'Proteína whey (pó)', 'Proteínas', 400, 80, 8, 6, 'Dose (30 g)', 30],
  // Leguminosas
  ['feijao', 'Feijão cozido', 'Leguminosas', 132, 8.9, 24, 0.5, 'Concha (100 g)', 100],
  ['grao', 'Grão-de-bico cozido', 'Leguminosas', 164, 8.9, 27, 2.6, 'Porção (100 g)', 100],
  ['lentilhas', 'Lentilhas cozidas', 'Leguminosas', 116, 9, 20, 0.4, 'Porção (100 g)', 100],
  ['ervilhas', 'Ervilhas', 'Leguminosas', 81, 5.4, 14, 0.4, 'Porção (80 g)', 80],
  ['hummus', 'Húmus', 'Leguminosas', 166, 8, 14, 10, 'Colher de sopa (30 g)', 30],
  // Lacticínios
  ['leite_mg', 'Leite meio-gordo', 'Lacticínios', 47, 3.3, 4.8, 1.6, 'Copo (250 ml)', 250],
  ['leite_magro', 'Leite magro', 'Lacticínios', 35, 3.4, 5, 0.1, 'Copo (250 ml)', 250],
  ['bebida_aveia', 'Bebida de aveia', 'Lacticínios', 46, 1, 6.7, 1.5, 'Copo (250 ml)', 250],
  ['bebida_soja', 'Bebida de soja', 'Lacticínios', 39, 3.3, 2.5, 1.8, 'Copo (250 ml)', 250],
  ['iogurte', 'Iogurte natural', 'Lacticínios', 61, 3.5, 4.7, 3.3, 'Unidade (125 g)', 125],
  ['skyr', 'Skyr natural', 'Lacticínios', 63, 11, 4, 0.2, 'Unidade (150 g)', 150],
  ['iogurte_grego', 'Iogurte grego natural', 'Lacticínios', 133, 5, 4, 10, 'Unidade (125 g)', 125],
  ['queijo_fresco', 'Queijo fresco', 'Lacticínios', 140, 11, 3, 9, 'Fatia (40 g)', 40],
  ['queijo_flamengo', 'Queijo flamengo', 'Lacticínios', 350, 25, 0.5, 27, 'Fatia (20 g)', 20],
  ['mozzarella', 'Mozzarella', 'Lacticínios', 254, 18, 2, 19, 'Porção (30 g)', 30],
  // Fruta
  ['banana', 'Banana', 'Fruta', 89, 1.1, 23, 0.3, 'Média (120 g)', 120],
  ['maca', 'Maçã', 'Fruta', 52, 0.3, 14, 0.2, 'Média (150 g)', 150],
  ['pera', 'Pera', 'Fruta', 57, 0.4, 15, 0.1, 'Média (150 g)', 150],
  ['laranja', 'Laranja', 'Fruta', 47, 0.9, 12, 0.1, 'Média (150 g)', 150],
  ['morangos', 'Morangos', 'Fruta', 32, 0.7, 7.7, 0.3, 'Taça (150 g)', 150],
  ['frutos_vermelhos', 'Frutos vermelhos', 'Fruta', 45, 1, 10, 0.4, 'Taça (125 g)', 125],
  ['uvas', 'Uvas', 'Fruta', 69, 0.7, 18, 0.2, 'Cacho pequeno (100 g)', 100],
  ['kiwi', 'Kiwi', 'Fruta', 61, 1.1, 15, 0.5, 'Unidade (75 g)', 75],
  ['manga', 'Manga', 'Fruta', 60, 0.8, 15, 0.4, 'Meia manga (150 g)', 150],
  ['ananas', 'Ananás', 'Fruta', 50, 0.5, 13, 0.1, 'Rodela (100 g)', 100],
  ['abacate', 'Abacate', 'Fruta', 160, 2, 9, 15, 'Meio abacate (70 g)', 70],
  ['melancia', 'Melancia', 'Fruta', 30, 0.6, 8, 0.2, 'Fatia (250 g)', 250],
  ['papaia', 'Papaia (mamão)', 'Fruta', 43, 0.5, 11, 0.3, 'Fatia (150 g)', 150],
  ['tamaras', 'Tâmaras', 'Fruta', 282, 2.5, 75, 0.4, 'Unidade (8 g)', 8],
  // Legumes
  ['sopa_legumes', 'Sopa de legumes', 'Legumes', 40, 1.5, 6, 1.2, 'Prato (300 g)', 300],
  ['salada', 'Salada mista', 'Legumes', 20, 1.2, 3.5, 0.2, 'Prato (100 g)', 100],
  ['brocolos', 'Brócolos cozidos', 'Legumes', 35, 2.4, 7, 0.4, 'Porção (100 g)', 100],
  ['espinafres', 'Espinafres', 'Legumes', 23, 2.9, 3.6, 0.4, 'Porção (100 g)', 100],
  ['cenoura', 'Cenoura', 'Legumes', 41, 0.9, 10, 0.2, 'Média (60 g)', 60],
  ['tomate', 'Tomate', 'Legumes', 18, 0.9, 3.9, 0.2, 'Médio (120 g)', 120],
  ['legumes_salteados', 'Legumes salteados', 'Legumes', 60, 2, 7, 3, 'Porção (150 g)', 150],
  // Gorduras e frutos secos
  ['azeite', 'Azeite', 'Gorduras e frutos secos', 884, 0, 0, 100, 'Colher de sopa (13 g)', 13],
  ['manteiga', 'Manteiga', 'Gorduras e frutos secos', 717, 0.9, 0.1, 81, 'Porção (10 g)', 10],
  ['manteiga_amendoim', 'Manteiga de amendoim', 'Gorduras e frutos secos', 588, 25, 20, 50, 'Colher de sopa (15 g)', 15],
  ['amendoas', 'Amêndoas', 'Gorduras e frutos secos', 579, 21, 22, 50, 'Mão-cheia (25 g)', 25],
  ['nozes', 'Nozes', 'Gorduras e frutos secos', 654, 15, 14, 65, 'Mão-cheia (25 g)', 25],
  ['cajus', 'Cajus', 'Gorduras e frutos secos', 553, 18, 30, 44, 'Mão-cheia (25 g)', 25],
  ['chia', 'Sementes de chia', 'Gorduras e frutos secos', 486, 17, 42, 31, 'Colher de sopa (12 g)', 12],
  // Bebidas
  ['cafe', 'Café expresso', 'Bebidas', 9, 0.1, 1.7, 0.2, 'Chávena (30 ml)', 30],
  ['galao', 'Galão', 'Bebidas', 40, 2.8, 4, 1.4, 'Copo (250 ml)', 250],
  ['sumo_laranja', 'Sumo de laranja natural', 'Bebidas', 45, 0.7, 10, 0.2, 'Copo (200 ml)', 200],
  ['refrigerante', 'Refrigerante', 'Bebidas', 42, 0, 10.6, 0, 'Lata (330 ml)', 330],
  ['cerveja', 'Cerveja', 'Bebidas', 43, 0.5, 3.6, 0, 'Imperial (200 ml)', 200],
  ['vinho', 'Vinho tinto', 'Bebidas', 85, 0.1, 2.6, 0, 'Copo (150 ml)', 150],
  // Snacks e doces
  ['pastel_nata', 'Pastel de nata', 'Snacks e doces', 330, 5, 40, 16, 'Unidade (60 g)', 60],
  ['bolacha_maria', 'Bolacha Maria', 'Snacks e doces', 440, 7, 75, 12, '4 bolachas (24 g)', 24],
  ['chocolate_negro', 'Chocolate negro 70%', 'Snacks e doces', 598, 7.8, 46, 43, '2 quadrados (20 g)', 20],
  ['barra_cereais', 'Barra de cereais', 'Snacks e doces', 400, 6, 68, 12, 'Unidade (25 g)', 25],
  // Pratos
  ['pizza', 'Pizza', 'Pratos', 266, 11, 33, 10, 'Fatia (110 g)', 110],
  ['hamburguer', 'Hambúrguer no pão', 'Pratos', 250, 13, 25, 11, 'Unidade (200 g)', 200],
  ['lasanha', 'Lasanha', 'Pratos', 160, 9, 14, 7.5, 'Dose (300 g)', 300],
  ['bitoque', 'Bitoque (bife, ovo, batata, arroz)', 'Pratos', 190, 11, 15, 10, 'Prato (450 g)', 450],
  ['feijoada', 'Feijoada', 'Pratos', 150, 9, 11, 8, 'Prato (350 g)', 350],
  ['sushi', 'Sushi (peças variadas)', 'Pratos', 150, 6, 28, 2, '8 peças (200 g)', 200],
];

export const FOODS: Food[] = ROWS.map(([id, name, cat, kcal, p, c, f, portion, grams]) => ({ id, name, cat, kcal, p, c, f, portion, grams }));
export const foodById = (id: string) => FOODS.find((x) => x.id === id);

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Pesquisa sem acentos; os nomes que começam pela pesquisa aparecem primeiro. */
export function searchFoods(q: string, limit = 40): Food[] {
  const t = norm(q.trim());
  if (!t) return FOODS.slice(0, limit);
  const words = t.split(/\s+/);
  return FOODS.filter((x) => {
    const n = norm(x.name + ' ' + x.cat);
    return words.every((w) => n.includes(w));
  })
    .sort((a, b) => Number(norm(b.name).startsWith(t)) - Number(norm(a.name).startsWith(t)))
    .slice(0, limit);
}

export type MealKey = 'pa' | 'almoco' | 'lanche' | 'jantar';
export const MEALS: [MealKey, string][] = [
  ['pa', 'Pequeno-almoço'],
  ['almoco', 'Almoço'],
  ['lanche', 'Lanche'],
  ['jantar', 'Jantar'],
];

export interface FoodEntry {
  id: string;
  /** refeição do plano do nutricionista que originou esta entrada (para desfazer) */
  planRef?: string;
  /** entrada automática (ex.: toma de Spirulina), para a retirar ao desmarcar */
  auto?: string;
  /** registada pelo AI Coach (pode ser substituída numa correção) */
  coach?: boolean;
  /** valores estimados (alimento fora da tabela) */
  est?: boolean;
  foodId?: string;
  name: string;
  grams: number;
  kcal: number;
  p: number;
  c: number;
  f: number;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Cria uma entrada no diário a partir de um alimento e da quantidade em gramas. */
export function entryOf(food: Food, grams: number): FoodEntry {
  const k = grams / 100;
  return {
    id: `${food.id}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    foodId: food.id,
    name: food.name,
    grams,
    kcal: Math.round(food.kcal * k),
    p: r1(food.p * k),
    c: r1(food.c * k),
    f: r1(food.f * k),
  };
}

export function totals(entries: FoodEntry[]) {
  return entries.reduce((t, e) => ({ kcal: t.kcal + e.kcal, p: r1(t.p + e.p), c: r1(t.c + e.c), f: r1(t.f + e.f) }), { kcal: 0, p: 0, c: 0, f: 0 });
}

/**
 * Correção manual de uma entrada do diário: mudar a quantidade reescala as calorias e os
 * macros; escrever as calorias (ex.: do rótulo) passa a valer o valor escrito e deixa de
 * ser estimativa.
 */
export function editEntry(e: FoodEntry, change: { grams?: number; kcal?: number }): FoodEntry {
  let out: FoodEntry = { ...e };
  if (change.grams !== undefined && change.grams > 0 && change.grams !== e.grams) {
    const g = Math.round(change.grams);
    if (e.grams > 0) {
      const k = g / e.grams;
      out = { ...out, grams: g, kcal: Math.round(e.kcal * k), p: r1(e.p * k), c: r1(e.c * k), f: r1(e.f * k) };
    } else out = { ...out, grams: g };
  }
  if (change.kcal !== undefined && change.kcal >= 0 && Math.round(change.kcal) !== out.kcal) {
    const kcal = Math.round(change.kcal);
    // os macros acompanham a proporção das calorias
    const k = out.kcal > 0 ? kcal / out.kcal : 0;
    out = { ...out, kcal, p: r1(out.p * k), c: r1(out.c * k), f: r1(out.f * k) };
    delete out.est;
  }
  return out;
}

