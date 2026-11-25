/**
 * Português do Brasil a partir do texto da app (escrito em português de Portugal).
 *
 * Não é tradução: é a mesma língua com vocabulário, ortografia e algumas construções diferentes
 * (telemóvel → celular, ecrã → tela, "está a ler" → "está lendo", registar → registrar…).
 * Para outros idiomas (inglês, espanhol) a base é a mesma escolha de idioma (src/i18n/locale.ts),
 * mas com textos traduzidos.
 */

/** Expressões e palavras (de Portugal → do Brasil). As expressões mais longas são tentadas primeiro. */
const PAIRS: [string, string][] = [
  // ecrã (masculino) → tela (feminino): artigos e adjetivos à volta
  ['adicionar ao ecrã principal', 'adicionar à tela de início'],
  ['ao ecrã principal', 'à tela de início'],
  ['no ecrã principal', 'na tela de início'],
  ['do ecrã principal', 'da tela de início'],
  ['o ecrã principal', 'a tela de início'],
  ['ecrã principal', 'tela de início'],
  ['ecrã bloqueado', 'tela bloqueada'],
  ['ecrã ligado', 'tela ligada'],
  ['ecrã inteiro', 'tela inteira'],
  ['ecrã cheio', 'tela cheia'],
  ['no ecrã', 'na tela'],
  ['do ecrã', 'da tela'],
  ['ao ecrã', 'à tela'],
  ['pelo ecrã', 'pela tela'],
  ['este ecrã', 'esta tela'],
  ['neste ecrã', 'nesta tela'],
  ['deste ecrã', 'desta tela'],
  ['um ecrã', 'uma tela'],
  ['o ecrã', 'a tela'],
  ['os ecrãs', 'as telas'],
  ['ecrãs', 'telas'],
  ['ecrã', 'tela'],
  // menu do iPhone
  ['Definições → [o seu nome] → Subscrições', 'Ajustes → [o seu nome] → Assinaturas'],
  // cupão → cupom; bónus → bônus
  ['cupões', 'cupons'],
  ['cupão', 'cupom'],
  ['bónus', 'bônus'],
  // ginásio (masculino) → academia (feminino)
  ['no ginásio', 'na academia'],
  ['do ginásio', 'da academia'],
  ['ao ginásio', 'à academia'],
  ['pelo ginásio', 'pela academia'],
  ['o ginásio', 'a academia'],
  ['um ginásio', 'uma academia'],
  ['ginásios', 'academias'],
  ['ginásio', 'academia'],
  // frigorífico (masculino) → geladeira (feminino)
  ['no frigorífico', 'na geladeira'],
  ['do frigorífico', 'da geladeira'],
  ['o frigorífico', 'a geladeira'],
  ['frigorífico', 'geladeira'],
  // aparelhos e conta
  ['telemóveis', 'celulares'],
  ['telemóvel', 'celular'],
  ['palavras-passe', 'senhas'],
  ['palavra-passe', 'senha'],
  ['utilizadores', 'usuários'],
  ['utilizadora', 'usuária'],
  ['utilizador', 'usuário'],
  ['utilizar', 'usar'],
  ['ficheiros', 'arquivos'],
  ['ficheiro', 'arquivo'],
  ['descarregar', 'baixar'],
  ['descarregue', 'baixe'],
  ['descarregado', 'baixado'],
  ['carregue-o', 'envie-o'],
  ['carregue', 'envie'],
  ['a sua alcunha', 'o seu apelido'],
  ['sua alcunha', 'seu apelido'],
  ['a alcunha', 'o apelido'],
  ['da alcunha', 'do apelido'],
  ['na alcunha', 'no apelido'],
  ['uma alcunha', 'um apelido'],
  ['as alcunhas', 'os apelidos'],
  ['alcunhas', 'apelidos'],
  ['alcunha', 'apelido'],
  ['definições', 'ajustes'],
  ['equipas', 'equipes'],
  ['equipa', 'equipe'],
  ['connosco', 'conosco'],
  ['contactos', 'contatos'],
  ['contacto', 'contato'],
  ['contactar', 'contatar'],
  ['contacte', 'contate'],
  ['por omissão', 'por padrão'],
  ['de seguida', 'em seguida'],
  ['casa de banho', 'banheiro'],
  ['auscultadores', 'fones de ouvido'],
  ['rastreios', 'exames preventivos'],
  ['rastreio', 'exame preventivo'],
  ['cópias de segurança', 'backups'],
  ['cópia de segurança', 'backup'],
  ['num sítio seguro', 'num lugar seguro'],
  ['num só sítio', 'num só lugar'],
  ['apanhar ar', 'tomar um ar'],
  ['apanhar sol', 'tomar sol'],
  ['a meio da tarde', 'no meio da tarde'],
  ['a meio da noite', 'no meio da noite'],
  ['assim-assim', 'mais ou menos'],
  ['uma sesta longa', 'um cochilo longo'],
  ['uma frescura', 'um frescor'],
  ['noite má', 'noite ruim'],
  ['outra divisão', 'outro cômodo'],
  ['fique só a respirar', 'fique só respirando'],
  ['fique assim, a respirar', 'fique assim, respirando'],
  ['fique sentado a respirar', 'fique sentado respirando'],
  ['a soltar bem o ar', 'soltando bem o ar'],
  ['os ombros a descer', 'os ombros descendo'],
  ['as costas a espalharem-se', 'as costas se espalhando'],
  ['a entrar e a sair', 'entrando e saindo'],
  ['de pedra, a afundar', 'de pedra, afundando'],
  ['quase a flutuar', 'quase flutuando'],
  ['só a descansar', 'só descansando'],
  ['ou a amamentar', 'ou amamentando'],
  ['altifalante', 'alto-falante'],
  ['arrefece', 'esfria'],
  ['formigueiro', 'formigamento'],
  ['embaciasse', 'embaçasse'],
  ['insónia', 'insônia'],
  ['abrandar', 'desacelerar'],
  ['uma almofada', 'um travesseiro'],
  ['contra a almofada', 'contra o travesseiro'],
  ['a almofada', 'o travesseiro'],
  ['da almofada', 'do travesseiro'],
  ['na almofada', 'no travesseiro'],
  ['pela almofada', 'pelo travesseiro'],
  ['almofadas', 'travesseiros'],
  ['almofada', 'travesseiro'],
  ['deitei-me', 'deitei'],
  ['levantei-me', 'levantei'],
  ['fico às voltas na cama', 'fico rolando na cama'],
  ['ficar às voltas na cama', 'ficar rolando na cama'],
  ['às voltas na cama', 'rolando na cama'],
  ['pensamentos às voltas', 'pensamentos que não param'],
  ['ao fim de semana', 'no fim de semana'],
  ['se fizer sesta', 'se tirar um cochilo'],
  ['uma sesta', 'um cochilo'],
  ['sestas', 'cochilos'],
  ['sesta', 'cochilo'],
  ['apanhar 10 a 30 minutos de luz', 'tomar 10 a 30 minutos de luz'],
  ['apanhe luz', 'tome luz'],
  ['apanhar luz', 'tomar luz'],
  ['não conduza', 'não dirija'],
  ['conduzir', 'dirigir'],
  ['duche', 'chuveiro'],
  ['frescura', 'frescor'],
  ['omoplatas', 'escápulas'],
  ['Ressonar', 'Roncar'],
  ['ressonar', 'roncar'],
  ['Ressona', 'Ronca'],
  ['ressona', 'ronca'],
  ['Baralhar a mente', 'Embaralhar a mente'],
  ['a baralhar', 'a embaralhar'],
  ['Baralhar', 'Embaralhar'],
  ['baralhar', 'embaralhar'],
  ['desliga-se sozinho', 'se desliga sozinho'],
  ['a meio da manhã', 'no meio da manhã'],
  ['ficou a meio', 'ficou pela metade'],
  ['toda a gente', 'todo mundo'],
  // "si" (tratamento) → "você"
  ['para si', 'para você'],
  ['sobre si', 'sobre você'],
  ['de si', 'de você'],
  ['a si', 'a você'],
  ['por si', 'por você'],
  ['convosco', 'com vocês'],
  // "partilha": nome (compartilhamento) só com artigo ou adjetivo; sozinho é o verbo (compartilha)
  ['partilha controlada', 'compartilhamento controlado'],
  ['a partilha', 'o compartilhamento'],
  ['da partilha', 'do compartilhamento'],
  ['na partilha', 'no compartilhamento'],
  ['pela partilha', 'pelo compartilhamento'],
  ['uma partilha', 'um compartilhamento'],
  ['partilhas', 'compartilhamentos'],
  ['partilha', 'compartilha'],
  ['respetivas', 'respectivas'],
  ['respetivos', 'respectivos'],
  ['respetiva', 'respectiva'],
  ['respetivo', 'respectivo'],
  ['hidratos de carbono', 'carboidratos'],
  ['hidratos', 'carboidratos'],
  ['lípidos', 'gorduras'],
  ['partilha:', 'compartilhamento:'],
  ['boletim de análises', 'resultado de exames'],
  ['boletins de análises', 'resultados de exames'],
  ['secções', 'seções'],
  ['secção', 'seção'],
  ['receção', 'recepção'],
  ['de facto', 'de fato'],
  ['facto', 'fato'],
  ['factos', 'fatos'],
  ['cancro', 'câncer'],
  // corpo e treino
  ['relação cintura-anca', 'relação cintura-quadril'],
  ['cintura-anca', 'cintura-quadril'],
  ['a anca', 'o quadril'],
  ['da anca', 'do quadril'],
  ['na anca', 'no quadril'],
  ['pela anca', 'pelo quadril'],
  ['as ancas', 'os quadris'],
  ['das ancas', 'dos quadris'],
  ['nas ancas', 'nos quadris'],
  ['ancas', 'quadris'],
  ['anca', 'quadril'],
  ['gémeos em pé', 'panturrilha em pé'],
  ['elevação de gémeos', 'elevação de panturrilha'],
  ['passadeira / esteira', 'esteira'],
  ['passadeira', 'esteira'],
  ['elíptica / elíptico', 'elíptico'],
  // internet e aparelhos
  ['sem ligação à internet', 'sem conexão com a internet'],
  ['ligação à internet', 'conexão com a internet'],
  ['sem ligação', 'sem conexão'],
  // saúde
  ['citologia', 'papanicolau'],
  ['tensão arterial', 'pressão arterial'],
  ['tensão alta', 'pressão alta'],
  ['tensão baixa', 'pressão baixa'],
  ['obstipação', 'prisão de ventre'],
  ['médicos de família', 'clínicos gerais'],
  ['médico de família', 'clínico geral'],
  ['penso', 'absorvente'],
  ['tampão', 'absorvente interno'],
  ['copo menstrual', 'coletor menstrual'],
  // alimentação
  ['pequenos-almoços', 'cafés da manhã'],
  ['pequeno-almoço', 'café da manhã'],
  ['pequeno almoço', 'café da manhã'],
  ['p. almoço', 'café da manhã'],
  ['sumos', 'sucos'],
  ['sumo', 'suco'],
  ['gelados', 'sorvetes'],
  ['gelado', 'sorvete'],
  ['fiambre', 'presunto cozido'],
  ['ananás', 'abacaxi'],
  ['papaia (mamão)', 'mamão (papaia)'],
  ['papaia', 'mamão'],
  ['frutos secos', 'oleaginosas'],
  ['frutos vermelhos', 'frutas vermelhas'],
  ['manteiga de amendoim', 'pasta de amendoim'],
  ['queijo flamengo', 'queijo prato'],
  ['esparguete', 'espaguete'],
  ['puré', 'purê'],
  ['as bolachas', 'os biscoitos'],
  ['uma bolacha', 'um biscoito'],
  ['bolachas', 'biscoitos'],
  ['bolacha', 'biscoito'],
  ['as natas', 'o creme de leite'],
  ['com natas', 'com creme de leite'],
  ['natas', 'creme de leite'],
  ['leite meio-gordo', 'leite semidesnatado'],
  ['leite magro', 'leite desnatado'],
  ['chávena', 'xícara'],
  ['tosta mista', 'misto-quente'],
  ['tostas', 'torradas'],
  ['tosta', 'torrada'],
  ['bica', 'cafezinho'],
  ['galão', 'café com leite'],
  ['autocarro', 'ônibus'],
  ['comboio', 'trem'],
  // ortografia (acentos e consoantes)
  ['anónimas', 'anônimas'],
  ['anónimos', 'anônimos'],
  ['anónima', 'anônima'],
  ['anónimo', 'anônimo'],
  ['económicas', 'econômicas'],
  ['económicos', 'econômicos'],
  ['económica', 'econômica'],
  ['económico', 'econômico'],
  ['quilómetros', 'quilômetros'],
  ['quilómetro', 'quilômetro'],
  ['fenómeno', 'fenômeno'],
  ['géneros', 'gêneros'],
  ['género', 'gênero'],
  ['ténis', 'tênis'],
  ['bebés', 'bebês'],
  ['bebé', 'bebê'],
  ['prémios', 'prêmios'],
  ['prémio', 'prêmio'],
  ['ómega', 'ômega'],
  ['académica', 'acadêmica'],
  ['académico', 'acadêmico'],
  ['cómodo', 'cômodo'],
  ['atómico', 'atômico'],
  ['polémica', 'polêmica'],
  ['efémero', 'efêmero'],
  ['António', 'Antônio'],
  // guardar → salvar (gravar); "guarda/guardamos" (manter) ficam
  ['guardados', 'salvos'],
  ['guardadas', 'salvas'],
  ['guardado', 'salvo'],
  ['guardada', 'salva'],
  ['guardar', 'salvar'],
  ['guarde', 'salve'],
  // partilhar → compartilhar
  ['partilhar', 'compartilhar'],
  ['partilhe', 'compartilhe'],
  ['partilhou', 'compartilhou'],
  ['partilham', 'compartilham'],
  ['partilhamos', 'compartilhamos'],
  ['partilhados', 'compartilhados'],
  ['partilhadas', 'compartilhadas'],
  ['partilhado', 'compartilhado'],
  ['partilhada', 'compartilhada'],
  ['partilhá-lo', 'compartilhá-lo'],
  ['partilhá-la', 'compartilhá-la'],
];

