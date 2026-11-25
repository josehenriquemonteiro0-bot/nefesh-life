/**
 * AI Coach NEFESH (especificação v2, secção 4).
 *
 * A app envia a conversa recente e um resumo do contexto da pessoa (objetivo, plano de
 * Spirulina, registos de hoje e médias). O modelo responde em linguagem de bem-estar e
 * devolve ações estruturadas (registos declarados). Os valores nutricionais NÃO vêm do
 * modelo: ele escolhe alimentos da tabela da app e a app calcula com o mesmo código do diário.
 */
import Anthropic from '@anthropic-ai/sdk';
import { FOODS } from '../../src/domain/foods';
import { GYM } from '../../src/domain/gymData';
import { MEDITATIONS } from '../../src/domain/meditations';
import { CYCLE_EVENTS, CYCLE_SYMPTOMS, MUCUS } from '../../src/domain/cycleData';
import { check, count, type CounterStore, type Limits } from './limits';
import { dailyQuota } from './features';

/** Fase de teste: limite largo só contra abusos. Com TEST_MODE desligado, o grátis tem 5 por dia. */
export function coachLimits(env: { TEST_MODE?: string }): Limits {
  const q = dailyQuota(env, 'coach', false);
  return { device: Number.isFinite(q) ? q : 40, ip: Number.isFinite(q) ? q * 4 : 120, global: 3000 };
}

const ACTION_TYPES = ['agua', 'sono', 'spirulina', 'energia', 'disposicao', 'refeicao', 'plano_refeicao', 'plano_treino', 'treino', 'passos', 'humor', 'stress', 'gratidao', 'respiracao', 'memoria', 'nota', 'lembrete', 'consulta', 'desafio', 'abrir', 'resumo', 'peso', 'meditar', 'ciclo', 'jejum'] as const;
/** Ecrãs da app que o assistente pode abrir (procura por voz). */
export const SCREENS = ['plano', 'nutricao', 'receitas', 'treino', 'sono', 'mente', 'corpo', 'cuidados', 'ciclo', 'evolucao', 'comunidade', 'desafios', 'profissionais', 'perfil', 'checkin'] as const;
export const CHALLENGES = ['ritual', 'agua', 'treino', 'checkin', 'passos', 'ritual_agua', 'ritual_treino', 'ritual_checkin', 'ritual_refeicoes', 'reset21'] as const;
export type CoachActionType = (typeof ACTION_TYPES)[number];

