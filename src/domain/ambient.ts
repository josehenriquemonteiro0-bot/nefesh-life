/**
 * Som de fundo das meditações: chuva, mar (ondas que sobem e descem) e tom (acorde suave).
 *
 * A app gera uma faixa de áudio (WAV) e toca-a num <audio> em ciclo, como se fosse um ficheiro de
 * música. Assim toca em todos os telemóveis, incluindo o iPhone com o interruptor de silêncio
 * (o Web Audio fica mudo nesse caso) e ao mesmo tempo que a voz lê a meditação.
 * Tem de começar num toque (regra dos telemóveis).
 */
import type { Ambient } from './meditations';

export interface AmbientPlayer {
  stop(): void;
  setVolume(v: number): void;
}

export const AMBIENT_RATE = 22050;
/** Duração do ciclo (s): múltiplo do período das ondas (9 s) e das "respirações" do tom. */
export const AMBIENT_SECONDS = 18;
/** Nível médio (RMS) com o volume no máximo: alto o bastante para se ouvir no altifalante do telemóvel. */
const TARGET_RMS: Record<Exclude<Ambient, 'nenhum'>, number> = { chuva: 0.2, mar: 0.22, tom: 0.16 };

/** Gerador aleatório com semente (o mesmo som de cada vez). */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2147483648 - 1;
  };
}

/** Amostras (−1…1) do som escolhido, já com o volume v (0–1), num ciclo sem cliques. */
export function ambientSamples(kind: Exclude<Ambient, 'nenhum'>, v: number, rate = AMBIENT_RATE, seconds = AMBIENT_SECONDS): Float32Array {
  const fade = Math.round(rate * 0.5);
  const len = Math.round(rate * seconds);
  // o ruído gera-se com meio segundo a mais, que é cruzado com o início (ciclo sem estalidos)
  const n = kind === 'tom' ? len : len + fade;
  let out = new Float32Array(n);
  const rnd = rng(kind === 'chuva' ? 7 : kind === 'mar' ? 11 : 13);
  const TAU = Math.PI * 2;
  if (kind === 'tom') {
    // Lá 110 + Lá 220 + Mi 330 Hz, cada um a "respirar" devagar (ciclos inteiros no ciclo)
    const parts: [number, number, number][] = [[110, 0.5, 2], [220, 0.35, 3], [330, 0.2, 4]];
    for (let i = 0; i < n; i++) {
      const t = i / rate;
      let x = 0;
      for (const [f, a, br] of parts) x += a * (0.7 + 0.3 * Math.sin((TAU * br * t) / seconds)) * Math.sin(TAU * f * t);
      out[i] = x;
    }
  } else {
    // ruído filtrado: chuva = mais aguda (passa-banda), mar = grave (ruído castanho) com ondas
    let lp = 0;
    let lp2 = 0;
    let hp = 0;
    let prev = 0;
    let brown = 0;
    for (let i = 0; i < n; i++) {
      const w = rnd();
      if (kind === 'chuva') {
        lp += 0.45 * (w - lp); // corta o chiado muito agudo
        hp = 0.97 * (hp + lp - prev); // tira o grave
        prev = lp;
        // gotas: pequenos estalidos aleatórios
        const drop = rnd() > 0.9993 ? rnd() * 2.5 : 0;
        out[i] = hp + drop * 0.3;
      } else {
        brown = (brown + 0.02 * w) / 1.02;
        lp2 += 0.08 * (brown * 3.5 - lp2);
        const t = i / rate;
        const wave = 0.25 + 0.75 * Math.pow(Math.sin((Math.PI * t * 2) / 9), 2); // onda a cada 9 s
        out[i] = (brown * 3.5 * 0.4 + lp2 * 0.6) * wave;
      }
    }
    // emenda: o meio segundo a mais entra por cima do início, e o fim liga sem salto ao início
    for (let i = 0; i < fade; i++) {
      const a = i / fade;
      out[i] = out[i] * a + out[len + i] * (1 - a);
    }
    out = out.slice(0, len);
  }
  // normaliza para o nível alvo e aplica o volume
  let s = 0;
  for (let i = 0; i < len; i++) s += out[i] * out[i];
  const rms = Math.sqrt(s / len) || 1;
  const g = (TARGET_RMS[kind] / rms) * Math.max(0, Math.min(1, v));
  for (let i = 0; i < len; i++) out[i] = Math.max(-1, Math.min(1, out[i] * g));
  return out;
}

/** WAV mono de 16 bits. */
export function wavBytes(samples: Float32Array, rate = AMBIENT_RATE): Uint8Array {
  const b = new Uint8Array(44 + samples.length * 2);
  const d = new DataView(b.buffer);
  const str = (o: number, t: string) => [...t].forEach((c, i) => (b[o + i] = c.charCodeAt(0)));
  str(0, 'RIFF');
  d.setUint32(4, 36 + samples.length * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  d.setUint32(16, 16, true);
  d.setUint16(20, 1, true);
  d.setUint16(22, 1, true);
  d.setUint32(24, rate, true);
  d.setUint32(28, rate * 2, true);
  d.setUint16(32, 2, true);
  d.setUint16(34, 16, true);
  str(36, 'data');
  d.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) d.setInt16(44 + i * 2, Math.round(samples[i] * 32767), true);
  return b;
}

/** Volume do controlo (0–1) → volume da faixa, com o controlo a meio já bem audível. */
const curve = (v: number) => Math.sqrt(Math.max(0, Math.min(1, v)));

function trackUrl(kind: Exclude<Ambient, 'nenhum'>, v: number) {
  const bytes = wavBytes(ambientSamples(kind, curve(v)));
  return URL.createObjectURL(new Blob([bytes.buffer as ArrayBuffer], { type: 'audio/wav' }));
}

export function playAmbient(kind: Ambient, volume = 0.5): AmbientPlayer | null {
  if (kind === 'nenhum' || typeof Audio === 'undefined') return null;
  try {
    // som como reprodução de multimédia (iPhone 16.4+: toca mesmo com o interruptor de silêncio)
    try {
      const s = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
      if (s) s.type = 'playback';
    } catch {
      /* não suportado */
    }
    const el = new Audio();
    el.loop = true;
    el.preload = 'auto';
    el.setAttribute('playsinline', '');
    let url = trackUrl(kind, volume);
    el.src = url;
    let stopped = false;
    el.play()?.catch(() => {});
    // se o telemóvel o parar (voz, chamada, ecrã), volta a tocar
    const revive = () => {
      if (!stopped && el.paused) el.play()?.catch(() => {});
    };
    const tick = window.setInterval(revive, 2000);
    const onVis = () => document.visibilityState === 'visible' && revive();
    document.addEventListener('visibilitychange', onVis);
    let pending = 0;
    return {
      // o iPhone não deixa mudar o volume de um <audio>: refaz a faixa com o volume novo
      setVolume: (v) => {
        window.clearTimeout(pending);
        pending = window.setTimeout(() => {
          if (stopped) return;
          const at = el.currentTime;
          const old = url;
          url = trackUrl(kind, v);
          el.src = url;
          try {
            el.currentTime = at;
          } catch {
            /* ainda a carregar */
          }
          el.play()?.catch(() => {});
          URL.revokeObjectURL(old);
        }, 250);
      },
      stop: () => {
        stopped = true;
        window.clearInterval(tick);
        window.clearTimeout(pending);
        document.removeEventListener('visibilitychange', onVis);
        try {
          el.pause();
        } catch {
          /* já parado */
        }
        el.removeAttribute('src');
        el.load();
        URL.revokeObjectURL(url);
      },
    };
  } catch {
    return null;
  }
}