// ecrã + adjetivo com o artigo antes ("o ecrã ligado" → "a tela ligada")
const ART: [string, string][] = [['o', 'a'], ['no', 'na'], ['do', 'da'], ['ao', 'à'], ['pelo', 'pela'], ['este', 'esta'], ['neste', 'nesta'], ['um', 'uma']];
for (const [adjM, adjF] of [['bloqueado', 'bloqueada'], ['ligado', 'ligada'], ['inteiro', 'inteira'], ['cheio', 'cheia'], ['apagado', 'apagada']])
  for (const [a, b] of ART) PAIRS.push([`${a} ecrã ${adjM}`, `${b} tela ${adjF}`]);

const L = 'a-zA-ZÀ-ÖØ-öø-ÿ';
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const MAP = new Map<string, string>();
for (const [a, b] of PAIRS) MAP.set(a.toLowerCase(), b);
// uma só expressão regular para tudo (mais rápido): as expressões mais longas primeiro
const WORDS = new RegExp(
  `(?<![${L}\\d-])(${[...MAP.keys()].sort((a, b) => b.length - a.length).map(esc).join('|')})(?![${L}\\d])`,
  'giu',
);

/** Mantém a maiúscula inicial (ou tudo em maiúsculas) do texto original. */
function keepCase(from: string, to: string) {
  if (from === from.toUpperCase() && from !== from.toLowerCase() && from.length > 1) return to.toUpperCase();
  if (from[0] !== from[0].toLowerCase()) return to[0].toUpperCase() + to.slice(1);
  return to;
}

