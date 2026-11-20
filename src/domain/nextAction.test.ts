import { describe, expect, it } from 'vitest';
import { keyDaysAgo } from './dates';
import { nextAction } from './nextAction';
import { blankState } from './sample';
import type { AppState } from './types';

const at = (h: number) => new Date(2026, 10, 20, h, 0);
const S = (): AppState => ({ ...blankState(at(9)), followLabel: true, ans: { goal: 'energia', peso: 70, prior: 'regular' }, planStart: keyDaysAgo(20, at(9)) });

describe('próxima ação do dia', () => {
  it('de manhã, a toma de Spirulina vem primeiro', () => {
    expect(nextAction(S(), {}, at(9))).toMatchObject({ kind: 'dose', slot: 0 });
  });
  it('depois da toma, a água atrasada', () => {
    expect(nextAction(S(), { doses: [true, true] }, at(15)).kind).toBe('agua');
  });
  it('à noite, com água em dia e refeições registadas, o check-in', () => {
    const meal = { id: 'x', name: 'x', grams: 1, kcal: 1, p: 0, c: 0, f: 0 };
    const r = nextAction(S(), { doses: [true, true], water: 20, meals: { jantar: [meal] } }, at(21));
    expect(r.kind).toBe('checkin');
  });
  it('tudo feito', () => {
    expect(nextAction(S(), { doses: [true, true], water: 20, e: 4 }, at(17)).kind).toBe('feito');
  });
});
