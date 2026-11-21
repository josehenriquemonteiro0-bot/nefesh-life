/**
 * Link para ler o versículo na Bíblia online (YouVersion / bible.com; no telemóvel com a
 * app Bíblia instalada, abre na app). Converte "Salmos 119:37", "2 Reis 4:1-7" ou "Daniel 6"
 * para o formato do site (PSA.119.37, 2KI.4.1-7, DAN.6).
 */
const BOOKS: Record<string, string> = {
  'génesis': 'GEN', 'gênesis': 'GEN', 'êxodo': 'EXO', 'levítico': 'LEV', 'números': 'NUM', 'deuteronómio': 'DEU', 'deuteronômio': 'DEU',
  'josué': 'JOS', 'juízes': 'JDG', 'rute': 'RUT', '1 samuel': '1SA', '2 samuel': '2SA', '1 reis': '1KI', '2 reis': '2KI',
  '1 crónicas': '1CH', '1 crônicas': '1CH', '2 crónicas': '2CH', '2 crônicas': '2CH', 'esdras': 'EZR', 'neemias': 'NEH', 'ester': 'EST',
  'jó': 'JOB', 'salmos': 'PSA', 'salmo': 'PSA', 'provérbios': 'PRO', 'eclesiastes': 'ECC', 'cânticos': 'SNG', 'cantares': 'SNG',
  'isaías': 'ISA', 'jeremias': 'JER', 'lamentações': 'LAM', 'ezequiel': 'EZK', 'daniel': 'DAN', 'oseias': 'HOS', 'oséias': 'HOS',
  'joel': 'JOL', 'amós': 'AMO', 'obadias': 'OBA', 'jonas': 'JON', 'miqueias': 'MIC', 'miquéias': 'MIC', 'naum': 'NAM',
  'habacuque': 'HAB', 'sofonias': 'ZEP', 'ageu': 'HAG', 'zacarias': 'ZEC', 'malaquias': 'MAL',
  'mateus': 'MAT', 'marcos': 'MRK', 'lucas': 'LUK', 'joão': 'JHN', 'atos': 'ACT', 'romanos': 'ROM',
  '1 coríntios': '1CO', '2 coríntios': '2CO', 'gálatas': 'GAL', 'efésios': 'EPH', 'filipenses': 'PHP', 'colossenses': 'COL',
  '1 tessalonicenses': '1TH', '2 tessalonicenses': '2TH', '1 timóteo': '1TI', '2 timóteo': '2TI', 'tito': 'TIT', 'filemom': 'PHM',
  'hebreus': 'HEB', 'tiago': 'JAS', '1 pedro': '1PE', '2 pedro': '2PE', '1 joão': '1JN', '2 joão': '2JN', '3 joão': '3JN',
  'judas': 'JUD', 'apocalipse': 'REV',
};

/** Tradução usada nos links: Nova Versão Internacional em português (id 129 no bible.com). */
const VERSION = { id: 129, abbr: 'NVI' };

/** Código do passo ("PSA.119.37"), ou null se a referência não for reconhecida. */
export function passageCode(ref: string): string | null {
  const m = ref.trim().match(/^(.+?)\s+(\d+)(?::(\d+(?:-\d+)?))?$/);
  if (!m) return null;
  const book = BOOKS[m[1].toLowerCase()];
  if (!book) return null;
  return [book, m[2], m[3]].filter(Boolean).join('.');
}

/** Link para ler o passo na Bíblia online, ou null. */
export function bibleLink(ref: string): string | null {
  const code = passageCode(ref);
  return code ? `https://www.bible.com/pt/bible/${VERSION.id}/${code}.${VERSION.abbr}` : null;
}