export const COACH_SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string', description: 'Resposta curta à pessoa (no máximo 3 frases), em português de Portugal, na terceira pessoa de cortesia ("você"/forma neutra).' },
    actions: {
      type: 'array',
      description: 'Registos a criar a partir do que a pessoa disse sobre HOJE. Vazio se ela só fez uma pergunta. Em cada registo, escreve só os campos que se aplicam a esse tipo (omite os outros).',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ACTION_TYPES },
          value: { type: 'number', description: 'agua: copos de 250 ml a ACRESCENTAR; sono: horas dormidas na última noite; energia e disposicao: 1 a 5; treino: minutos; passos: número de passos; plano_refeicao: número [n] da refeição do plano do nutricionista (no contexto); plano_treino: número [n] do treino do plano do personal (no contexto); humor e stress: 1 a 5; peso: kg (ex.: 68.5); respiracao: minutos da pausa sugerida (2 a 5); ciclo menstruacao: fluxo 1 leve, 2 moderado, 3 intenso, 4 muito intenso (0 se não disser); ciclo dor: 0 a 10; gratidao: 1; spirulina e refeicao: 1; jejum: 1 = começou o jejum, 0 = terminou o jejum' },
          option: { type: 'number', description: 'jejum: duração em horas (0 se não disser); plano_refeicao: número da opção do plano que comeu (0 se só houver uma ou se não disser); plano_treino: minutos do treino (0 se não disser); 0 nos outros' },
          status: { type: 'string', enum: ['seguido', 'alterado', 'saltado', ''], description: 'só para plano_refeicao e plano_treino: seguido = como no plano; alterado = com mudanças; saltado = não fez; "" nos outros' },
          note: { type: 'string', description: 'jejum: hora de fim HH:MM se disser "até às…"; plano_refeicao alterado: as mudanças (ex.: "sem arroz"); gratidao: a frase de gratidão; memoria: o facto a lembrar, curto e na 3.ª pessoa (ex.: "É vegetariana"); nota: o relato da pessoa resumido numa frase; lembrete: o texto do lembrete (ex.: "Hora de deitar"); meditar: o id da meditação da biblioteca; ciclo sintomas: os sintomas separados por vírgulas, com os nomes da lista do ciclo; ciclo muco: seco, pegajoso, cremoso, aquoso ou clara; consulta: especialidade e com quem (ex.: "Cardiologia, Dr. Silva"); "" nos outros' },
          meal: { type: 'string', enum: ['pa', 'almoco', 'lanche', 'jantar', ''], description: 'só para refeicao: pa = pequeno-almoço; "" se não for refeição' },
          intensity: { type: 'string', enum: ['leve', 'moderado', 'intenso', ''], description: 'só para treino' },
          date: { type: 'string', description: 'ciclo: dia do registo AAAA-MM-DD se não for hoje (ex.: "comecei ontem"), senão ""; lembrete e consulta: data AAAA-MM-DD (usa a data de hoje do contexto para "hoje"/"amanhã"); "" nos outros' },
          time: { type: 'string', description: 'lembrete e consulta: hora HH:MM (24 h); jejum: hora a que começou ou terminou, se disser (ex.: "comecei às 20h"); "" se não houver' },
          challenge: { type: 'string', enum: [...CHALLENGES, ''], description: 'só para desafio: o tipo (caminhada/passos = passos; água = agua; treino = treino; Spirulina todos os dias = ritual; 21 Day Reset = reset21)' },
          level: { type: 'string', enum: ['leve', 'firme', ''], description: 'só para desafio: leve se a pessoa quiser algo mais fácil; senão firme' },
          friends: { type: 'array', items: { type: 'string' }, description: 'só para desafio: alcunhas dos amigos que a pessoa nomeou (da lista de amigos do contexto); vazio se não nomeou' },
          screen: { type: 'string', enum: [...SCREENS, ''], description: 'só para abrir: o ecrã da app que responde ao pedido' },
          exercises: {
            type: 'array',
            description: 'só para treino: exercícios ditos pela pessoa (vazio se não disse)',
            items: {
              type: 'object',
              properties: {
                gym_id: { type: 'string', description: 'id da lista de exercícios de ginásio, se houver equivalente; "" se não' },
                name: { type: 'string', description: 'nome do exercício como a pessoa disse' },
                sets: { type: 'number', description: 'séries (0 se não disse)' },
                reps: { type: 'number', description: 'repetições por série (0 se não disse)' },
                kg: { type: 'number', description: 'carga em kg (0 se não disse ou peso do corpo)' },
                feel: { type: 'string', enum: ['facil', 'certo', 'dificil', 'falhei', ''], description: 'como correu, se a pessoa disse ("foi fácil", "custou muito", "não consegui acabar"); "" se não disse' },
              },
              required: ['gym_id', 'name'],
              additionalProperties: false,
            },
          },
          title: { type: 'string', description: `treino: nome curto (ex.: "Peito e tríceps", "Corrida"); ciclo: o que registar, um de ${CYCLE_EVENTS.join(', ')}; "" nos outros` },
          replace: { type: 'boolean', description: 'true quando corrige um registo anterior do Coach (substitui-o); false quando acrescenta' },
          items: {
            type: 'array',
            description: 'só para refeicao: os alimentos, um por linha',
            items: {
              type: 'object',
              properties: {
                food_id: { type: 'string', description: 'id da tabela de alimentos se houver um equivalente; "" se não houver' },
                name: { type: 'string', description: 'nome do alimento como a pessoa o diria' },
                grams: { type: 'number', description: 'quantidade estimada em gramas (porção habitual se ela não disser)' },
                kcal100: { type: 'number', description: 'só se food_id = "": estimativa de kcal por 100 g' },
                p100: { type: 'number', description: 'só se food_id = "": proteína por 100 g' },
                c100: { type: 'number', description: 'só se food_id = "": hidratos por 100 g' },
                f100: { type: 'number', description: 'só se food_id = "": gordura por 100 g' },
              },
              required: ['food_id', 'name', 'grams'],
              additionalProperties: false,
            },
          },
        },
        // só o tipo é obrigatório: o modelo escreve apenas os campos que usa (menos texto de saída, menos custo)
        required: ['type', 'value'],
        additionalProperties: false,
      },
    },
    suggest_professional: { type: 'boolean', description: 'true perante sinais persistentes ou preocupantes que justificam falar com um profissional de saúde' },
  },
  required: ['reply', 'actions', 'suggest_professional'],
  additionalProperties: false,
} as const;

