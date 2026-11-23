/**
 * Som de fundo das meditações, gerado pela app (Web Audio, sem ficheiros):
 * chuva (ruído filtrado), mar (ruído que sobe e desce como ondas) e tom (acorde suave).
 * Tem de começar num toque (regra do iPhone).
 *
 * No iPhone, o Web Audio fica mudo com o interruptor de silêncio (a voz continua a falar) e a voz
 * pode "interromper" o áudio. Por isso: pedimos sessão de reprodução (como música), tocamos um
 * <audio> silencioso em ciclo (faz o iOS tratar o som como multimédia) e retomamos o áudio se for
 * interrompido.
 */
import type { Ambient } from './meditations';

export interface AmbientPlayer {
  stop(): void;
  setVolume(v: number): void;
}

function noiseBuffer(ctx: BaseAudioContext, brown: boolean) {
  const len = ctx.sampleRate * 4;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (brown) {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    } else d[i] = w;
  }
  return buf;
}

/** 0,1 s de silêncio (WAV 8 kHz, 8 bits): tocado em ciclo para o iPhone tocar o som mesmo em silêncio. */
function silentWav(): string {
  const n = 800;
  const b = new Uint8Array(44 + n);
  const v = new DataView(b.buffer);
  const str = (o: number, t: string) => [...t].forEach((c, i) => (b[o + i] = c.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + n, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true);
  v.setUint32(28, 8000, true);
  v.setUint16(32, 1, true);
  v.setUint16(34, 8, true);
  str(36, 'data');
  v.setUint32(40, n, true);
  b.fill(128, 44);
  let bin = '';
  b.forEach((x) => (bin += String.fromCharCode(x)));
  return `data:audio/wav;base64,${btoa(bin)}`;
}

let keepAlive: HTMLAudioElement | null = null;
/** Diz ao iPhone que isto é reprodução de som (toca com o interruptor de silêncio). Chamar no toque. */
export function unlockMediaAudio() {
  try {
    const s = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
    if (s) s.type = 'playback';
  } catch {
    /* não suportado */
  }
  try {
    if (!keepAlive) {
      keepAlive = new Audio(silentWav());
      keepAlive.loop = true;
      keepAlive.setAttribute('playsinline', '');
      keepAlive.volume = 0.01;
    }
    keepAlive.play()?.catch(() => {});
  } catch {
    /* sem <audio> */
  }
}
function releaseMediaAudio() {
  try {
    keepAlive?.pause();
  } catch {
    /* já parado */
  }
}

/** Monta o som (chuva, mar ou tom) num contexto de áudio; devolve o volume geral e as fontes. */
export function buildAmbient(ctx: BaseAudioContext, kind: Exclude<Ambient, 'nenhum'>, volume: number, fadeIn = 4) {
  const master = ctx.createGain();
  master.connect(ctx.destination);
  const level = (v: number) => (kind === 'tom' ? 0.05 : kind === 'chuva' ? 0.09 : 0.16) * v;
  // entra suavemente: o ponto de partida tem de ficar marcado (senão o Safari salta ou fica mudo)
  const now = ctx.currentTime;
  master.gain.cancelScheduledValues(now);
  master.gain.setValueAtTime(0.0001, now);
  master.gain.linearRampToValueAtTime(level(volume), now + fadeIn);
  const nodes: AudioScheduledSourceNode[] = [];
  if (kind === 'chuva' || kind === 'mar') {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx, kind === 'mar');
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = kind === 'chuva' ? 'bandpass' : 'lowpass';
    filter.frequency.value = kind === 'chuva' ? 1800 : 500;
    filter.Q.value = kind === 'chuva' ? 0.4 : 0.7;
    const g = ctx.createGain();
    g.gain.value = 1;
    src.connect(filter).connect(g).connect(master);
    if (kind === 'mar') {
      // ondas: o volume sobe e desce a cada ~9 s
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.11;
      const depth = ctx.createGain();
      depth.gain.value = 0.6;
      lfo.connect(depth).connect(g.gain);
      lfo.start();
      nodes.push(lfo);
    }
    src.start();
    nodes.push(src);
  } else {
    // tom: acorde suave (Lá 220 Hz + Mi 330 Hz + Lá 110 Hz) com "respiração" lenta
    for (const [f, v] of [
      [110, 0.5],
      [220, 0.35],
      [330, 0.2],
    ] as const) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = v;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.07 + f / 10000;
      const depth = ctx.createGain();
      depth.gain.value = v * 0.4;
      lfo.connect(depth).connect(g.gain);
      o.connect(g).connect(master);
      o.start();
      lfo.start();
      nodes.push(o, lfo);
    }
  }
  return { master, nodes, level };
}

export function playAmbient(kind: Ambient, volume = 0.5): AmbientPlayer | null {
  if (kind === 'nenhum') return null;
  unlockMediaAudio();
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC();
    ctx.resume().catch(() => {});
    const { master, nodes, level } = buildAmbient(ctx, kind, volume);
    let stopped = false;
    // o iPhone "interrompe" o áudio (voz, chamada, ecrã) e não o retoma sozinho
    const revive = () => {
      if (!stopped && ctx.state !== 'running' && ctx.state !== 'closed') ctx.resume().catch(() => {});
    };
    ctx.onstatechange = revive;
    const onVis = () => document.visibilityState === 'visible' && revive();
    document.addEventListener('visibilitychange', onVis);
    const tick = window.setInterval(revive, 2000);
    return {
      setVolume: (v) => master.gain.setTargetAtTime(level(v), ctx.currentTime, 0.3),
      stop: () => {
        stopped = true;
        window.clearInterval(tick);
        document.removeEventListener('visibilitychange', onVis);
        releaseMediaAudio();
        // sai suavemente (1,5 s) e fecha
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
        master.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
        window.setTimeout(() => {
          nodes.forEach((n) => {
            try {
              n.stop();
            } catch {
              /* já parado */
            }
          });
          ctx.close().catch(() => {});
        }, 1600);
      },
    };
  } catch {
    return null;
  }
}
