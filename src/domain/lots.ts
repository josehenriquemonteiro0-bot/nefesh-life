/**
 * Frascos, lotes e leitura do QR code.
 *
 * O stock é contado em "cápsulas-equivalentes" de 0,5 g, para que cápsulas,
 * pó e Nibs somem no mesmo total.
 */

export type ProductId = 'caps' | 'po' | 'nibs';

export interface Product {
  id: ProductId;
  name: string;
  /** conteúdo da embalagem em gramas */
  grams: number;
  unit: string;
  /** tamanho da embalagem ainda por confirmar com a NEFESH */
  confirmar?: boolean;
}

export const PRODUCTS: Record<ProductId, Product> = {
  caps: { id: 'caps', name: 'Pure Spirulina · 120 cápsulas', grams: 60, unit: '120 cápsulas de 500 mg' },
  po: { id: 'po', name: 'Spirulina em pó', grams: 100, unit: '100 g', confirmar: true },
  nibs: { id: 'nibs', name: 'Spirulina Nibs', grams: 100, unit: '100 g', confirmar: true },
};

/** Cápsulas-equivalentes (0,5 g) numa embalagem. */
export const capsEquivalent = (p: ProductId) => Math.round(PRODUCTS[p].grams * 2);

export interface LotAnalysis {
  code: string;
  lab: string;
  date: string;
  /** valores por 100 g, com a referência e a posição face à literatura */
  values: { key: string; label: string; value: number; unit: string; ref: string; pos: 'acima' | 'alinhado' | 'abaixo' | 'usp' | 'base' }[];
  /** minerais em mg/100 g, para calcular o que a dose fornece */
  minerals: Record<'ferro' | 'calcio' | 'magnesio' | 'potassio' | 'zinco' | 'fosforo', number>;
  notes: string[];
}

/** Valores de referência de nutrientes (VRN) da UE, Regulamento 1169/2011, em mg. */
export const NRV: Record<keyof LotAnalysis['minerals'], { label: string; mg: number }> = {
  ferro: { label: 'Ferro', mg: 14 },
  calcio: { label: 'Cálcio', mg: 800 },
  magnesio: { label: 'Magnésio', mg: 375 },
  potassio: { label: 'Potássio', mg: 2000 },
  zinco: { label: 'Zinco', mg: 10 },
  fosforo: { label: 'Fósforo', mg: 700 },
};

/** Laudos conhecidos. Na versão com servidor, isto vem de uma base de dados de lotes. */
export const LOTS: Record<string, LotAnalysis> = {
  GCL_26_1372: {
    code: 'GCL_26_1372',
    lab: 'GreenCoLab',
    date: '2026-09-17',
    values: [
      { key: 'carot', label: 'Carotenoides totais', value: 830, unit: 'mg/100 g', ref: 'Literatura 30–380 mg · mínimo USP 350 mg', pos: 'acima' },
      { key: 'pc', label: 'Ficocianina', value: 7.8, unit: 'g/100 g', ref: 'Mínimo USP 6 g · literatura 10–20 g', pos: 'usp' },
      { key: 'fe', label: 'Ferro', value: 26, unit: 'mg/100 g', ref: 'Literatura ~26,6–28,5 mg', pos: 'alinhado' },
      { key: 'k', label: 'Potássio', value: 1566, unit: 'mg/100 g', ref: 'Literatura ~1 363 mg', pos: 'acima' },
      { key: 'ca', label: 'Cálcio', value: 124, unit: 'mg/100 g', ref: 'Literatura ~108 mg', pos: 'acima' },
      { key: 'abts', label: 'Atividade antioxidante (ABTS)', value: 383.17, unit: 'mg TE/100 g', ref: 'Sem faixa padronizada: linha de base interna', pos: 'base' },
    ],
    minerals: { ferro: 26, calcio: 124, magnesio: 216, potassio: 1566, zinco: 2, fosforo: 664 },
    notes: [
      'A vitamina B12 medida inclui pseudovitamina B12, que o corpo não usa. Por isso não a apresentamos como fonte de B12.',
      'Este laudo descreve a composição nutricional. As análises de contaminantes (microcistinas, metais pesados) estão num relatório à parte.',
    ],
  },
};

export interface ScanResult {
  code: string | null;
  url: string | null;
  product: ProductId | null;
  raw: string;
}

const CODE_RE = /\b([A-Z]{2,6}[_-]\d{2}[_-]\d{2,8}|L\d{4,12}|LOTE?[_-]?[A-Z0-9]{3,12})\b/i;

/** Interpreta o texto de um QR code: um URL com parâmetros, um código de lote, ou texto livre. */
export function parseScan(raw: string): ScanResult {
  const text = raw.trim();
  let url: string | null = null;
  let code: string | null = null;
  let product: ProductId | null = null;
  try {
    const u = new URL(text);
    if (u.protocol === 'http:' || u.protocol === 'https:') {
      url = u.toString();
      for (const k of ['lote', 'lot', 'batch', 'l', 'laudo', 'code']) {
        const v = u.searchParams.get(k);
        if (v) { code = v; break; }
      }
      const p = (u.searchParams.get('p') || u.searchParams.get('produto') || u.searchParams.get('product') || '').toLowerCase();
      if (p) product = detectProduct(p);
      if (!code) {
        const m = decodeURIComponent(u.pathname).match(CODE_RE);
        if (m) code = m[1];
      }
    }
  } catch {
    /* não é URL */
  }
  if (!code) {
    const m = text.match(CODE_RE);
    if (m) code = m[1];
  }
  if (!product) product = detectProduct(text.toLowerCase());
  return { code: code ? normalizeCode(code) : null, url, product, raw: text };
}

export const normalizeCode = (c: string) => c.trim().toUpperCase().replace(/-/g, '_');

function detectProduct(s: string): ProductId | null {
  if (/nibs|palhinha|crunch/.test(s)) return 'nibs';
  if (/\b(po|pó|powder|pulver)\b/.test(s)) return 'po';
  if (/caps|cápsula|capsula|tablet|comprimido/.test(s)) return 'caps';
  return null;
}

export const lotFor = (code: string | null | undefined) => (code ? LOTS[normalizeCode(code)] ?? null : null);

/** Quanto de cada mineral fornece uma dose diária, em mg e em % do VRN. */
export function doseNutrients(lot: LotAnalysis, grams: number) {
  return (Object.keys(NRV) as (keyof LotAnalysis['minerals'])[]).map((k) => {
    const mg = (lot.minerals[k] * grams) / 100;
    return { key: k, label: NRV[k].label, mg, pct: (mg / NRV[k].mg) * 100 };
  });
}
