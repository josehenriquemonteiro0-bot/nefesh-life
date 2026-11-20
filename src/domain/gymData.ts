/** Exercícios de ginásio (sem dependências: usado pela app e pelo servidor do assistente). */
export type GymLevel = 'iniciante' | 'intermedio';

export interface GymExercise {
  name: string;
  area: string;
  /** séries × repetições por nível */
  sets: Record<GymLevel, string>;
  /** dica curta de segurança/execução */
  tip: string;
}

export const GYM: Record<string, GymExercise> = {
  legpress: { name: 'Leg press', area: 'Pernas', sets: { iniciante: '3 × 12', intermedio: '3 × 10' }, tip: 'Pés à largura dos ombros; não bloqueie os joelhos em cima.' },
  supino_maq: { name: 'Supino na máquina', area: 'Peito', sets: { iniciante: '3 × 12', intermedio: '3 × 10' }, tip: 'Pegas à altura do peito; empurre sem tirar as costas do banco.' },
  puxada: { name: 'Puxada à frente', area: 'Costas', sets: { iniciante: '3 × 12', intermedio: '4 × 10' }, tip: 'Puxe a barra até ao peito com o tronco ligeiramente inclinado para trás.' },
  remada_sentada: { name: 'Remada sentada (cabo)', area: 'Costas', sets: { iniciante: '3 × 12', intermedio: '3 × 10' }, tip: 'Costas direitas; puxe os cotovelos para trás e aperte as omoplatas.' },
  prancha: { name: 'Prancha', area: 'Abdominais', sets: { iniciante: '3 × 20 s', intermedio: '3 × 45 s' }, tip: 'Corpo em linha reta, sem deixar a anca cair.' },
  agachamento_goblet: { name: 'Agachamento goblet (com halter)', area: 'Pernas e glúteos', sets: { iniciante: '3 × 10', intermedio: '3 × 12' }, tip: 'Halter junto ao peito; desça com as costas direitas e os joelhos na linha dos pés.' },
  peso_morto_romeno: { name: 'Peso morto romeno (halteres)', area: 'Posteriores e glúteos', sets: { iniciante: '3 × 10', intermedio: '4 × 8' }, tip: 'Leve a anca atrás com os joelhos ligeiramente fletidos; costas sempre direitas.' },
  press_ombros: { name: 'Press de ombros (máquina ou halteres)', area: 'Ombros', sets: { iniciante: '3 × 12', intermedio: '3 × 10' }, tip: 'Não arqueie a lombar; desça até as mãos ficarem à altura das orelhas.' },
  remada_halter: { name: 'Remada unilateral com halter', area: 'Costas', sets: { iniciante: '3 × 10 por lado', intermedio: '3 × 10 por lado' }, tip: 'Apoie a mão e o joelho num banco; puxe o halter até à anca.' },
  elevacao_pelvica: { name: 'Elevação pélvica', area: 'Glúteos', sets: { iniciante: '3 × 12', intermedio: '4 × 10' }, tip: 'Costas apoiadas no banco; suba a anca e aperte os glúteos em cima.' },
  supino_barra: { name: 'Supino com barra', area: 'Peito', sets: { iniciante: '3 × 10', intermedio: '4 × 8' }, tip: 'Desça a barra até ao meio do peito; peça a alguém para o ajudar com cargas altas.' },
  remada_curvada: { name: 'Remada curvada com barra', area: 'Costas', sets: { iniciante: '3 × 10', intermedio: '4 × 8' }, tip: 'Tronco inclinado, costas direitas; puxe a barra até ao umbigo.' },
  agachamento_barra: { name: 'Agachamento com barra', area: 'Pernas e glúteos', sets: { iniciante: '3 × 10', intermedio: '4 × 8' }, tip: 'Comece com carga leve e aprenda a técnica; desça até as coxas ficarem paralelas ao chão.' },
  afundos_halteres: { name: 'Afundos com halteres', area: 'Pernas e equilíbrio', sets: { iniciante: '3 × 8 por perna', intermedio: '3 × 10 por perna' }, tip: 'Passo grande; os dois joelhos a 90 graus.' },
  biceps: { name: 'Curl de bíceps', area: 'Braços', sets: { iniciante: '2 × 12', intermedio: '3 × 10' }, tip: 'Cotovelos junto ao corpo; desça devagar.' },
  triceps: { name: 'Tríceps na polia', area: 'Braços', sets: { iniciante: '2 × 12', intermedio: '3 × 12' }, tip: 'Cotovelos fixos ao lado do corpo; estique os braços por completo.' },
  gemeos: { name: 'Gémeos em pé', area: 'Pernas', sets: { iniciante: '2 × 15', intermedio: '3 × 15' }, tip: 'Suba até à ponta dos pés e desça devagar.' },
};
