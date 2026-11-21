import { describe, expect, it } from 'vitest';
import { blankState } from './sample';
import { ESSENTIAL, LATER, QUIZ, answerLater, askAccount, missingLater, nextLaterQuestion, provisionalAreas, skipLater } from './onboarding';
import { QUESTIONS } from './content';
import { scores } from './plan';
import type { AppState } from './types';

const base = { name: 'Ana', goal: 'energia', sexo: 'f', idade: 30, altura: 165, peso: 60, ativ: '1-2', sonoh: '7-8', energia: 3, stress: 3, safe: ['nenhuma'] } as AppState['ans'];
const at = (d: string, h: number) => new Date(`${d}T${String(h).padStart(2, '0')}:00:00`);
const S0 = (): AppState => ({ ...blankState(), ans: { ...base! }, planStart: '2026-11-20', evals: [{ date: '2026-11-20', sc: scores(base!), prov: provisionalAreas(base) }] });

describe('chegada rápida', () => {
  it('11 essenciais na avaliação; as outras 9 ficam para depois, sem perder nenhuma', () => {
    expect(QUIZ.map((q) => q.id)).toEqual([...ESSENTIAL].sort((a, b) => QUESTIONS.findIndex((q) => q.id === a) - QUESTIONS.findIndex((q) => q.id === b)));
    expect(QUIZ.length + LATER.length).toBe(QUESTIONS.length);
    expect(missingLater(base)).toHaveLength(9);
    expect(provisionalAreas(base).sort()).toEqual(['hidratacao', 'nutricao', 'sono']);
  });

  it('pergunta do dia: nenhuma no 1.º dia; de manhã o sono, ao almoço a alimentação; até 3 por dia', () => {
    const S = S0();
    expect(nextLaterQuestion(S, at('2026-11-20', 9))).toBeNull();
    expect(nextLaterQuestion(S, at('2026-11-21', 9))!.id).toBe('sonoq');
    expect(nextLaterQuestion(S, at('2026-11-21', 13))!.id).toBe('veg');
    const now = at('2026-11-21', 9);
    answerLater(S, { sonoq: 4 }, now);
    answerLater(S, { cafe: '1-2' }, now);
    answerLater(S, { agua: '4-6' }, now);
    expect(nextLaterQuestion(S, now)).toBeNull();
    expect(nextLaterQuestion(S, at('2026-11-22', 13))!.id).toBe('veg');
  });

  it('a avaliação inicial fica como foi vista; só deixa de estar marcada como provisória', () => {
    const S = S0();
    const before = { ...S.evals[0].sc };
    answerLater(S, { sonoq: 5 }, at('2026-11-21', 9));
    expect(S.evals[0].sc).toEqual(before);
    expect(S.evals[0].prov).not.toContain('sono');
    answerLater(S, { agua: '7-9' }, at('2026-11-21', 9));
    expect(S.evals[0].prov).toContain('hidratacao'); // falta o café
  });

  it('agora não: não volta a perguntar hoje; medidas saltadas contam como respondidas', () => {
    const S = S0();
    const now = at('2026-11-21', 9);
    skipLater(S, 'sonoq', now);
    expect(nextLaterQuestion(S, now)!.id).toBe('cafe');
    answerLater(S, { medidasSaltadas: true }, now);
    expect(missingLater(S.ans).map((x) => x.id)).not.toContain('cintura');
  });

  it('conta pedida a partir do 3.º dia, sem conta, e de novo 7 dias depois do "agora não"', () => {
    const S = S0();
    expect(askAccount(S, false, at('2026-11-21', 9))).toBe(false);
    expect(askAccount(S, false, at('2026-11-22', 9))).toBe(true);
    expect(askAccount(S, true, at('2026-11-22', 9))).toBe(false);
    S.accountAsk = '2026-11-22';
    expect(askAccount(S, false, at('2026-11-25', 9))).toBe(false);
    expect(askAccount(S, false, at('2026-11-29', 9))).toBe(true);
  });
});

import { noteLaterShown } from './onboarding';

describe('pergunta do dia não fica presa', () => {
  it('sem resposta, no dia seguinte passa para a seguinte (e volta mais tarde)', () => {
    const S = S0();
    const d3 = at('2026-11-22', 16);
    const first = nextLaterQuestion(S, d3)!.id;
    noteLaterShown(S, first, d3);
    const d4 = at('2026-11-23', 16);
    const second = nextLaterQuestion(S, d4)!.id;
    expect(second).not.toBe(first);
    noteLaterShown(S, second, d4);
    expect(nextLaterQuestion(S, d4)!.id).toBe(second); // estável durante o dia
    expect(missingLater(S.ans).map((x) => x.id)).toContain(first); // continua por responder
  });
});

import { liveIndex, liveScores } from './liveIndex';

describe('Índice vivo', () => {
  it('mexe com os hábitos dos últimos 14 dias (metade avaliação, metade comportamento)', () => {
    const S = S0();
    const base = liveIndex(S, at('2026-12-01', 20));
    for (let i = 0; i < 10; i++) {
      const d = new Date(at('2026-12-01', 12)); d.setDate(d.getDate() - i);
      S.logs[d.toLocaleDateString('en-CA')] = { e: 5, sleepH: 7.5, water: 12, steps: 9000, hab: { veg: true } };
    }
    const live = liveScores(S, at('2026-12-01', 20));
    expect(live.sono).toBe(Math.round((scores(S.ans!).sono + 100) / 2));
    expect(liveIndex(S, at('2026-12-01', 20))).toBeGreaterThan(base);
  });
});
