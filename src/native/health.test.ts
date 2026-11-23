import { describe, expect, it } from 'vitest';
import { sleepByNight } from './health';

const iso = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m).toISOString();

describe('sono do Apple Health', () => {
  it('soma as fases a dormir no dia em que acordou e não conta duas vezes o mesmo período', () => {
    const r = sleepByNight([
      { startDate: iso(22, 23), endDate: iso(23, 3), sleepState: 'deep' },
      { startDate: iso(23, 3), endDate: iso(23, 3, 20), sleepState: 'awake' },
      { startDate: iso(23, 3, 20), endDate: iso(23, 7), sleepState: 'rem' },
      // o relógio e o telemóvel registaram a mesma parte da noite
      { startDate: iso(23, 1), endDate: iso(23, 2), sleepState: 'asleep' },
      { startDate: iso(22, 22, 30), endDate: iso(22, 23), sleepState: 'inBed' },
    ]);
    expect(r).toEqual({ '2026-11-23': 7.7 });
  });
});
