import type { AreaKey, Goal, HabitKey, Question } from './types';
import type { IconName } from '../components/Icon';

export const STORAGE_KEY = 'nefesh-life-v2';
export const SHOP_URL = 'https://www.nefeshglobal.shop';
export const CAPS_PER_BOTTLE = 120;
export const CAPSULE_MG = 500;
export const STEP_GOAL = 8000;
export const GLASS_ML = 250;

export const GOALS: [Goal, string][] = [
  ['energia', 'Mais energia e vitalidade'],
  ['desporto', 'Desempenho e recuperação no treino'],
  ['imunidade', 'Reforçar as defesas'],
  ['foco', 'Foco e clareza mental'],
  ['nutricao', 'Completar uma alimentação vegetal'],
  ['peso', 'Saciedade e controlo de peso'],
];

export const GOAL_LABEL: Record<Goal, string> = {
  energia: 'Energia e vitalidade',
  desporto: 'Desempenho no treino',
  imunidade: 'Defesas',
  foco: 'Foco mental',
  nutricao: 'Alimentação vegetal',
  peso: 'Saciedade e peso',
};

export const QUESTIONS: Question[] = [
  { id: 'name', t: 'Como gosta de ser tratado(a)?', kind: 'text', placeholder: 'O seu primeiro nome' },
  { id: 'goal', t: 'Qual é o seu objetivo principal?', kind: 'options', o: GOALS },
  { id: 'sexo', t: 'Sexo', kind: 'options', o: [['f', 'Feminino'], ['m', 'Masculino']] },
  { id: 'idade', t: 'Qual é a sua idade?', kind: 'options', o: [['18-29', '18 a 29 anos'], ['30-44', '30 a 44 anos'], ['45-59', '45 a 59 anos'], ['60+', '60 anos ou mais']] },
  { id: 'peso', t: 'Qual é o seu peso?', kind: 'num', min: 40, max: 150, def: 70, unit: 'kg' },
  { id: 'ativ', t: 'Quantas vezes treina por semana?', kind: 'options', o: [['0', 'Raramente'], ['1-2', '1 a 2 vezes'], ['3-4', '3 a 4 vezes'], ['5+', '5 ou mais']] },
  { id: 'sonoh', t: 'Quantas horas dorme, em média?', kind: 'options', o: [['<5', 'Menos de 5 horas'], ['5-6', '5 a 6 horas'], ['7-8', '7 a 8 horas'], ['>8', 'Mais de 8 horas']] },
  { id: 'sonoq', t: 'Como avalia a qualidade do seu sono?', kind: 'scale', labels: ['Muito má', 'Excelente'] },
  { id: 'energia', t: 'Como está a sua energia ao longo do dia?', kind: 'scale', labels: ['Muito baixa', 'Excelente'] },
  { id: 'stress', t: 'Qual é o seu nível de stress?', kind: 'scale', labels: ['Muito baixo', 'Muito alto'] },
  { id: 'agua', t: 'Quantos copos de água bebe por dia?', kind: 'options', o: [['<4', 'Menos de 4'], ['4-6', '4 a 6'], ['7-9', '7 a 9'], ['10+', '10 ou mais']] },
  { id: 'cafe', t: 'Quantos cafés ou bebidas com cafeína por dia?', kind: 'options', o: [['0', 'Nenhum'], ['1-2', '1 a 2'], ['3+', '3 ou mais']] },
  { id: 'veg', t: 'Quantas porções de fruta e vegetais come por dia?', kind: 'options', o: [['0-1', '0 a 1'], ['2-3', '2 a 3'], ['4+', '4 ou mais']] },
  { id: 'proc', t: 'Com que frequência come ultraprocessados?', kind: 'options', o: [['raro', 'Raramente'], ['as-vezes', 'Algumas vezes por semana'], ['diario', 'Quase todos os dias']] },
  { id: 'dieta', t: 'Como descreve a sua alimentação?', kind: 'options', o: [['omni', 'Como de tudo'], ['veg', 'Vegetariana'], ['vegan', 'Vegana']] },
  { id: 'prior', t: 'Já tomou Spirulina antes?', kind: 'options', o: [['nunca', 'Nunca'], ['as-vezes', 'Às vezes'], ['regular', 'Tomo com regularidade']] },
  {
    id: 'safe',
    t: 'Alguma destas situações se aplica a si?',
    kind: 'options',
    multi: true,
    o: [
      ['pku', 'Fenilcetonúria'],
      ['auto', 'Doença autoimune'],
      ['antico', 'Toma anticoagulantes ou imunossupressores'],
      ['gravidez', 'Gravidez ou amamentação'],
      ['renal', 'Doença renal ou gota'],
      ['nenhuma', 'Nenhuma destas'],
    ],
  },
];

