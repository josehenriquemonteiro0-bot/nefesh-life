import { describe, expect, it } from 'vitest';
import { applyCoachActions, buildContext, coachEntry, todaysMessages, type CoachAction } from './coach';
import { blankState } from './sample';
import { todayKey } from './dates';
import { foodById } from './foods';
import { took } from './stats';

const NOW = new Date('2026-11-20T13:00:00');
const act = (a: Partial<CoachAction>): CoachAction => ({ type: 'agua', value: 0, meal: '', intensity: '', title: '', replace: false, items: [], ...a });
const person = () => ({ ...blankState(NOW), ans: { name: 'Belinha', goal: 'energia' as const, peso: 62, safe: ['gravidez'] }, planStart: '2026-11-01' });

describe('AI Coach na app', () => {
  it('o contexto leva objetivo, plano, cuidados e registos de hoje', () => {
    const S = person();
    S.logs[todayKey(NOW)] = { water: 3, sleepH: 6.5 };
    const c = buildContext(S, NOW);
    expect(c).toMatch(/Objetivo: Energia e vitalidade/);
    expect(c).toMatch(/Plano de Spirulina/);
    expect(c).toMatch(/Gravidez ou amamentação/);
    expect(c).toMatch(/água 3 copos; sono 6,5 h/);
  });

  it('as calorias vêm da tabela da app, não do modelo', () => {
    const e = coachEntry({ food_id: 'pao_trigo', name: 'pão', grams: 50, kcal100: 9999, p100: 0, c100: 0, f100: 0 });
    expect(e.kcal).toBe(Math.round(foodById('pao_trigo')!.kcal * 0.5));
    expect(e.est).toBeUndefined();
    const x = coachEntry({ food_id: '', name: 'Bolo da avó', grams: 80, kcal100: 400, p100: 5, c100: 50, f100: 20 });
    expect(x).toMatchObject({ kcal: 320, est: true, coach: true });
  });

  it('cria registos declarados: água, sono, energia, Spirulina, treino e refeição', () => {
    const S = person();
    const done = applyCoachActions(S, [
      act({ type: 'agua', value: 2 }),
      act({ type: 'sono', value: 5.8 }),
      act({ type: 'energia', value: 2 }),
      act({ type: 'spirulina', value: 1 }),
      act({ type: 'treino', value: 40, intensity: 'moderado', title: 'Ginásio' }),
      act({ type: 'refeicao', meal: 'pa', items: [{ food_id: 'pao_trigo', name: 'pão', grams: 50, kcal100: 0, p100: 0, c100: 0, f100: 0 }] }),
    ], NOW);
    const l = S.logs[todayKey(NOW)];
    expect(l.water).toBe(2);
    expect(l.sleepH).toBe(6);
    expect(l.src).toBeUndefined(); // declarado
    expect(l.e).toBe(2);
    expect(took(S, l, NOW)).toBe(true);
    expect(l.workouts![0]).toMatchObject({ sessionId: 'coach', minutes: 40, mvpa: 40, strength: true });
    expect(l.t).toBe(2);
    expect(l.meals!.pa!.some((e) => e.coach && e.foodId === 'pao_trigo')).toBe(true);
    expect(done).toHaveLength(6);
    expect(done[5]).toMatch(/Pequeno-almoço: Pão de trigo \(50 g\) · \d+ kcal/);
  });

  it('corrige sem refazer tudo: "não, foram três ovos" substitui só o que o Coach registou', () => {
    const S = person();
    S.logs[todayKey(NOW)] = { meals: { pa: [{ id: 'manual', name: 'Café', grams: 50, kcal: 2, p: 0, c: 0, f: 0 }] } };
    const ovo = (g: number) => act({ type: 'refeicao', meal: 'pa', items: [{ food_id: '', name: 'Ovo', grams: g, kcal100: 150, p100: 13, c100: 1, f100: 10 }] });
    applyCoachActions(S, [ovo(100)], NOW);
    applyCoachActions(S, [{ ...ovo(150), replace: true }], NOW);
    const pa = S.logs[todayKey(NOW)].meals!.pa!;
    expect(pa.map((e) => `${e.name}:${e.grams}`)).toEqual(['Café:50', 'Ovo:150']);
    // água: acrescentar soma, corrigir substitui o total
    applyCoachActions(S, [act({ type: 'agua', value: 2 }), act({ type: 'agua', value: 1 })], NOW);
    expect(S.logs[todayKey(NOW)].water).toBe(3);
    applyCoachActions(S, [act({ type: 'agua', value: 5, replace: true })], NOW);
    expect(S.logs[todayKey(NOW)].water).toBe(5);
  });

  it('só envia as mensagens de hoje', () => {
    const h = [
      { role: 'user' as const, text: 'ontem', at: '2026-11-19T10:00:00' },
      { role: 'user' as const, text: 'hoje', at: new Date('2026-11-20T10:00:00').toISOString() },
    ];
    expect(todaysMessages(h, NOW).map((m) => m.text)).toEqual(['hoje']);
  });
});