/** registar/registo/registado… → registrar/registro/registrado… */
const REGIST = /(?<![a-zà-ÿ])([Rr]egist)(?=[aeoáéó])/g;

/** Gerúndio: ler → lendo, fazer → fazendo, ouvir → ouvindo, pôr → pondo. */
export function gerund(inf: string) {
  if (/pôr$/.test(inf)) return inf.replace(/pôr$/, 'pondo');
  return inf.replace(/ar$/, 'ando').replace(/er$/, 'endo').replace(/ir$/, 'indo');
}

/** "está a ler" → "está lendo"; "continua a treinar" → "continua treinando". */
const PROGRESSIVE = new RegExp(
  `(?<![${L}])((?:est(?:ou|á|ás|amos|ão|ava|avas|ávamos|avam|ar|eja|ejam|ive|eve|iver)|continu(?:a|o|e|as|am|amos|ar|em)|fic(?:a|o|as|am|amos|ar)|and(?:a|o|as|am|amos|ar))\\s+)a\\s+([a-zà-ÿ]+(?:ar|er|ir)|pôr)(?![${L}-])`,
  'giu',
);

/** Estados no início de uma frase com reticências: "A ler o relatório…" → "Lendo o relatório…". */
const STATUS = new RegExp(`^(\\s*)A\\s+([a-zà-ÿ]+(?:ar|er|ir))(?![${L}-])(?=[^…]*…)`, 'u');

/** Converte um texto de português de Portugal para português do Brasil. */
/** Textos que, sozinhos (um botão ou um título), têm outra tradução. */
const WHOLE: Record<string, string> = { Partilha: 'Compartilhamento', Partilhar: 'Compartilhar' };

export function toBR(text: string): string {
  if (!text || !/[A-Za-zÀ-ÿ]/.test(text)) return text;
  const whole = WHOLE[text.trim()];
  if (whole) return text.replace(text.trim(), whole);
  let t = text.replace(STATUS, (_m, sp: string, v: string) => {
    const g = gerund(v);
    return sp + g[0].toUpperCase() + g.slice(1);
  });
  t = t.replace(PROGRESSIVE, (_m, aux: string, v: string) => aux + gerund(v));
  t = t.replace(REGIST, '$1r');
  t = t.replace(WORDS, (m) => keepCase(m, MAP.get(m.toLowerCase()) ?? m));
  return t;
}
