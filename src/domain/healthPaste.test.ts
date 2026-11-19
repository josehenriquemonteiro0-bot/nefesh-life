import { describe, expect, it } from 'vitest';
import { parseHealthPaste, parseSleep, parseSteps } from './healthPaste';

describe('texto do atalho NEFESH Saúde', () => {
  it('lê o formato recomendado', () => {
    expect(parseHealthPaste('NEFESH passos=7200 sono=7,5')).toEqual({ steps: 7200, sleepH: 7.5 });
  });
  it('aceita separadores de milhares e decimais do Atalhos', () => {
    expect(parseHealthPaste('NEFESH passos=7 200 sono=7,53')).toEqual({ steps: 7200, sleepH: 7.5 });
    expect(parseHealthPaste('NEFESH passos=12.480 sono=6.9')).toEqual({ steps: 12480, sleepH: 7 });
    expect(parseHealthPaste('NEFESH passos=8431,6 sono=7:20')).toEqual({ steps: 8431, sleepH: 7.5 });
  });
  it('funciona só com passos ou só com sono', () => {
    expect(parseHealthPaste('NEFESH passos=5000')).toEqual({ steps: 5000 });
    expect(parseHealthPaste('NEFESH sono=8')).toEqual({ sleepH: 8 });
    expect(parseHealthPaste('olá')).toEqual({});
  });
});

describe('duração do sono', () => {
  it('reconhece horas, minutos e segundos', () => {
    expect(parseSleep('7 h 30 min')).toBe(7.5);
    expect(parseSleep('450 min')).toBe(7.5);
    expect(parseSleep('27000')).toBe(7.5);
    expect(parseSleep('420')).toBe(7);
    expect(parseSleep('30')).toBe(0.5);
    expect(parseSleep('0')).toBeUndefined();
  });
  it('passos fora do intervalo são ignorados', () => {
    expect(parseSteps('abc')).toBeUndefined();
    expect(parseSteps('999999')).toBeUndefined();
  });
});
