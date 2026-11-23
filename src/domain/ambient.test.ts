import { describe, expect, it } from 'vitest';
import { AMBIENT_RATE, AMBIENT_SECONDS, ambientSamples, wavBytes } from './ambient';

const rms = (x: Float32Array) => Math.sqrt(x.reduce((t, v) => t + v * v, 0) / x.length);
const db = (v: number) => 20 * Math.log10(v);

describe('som de fundo da meditação', () => {
  for (const k of ['chuva', 'mar', 'tom'] as const) {
    it(`${k}: alto o bastante para o telemóvel, sem distorção e ciclo sem estalidos`, () => {
      const x = ambientSamples(k, 1);
      expect(x.length).toBe(AMBIENT_RATE * AMBIENT_SECONDS);
      expect(db(rms(x))).toBeGreaterThan(-20); // antes ficava em −38 dB (inaudível)
      const clipped = x.filter((v) => Math.abs(v) >= 0.999).length / x.length;
      expect(clipped).toBeLessThan(0.002);
      // a emenda fim → início não salta mais do que o som salta normalmente
      const jumps = x.slice(1).map((v, i) => Math.abs(v - x[i]));
      const typical = jumps.reduce((a, b) => a + b, 0) / jumps.length;
      expect(Math.abs(x[0] - x[x.length - 1])).toBeLessThan(typical * 8 + 0.02);
    });
  }
  it('o volume baixa o som e o zero cala', () => {
    expect(rms(ambientSamples('chuva', 0.25))).toBeLessThan(rms(ambientSamples('chuva', 1)) * 0.3);
    expect(rms(ambientSamples('mar', 0))).toBe(0);
  });
  it('gera um WAV válido', () => {
    const b = wavBytes(new Float32Array([0, 0.5, -0.5]));
    expect(String.fromCharCode(...b.slice(0, 4))).toBe('RIFF');
    expect(String.fromCharCode(...b.slice(8, 12))).toBe('WAVE');
    expect(b.length).toBe(44 + 6);
  });
});
