/**
 * Biblioteca de vídeos NEFESH: um vídeo de demonstração por exercício, escolhido pela equipa
 * (agora links do YouTube/Instagram; depois os vídeos próprios da NEFESH). O aluno vê-o quando
 * o personal não pôs um vídeo seu.
 */
import { LIBRARY, GROUP_NAME } from '../../src/domain/proLibrary';
import { GYM } from '../../src/domain/gymData';
import type { DB } from './social';
import { videoUrl } from './pro';

export const exKey = (name: string) => name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Exercícios da biblioteca do Pro e do ginásio, por grupo. */
export function allExercises() {
  const seen = new Set<string>();
  const out: { name: string; group: string }[] = [];
  const add = (name: string, group: string) => { const k = exKey(name); if (!seen.has(k)) { seen.add(k); out.push({ name, group }); } };
  for (const e of LIBRARY) add(e.name, GROUP_NAME[e.group]);
  for (const e of Object.values(GYM)) add(e.name, e.area);
  return out;
}

export async function videoMap(db: DB): Promise<Record<string, string>> {
  const { results } = await db.prepare('SELECT k, url FROM ex_videos').all<{ k: string; url: string }>();
  return Object.fromEntries(results.map((r) => [r.k, r.url]));
}

/** Guarda os links enviados pelo formulário da equipa (campos "v:<nome>"); vazio apaga. */
export async function saveVideos(db: DB, form: FormData, now = new Date()) {
  let n = 0;
  for (const [field, value] of form.entries()) {
    if (!field.startsWith('v:')) continue;
    const name = field.slice(2).slice(0, 80);
    const k = exKey(name);
    const raw = String(value).trim();
    if (!raw) { await db.prepare('DELETE FROM ex_videos WHERE k = ?').bind(k).run(); continue; }
    const url = videoUrl(raw);
    if (!url) continue;
    await db.prepare('INSERT INTO ex_videos (k, name, url, updated) VALUES (?, ?, ?, ?) ON CONFLICT(k) DO UPDATE SET url = excluded.url, name = excluded.name, updated = excluded.updated').bind(k, name, url, now.toISOString()).run();
    n++;
  }
  return n;
}
