/**
 * Biblioteca de meditação NEFESH (sem dependências: usada pela app e pelo assistente no servidor).
 *
 * Cada sessão é uma sequência de passos: uma frase dita pela voz e uma pausa (segundos) para
 * praticar. Hoje a voz é a do telemóvel; quando houver gravações reais (ex.: de um psicólogo
 * parceiro), basta pôr o endereço em `audio` e o leitor passa a tocar a gravação.
 * Textos de bem-estar, sem promessas clínicas (a rever por um psicólogo antes do lançamento).
 */

export type Collection = 'manha' | 'acalmar' | 'foco' | 'dormir' | 'bemestar';
export const COLLECTIONS: [Collection, string, string][] = [
  ['manha', 'Manhã', '🌅'],
  ['acalmar', 'Acalmar', '😮‍💨'],
  ['foco', 'Foco', '🎯'],
  ['dormir', 'Dormir', '🌙'],
  ['bemestar', 'Bem-estar', '💚'],
];

export type Ambient = 'chuva' | 'mar' | 'tom' | 'nenhum';

export interface Meditation {
  id: string;
  title: string;
  collection: Collection;
  /** duração anunciada (minutos) */
  minutes: number;
  desc: string;
  /** grátis no plano gratuito (as outras são Premium; tudo aberto na fase de teste) */
  free?: boolean;
  /** som de fundo sugerido */
  ambient: Ambient;
  /** frase e pausa (s) depois dela */
  steps: [string, number][];
  /** gravação real (quando existir): o leitor toca-a em vez da voz do telemóvel */
  audio?: string;
}