export const AREAS: [AreaKey, string][] = [
  ['energia', 'Energia'],
  ['sono', 'Sono'],
  ['nutricao', 'Nutrição'],
  ['hidratacao', 'Hidratação'],
  ['movimento', 'Movimento'],
];

export const REFS: Record<Goal, string> = {
  desporto: 'Kalafati et al., 2010 (Med Sci Sports Exerc): 6 g/dia durante 4 semanas em homens treinados.',
  energia: 'Johnson et al., 2016 (Nutrition and Health): 3 g/dia e perceção de fadiga.',
  imunidade: 'Selmi et al., 2011 (Cell Mol Immunol): suplementação de 12 semanas em adultos seniores.',
  foco: 'Johnson et al., 2016 (Nutrition and Health): 3 g/dia e fadiga mental.',
  nutricao: 'Revisões sobre a composição nutricional da Spirulina: proteína, ferro e vitaminas do complexo B.',
  peso: 'Meta-análises recentes sobre peso e perfil lipídico, com doses de 1 a 10 g/dia.',
};

export const EXPECT: Record<Goal, string> = {
  energia: 'Use o check-in diário para acompanhar a energia e a disposição semana a semana.',
  desporto: 'Registe os treinos no check-in para ver a dose ao lado da sua recuperação.',
  imunidade: 'O foco está na regularidade: a Spirulina entra na rotina como parte de uma alimentação equilibrada.',
  foco: 'Acompanhe a disposição e o sono: são os dois indicadores mais ligados à clareza mental.',
  nutricao: 'A Spirulina junta proteína vegetal e micronutrientes a uma alimentação à base de plantas.',
  peso: 'Tomada antes das refeições, entra num plano com alimentação e movimento, não em substituição.',
};

export const TIPS = [
  'A cor verde-azulada da Spirulina vem da ficocianina, um pigmento com ação antioxidante.',
  'A Spirulina NEFESH é seca abaixo de 40 °C para preservar os compostos sensíveis ao calor.',
  'Ligue a dose a algo que já faz todos os dias, como o pequeno-almoço. É assim que um hábito se fixa.',
  'Cada frasco NEFESH tem um QR code com os laudos de análise do lote.',
  'A nossa Spirulina é cultivada em Tomar, em tanques com controlo de temperatura, pH e luz.',
  'Beber água ao longo do dia, e não toda de uma vez, ajuda a manter a hidratação estável.',
  'Dormir 7 a 9 horas é o hábito com mais impacto na energia do dia seguinte.',
  'Cerca de 60 a 70% do peso seco da Spirulina é proteína.',
];

export const ADVICE: Record<AreaKey, string> = {
  energia: 'Mantenha a dose diária e registe a energia no check-in.',
  sono: 'Procure 7 a 8 horas de sono e um horário regular para deitar.',
  nutricao: 'Junte uma porção de vegetais a cada refeição principal.',
  hidratacao: 'Use o contador de água do ecrã Início.',
  movimento: 'Comece com 20 minutos de caminhada, 3 dias por semana.',
};

export interface Professional {
  i: string;
  n: string;
  a: string;
  m: string;
}

export const PROS: Professional[] = [
  { i: 'NU', n: 'Nutricionista', a: 'Plano alimentar e ajuste da dose ao seu caso', m: 'Online · Portugal e Brasil' },
  { i: 'MI', n: 'Médico(a) de medicina integrativa', a: 'Avaliação clínica e situações que pedem cautela', m: 'Lisboa · Online' },
  { i: 'PE', n: 'Profissional de exercício', a: 'Treino, recuperação e rotina de performance', m: 'Tomar · Online' },
  { i: 'PS', n: 'Psicólogo(a) de bem-estar', a: 'Stress, sono e mudança de hábitos', m: 'Online' },
];

export const HABITS: [HabitKey, string, IconName][] = [
  ['sono', 'Dormi 7h+', 'moon'],
  ['passos', '6 000 passos', 'steps'],
  ['resp', '5 min a respirar', 'wind'],
];

export const SLIDES: [IconName, string, string][] = [
  ['quiz', 'O seu Índice NEFESH', 'Uma avaliação de 2 minutos mede a sua energia, sono, nutrição, hidratação e movimento.'],
  ['bottle', 'Uma dose feita para si', 'Calculada a partir dos estudos, do seu objetivo e do seu corpo, e explicada passo a passo.'],
  ['flame', 'Um ritual que o acompanha', 'Lembretes, água, passos e check-in diário, com a sua evolução sempre à vista.'],
];

export const TRAINING = ['Não treinei', 'Leve', 'Moderado', 'Intenso'];
