/**
 * Vídeos de demonstração dos exercícios: o do personal (se houver) ou o da biblioteca NEFESH
 * (escolhido pela equipa). Abrem dentro da app num leitor (YouTube, Instagram, Vimeo).
 */
import { PHOTO_API } from './photo';

const KEY = 'nefesh-life-videos';
export const exKey = (name: string) => name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

let map: Record<string, string> = (() => {
  try { return (JSON.parse(localStorage.getItem(KEY) || '{}') as { map?: Record<string, string> }).map ?? {}; } catch { return {}; }
})();
let loading: Promise<void> | null = null;

/** Atualiza a biblioteca (no máximo uma vez a cada 6 horas). */
export function loadVideos(force = false): Promise<void> {
  try {
    const at = (JSON.parse(localStorage.getItem(KEY) || '{}') as { at?: number }).at ?? 0;
    if (!force && Date.now() - at < 6 * 3600e3) return Promise.resolve();
  } catch { /* sem armazenamento */ }
  loading ??= fetch(`${PHOTO_API.replace(/\/$/, '')}/videos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    .then((r) => (r.ok ? r.json() : { videos: {} }))
    .then((r: { videos?: Record<string, string> }) => {
      map = r.videos ?? {};
      try { localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), map })); } catch { /* sem armazenamento */ }
    })
    .catch(() => undefined)
    .finally(() => { loading = null; });
  return loading;
}

export const libraryVideo = (name: string): string | undefined => map[exKey(name)];

/** Link → endereço para o leitor dentro da app (ou null: abre fora). */
export function embedUrl(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}?rel=0&playsinline=1&modestbranding=1`;
  const ig = url.match(/instagram\.com\/(reel|reels|p|tv)\/([\w-]+)/);
  if (ig) return `https://www.instagram.com/${ig[1] === 'reels' ? 'reel' : ig[1]}/${ig[2]}/embed`;
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return null;
}
