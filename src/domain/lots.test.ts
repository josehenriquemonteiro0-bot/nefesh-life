import { describe, expect, it } from 'vitest';
import { capsEquivalent, doseNutrients, doseText, lotFor, parseScan } from './lots';
import { RECIPES, recipeOfDay } from './recipes';
import { blankState } from './sample';
import { keyDaysAgo } from './dates';
import { stock } from './stats';

describe('parseScan', () => {
  it('lê um código de laudo em texto simples', () => {
    expect(parseScan('GCL_26_1372').code).toBe('GCL_26_1372');
    expect(parseScan('gcl-26-1372').code).toBe('GCL_26_1372');
  });
  it('lê o lote e o produto a partir de um URL', () => {
    const r = parseScan('https://www.nefeshglobal.shop/laudo?lote=GCL_26_1372&p=nibs');
    expect(r).toMatchObject({ code: 'GCL_26_1372', product: 'nibs', url: 'https://www.nefeshglobal.shop/laudo?lote=GCL_26_1372&p=nibs' });
  });
  it('encontra o lote no caminho do URL', () => {
    expect(parseScan('https://nefesh.pt/lotes/GCL_26_1372.pdf').code).toBe('GCL_26_1372');
  });
  it('reconhece o QR atual dos rótulos (certificado no Google Drive)', () => {
    expect(parseScan('https://drive.google.com/file/d/1RmLRQ1rWUAZMCPHXcSYjnDGr-0KaswGD/view?usp=drivesdk').code).toBe('GCL_26_1372');
  });
  it('guarda o URL mesmo sem código reconhecível', () => {
    const r = parseScan('https://drive.google.com/file/d/abc123/view');
    expect(r.code).toBeNull();
    expect(r.url).toContain('drive.google.com');
  });
});

describe('doseText', () => {
  it('mostra cápsulas ou gramas com colheres de chá', () => {
    expect(doseText(4, 'caps')).toBe('4 cápsulas');
    expect(doseText(6, 'po')).toBe('3 g (1 colher de chá)');
    expect(doseText(3, 'nibs')).toBe('1,5 g (½ colher de chá)');
  });
});

describe('lote e nutrientes', () => {
  it('calcula o que 3 g fornecem com base no laudo', () => {
    const lot = lotFor('GCL_26_1372')!;
    const fe = doseNutrients(lot, 3).find((n) => n.key === 'ferro')!;
    expect(fe.mg).toBeCloseTo(0.78, 2);
    expect(fe.pct).toBeCloseTo((0.78 / 14) * 100, 1);
  });
  it('desconhece lotes que não estão registados', () => {
    expect(lotFor('XYZ_00_0000')).toBeNull();
  });
  it('converte embalagens em cápsulas-equivalentes', () => {
    expect(capsEquivalent('caps')).toBe(120);
    expect(capsEquivalent('po')).toBe(120);
  });
});

describe('receitas', () => {
  it('a toma feita com receita não gasta cápsulas do stock', () => {
    const now = new Date(2026, 10, 19, 10);
    const S = { ...blankState(now), ans: { goal: 'energia' as const, peso: 70, prior: 'regular' }, stockStart: keyDaysAgo(5, now) };
    S.logs[keyDaysAgo(1, now)] = { doses: [true, true] };
    S.logs[keyDaysAgo(0, now)] = { doses: [true, true], viaRecipe: { 0: 'verde-tropical' } };
    expect(stock(S, now).used).toBe(4);
  });
  it('todas as receitas são frias e têm Spirulina por porção', () => {
    for (const r of RECIPES) {
      expect(r.grams).toBeGreaterThan(0);
      expect(r.steps.join(' ')).not.toMatch(/ferver|forno|cozer a spirulina/i);
    }
    expect(recipeOfDay('desporto', 3).goals).toContain('desporto');
  });
});
