import { PHOTO_API, PhotoError, deviceId } from './photo';

export interface ExerciseTip { steps: string[]; mistakes: string[]; breathing: string; muscles: string; safety: string }

export const tipKey = (name: string) => name.trim().toLowerCase();

/** Pesquisa de vídeos no YouTube (não pesa nada na app). */
export const videoSearchUrl = (name: string) => `https://www.youtube.com/results?search_query=${encodeURIComponent(`${name} execução correta`)}`;

export async function fetchTip(name: string, notes?: string): Promise<ExerciseTip> {
  let res: Response;
  try {
    res = await fetch(`${PHOTO_API.replace(/\/$/, '')}/dica`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, notes, device: deviceId() }),
    });
  } catch {
    throw new PhotoError('Sem ligação à internet. Tente outra vez.', 0);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new PhotoError(body.error || 'Não foi possível obter as dicas.', res.status);
  return body as ExerciseTip;
}