const MED_LIST = MEDITATIONS.map((m) => `${m.id}: ${m.title}, ${m.minutes} min — ${m.desc}`).join('\n');
const GYM_LIST = Object.entries(GYM).map(([id, e]) => `${id}: ${e.name}`).join('\n');
const CATALOGUE = FOODS.filter((f) => f.cat !== 'NEFESH').map((f) => `${f.id}: ${f.name} (${f.portion})`).join('\n');

export const COACH_SYSTEM = `És o NEFESH Voice Assistant, o assistente de bem-estar da app NEFESH Life (Spirulina NEFESH, hábitos, alimentação, treino e sono). Falas português de Portugal, com calor humano e frases curtas. Tratas a pessoa de forma educada e neutra ("você" ou sem pronome). Números decimais sempre com vírgula (2,5 copos; 7,5 h), como no resto da app.

O teu trabalho:
1. Ler o que a pessoa escreve em linguagem natural e criar registos estruturados (campo actions) do que ela diz que fez ou sentiu HOJE. Exemplo: "Dormi mal, comi dois ovos e pão, vou treinar à tarde e estou cansado" → sono (se disser as horas; "dormi mal" sem horas não cria sono), refeição com ovos e pão, energia 2. "Vou treinar" é um plano, não um registo: não cria treino.
2. Responder com uma sugestão curta e prática para o dia, ligada ao objetivo e ao plano da pessoa. Confirma em poucas palavras o que registaste.

A pessoa pode escrever ou falar em português do Brasil (ex.: "café da manhã" = pequeno-almoço, "academia" = ginásio, "suco" = sumo): entende e responde sempre em português de Portugal. Mensagens ditadas por voz podem ter erros de transcrição: interpreta pelo sentido e, se houver dúvida num número, pergunta.

Regras de registo:
- Só registas o que a pessoa afirma. Não inventes valores. Se faltar um dado essencial (ex.: horas de sono), pergunta na resposta em vez de adivinhar.
- Água: "bebi 2 copos" → value 2; "bebi meio litro" → 2; "1 litro" → 4.
- Spirulina: "tomei a Spirulina" → spirulina (value 1). Nunca sugiras doses diferentes do plano dela.
- Refeição: escolhe food_id da tabela abaixo sempre que houver um equivalente razoável (ex.: "ovo" → o id de ovo); usa grams pela quantidade dita ou pela porção habitual. Só sem equivalente deixas food_id "" e dás uma estimativa por 100 g. Não escrevas calorias na resposta: a app calcula-as.
- Plano do nutricionista: se o contexto tiver "Plano alimentar do nutricionista" e a pessoa disser que fez uma refeição do plano ("almocei o do plano", "segui o plano ao jantar", "fiz o pequeno-almoço do plano mas sem pão"), usa plano_refeicao com value = número [n] dessa refeição, option = opção, status = seguido / alterado (com note) / saltado ("não fiz o lanche"). NÃO envies também refeicao para a mesma refeição: a app põe os alimentos do plano no diário. O que comer a mais, fora do plano, vai como refeicao.
- Plano do personal: se o contexto tiver "Plano de treino do personal" e a pessoa disser que fez um treino do plano ("fiz o treino A", "treinei pernas do plano"), usa plano_treino com value = número [n] desse treino, option = minutos (0 se não disser), status e note como acima. NÃO envies também treino para o mesmo.
- Mente: humor (1 = muito em baixo … 5 = muito bem) e stress (1 = nada … 5 = muito) quando a pessoa o diz. Gratidão ("hoje estou grato por…"): gratidao com a frase em note.
- Stress, ansiedade ou nervos: regista stress e propõe uma pausa com respiracao (value 2 a 5 minutos); a app mostra um botão para começar a respiração guiada. Na resposta, convida com uma frase curta. Não registes a respiração como feita.
- Tristeza ou ansiedade que duram há semanas, ou falta de vontade de fazer as coisas: sugere falar com o médico de família ou um psicólogo (suggest_professional = true). Se falar em fazer-se mal ou em não querer viver: responde com cuidado e indica SNS 24 (808 24 24 24) ou 112 em Portugal, CVV 188 ou 192 no Brasil.
- Treino com exercícios ("supino com 60 kg, 4 séries de 10, foi fácil"): treino com exercises (gym_id da lista de exercícios abaixo quando houver equivalente, feel se disser como correu) e title curto. Se não disser os minutos, value = 0 (a app estima). A app tem progressão automática: com feel, decide a carga da próxima vez; se o contexto tiver "Progressão", usa-a para responder "quanto ponho no agachamento?" e explica o porquê.
- Corrida, caminhada ou bicicleta com GPS: a pessoa usa o botão em Treino → Ao ar livre com GPS (abrir com screen treino). Se o contexto tiver plano de corrida, diz qual é a próxima sessão.
- Lembrar algo sobre a pessoa ("lembra-te que sou vegetariana", "trabalho por turnos"): memoria com o facto em note. Só o que a pessoa pede para lembrar ou afirma sobre si de forma duradoura.
- Relatos de saúde ou do dia que valem guardar ("tenho tido dificuldade em recuperar dos treinos", "hoje foi um dia difícil no trabalho"): nota com o relato numa frase. Procura padrões no contexto e, se for persistente, sugere avaliação profissional.
- Ações que pedem CONFIRMAÇÃO (a app mostra um botão "Confirmar"; nunca digas que já está feito, diz que preparaste e pede para confirmar):
  · lembrete: planear o dia ou pedir para ser lembrado ("amanhã tenho reunião às 9, quero treinar e dormir 8 horas" → propõe horários na resposta e cria lembretes, ex.: deitar às 23:00, treino às 07:00). Um lembrete por ação, com date, time e note.
  · consulta: marcar uma consulta na agenda da pessoa (date, time se disser, note com especialidade e com quem).
  · desafio: criar um desafio com amigos (challenge, value = dias 7, 21, 30 ou 90, level, friends com as alcunhas nomeadas). Se a pessoa não tiver amigos na app, sugere o 21 Day Reset, que se pode começar a solo.
- Procura ("onde vejo as minhas análises?", "quero uma receita com Spirulina", "preciso de um nutricionista"): responde em poucas palavras e usa abrir com o screen certo (análises e medicação = cuidados; receitas = receitas; profissionais = profissionais; relatório e timeline = evolucao).
- Peso ("hoje pesei 68,5"): peso com value em kg.
- Jejum ("vou fazer jejum agora até às 16h", "comecei o jejum às 20h", "jejum de 14 horas", "terminei o jejum", "quebrei o jejum"): cria SEMPRE a ação jejum, mesmo que o jejum não esteja configurado (a app faz um jejum pontual e aplica as regras de segurança). value 1 = começou, 0 = terminou; time = hora de início se a disser (senão ""); note = hora de fim "HH:MM" se disser "até às 16h" (ex.: "16:00"), senão ""; option = duração em horas se disser "jejum de 14 horas" (14), senão 0. O jejum é registado logo pela app (NÃO pede confirmação nem fala em botão "Confirmar"): na resposta diz numa frase que o jejum começou e até que horas. Se o contexto tiver um plano do nutricionista com refeições a horas que o jejum salta, lembra com uma frase curta que vale a pena falar com o nutricionista. Nunca incentives jejuns de mais de 24 horas; perante tonturas, fraqueza ou mal-estar, diz para comer e falar com um profissional.
- Ciclo menstrual: "fiquei menstruada hoje, fluxo forte, com cólicas" → ciclo com title menstruacao (value 3) e ciclo com title sintomas (note "Cólicas"); "a menstruação acabou" → fim; "só umas manchas" → borra; "dor 7" → dor com value 7; "comecei ontem" → date de ontem; relações, testes de ovulação e de gravidez pelo title. Sintomas do ciclo: ${CYCLE_SYMPTOMS.join(', ')}. Muco: ${MUCUS.map(([k]) => k).join(', ')}. Perguntas ("quando vem a próxima?", "estou fértil?", "porque estou tão cansada?") respondes com o resumo do ciclo do contexto, dizendo que são estimativas. Nunca digas que um dia é "seguro" para não engravidar: a app não é método contracetivo. Dor que obriga a parar, fluxo muito intenso ou atraso com relações sem proteção: sugere com calma o médico ou um teste de gravidez.
- Meditação ("guia-me numa meditação", "não consigo dormir", "estou ansioso", "preciso de focar"): meditar com o id da sessão certa da biblioteca abaixo em note; a app mostra o botão para começar. Para uma pausa rápida de respiração continua a usar respiracao.
- Resumo do dia ("como está o meu dia?", "o que me falta hoje?"): usa resumo; a app junta o resumo com os dados de hoje.
- Acrescentar ("também comi uma maçã"): envia só o que é novo, com replace = false.
- Correções ("não, foram três ovos", "afinal dormi 6 horas"): envia o registo corrigido completo com replace = true; a app substitui o que o Coach registou antes nessa refeição (ou o valor desse dia). Para água, replace = true quer dizer o total de copos do dia.
- Energia e disposição: escala 1 a 5 (cansado/em baixo = 2, normal = 3, bem = 4, ótimo = 5).

Regras de segurança (obrigatórias):
- Não fazes diagnósticos nem tratas doenças. Usas linguagem de bem-estar e orientação geral.
- Perante sinais persistentes ou preocupantes (dor, cansaço que dura há semanas, sono muito alterado durante semanas, perda de peso sem razão, falta de ar, tonturas, tristeza persistente, etc.), sugeres falar com um profissional de saúde e pões suggest_professional = true. Em emergência (dor no peito, ideias de se magoar), diz para ligar 112 (Portugal) ou 192/188 (Brasil).
- Não contradizes nem alteras orientações de profissionais (nutricionista, médico, personal). Se a pessoa tiver um plano de um profissional, segue-o.
- Quando dás números (porções, minutos), dizes que são estimativas.
- Sobre a Spirulina: segues o plano de uso da pessoa e o rótulo. Não prometes curas nem fazes alegações de saúde (não digas que trata, cura ou previne doenças). Escreve sempre "Spirulina", nunca "espirulina".
- Não alteras o plano do profissional nem partilhas dados. Desafios, lembretes e consultas só com a confirmação da pessoa (ações acima).
- Fora do âmbito (finanças, política, etc.): responde com simpatia que só ajudas com bem-estar.

Tabela de alimentos (id: nome (porção habitual)):
${CATALOGUE}

Exercícios de ginásio (id: nome):
${GYM_LIST}

Biblioteca de meditação (id: título, minutos, para quê):
${MED_LIST}`;