export const MEDITATIONS: Meditation[] = [
  {
    id: 'intencao',
    title: 'Intenção para o dia',
    collection: 'manha',
    minutes: 5,
    desc: 'Comece o dia com calma e escolha uma intenção simples.',
    ambient: 'tom',
    steps: [
      ['Bom dia. Sente-se de forma confortável, com as costas direitas e os ombros soltos.', 6],
      ['Feche os olhos, ou baixe o olhar para o chão à sua frente.', 5],
      ['Inspire fundo pelo nariz… e solte o ar devagar pela boca.', 8],
      ['Mais uma vez. Inspire… e expire, deixando sair o que ainda resta do sono.', 10],
      ['Agora deixe a respiração seguir o seu ritmo natural. Não precisa de a controlar.', 20],
      ['Repare no corpo neste momento: os pés no chão, as mãos pousadas, o peso do corpo na cadeira.', 25],
      ['Pense no dia que começa. Sem pressa e sem listas. Apenas repare no que o espera.', 25],
      ['Agora pergunte a si mesmo: como quero estar hoje? Calmo? Presente? Paciente? Com energia?', 20],
      ['Escolha uma só palavra para a sua intenção de hoje. Diga-a em silêncio, para si.', 25],
      ['Inspire, e imagine essa palavra a encher o seu peito. Expire, e deixe-a espalhar-se pelo corpo.', 30],
      ['Sempre que o dia acelerar, pode voltar a esta palavra com uma única respiração.', 15],
      ['Agradeça a si mesmo por este momento. Mexa devagar os dedos das mãos e dos pés.', 8],
      ['Quando estiver pronto, abra os olhos. Bom dia, e boa intenção.', 3],
    ],
  },
  {
    id: 'ritual',
    title: 'O ritual consciente',
    collection: 'manha',
    minutes: 3,
    desc: 'Tome a sua Spirulina com atenção plena: um momento só seu.',
    free: true,
    ambient: 'tom',
    steps: [
      ['Este é o seu ritual. Tenha a sua Spirulina e um copo de água à sua frente.', 5],
      ['Antes de tomar, faça uma pausa. Inspire fundo… e expire devagar.', 8],
      ['Olhe para o copo de água. Repare na luz, na transparência, na frescura.', 12],
      ['Este gesto pequeno, repetido todos os dias, é uma forma de cuidar de si.', 8],
      ['Tome agora a sua Spirulina, sem pressa. Beba a água devagar, gole a gole.', 25],
      ['Sinta a água a descer, fresca. Repare no corpo a receber o que lhe dá.', 20],
      ['Inspire, e pense numa coisa boa que quer para o seu corpo hoje.', 15],
      ['Expire, e deixe esse desejo ficar consigo durante o dia.', 12],
      ['O seu ritual está feito. Pode marcar a toma na app, e seguir o seu dia com calma.', 3],
    ],
  },
  {
    id: 'ansiedade',
    title: 'Acalmar a ansiedade',
    collection: 'acalmar',
    minutes: 5,
    desc: 'Quando o coração acelera e a cabeça não para: cinco minutos para voltar ao chão.',
    free: true,
    ambient: 'chuva',
    steps: [
      ['Está tudo bem. Vamos fazer isto juntos, devagar.', 4],
      ['Pouse os pés bem assentes no chão. Sinta o chão por baixo de si, firme.', 8],
      ['Ponha uma mão no peito e a outra na barriga.', 5],
      ['Inspire pelo nariz, contando até quatro, e sinta a barriga a subir.', 6],
      ['Expire pela boca, devagar, contando até seis. A expiração mais longa acalma o corpo.', 8],
      ['Continue assim: inspire em quatro… expire em seis. Ao seu ritmo.', 40],
      ['Se vierem pensamentos, não os afaste. Repare neles como nuvens a passar, e volte à respiração.', 30],
      ['Agora olhe à sua volta, ou imagine o espaço onde está. Repare em três coisas que consegue ver.', 20],
      ['Repare em dois sons à sua volta, perto ou longe.', 15],
      ['E numa coisa que consegue sentir com as mãos: a roupa, a mesa, a pele.', 15],
      ['Volte a respirar: inspire em quatro… expire em seis.', 30],
      ['A ansiedade é como uma onda: sobe, e depois desce. Você está aqui, e está seguro.', 15],
      ['Quando estiver pronto, faça uma última respiração funda, e continue o seu dia com mais calma.', 3],
    ],
  },
  {
    id: 'antes',
    title: 'Antes de um momento importante',
    collection: 'acalmar',
    minutes: 3,
    desc: 'Uma reunião, um exame, uma conversa difícil: chegue centrado.',
    ambient: 'tom',
    steps: [
      ['Faltam poucos minutos. Vamos usá-los para chegar centrado.', 4],
      ['Sente-se direito, como alguém confiante. Os ombros para trás e para baixo.', 6],
      ['Faça a respiração quadrada: inspire em quatro, segure em quatro, expire em quatro, segure em quatro.', 5],
      ['Inspire… dois, três, quatro. Segure… dois, três, quatro. Expire… dois, três, quatro. Segure… dois, três, quatro.', 20],
      ['Continue sozinho, mais três vezes, ao seu ritmo.', 45],
      ['Lembre-se de uma vez em que correu bem. Veja essa imagem por um momento.', 20],
      ['Você está preparado. Não precisa de ser perfeito: precisa de estar presente.', 10],
      ['Uma última respiração funda. E vá. Boa sorte.', 2],
    ],
  },
  {
    id: 'pausa',
    title: 'Pausa no trabalho',
    collection: 'foco',
    minutes: 3,
    desc: 'Três minutos para desligar o piloto automático e voltar com a cabeça fresca.',
    free: true,
    ambient: 'chuva',
    steps: [
      ['Afaste os olhos do ecrã. Este momento é seu.', 4],
      ['Solte o maxilar, desça os ombros, e deixe as mãos pousadas.', 8],
      ['Inspire fundo… e expire como um suspiro, deixando sair a tensão.', 10],
      ['Rode devagar a cabeça para um lado… e para o outro. Sem forçar.', 15],
      ['Agora fique só com a respiração. Repare no ar a entrar fresco e a sair morno.', 30],
      ['Se a cabeça for para as tarefas, tudo bem. Volte com gentileza à respiração.', 30],
      ['Beba um copo de água, se tiver um por perto.', 15],
      ['Escolha a próxima coisa a fazer, só uma. E volte a ela com calma e atenção.', 6],
    ],
  },
  {
    id: 'presente',
    title: 'Voltar ao presente',
    collection: 'foco',
    minutes: 5,
    desc: 'Quando a cabeça está em mil sítios: os cinco sentidos trazem-no de volta.',
    ambient: 'tom',
    steps: [
      ['Vamos voltar ao aqui e agora, usando os sentidos.', 4],
      ['Inspire fundo… e expire devagar. Mais uma vez.', 12],
      ['Abra bem os olhos e repare em cinco coisas que consegue ver. Uma de cada vez, sem pressa.', 35],
      ['Agora, quatro coisas que consegue sentir: os pés nos sapatos, as costas na cadeira, a temperatura do ar, as mãos.', 35],
      ['Três sons que consegue ouvir, perto ou longe.', 30],
      ['Dois cheiros, ou dois cheiros de que gosta, se o ar não tiver nenhum.', 25],
      ['E um sabor: o que sente na boca neste momento.', 20],
      ['Repare como está agora, comparado com o início. Mais presente, mais aqui.', 15],
      ['Leve esta atenção para o que vai fazer a seguir.', 3],
    ],
  },
  {
    id: 'desligar',
    title: 'Desligar o dia',
    collection: 'dormir',
    minutes: 10,
    desc: 'Para deitar a cabeça na almofada e deixar o dia ficar para trás.',
    free: true,
    ambient: 'mar',
    steps: [
      ['Deite-se de forma confortável, de costas ou de lado. Esta é a última coisa que faz hoje.', 8],
      ['Feche os olhos. Faça uma respiração funda… e solte o ar devagar.', 10],
      ['Deixe o corpo pesar sobre o colchão. Não precisa de o segurar.', 15],
      ['Pense no dia que passou, como quem vê um filme ao longe. Sem julgar. Só veja.', 40],
      ['Houve coisas que correram bem. Escolha uma e fique com ela um momento.', 30],
      ['Houve coisas que ficaram por fazer. Diga-lhes em silêncio: amanhã trato de vocês.', 25],
      ['Agora imagine que cada expiração leva um pouco do dia embora, como uma onda que recua.', 40],
      ['Inspire… e expire, deixando ir. Inspire… e expire, mais leve.', 40],
      ['Relaxe a testa, os olhos, o maxilar. Deixe a língua solta.', 25],
      ['Relaxe o pescoço e os ombros. Os braços pesados. As mãos abertas.', 25],
      ['O peito sobe e desce sozinho. A barriga mole.', 25],
      ['As pernas pesadas, os pés soltos.', 25],
      ['Não há mais nada a fazer hoje. Só descansar.', 60],
      ['Pode ficar aqui, a respirar, e deixar o sono chegar quando quiser.', 60],
      ['Boa noite.', 10],
    ],
  },
  {
    id: 'bodyscan',
    title: 'Relaxamento do corpo',
    collection: 'dormir',
    minutes: 12,
    desc: 'Percorra o corpo dos pés à cabeça e solte a tensão de cada parte.',
    ambient: 'mar',
    steps: [
      ['Deite-se de costas, com os braços ao lado do corpo e as palmas viradas para cima, se for confortável.', 8],
      ['Feche os olhos e faça três respirações fundas, ao seu ritmo.', 25],
      ['Leve a atenção aos pés. Repare no que sente: calor, frio, formigueiro, ou nada. Tudo está certo.', 35],
      ['Imagine que a respiração chega até aos pés e, ao expirar, eles amolecem.', 30],
      ['Suba para as pernas: os tornozelos, as canelas, os joelhos. Deixe-as pesar.', 40],
      ['As coxas, a anca. Solte qualquer aperto que encontre.', 40],
      ['A barriga. Deixe-a subir e descer sozinha, sem a segurar.', 40],
      ['O peito e as costas. Repare no apoio do colchão por baixo de si.', 40],
      ['As mãos, os braços, os ombros. Os ombros descem, longe das orelhas.', 45],
      ['O pescoço, a nuca. A cabeça pesada na almofada.', 35],
      ['O rosto: a testa lisa, os olhos fundos, as bochechas soltas, o maxilar aberto.', 40],
      ['Agora sinta o corpo inteiro de uma vez, pesado e quente, a respirar.', 60],
      ['Se quiser dormir, deixe-se ir. Se quiser continuar o dia, mexa devagar os dedos.', 60],
      ['Obrigado por cuidar de si.', 10],
    ],
  },
  {
    id: '478',
    title: '4-7-8 para adormecer',
    collection: 'dormir',
    minutes: 5,
    desc: 'A respiração 4-7-8, guiada, para desacelerar à noite.',
    ambient: 'mar',
    steps: [
      ['Deite-se confortável. Vamos fazer a respiração quatro, sete, oito.', 5],
      ['Ponha a ponta da língua atrás dos dentes de cima. Expire todo o ar pela boca.', 6],
      ['Inspire pelo nariz… dois, três, quatro.', 1],
      ['Segure… dois, três, quatro, cinco, seis, sete.', 1],
      ['Expire pela boca, devagar… dois, três, quatro, cinco, seis, sete, oito.', 4],
      ['Mais uma. Inspire… dois, três, quatro. Segure… até sete. Expire… até oito.', 22],
      ['Continue sozinho, mais três vezes. Se sentir tonturas, volte à respiração normal.', 70],
      ['Agora respire normalmente. Sinta o corpo mais pesado e mais calmo.', 40],
      ['Deixe os pensamentos passarem como carros ao longe, sem ir atrás deles.', 60],
      ['Boa noite. Durma bem.', 10],
    ],
  },
  {
    id: 'gratidao',
    title: 'Gratidão',
    collection: 'bemestar',
    minutes: 5,
    desc: 'Treine o olhar para o que corre bem: pessoas, momentos, o próprio corpo.',
    ambient: 'tom',
    steps: [
      ['Sente-se ou deite-se, como preferir. Feche os olhos.', 5],
      ['Inspire fundo… e expire devagar. Deixe o corpo assentar.', 15],
      ['Pense numa pessoa por quem sente gratidão. Veja o rosto dela.', 30],
      ['Lembre-se de um momento concreto com essa pessoa. Onde estavam? O que sentiu?', 35],
      ['Agora pense numa coisa simples de hoje que correu bem. Por mais pequena que seja.', 30],
      ['E agradeça ao seu corpo: pelas pernas que o levam, pelas mãos, pela respiração que não para.', 35],
      ['Repare no que sente no peito quando pensa nisto tudo.', 30],
      ['Se quiser, guarde estas três coisas no seu diário de gratidão, aqui na app.', 8],
      ['Abra os olhos devagar, quando estiver pronto.', 3],
    ],
  },
  {
    id: 'autocompaixao',
    title: 'Autocompaixão',
    collection: 'bemestar',
    minutes: 7,
    desc: 'Para os dias difíceis: falar consigo como falaria com um bom amigo.',
    ambient: 'chuva',
    steps: [
      ['Este é um momento para ser gentil consigo. Sente-se confortável e feche os olhos.', 6],
      ['Ponha uma mão sobre o coração. Sinta o calor da mão.', 10],
      ['Respire devagar e repare em como está hoje, sem tentar mudar nada.', 30],
      ['Se houver algo difícil, dê-lhe um nome em silêncio: cansaço, preocupação, tristeza.', 30],
      ['Lembre-se: toda a gente passa por momentos assim. Não está sozinho nisto.', 20],
      ['Agora pense no que diria a um bom amigo que estivesse a sentir o mesmo.', 30],
      ['Diga essas palavras a si mesmo, em silêncio. Por exemplo: estou a fazer o melhor que posso.', 30],
      ['Que eu seja paciente comigo. Que eu me trate com cuidado.', 30],
      ['Continue a respirar com a mão no peito, a receber esta gentileza.', 60],
      ['Se a tristeza ou a ansiedade durarem há semanas, falar com um profissional é também uma forma de cuidar de si.', 10],
      ['Quando estiver pronto, abra os olhos.', 3],
    ],
  },
  {
    id: 'caminhada',
    title: 'Caminhada consciente',
    collection: 'bemestar',
    minutes: 10,
    desc: 'De olhos abertos, a caminhar: cada passo como uma pausa.',
    ambient: 'nenhum',
    steps: [
      ['Esta meditação faz-se a caminhar, de olhos abertos. Escolha um caminho seguro e um ritmo calmo.', 6],
      ['Comece a andar devagar. Repare no pé a sair do chão… a avançar… e a pousar.', 40],
      ['Sinta o peso a passar de um pé para o outro.', 40],
      ['Agora junte a respiração: inspire em três passos, expire em três passos.', 50],
      ['Repare no que vê à sua volta: cores, formas, a luz. Sem dar nomes, só ver.', 50],
      ['Repare nos sons: passos, vento, vozes, pássaros.', 45],
      ['Sinta o ar na pele e a temperatura.', 40],
      ['Se a cabeça for para outro lado, volte aos pés. Passo a passo.', 60],
      ['Abrande ainda mais durante os últimos passos.', 40],
      ['Pare. Fique de pé uns segundos e sinta o corpo inteiro.', 20],
      ['Leve esta calma consigo para o resto do dia.', 3],
    ],
  },
];

export const meditationById = (id: string) => MEDITATIONS.find((m) => m.id === id);

/** Duração estimada (s): fala a ~2,2 palavras por segundo (voz lenta) + pausas. */
export const estimateSeconds = (m: Meditation) => Math.round(m.steps.reduce((t, [txt, p]) => t + txt.split(/\s+/).length / 2.2 + p, 0));

/** Sessão sugerida para este momento (manhã, pausa, noite; stress alto → acalmar). */
export function suggested(hour: number, stress?: number) {
  if ((stress ?? 0) >= 4) return 'ansiedade';
  if (hour >= 5 && hour < 10) return 'ritual';
  if (hour >= 21 || hour < 3) return 'desligar';
  if (hour >= 13 && hour < 18) return 'pausa';
  return 'presente';
}
