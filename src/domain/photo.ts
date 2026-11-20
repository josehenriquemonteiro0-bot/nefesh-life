import type { FoodEntry, MealKey } from './foods';

/** Endereço do serviço de fotos (Cloudflare Worker). Pode ser trocado no build com VITE_PHOTO_API. */
export const PHOTO_API: string =
  (import.meta.env.VITE_PHOTO_API as string | undefined)?.trim() || 'https://nefesh-foto.josehenriquemonteiro0.workers.dev';

export interface PhotoItem {
  name: string;
  grams: number;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  confidence: 'alta' | 'media' | 'baixa';
}

export interface PhotoResult {
  is_food: boolean;
  items: PhotoItem[];
  note: string;
}

/** Reduz a foto a no máximo 1024 px (JPEG): menos dados a enviar e menor custo por análise. */
export async function compressImage(file: Blob, max = 1024): Promise<{ data: string; media_type: 'image/jpeg' }> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  const url = canvas.toDataURL('image/jpeg', 0.82);
  return { data: url.slice(url.indexOf(',') + 1), media_type: 'image/jpeg' };
}

export class PhotoError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function analyzePhoto(image: { data: string; media_type: string }, code: string, hint: string): Promise<PhotoResult> {
  let res: Response;
  try {
    res = await fetch(PHOTO_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: image.data, media_type: image.media_type, code, hint }),
    });
  } catch {
    throw new PhotoError('Sem ligação à internet. Tente outra vez.', 0);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new PhotoError(body.error || 'Não foi possível analisar a foto.', res.status);
  return body as PhotoResult;
}

/** Refeição sugerida pela hora do dia. */
export function mealForHour(h: number): MealKey {
  if (h < 11) return 'pa';
  if (h < 15) return 'almoco';
  if (h < 19) return 'lanche';
  return 'jantar';
}

/** Converte um item da foto numa entrada do diário, ajustando à quantidade escolhida. */
export function photoEntry(item: PhotoItem, grams: number): FoodEntry {
  const k = item.grams > 0 ? grams / item.grams : 1;
  const r1 = (n: number) => Math.round(n * k * 10) / 10;
  return {
    id: `foto-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: item.name,
    grams: Math.round(grams),
    kcal: Math.round(item.kcal * k),
    p: r1(item.protein_g),
    c: r1(item.carbs_g),
    f: r1(item.fat_g),
  };
}
