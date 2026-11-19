import type { Goal } from './types';

/**
 * Base científica da NEFESH Life.
 *
 * IMPORTANTE: os dados abaixo foram compilados a partir da literatura e têm de
 * ser verificados pela equipa científica antes do lançamento. Os campos marcados
 * com `confirmar: true` têm detalhes (n, dose ou duração) que não estão confirmados.
 */

export type EvidenceLevel = 'moderada' | 'preliminar' | 'seguranca';

export const LEVELS: Record<EvidenceLevel, { label: string; text: string }> = {
  moderada: {
    label: 'Evidência moderada',
    text: 'Revisão sistemática ou meta-análise que junta vários ensaios clínicos. Resultados mais sólidos, mas os ensaios originais são pequenos.',
  },
  preliminar: {
    label: 'Evidência preliminar',
    text: 'Um estudo com poucos participantes ou sem grupo placebo. Indica uma direção, mas precisa de confirmação.',
  },
  seguranca: {
    label: 'Segurança',
    text: 'Avaliação da segurança e tolerância, não da eficácia.',
  },
};

export interface Study {
  id: string;
  cite: string;
  title: string;
  journal: string;
  design: string;
  population: string;
  dose: string;
  duration: string;
  result: string;
  level: EvidenceLevel;
  goals: Goal[];
  confirmar?: boolean;
}

export const STUDIES: Study[] = [
  {
    id: 'kalafati2010',
    cite: 'Kalafati et al., 2010',
    title: 'Ergogenic and antioxidant effects of spirulina supplementation in humans',
    journal: 'Medicine & Science in Sports & Exercise 42(1):142–151',
    design: 'Ensaio aleatorizado, duplamente cego, cruzado, com placebo',
    population: '9 homens moderadamente treinados',
    dose: '6 g/dia',
    duration: '4 semanas',
    result: 'Mais tempo até à exaustão numa corrida após 2 h de esforço, maior uso de gordura como energia e aumento da glutationa (antioxidante).',
    level: 'preliminar',
    goals: ['desporto'],
  },
  {
    id: 'johnson2016',
    cite: 'Johnson et al., 2016',
    title: 'A randomized, double blind, placebo controlled study of spirulina supplementation on indices of mental and physical fatigue in men',
    journal: 'International Journal of Food Sciences and Nutrition 67(2):203–206',
    design: 'Ensaio aleatorizado, duplamente cego, com placebo',
    population: 'Homens adultos saudáveis',
    dose: '3 g/dia',
    duration: 'a confirmar',
    result: 'Menor fadiga mental e física em testes de laboratório face ao placebo.',
    level: 'preliminar',
    goals: ['energia', 'foco'],
    confirmar: true,
  },
  {
    id: 'selmi2011',
    cite: 'Selmi et al., 2011',
    title: 'The effects of Spirulina on anemia and immune function in senior citizens',
    journal: 'Cellular & Molecular Immunology 8(3):248–254',
    design: 'Estudo de intervenção',
    population: '40 adultos com 50 ou mais anos',
    dose: 'a confirmar',
    duration: '12 semanas',
    result: 'Aumento da hemoglobina (sobretudo em mulheres) e alterações em marcadores do sistema imunitário.',
    level: 'preliminar',
    goals: ['imunidade'],
    confirmar: true,
  },
  {
    id: 'mazokopakis2014',
    cite: 'Mazokopakis et al., 2014',
    title: 'The hypolipidaemic effects of Spirulina (Arthrospira platensis) supplementation in a Cretan population: a prospective study',
    journal: 'Journal of the Science of Food and Agriculture 94(3):432–437',
    design: 'Estudo prospetivo, sem grupo placebo',
    population: '52 adultos com colesterol ou triglicéridos elevados',
    dose: '1 g/dia',
    duration: '12 semanas',
    result: 'Descida dos triglicéridos e do colesterol LDL.',
    level: 'preliminar',
    goals: ['peso', 'nutricao'],
  },
  {
    id: 'serban2016',
    cite: 'Serban et al., 2016',
    title: 'A systematic review and meta-analysis of the impact of Spirulina supplementation on plasma lipid concentrations',
    journal: 'Clinical Nutrition 35(4):842–851',
    design: 'Revisão sistemática e meta-análise de ensaios aleatorizados',
    population: '7 ensaios, cerca de 520 participantes',
    dose: '1 a 10 g/dia, consoante o ensaio',
    duration: '2 semanas a 12 meses',
    result: 'Descida do colesterol total, do LDL e dos triglicéridos, e subida do HDL.',
    level: 'moderada',
    goals: ['peso', 'nutricao'],
    confirmar: true,
  },
  {
    id: 'moradi2019',
    cite: 'Moradi et al., 2019',
    title: 'Effects of Spirulina supplementation on obesity: a systematic review and meta-analysis of randomized clinical trials',
    journal: 'Complementary Therapies in Medicine 47:102211',
    design: 'Revisão sistemática e meta-análise de ensaios aleatorizados',
    population: '5 ensaios com adultos',
    dose: 'variável, consoante o ensaio',
    duration: 'variável',
    result: 'Pequena descida do peso corporal, mais clara em pessoas com obesidade.',
    level: 'moderada',
    goals: ['peso'],
    confirmar: true,
  },
  {
    id: 'marles2011',
    cite: 'Marles et al., 2011',
    title: 'United States Pharmacopeia safety evaluation of spirulina',
    journal: 'Critical Reviews in Food Science and Nutrition 51(7):593–604',
    design: 'Revisão de segurança da Farmacopeia dos EUA',
    population: 'Ensaios clínicos, relatos de casos e dados toxicológicos',
    dose: 'doses usadas nos ensaios clínicos',
    duration: '—',
    result: 'Classe A de segurança, desde que livre de contaminantes como microcistinas e metais pesados. Os efeitos adversos relatados são raros e sobretudo digestivos.',
    level: 'seguranca',
    goals: ['energia', 'desporto', 'imunidade', 'foco', 'nutricao', 'peso'],
  },
  {
    id: 'watanabe2007',
    cite: 'Watanabe, 2007',
    title: 'Vitamin B12 sources and bioavailability',
    journal: 'Experimental Biology and Medicine 232(10):1266–1274',
    design: 'Revisão',
    population: '—',
    dose: '—',
    duration: '—',
    result: 'A maior parte da "vitamina B12" da Spirulina é pseudovitamina B12, que o corpo humano não usa. Quem segue uma alimentação vegana continua a precisar de suplemento de B12.',
    level: 'seguranca',
    goals: ['nutricao'],
  },
];

