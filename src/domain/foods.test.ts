import { describe, expect, it } from 'vitest';
import { FOODS, entryOf, foodById, searchFoods, totals } from './foods';

describe('base de alimentos', () => {
  it('tem identificadores únicos e valores coerentes', () => {
    expect(new Set(FOODS.map((f) => f.id)).size).toBe(FOODS.length);
    // bebidas alcoólicas ficam de fora: o álcool tem 7 kcal/g e não entra em P/H/G
    for (const f of FOODS.filter((x) => !['vinho', 'cerveja'].includes(x.id))) {
      // as kcal declaradas não fogem muito de 4·P + 4·H + 9·G (tolerância para fibra e álcool)
      const est = 4 * f.p + 4 * f.c + 9 * f.f;
      expect(Math.abs(est - f.kcal), f.name).toBeLessThan(Math.max(30, f.kcal * 0.25));
    }
  });
  it('pesquisa sem acentos e por várias palavras', () => {
    expect(searchFoods('maca')[0].name).toBe('Maçã');
    expect(searchFoods('frango grelhado').map((f) => f.id)).toContain('frango_peito');
    expect(searchFoods('spirulina').length).toBe(3);
  });
  it('calcula a porção e soma o dia', () => {
    const e = entryOf(foodById('arroz_branco')!, 150);
    expect(e.kcal).toBe(195);
    const t = totals([e, entryOf(foodById('frango_peito')!, 120)]);
    expect(t.kcal).toBe(393);
    expect(t.p).toBeCloseTo(41.3, 1);
  });
});

import { photoEntry } from './photo';
describe('itens da foto', () => {
  it('ajusta calorias e macros à quantidade escolhida', () => {
    const e = photoEntry({ name: 'Arroz', grams: 180, kcal: 234, protein_g: 4.9, carbs_g: 50.4, fat_g: 0.5, confidence: 'alta' }, 90);
    expect(e).toMatchObject({ name: 'Arroz', grams: 90, kcal: 117, p: 2.5, c: 25.2, f: 0.3 });
  });
});
