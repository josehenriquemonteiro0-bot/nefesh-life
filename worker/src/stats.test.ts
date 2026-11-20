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

  it('compara a aderência à Spirulina pelo uso antes da app', async () => {
    const s = memory();
    await savePing(s, 'tel-aaaaaaaa', { plan: true, prior: 'nunca', adh14: 80 }, NOW);
    await savePing(s, 'tel-bbbbbbbb', { plan: true, prior: 'nunca', adh14: 60 }, NOW);
    await savePing(s, 'tel-cccccccc', { plan: true, prior: 'regular', adh14: 250 }, NOW);
    await savePing(s, 'tel-dddddddd', { plan: true, prior: 'hack', adh14: 10 }, NOW);
    const r = await summarize(s, 30, NOW);
    expect(r.adherenceByPrior).toEqual({
      'Nunca tinham tomado': { n: 2, avg: 70 },
      'Já tomavam com regularidade': { n: 1, avg: 100 },
      'Sem resposta': { n: 1, avg: 10 },
    });
    expect(statsPage(r)).toContain('Aderência à Spirulina: antes e com a app');
  });
});

describe('I&D e retenção', () => {
  it('só usa dados de investigação de quem autorizou e esconde grupos pequenos', async () => {
    const s = memory();
    for (const [i, rd] of [{ goal: 'energia', eStart: 2.5, eNow: 3.5, sStart: 6, sNow: 7, idxStart: 55, idxNow: 65 }, { goal: 'energia', eStart: 3, eNow: 4 }, { goal: 'energia', eStart: 3, eNow: 3 }, { goal: 'foco', eStart: 2, eNow: 4 }].entries()) {
      await savePing(s, `tel-rd${i}aaaaa`, { plan: true, adh14: 80, format: 'po', rd }, NOW);
    }
    await savePing(s, 'tel-semrd000', { plan: true, adh14: 10, rd: 'texto livre' }, NOW);
    const r = await summarize(s, 30, NOW);
    expect(r.rd.devices).toBe(4);
    expect(r.rd.byGoal.energia).toMatchObject({ n: 3, adh: 80, energy: 0.7, sleep: 1, index: 10 });
    expect(r.rd.byProduct.po.n).toBe(4);
    const html = statsPage(r);
    expect(html).toMatch(/Investigação e desenvolvimento \(só de quem autorizou\)/);
    expect(html).toMatch(/Foco<\/td><td>1<\/td><td colspan="4" class="m">poucas pessoas/);
  });

  it('retenção D7: quem voltou 7 ou mais dias depois do primeiro dia', async () => {
    const s = memory();
    const d = (n: number) => new Date(NOW.getTime() - n * 86400000);
    await savePing(s, 'tel-volta001', { plan: true }, d(20));
    await savePing(s, 'tel-volta001', { plan: true }, d(5));
    await savePing(s, 'tel-saiu0001', { plan: true }, d(20));
    await savePing(s, 'tel-novo0001', { plan: true }, d(2));
    const r = await summarize(s, 30, NOW);
    expect(r.retention.d7).toEqual({ cohort: 2, pct: 50 });
  });
});