export const studyById = (id: string) => STUDIES.find((s) => s.id === id)!;
export const studiesFor = (g: Goal) => STUDIES.filter((s) => s.goals.includes(g));
export const pubmedUrl = (s: Study) => `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(s.title)}`;

/** Porque é que cada objetivo começa na dose que começa. */
export const DOSE_BASIS: Record<Goal, { text: string; studies: string[] }> = {
  energia: { text: 'É a dose testada contra placebo na fadiga mental e física.', studies: ['johnson2016'] },
  foco: { text: 'É a dose testada contra placebo na fadiga mental.', studies: ['johnson2016'] },
  desporto: {
    text: 'O ensaio em atletas usou 6 g/dia. Partimos de 5 g e somamos conforme o seu peso e volume de treino.',
    studies: ['kalafati2010'],
  },
  imunidade: { text: 'Dose dentro do intervalo usado em adultos mais velhos durante 12 semanas.', studies: ['selmi2011'] },
  nutricao: { text: 'Dose nutricional: cerca de 2 g de proteína vegetal. Os ensaios usaram entre 1 e 10 g/dia.', studies: ['serban2016'] },
  peso: { text: 'Fica no meio do intervalo dos ensaios incluídos nas meta-análises.', studies: ['moradi2019', 'serban2016'] },
};

/** Força global da evidência por objetivo, dita com honestidade. */
export const GOAL_EVIDENCE: Record<Goal, { level: EvidenceLevel; text: string }> = {
  energia: { level: 'preliminar', text: 'Há um ensaio com placebo a favor, mas com poucos participantes. O seu check-in diário mostra se funciona para si.' },
  foco: { level: 'preliminar', text: 'A fadiga mental foi medida num único ensaio com placebo. Acompanhe a sua disposição e o sono no check-in.' },
  desporto: { level: 'preliminar', text: 'Um ensaio cruzado com placebo em atletas, com amostra pequena. Os resultados são promissores, mas não definitivos.' },
  imunidade: { level: 'preliminar', text: 'Os estudos medem marcadores no sangue, não menos infeções. Por isso não prometemos proteção contra doenças.' },
  nutricao: { level: 'moderada', text: 'O valor nutricional (proteína, ferro, pigmentos) está bem descrito. O efeito nos lípidos do sangue tem apoio de meta-análises.' },
  peso: { level: 'moderada', text: 'As meta-análises mostram efeitos pequenos. A Spirulina ajuda dentro de um plano com alimentação e movimento, nunca sozinha.' },
};

/** Porque é que cada situação de risco pede um profissional. */
export const SAFETY_REASONS: Record<string, string> = {
  pku: 'A Spirulina contém fenilalanina, que tem de ser controlada na fenilcetonúria.',
  auto: 'A Spirulina pode estimular o sistema imunitário, o que pede cautela em doenças autoimunes.',
  antico: 'Há uma possível interação com anticoagulantes e imunossupressores, que deve ser avaliada pelo médico.',
  gravidez: 'Não há estudos suficientes sobre a segurança na gravidez e na amamentação.',
  renal: 'A Spirulina é rica em proteína e purinas, que podem sobrecarregar os rins ou agravar a gota.',
};
