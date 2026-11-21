import { describe, expect, it } from 'vitest';
import { asksContext, asksNow } from './prompts';
import { blankState } from './sample';
import type { AppState } from './types';

const person = () => ({ ...blankState(), ans: { goal: 'energia', peso: 70 } } as unknown as AppState);
const at = (h: number, m = 0) => new Date(2026, 10, 21, h, m);

describe('perguntas no momento certo', () => {
  it('de manhã pergunta pelo sono e pelo peso da semana; depois do almoço, pelo almoço', () => {
    const S = person();
    expect(asksNow(S, at(8)).map((a) => a.id)).toEqual(['sono', 'peso']);
    S.logs['2026-11-21'] = { sleepH: 7 };
    S.bodyLog = [{ date: '2026-11-19', peso: 70 }];
    expect(asksNow(S, at(8))).toEqual([]);
    expect(asksNow(S, at(14)).map((a) => a.id)).toEqual(['almoco']);
  });
  it('à noite pergunta pela energia e pelo jantar; com o plano, resposta rápida "o do plano"', () => {
    const S = { ...person(), nutriPlan: { meals: [] } } as unknown as AppState;
    const a = asksNow(S, at(21));
    expect(a.map((x) => x.id)).toEqual(['jantar', 'energia']);
    expect(a[0].quick).toEqual(['Jantei o do plano']);
    expect(asksContext(S, at(21))).toMatch(/Em falta hoje.*jantar, energia/);
  });
  it('sem avaliação, não pergunta nada', () => {
    expect(asksNow(blankState(), at(8))).toEqual([]);
  });
});
