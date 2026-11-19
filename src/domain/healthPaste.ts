/**
 * Lê o texto copiado pelo atalho "NEFESH Saúde" do iPhone.
 *
 * Formato recomendado:  NEFESH passos=7200 sono=7,5
 * O leitor aceita também variações que o Atalhos produz conforme a língua e a
 * versão do iOS: "7 200", "7.200", "7,53", "7:30", "7 h 30 min", minutos ou segundos.
 */
export interface PastedHealth {
  steps?: number;
  sleepH?: number;
}

const num = (s: string) => Number(s.replace(',', '.'));

/** Converte uma duração de sono em horas, com arredondamento a 0,5 h. */
export function parseSleep(raw: string): number | undefined {
  const t = raw.trim().toLowerCase();
  if (!t) return undefined;
  let h: number | undefined;
  const hm = t.match(/(\d+)\s*(?:h|hr|hrs|horas?)\s*(?:e\s*)?(\d+)?\s*(?:m|min|minutos?)?/);
  const colon = t.match(/^(\d{1,2}):(\d{2})/);
  if (colon) h = +colon[1] + +colon[2] / 60;
  else if (hm) h = +hm[1] + (hm[2] ? +hm[2] / 60 : 0);
  else {
    const m = t.match(/[\d]+(?:[.,]\d+)?/);
    if (!m) return undefined;
    const v = num(m[0]);
    if (/min/.test(t)) h = v / 60;
    else if (/seg|sec|\bs\b/.test(t)) h = v / 3600;
    else if (v > 1000) h = v / 3600; // segundos
    else if (v > 24) h = v / 60; // minutos
    else h = v;
  }
  if (h === undefined || !Number.isFinite(h) || h <= 0 || h > 24) return undefined;
  return Math.round(h * 2) / 2;
}

/** Converte passos, ignorando separadores de milhares e casas decimais. */
export function parseSteps(raw: string): number | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  // "7 200", "7.200" e "7,200" são milhares; "7200,4" é uma soma com decimais
  const m = t.match(/\d[\d\s.,  ]*/);
  if (!m) return undefined;
  let s = m[0].replace(/[\s  ]/g, '');
  const dec = s.match(/[.,](\d{1,2})$/);
  if (dec) s = s.slice(0, -dec[0].length);
  const v = Number(s.replace(/[.,]/g, ''));
  if (!Number.isFinite(v) || v < 0 || v > 150000) return undefined;
  return Math.round(v);
}

export function parseHealthPaste(text: string): PastedHealth {
  const out: PastedHealth = {};
  const steps = text.match(/passos\s*[=:]\s*([^\n|;]+?)(?=\s+sono\b|[|;\n]|$)/i);
  const sleep = text.match(/sono\s*[=:]\s*([^\n|;]+?)(?=\s+passos\b|[|;\n]|$)/i);
  if (steps) out.steps = parseSteps(steps[1]);
  if (sleep) out.sleepH = parseSleep(sleep[1]);
  if (out.steps === undefined) delete out.steps;
  if (out.sleepH === undefined) delete out.sleepH;
  return out;
}
