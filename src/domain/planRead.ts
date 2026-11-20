import { PHOTO_API, PhotoError, deviceId } from './photo';
import type { FoodEntry, MealKey } from './foods';

export interface PlanItem { name: string; quantity: string; grams: number; kcal: number; protein_g: number; carbs_g: number; fat_g: number }
export interface PlanMeal { meal: 'pa' | 'almoco' | 'lanche' | 'jantar' | 'ceia' | 'outro'; label: string; time: string; options: { name: string; items: PlanItem[] }[] }
export interface ParsedPlan { is_plan: boolean; meals: PlanMeal[]; daily_kcal: number; daily_protein_g: number; professional: string; notes: string }

/** Formatos que o Claude lê diretamente. */
const DIRECT = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const toBase64 = (buf: ArrayBuffer) => {
  let s = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

/** Prepara o ficheiro: PDF e imagens vão como estão; Excel, CSV e Word viram texto no telemóvel. */
export async function preparePlan(file: Blob, name: string): Promise<{ file?: string; media_type?: string; text?: string }> {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const type = file.type || (ext === 'pdf' ? 'application/pdf' : '');
  if (DIRECT.includes(type)) return { file: toBase64(await file.arrayBuffer()), media_type: type };
  if (ext === 'xlsx') {
    const { default: readXlsxFile, readSheetNames } = await import('read-excel-file');
    const sheets = await readSheetNames(file);
    let text = '';
    for (const sheet of sheets) {
      const rows = await readXlsxFile(file, { sheet });
      text += `\n## ${sheet}\n` + rows.map((r) => r.filter((c) => c !== null && c !== '').join(' | ')).filter(Boolean).join('\n');
    }
    return { text };
  }
  if (ext === 'docx') {
    const mammoth = (await import('mammoth/mammoth.browser.min.js')).default as { extractRawText: (i: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }> };
    return { text: (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value };
  }
  if (['csv', 'txt'].includes(ext) || type.startsWith('text/')) return { text: await file.text() };
  throw new PhotoError('Este formato ainda não pode ser lido. Guarde o plano como PDF (ou Excel .xlsx / Word .docx) e carregue de novo.', 415);
}

export async function readPlan(file: Blob, name: string): Promise<ParsedPlan & { remaining?: number }> {
  const payload = await preparePlan(file, name);
  let res: Response;
  try {
    res = await fetch(`${PHOTO_API.replace(/\/$/, '')}/plano`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, name, device: deviceId() }),
    });
  } catch {
    throw new PhotoError('Sem ligação à internet. Tente outra vez.', 0);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new PhotoError(body.error || 'Não foi possível ler o plano.', res.status);
  return body;
}

/** Refeição do diário correspondente (a ceia junta-se ao jantar; "outro" ao lanche). */
export const diaryMeal = (m: PlanMeal['meal']): MealKey => (m === 'ceia' ? 'jantar' : m === 'outro' ? 'lanche' : m);

export function planEntries(items: PlanItem[]): FoodEntry[] {
  return items.map((it, i) => ({
    id: `plano-${Date.now().toString(36)}-${i}-${Math.random().toString(36).slice(2, 5)}`,
    name: `${it.name}${it.quantity ? ` (${it.quantity})` : ''}`,
    grams: Math.round(it.grams || 0),
    kcal: Math.round(it.kcal || 0),
    p: Math.round((it.protein_g || 0) * 10) / 10,
    c: Math.round((it.carbs_g || 0) * 10) / 10,
    f: Math.round((it.fat_g || 0) * 10) / 10,
  }));
}
