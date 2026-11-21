/**
 * Envia ao servidor uma foto do rótulo (tabela nutricional) ou um boletim de análises
 * (foto ou PDF) e devolve os dados já no formato da app. O documento não é guardado.
 */
import { compressImage, deviceId, PHOTO_API } from './photo';
import { labDef, newId, type LabResult } from './care';
import { notePremiumUse } from './analytics';
import type { ScannedFood } from './barcode';

const toBase64 = (b: Blob) =>
  new Promise<string>((ok, fail) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).slice(String(r.result).indexOf(',') + 1));
    r.onerror = () => fail(r.error);
    r.readAsDataURL(b);
  });

async function post<T>(path: string, file: Blob): Promise<T> {
  const isPdf = file.type === 'application/pdf';
  if (isPdf && file.size > 6 * 1024 * 1024) throw new Error('O PDF é demasiado grande (máximo 6 MB).');
  const body = isPdf ? { file: await toBase64(file), media_type: 'application/pdf' } : await compressImage(file, 1600).then((i) => ({ file: i.data, media_type: i.media_type }));
  let res: Response;
  try {
    res = await fetch(`${PHOTO_API}/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, device: deviceId() }) });
  } catch {
    throw new Error('Sem ligação à internet. Tente outra vez.');
  }
  const out = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(out.error || 'Não foi possível ler. Tente outra vez com melhor luz.');
  return out;
}

/** Tabela nutricional fotografada → produto (guardado com o código de barras, se houver). */
export async function readLabel(photo: Blob, code: string): Promise<ScannedFood> {
  const r = await post<{ is_label: boolean; name: string; brand: string; kcal: number; protein_g: number; carbs_g: number; sugar_g: number; fat_g: number; salt_g: number; fiber_g: number; serving_g: number }>('rotulo', photo);
  if (!r.is_label) throw new Error('Não encontrei uma tabela nutricional na foto. Fotografe de perto, com a tabela inteira e legível.');
  return {
    code: code || `rotulo-${Date.now().toString(36)}`,
    name: r.name.trim() || 'Produto',
    brand: r.brand.trim() || undefined,
    kcal: Math.round(r.kcal),
    p: r.protein_g,
    c: r.carbs_g,
    f: r.fat_g,
    sugar: r.sugar_g,
    salt: r.salt_g,
    fiber: r.fiber_g || undefined,
    serving: r.serving_g > 0 ? r.serving_g : undefined,
    source: 'rotulo',
  };
}

/** Converte os resultados lidos para as análises da app. */
export function toLabResults(r: { date: string; results: { key: string; name: string; value: number; unit: string; ref_low: number; ref_high: number }[] }, fallbackDate: string): LabResult[] {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? r.date : fallbackDate;
  return r.results
    .filter((x) => Number.isFinite(x.value))
    .map((x) => {
      const def = x.key ? labDef(x.key) : undefined;
      // unidade diferente da da app: guarda como análise à parte (não mistura escalas)
      const same = def && def.unit.toLowerCase().replace(/\s/g, '') === x.unit.toLowerCase().replace(/\s/g, '');
      const key = def && same ? def.key : `outra:${x.name.trim().toLowerCase()}`;
      const lo = x.ref_low >= 0 ? x.ref_low : null;
      const hi = x.ref_high >= 0 ? x.ref_high : null;
      return {
        id: newId(),
        date,
        key,
        name: def && same ? def.name : x.name.trim(),
        value: x.value,
        unit: def && same ? def.unit : x.unit,
        ...(lo !== null || hi !== null ? { lo, hi } : {}),
      };
    });
}

/** Boletim de análises (foto ou PDF) → resultados para confirmar. */
export async function readLabs(file: Blob, fallbackDate: string) {
  notePremiumUse('lerPlano');
  const r = await post<{ is_labs: boolean; date: string; results: { key: string; name: string; value: number; unit: string; ref_low: number; ref_high: number }[] }>('analises', file);
  if (!r.is_labs || !r.results.length) throw new Error('Não encontrei resultados de análises neste documento.');
  return { date: r.date, results: toLabResults(r, fallbackDate) };
}