export interface CoachMessage {
  role: 'user' | 'assistant';
  text: string;
}

/** Só o que é esperado: últimas 12 mensagens, texto limitado, a terminar na pessoa. */
export function cleanMessages(raw: unknown): CoachMessage[] {
  if (!Array.isArray(raw)) return [];
  const msgs = raw
    .filter((m): m is CoachMessage => !!m && (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string' && m.text.trim().length > 0)
    .map((m) => ({ role: m.role, text: m.text.trim().slice(0, 1200) }))
    .slice(-12);
  while (msgs.length && msgs[0].role !== 'user') msgs.shift();
  // junta mensagens seguidas do mesmo lado (a API pede alternância)
  const out: CoachMessage[] = [];
  for (const m of msgs) {
    const last = out[out.length - 1];
    if (last && last.role === m.role) last.text += `\n${m.text}`;
    else out.push({ ...m });
  }
  return out.length && out[out.length - 1].role === 'user' ? out : [];
}

/** Valida as ações devolvidas pelo modelo (tipos, intervalos e alimentos conhecidos). */
export function cleanActions(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  const ids = new Set(FOODS.map((f) => f.id));
  const num = (v: unknown, min: number, max: number) => Math.max(min, Math.min(max, Number(v) || 0));
  return raw
    .filter((a) => a && ACTION_TYPES.includes(a.type))
    .slice(0, 8)
    .map((a) => ({
      type: a.type as CoachActionType,
      value: a.type === 'peso' ? Math.round(num(a.value, 0, 400) * 10) / 10 : a.type === 'desafio' ? ([7, 21, 30, 90].includes(Math.round(Number(a.value))) ? Math.round(Number(a.value)) : 7) : a.type === 'respiracao' ? Math.round(num(a.value, 2, 5)) : a.type === 'humor' || a.type === 'stress' ? Math.round(num(a.value, 1, 5)) : a.type === 'plano_refeicao' || a.type === 'plano_treino' ? Math.round(num(a.value, 0, 30)) : a.type === 'energia' || a.type === 'disposicao' ? Math.round(num(a.value, 1, 5)) : a.type === 'sono' ? num(a.value, 0, 16) : a.type === 'passos' ? Math.round(num(a.value, 0, 100000)) : a.type === 'treino' ? Math.round(num(a.value, 0, 600)) : a.type === 'agua' ? Math.round(num(a.value, -20, 20)) : a.type === 'jejum' ? (Number(a.value) ? 1 : 0) : 1,
      meal: ['pa', 'almoco', 'lanche', 'jantar'].includes(a.meal) ? a.meal : '',
      intensity: ['leve', 'moderado', 'intenso'].includes(a.intensity) ? a.intensity : '',
      title: String(a.title ?? '').slice(0, 40),
      replace: a.replace === true,
      option: a.type === 'jejum' ? Math.max(0, Math.min(48, Math.round((Number(a.option) || 0) * 4) / 4)) : Math.max(0, Math.min(a.type === 'plano_treino' ? 600 : 10, Math.round(Number(a.option) || 0))),
      date: /^\d{4}-\d{2}-\d{2}$/.test(String(a.date)) ? String(a.date) : '',
      time: /^([01]\d|2[0-3]):[0-5]\d$/.test(String(a.time)) ? String(a.time) : '',
      challenge: (CHALLENGES as readonly string[]).includes(a.challenge) ? a.challenge : '',
      level: a.level === 'leve' ? 'leve' : 'firme',
      friends: (Array.isArray(a.friends) ? a.friends : []).slice(0, 20).map((f: unknown) => String(f).slice(0, 30)),
      screen: (SCREENS as readonly string[]).includes(a.screen) ? a.screen : '',
      exercises: (Array.isArray(a.exercises) ? a.exercises : []).slice(0, 15).map((e: Record<string, unknown>) => ({
        gym_id: Object.prototype.hasOwnProperty.call(GYM, String(e.gym_id)) ? String(e.gym_id) : '',
        name: String(e.name ?? '').slice(0, 50),
        sets: Math.round(num(e.sets, 0, 20)),
        reps: Math.round(num(e.reps, 0, 100)),
        kg: Math.round(num(e.kg, 0, 500) * 2) / 2,
      })),
      status: ['seguido', 'alterado', 'saltado'].includes(a.status) ? a.status : 'seguido',
      note: String(a.note ?? '').slice(0, 200),
      items: (Array.isArray(a.items) ? a.items : []).slice(0, 12).map((i: Record<string, unknown>) => ({
        food_id: ids.has(String(i.food_id)) ? String(i.food_id) : '',
        name: String(i.name ?? '').slice(0, 60),
        grams: num(i.grams, 1, 2000),
        kcal100: num(i.kcal100, 0, 900),
        p100: num(i.p100, 0, 100),
        c100: num(i.c100, 0, 100),
        f100: num(i.f100, 0, 100),
      })),
    }))
    .filter((a) => a.type !== 'refeicao' || a.items.length > 0)
    .filter((a) => !['sono', 'treino', 'passos', 'agua'].includes(a.type) || a.value !== 0 || (a.type === 'treino' && a.exercises.length > 0))
    .filter((a) => !['memoria', 'nota', 'lembrete'].includes(a.type) || a.note.trim().length > 0)
    .filter((a) => !['lembrete', 'consulta'].includes(a.type) || a.date)
    .filter((a) => a.type !== 'desafio' || a.challenge)
    .filter((a) => a.type !== 'abrir' || a.screen)
    .filter((a) => a.type !== 'peso' || (a.value >= 25 && a.value <= 350))
    .filter((a) => a.type !== 'meditar' || MEDITATIONS.some((m) => m.id === a.note.trim()));
}

export async function handleCoach(
  body: Record<string, unknown>,
  store: CounterStore,
  limits: Limits,
  client: Anthropic,
  model: string,
  device: string,
  ip: string,
  json: (b: unknown, s: number) => Response,
) {
  const messages = cleanMessages(body.messages);
  if (!messages.length) return json({ error: 'Escreva uma mensagem.' }, 400);
  const allowed = await check(store, limits, device, ip, new Date(), 'c');
  if (!allowed.ok) {
    return json({ error: `Chegou ao limite de ${limits.device} mensagens ao Coach por hoje. Volte amanhã.`, remaining: 0, limit: limits.device }, 429);
  }
  const context = String(body.context ?? '').slice(0, 3000);
  const response = await client.beta.messages.create({
    model,
    max_tokens: 3000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: [
      { type: 'text', text: COACH_SYSTEM, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: `Contexto da pessoa (calculado pela app; usa-o, não o repitas todo):\n${context}` },
    ],
    output_config: { effort: 'low', format: { type: 'json_schema', schema: COACH_SCHEMA } },
    messages: messages.map((m) => ({ role: m.role, content: m.text })),
  });
  if (response.stop_reason === 'refusal') return json({ reply: 'Sobre isso não consigo ajudar. Posso ajudar com os seus hábitos, alimentação, treino, sono e o seu ritual de Spirulina.', actions: [], suggest_professional: false }, 200);
  const text = response.content.find((b) => b.type === 'text');
  if (!text || text.type !== 'text') return json({ error: 'resposta vazia' }, 502);
  const r = JSON.parse(text.text) as { reply?: string; actions?: unknown; suggest_professional?: boolean };
  const remaining = await count(store, limits, device, ip, new Date(), 'c');
  return json(
    {
      reply: String(r.reply ?? '').slice(0, 1500),
      actions: cleanActions(r.actions),
      suggest_professional: r.suggest_professional === true,
      remaining,
      limit: limits.device,
    },
    200,
  );
}
