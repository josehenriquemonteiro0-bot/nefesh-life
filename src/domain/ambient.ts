/**
 * Som de fundo das meditações, gerado pela app (Web Audio, sem ficheiros):
 * chuva (ruído filtrado), mar (ruído que sobe e desce como ondas) e tom (acorde suave).
 * Tem de começar num toque (regra do iPhone).
 */
import type { Ambient } from './meditations';

export interface AmbientPlayer {
  stop(): void;
  setVolume(v: number): void;
}

function noiseBuffer(ctx: AudioContext, brown: boolean) {
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

export function playAmbient(kind: Ambient, volume = 0.5): AmbientPlayer | null {
  if (kind === 'nenhum') return null;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC();
    ctx.resume().catch(() => {});
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    const level = (v: number) => (kind === 'tom' ? 0.05 : kind === 'chuva' ? 0.09 : 0.16) * v;
    // entra suavemente (4 s)
    master.gain.linearRampToValueAtTime(level(volume), ctx.currentTime + 4);
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
      for (const [f, v] of [[110, 0.5], [220, 0.35], [330, 0.2]] as const) {
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
    return {
      setVolume: (v) => master.gain.setTargetAtTime(level(v), ctx.currentTime, 0.3),
      stop: () => {
        // sai suavemente (1,5 s) e fecha
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
