import type { Goal } from './types';

export interface Recipe {
  id: string;
  title: string;
  kind: 'Smoothie' | 'Bebida' | 'Pequeno-almoço' | 'Refeição' | 'Snack';
  form: 'pó' | 'Nibs' | 'pó + Nibs';
  /** gramas de Spirulina por porção */
  grams: number;
  serves: string;
  minutes: number;
  ingredients: string[];
  steps: string[];
  tip?: string;
  goals: Goal[];
  /** duas cores para o cartão */
  hue: [string, string];
}

export const RECIPES: Recipe[] = [
  {
    id: 'verde-tropical',
    title: 'Smoothie verde tropical',
    kind: 'Smoothie',
    form: 'pó',
    grams: 3,
    serves: '1 copo grande',
    minutes: 5,
    ingredients: ['3 g de Spirulina em pó (1 colher de chá rasa)', '1 banana congelada', '150 g de ananás', '1 punhado de espinafres', '200 ml de água de coco', 'Sumo de ½ lima'],
    steps: ['Coloque tudo no liquidificador, com a Spirulina no fim.', 'Triture 40 a 60 segundos até ficar cremoso.', 'Beba logo, para aproveitar a cor e o sabor.'],
    tip: 'O ananás e a lima disfarçam o sabor a mar da Spirulina. A vitamina C dos citrinos também ajuda a absorver o ferro de origem vegetal.',
    goals: ['energia', 'imunidade', 'foco'],
    hue: ['#0b5560', '#2fa36b'],
  },
  {
    id: 'cacau-banana',
    title: 'Smoothie de cacau e banana pós-treino',
    kind: 'Smoothie',
    form: 'pó',
    grams: 3,
    serves: '1 copo grande',
    minutes: 5,
    ingredients: ['3 g de Spirulina em pó', '1 banana madura', '250 ml de bebida de aveia ou leite', '1 colher de sopa de cacau cru', '1 colher de sopa de manteiga de amendoim', '2 tâmaras sem caroço', 'Gelo a gosto'],
    steps: ['Triture tudo até ficar homogéneo.', 'Tome nos 60 minutos a seguir ao treino.'],
    tip: 'O cacau esconde quase por completo a cor verde. É uma boa porta de entrada para quem estranha o sabor.',
    goals: ['desporto', 'energia'],
    hue: ['#3b2a1d', '#0b5560'],
  },
  {
    id: 'manga-gengibre',
    title: 'Smoothie de manga e gengibre',
    kind: 'Smoothie',
    form: 'pó',
    grams: 2,
    serves: '1 copo',
    minutes: 5,
    ingredients: ['2 g de Spirulina em pó', '150 g de manga (pode ser congelada)', '125 g de iogurte natural ou vegetal', '1 cm de gengibre fresco', '100 ml de água fria', 'Sumo de ½ lima'],
    steps: ['Descasque o gengibre e triture tudo junto.', 'Ajuste a espessura com mais água, se precisar.'],
    goals: ['imunidade', 'foco', 'peso'],
    hue: ['#b8862f', '#2fa36b'],
  },
  {
    id: 'limonada',
    title: 'Limonada verde de hortelã',
    kind: 'Bebida',
    form: 'pó',
    grams: 1,
    serves: '500 ml',
    minutes: 3,
    ingredients: ['1 g de Spirulina em pó (⅓ de colher de chá)', '500 ml de água fria', 'Sumo de 1 limão', '6 folhas de hortelã', '1 colher de chá de mel ou xarope de agave (opcional)'],
    steps: ['Dissolva a Spirulina num pouco de água, mexendo bem.', 'Junte o resto e agite numa garrafa.', 'Leve consigo e beba ao longo da manhã.'],
    tip: 'Uma forma de juntar Spirulina à meta de água do dia.',
    goals: ['energia', 'peso', 'desporto'],
    hue: ['#1f7fa6', '#2fa36b'],
  },
  {
    id: 'bowl-frutos-vermelhos',
    title: 'Smoothie bowl de frutos vermelhos com Nibs',
    kind: 'Pequeno-almoço',
    form: 'pó + Nibs',
    grams: 4,
    serves: '1 taça',
    minutes: 8,
    ingredients: ['2 g de Spirulina em pó, para a base', '2 g de Spirulina Nibs, por cima', '150 g de frutos vermelhos congelados', '1 banana congelada', '80 ml de bebida vegetal', 'Por cima: granola, sementes de abóbora, coco ralado'],
    steps: ['Triture a fruta, a bebida e o pó até ficar espesso, como um gelado.', 'Passe para uma taça e junte os toppings.', 'Espalhe os Nibs por cima no fim, para ficarem crocantes.'],
    goals: ['energia', 'nutricao', 'imunidade'],
    hue: ['#7a2047', '#0b5560'],
  },
  {
    id: 'overnight-oats',
    title: 'Papas de aveia de véspera com Nibs',
    kind: 'Pequeno-almoço',
    form: 'Nibs',
    grams: 3,
    serves: '1 frasco',
    minutes: 5,
    ingredients: ['40 g de flocos de aveia', '120 ml de bebida vegetal', '1 colher de sopa de sementes de chia', '½ maçã ralada ou fruta a gosto', 'Canela', '3 g de Spirulina Nibs, só de manhã'],
    steps: ['À noite, misture a aveia, a bebida, a chia, a fruta e a canela num frasco.', 'Deixe no frigorífico durante a noite.', 'De manhã, junte os Nibs por cima e coma.'],
    tip: 'Junte os Nibs na hora, para manterem a textura.',
    goals: ['energia', 'peso', 'nutricao'],
    hue: ['#8a7034', '#2fa36b'],
  },
  {
    id: 'salada-quinoa',
    title: 'Salada de quinoa, abacate e Nibs',
    kind: 'Refeição',
    form: 'Nibs',
    grams: 3,
    serves: '1 prato',
    minutes: 15,
    ingredients: ['120 g de quinoa cozida e fria', '½ abacate', '8 tomates-cereja', '½ pepino', 'Grão-de-bico cozido (opcional)', 'Sumo de limão, azeite e sal', '3 g de Spirulina Nibs'],
    steps: ['Corte os vegetais e junte à quinoa fria.', 'Tempere com limão, azeite e sal.', 'Espalhe os Nibs no fim.'],
    tip: 'Não junte Spirulina a pratos quentes: acima de cerca de 40 °C a ficocianina degrada-se. Adicione-a sempre depois de cozinhar.',
    goals: ['nutricao', 'peso', 'desporto'],
    hue: ['#4a6b2a', '#0b5560'],
  },
  {
    id: 'guacamole',
    title: 'Guacamole verde intenso',
    kind: 'Snack',
    form: 'pó',
    grams: 1,
    serves: '4 porções',
    minutes: 10,
    ingredients: ['4 g de Spirulina em pó (1 g por porção)', '2 abacates maduros', 'Sumo de 1 lima', '¼ de cebola roxa picada', 'Coentros frescos', 'Sal e malagueta a gosto'],
    steps: ['Esmague os abacates com o sumo de lima.', 'Junte o resto e misture bem.', 'Sirva com palitos de cenoura e pepino.'],
    goals: ['nutricao', 'peso'],
    hue: ['#2f6b2a', '#2fa36b'],
  },
  {
    id: 'bolinhas',
    title: 'Bolinhas energéticas de tâmara',
    kind: 'Snack',
    form: 'pó',
    grams: 1,
    serves: '12 bolinhas (2 por porção)',
    minutes: 15,
    ingredients: ['6 g de Spirulina em pó (0,5 g por bolinha)', '150 g de tâmaras sem caroço', '80 g de amêndoas ou cajus', '2 colheres de sopa de cacau', '1 colher de sopa de óleo de coco', 'Coco ralado para envolver'],
    steps: ['Triture as tâmaras com os frutos secos até formar uma pasta.', 'Junte o cacau, o óleo de coco e a Spirulina.', 'Faça 12 bolinhas, passe-as por coco ralado e guarde no frigorífico até 7 dias.'],
    tip: 'Cada bolinha tem 0,5 g, o mesmo que uma cápsula. Um snack fácil para levar para o trabalho ou para o treino.',
    goals: ['desporto', 'energia', 'foco'],
    hue: ['#5a3a20', '#2fa36b'],
  },
  {
    id: 'tosta-abacate',
    title: 'Tosta de abacate com Nibs',
    kind: 'Pequeno-almoço',
    form: 'Nibs',
    grams: 2,
    serves: '1 tosta',
    minutes: 5,
    ingredients: ['1 fatia de pão de fermentação lenta', '½ abacate', 'Sumo de limão, sal e pimenta', 'Sementes de sésamo', '2 g de Spirulina Nibs'],
    steps: ['Torre o pão e deixe arrefecer 1 minuto.', 'Esmague o abacate com limão, sal e pimenta e barre o pão.', 'Termine com sésamo e Nibs.'],
    goals: ['energia', 'foco', 'nutricao'],
    hue: ['#3d5a28', '#8a7034'],
  },
];

export const GOLDEN_RULES = [
  { t: 'Nunca aquecer', d: 'Junte a Spirulina depois de cozinhar. Acima de cerca de 40 °C a ficocianina, o pigmento azul, degrada-se.' },
  { t: 'Começar com pouco', d: 'O sabor é intenso. Comece com 1 g e vá subindo até à sua dose.' },
  { t: 'Citrinos são aliados', d: 'Limão, lima e ananás disfarçam o sabor e a vitamina C ajuda a absorver o ferro.' },
  { t: 'Nibs no fim', d: 'Junte os Nibs no último momento, para ficarem crocantes.' },
  { t: 'Guardar bem', d: 'Embalagem fechada, ao abrigo da luz e do calor. O pó absorve humidade.' },
];

/** Receita do dia, rodando por todas, com preferência pelo objetivo da pessoa. */
export function recipeOfDay(goal: Goal | undefined, dayIndex: number) {
  const pool = goal ? RECIPES.filter((r) => r.goals.includes(goal)) : RECIPES;
  const list = pool.length ? pool : RECIPES;
  return list[((dayIndex % list.length) + list.length) % list.length];
}
