import { describe, expect, it } from 'vitest';
import { bibleLink, passageCode } from './biblia';
import { CHAVES } from './chavesDoDia';

describe('links da Bíblia', () => {
  it('converte versículo, intervalo e capítulo', () => {
    expect(passageCode('Salmos 119:37')).toBe('PSA.119.37');
    expect(passageCode('2 Reis 4:1-7')).toBe('2KI.4.1-7');
    expect(passageCode('Daniel 6')).toBe('DAN.6');
    expect(passageCode('1 Coríntios 15:58')).toBe('1CO.15.58');
    expect(bibleLink('Tiago 1:5')).toBe('https://www.bible.com/pt/bible/129/JAS.1.5.NVI');
    expect(bibleLink('Livro inventado 1:1')).toBeNull();
  });
  it('todas as chaves do dia têm link', () => {
    expect(CHAVES.filter((c) => !bibleLink(c.referencia)).map((c) => c.referencia)).toEqual([]);
  });
});
