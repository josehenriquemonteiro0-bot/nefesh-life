import { describe, expect, it } from 'vitest';
import { check, cleanDeviceId, count, dayKey, type CounterStore } from './limits';

function memory(): CounterStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, get: async (k) => data.get(k) ?? null, put: async (k, v) => void data.set(k, v) };
}
const L = { device: 15, ip: 45, global: 200 };
const NOW = new Date('2026-11-20T10:00:00Z');

describe('limite diário de fotos', () => {
  it('deixa 15 fotos por telemóvel e depois bloqueia', async () => {
    const s = memory();
    for (let n = 1; n <= 15; n++) {
      expect((await check(s, L, 'tel-aaaaaaaa', '1.1.1.1', NOW)).ok).toBe(true);
      expect(await count(s, L, 'tel-aaaaaaaa', '1.1.1.1', NOW)).toBe(15 - n);
    }
    expect(await check(s, L, 'tel-aaaaaaaa', '1.1.1.1', NOW)).toEqual({ ok: false, remaining: 0, reason: 'device' });
    // outro telemóvel na mesma casa continua a poder
    expect((await check(s, L, 'tel-bbbbbbbb', '1.1.1.1', NOW)).ok).toBe(true);
  });
  it('trava uma rede com muitos pedidos e o total do dia', async () => {
    const s = memory();
    s.data.set(`i:${dayKey(NOW)}:9.9.9.9`, '45');
    expect((await check(s, L, 'tel-cccccccc', '9.9.9.9', NOW)).reason).toBe('ip');
    s.data.set(`g:${dayKey(NOW)}`, '200');
    expect((await check(s, L, 'tel-dddddddd', '8.8.8.8', NOW)).reason).toBe('global');
  });
  it('volta a zero no dia seguinte (hora de Lisboa)', async () => {
    const s = memory();
    for (let n = 0; n < 15; n++) await count(s, L, 'tel-aaaaaaaa', '1.1.1.1', NOW);
    expect((await check(s, L, 'tel-aaaaaaaa', '1.1.1.1', new Date('2026-11-21T00:30:00Z'))).ok).toBe(true);
    expect(dayKey(new Date('2026-11-20T23:30:00Z'))).toBe('2026-11-20');
  });
  it('aceita só identificadores de telemóvel válidos', () => {
    expect(cleanDeviceId('3f2a9c1e-77aa-4b1c-9d2e-123456789abc')).toBe('3f2a9c1e-77aa-4b1c-9d2e-123456789abc');
    expect(cleanDeviceId('x')).toBe('sem-id');
    expect(cleanDeviceId('<script>')).toBe('sem-id');
  });
});
