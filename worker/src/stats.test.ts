import { describe, expect, it } from 'vitest';
import { cleanPing, savePing, statsPage, summarize, type StatsStore } from './stats';

function memory(): StatsStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    get: async (k) => data.get(k) ?? null,
    put: async (k, v) => void data.set(k, v),
    list: async ({ prefix }) => ({ keys: [...data.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }),
  };
}
const NOW = new Date('2026-11-20T10:00:00Z');

describe('estatísticas anónimas', () => {
  it('só guarda campos conhecidos e com limites', () => {
    const p = cleanPing({ plan: true, spirulina: 99, format: 'x', name: 'Ana', stage: '8-30' });
    expect(p.spirulina).toBe(7);
    expect(p.format).toBe('caps');
    expect(p.stage).toBe('8-30');
    expect('name' in p).toBe(false);
  });

  it('não guarda o identificador do telemóvel em claro', async () => {
    const s = memory();
    await savePing(s, 'tel-aaaaaaaa', { plan: true }, NOW);
    expect([...s.data.keys()].some((k) => k.includes('tel-aaaaaaaa'))).toBe(false);
    expect(await savePing(s, 'sem-id', {}, NOW)).toBe(false);
  });

  it('conta ativos, novos e funcionalidades', async () => {
    const s = memory();
    const yesterday = new Date(NOW.getTime() - 86400000);
    await savePing(s, 'tel-aaaaaaaa', { plan: true, spirulina: 6, diary: 2 }, yesterday);
    await savePing(s, 'tel-aaaaaaaa', { plan: true, spirulina: 6, diary: 0 }, NOW);
    await savePing(s, 'tel-bbbbbbbb', { plan: false }, NOW);
    s.data.set('g:2026-11-20', '3');
    const r = await summarize(s, 30, NOW);
    expect(r.perDay[0]).toMatchObject({ day: '2026-11-20', active: 2, fresh: 1, photos: 3 });
    expect(r.perDay[1]).toMatchObject({ active: 1, fresh: 1 });
    expect(r.devices7).toBe(2);
    expect(r.features['Fizeram a avaliação']).toBe(50);
    // usa o resumo mais recente de cada telemóvel
    expect(r.features['Usaram o diário']).toBe(0);
    expect(statsPage(r)).toContain('NEFESH Life · Estatísticas');
  });
});
