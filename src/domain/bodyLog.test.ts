import { describe, expect, it } from 'vitest';
import { bodySeries, change, monthly } from './bodyLog';

const NOW = new Date('2026-11-20T12:00:00');

describe('corpo ao longo do tempo', () => {
  const S = {
    evals: [{ date: '2026-07-01T10:00:00Z', sc: {} as never, body: { peso: 72, cintura: 84 } }],
    bodyLog: [
      { date: '2026-09-15', peso: 70.4 },
      { date: '2026-10-10', peso: 69.8, cintura: 81 },
      { date: '2026-11-18', peso: 69, anca: 98 },
    ],
  };
  it('junta as reavaliações e o registo do corpo', () => {
    expect(bodySeries(S).map((e) => `${e.date}:${e.peso}`)).toEqual(['2026-07-01:72', '2026-09-15:70.4', '2026-10-10:69.8', '2026-11-18:69']);
  });
  it('gráfico mensal com o último valor de cada mês', () => {
    const m = monthly(bodySeries(S), 'peso', 6, NOW);
    expect(m.map((x) => x.value)).toEqual([null, 72, null, 70.4, 69.8, 69]);
    expect(m[5].month).toBe('2026-11');
  });
  it('variação desde o início e nos últimos 30 dias', () => {
    expect(change(bodySeries(S), 'peso', NOW)).toMatchObject({ last: 69, sinceStart: -3, since30: -0.8 });
    expect(change(bodySeries(S), 'cintura', NOW)).toMatchObject({ last: 81, sinceStart: -3 });
    expect(change(bodySeries(S), 'pescoco', NOW)).toBeNull();
  });
});
