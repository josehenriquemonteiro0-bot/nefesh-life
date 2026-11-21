import { describe, expect, it } from 'vitest';
import { parseOff, productNotes, rememberScanned, scannedEntry, validCode } from './barcode';
import { blankState } from './sample';

const OFF_JSON = {
  status: 1,
  product: {
    product_name: 'Iogurte natural', brands: 'Marca X,Outra', serving_quantity: 125, serving_size: '1 copo (125 g)',
    nutriscore_grade: 'b', nova_group: 1, allergens_tags: ['en:milk'], additives_tags: [],
    nutriments: { 'energy-kcal_100g': 62, proteins_100g: 4.2, carbohydrates_100g: 5.1, fat_100g: 2.8, sugars_100g: 5.1, salt_100g: 0.12 },
    image_front_small_url: 'https://images.openfoodfacts.org/x.jpg',
  },
};

describe('código de barras + Open Food Facts', () => {
  it('lê o produto da Open Food Facts', () => {
    const f = parseOff('5601234567890', OFF_JSON)!;
    expect(f).toMatchObject({ name: 'Iogurte natural', brand: 'Marca X', kcal: 62, p: 4.2, serving: 125, nutri: 'B', nova: 1, allergens: ['milk'], source: 'off' });
    expect(parseOff('1', { status: 0 })).toBeNull();
    // sem kcal mas com energia em kJ
    expect(parseOff('2', { status: 1, product: { product_name: 'Água', nutriments: { energy_100g: 0 } } })!.kcal).toBe(0);
    expect(parseOff('3', { status: 1, product: { product_name: 'Sem tabela', nutriments: {} } })).toBeNull();
  });
  it('entrada do diário com os valores do rótulo para a quantidade escolhida', () => {
    const e = scannedEntry(parseOff('5601234567890', OFF_JSON)!, 125);
    expect(e).toMatchObject({ name: 'Iogurte natural · Marca X', grams: 125, kcal: 78, p: 5.3, barcode: '5601234567890' });
    expect(e.est).toBeUndefined();
  });
  it('avisos: aspartame com fenilcetonúria, alergénios, ultraprocessado, açúcar', () => {
    const f = { ...parseOff('1', OFF_JSON)!, additives: ['e951'], nova: 4, sugar: 30 };
    const n = productNotes(f, { ans: { safe: ['pku'] } });
    expect(n.map((x) => x.level)).toEqual(['alto', 'medio', 'info', 'info']);
    expect(n[1].text).toBe('Alergénios: leite.');
  });
  it('guarda os produtos lidos e valida o código', () => {
    const S = blankState();
    rememberScanned(S, parseOff('5601234567890', OFF_JSON)!);
    expect(Object.keys(S.scanned!)).toEqual(['5601234567890']);
    expect(validCode('5601234567890')).toBe(true);
    expect(validCode('abc')).toBe(false);
  });
});
