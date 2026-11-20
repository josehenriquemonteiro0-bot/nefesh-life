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

describe('Coach e o plano do nutricionista', () => {
  const withPlan = () => {
    const S = person();
    S.nutriPlan = {
      is_plan: true, at: '2026-11-01', name: 'plano.pdf', daily_kcal: 1800, daily_protein_g: 90, professional: 'Dra. Ana', notes: '',
      meals: [
        { meal: 'pa', label: 'Pequeno-almoço', time: '08:00', options: [{ name: 'A', items: [{ name: 'Iogurte', quantity: '1', grams: 125, kcal: 80, protein_g: 5, carbs_g: 6, fat_g: 3 } as never] }] },
        { meal: 'almoco', label: 'Almoço', time: '13:00', options: [
          { name: 'A', items: [{ name: 'Frango', quantity: '150 g', grams: 150, kcal: 240, protein_g: 40, carbs_g: 0, fat_g: 8 } as never, { name: 'Arroz', quantity: '100 g', grams: 100, kcal: 130, protein_g: 3, carbs_g: 28, fat_g: 0 } as never] },
          { name: 'B', items: [{ name: 'Peixe', quantity: '150 g', grams: 150, kcal: 180, protein_g: 35, carbs_g: 0, fat_g: 4 } as never] },
        ] },
      ],
    };
    S.plans = { nutri: { name: 'plano.pdf', type: 'application/pdf', size: 1, at: '2026-11-01' } as never };
    return S;
  };

  it('o contexto mostra as refeições do plano com o número e o que já foi marcado', () => {
    const S = withPlan();
    S.logs[todayKey(NOW)] = { planLog: { '0': { status: 'seguido', option: 0 } } };
    const c = buildContext(S, NOW);
    expect(c).toMatch(/\[0\] Pequeno-almoço \(08:00\): opção 0: Iogurte — hoje: seguido/);
    expect(c).toMatch(/\[1\] Almoço \(13:00\): opção 0: Frango, Arroz \| opção 1: Peixe/);
  });

  it('"fiz o almoço do plano" põe o ✓ e os alimentos no diário; corrigir não duplica', () => {
    const S = withPlan();
    const done = applyCoachActions(S, [act({ type: 'plano_refeicao', value: 1, option: 0, status: 'seguido' })], NOW);
    const l = S.logs[todayKey(NOW)];
    expect(l.planLog!['1']).toEqual({ status: 'seguido', option: 0 });
    expect(l.meals!.almoco!.map((e) => e.planRef)).toEqual(['1', '1']);
    expect(done[0]).toMatch(/Almoço: segui o plano ✓/);
    applyCoachActions(S, [act({ type: 'plano_refeicao', value: 1, option: 1, status: 'alterado', note: 'sem arroz' })], NOW);
    expect(l.planLog!['1']).toMatchObject({ status: 'alterado', option: 1, changes: ['sem arroz'] });
    expect(S.logs[todayKey(NOW)].meals!.almoco!.map((e) => e.name)).toEqual(['Peixe (150 g)']);
    applyCoachActions(S, [act({ type: 'plano_refeicao', value: 0, status: 'saltado' })], NOW);
    expect(S.logs[todayKey(NOW)].planLog!['0'].status).toBe('saltado');
    // refeição inexistente: ignora
    expect(applyCoachActions(S, [act({ type: 'plano_refeicao', value: 9 })], NOW)).toEqual([]);
  });
});

describe('Coach e o plano do personal', () => {
  it('"fiz o treino A" marca o treino do plano e conta os minutos', () => {
    const S = person();
    S.trainPlan = { is_workout: true, at: '2026-11-01', name: 'treino.pdf', per_week: 3, professional: 'PT Rui', notes: '', workouts: [
      { name: 'Treino A', focus: 'Pernas', day: 'Segunda', exercises: [{ name: 'Agachamento', sets: 3, reps: '10', load: '20 kg', rest: '60 s', notes: '' }] },
    ] };
    S.plans = { treino: { name: 'treino.pdf', type: 'application/pdf', size: 1, at: '2026-11-01' } as never };
    expect(buildContext(S, NOW)).toMatch(/\[0\] Treino A — Pernas \(Segunda\)/);
    const done = applyCoachActions(S, [act({ type: 'plano_treino', value: 0, option: 50, status: 'seguido' })], NOW);
    const l = S.logs[todayKey(NOW)];
    expect(l.trainLog!['0']).toMatchObject({ status: 'seguido', minutes: 50 });
    expect(l.trainLog!['0'].sets.every((x) => x.done)).toBe(true);
    expect(l.workouts).toEqual([{ sessionId: 'plano-0', title: 'Treino A', minutes: 50, mvpa: 50, strength: true }]);
    expect(done[0]).toBe('🏋️ Treino A: feito como planeado, 50 min ✓');
    // outra vez não duplica
    applyCoachActions(S, [act({ type: 'plano_treino', value: 0, option: 40, status: 'seguido' })], NOW);
    expect(S.logs[todayKey(NOW)].workouts).toHaveLength(1);
  });
});

describe('Coach e a mente', () => {
  it('regista humor, stress e gratidão; a pausa não conta como feita', () => {
    const S = person();
    const done = applyCoachActions(S, [act({ type: 'stress', value: 4 }), act({ type: 'humor', value: 2 }), act({ type: 'gratidao', note: 'o abraço da minha filha' }), act({ type: 'respiracao', value: 3 })], NOW);
    const l = S.logs[todayKey(NOW)];
    expect(l).toMatchObject({ stress: 4, d: 2, grat: ['o abraço da minha filha'] });
    expect(l.breath).toBeUndefined();
    expect(done).toEqual(['🌬️ Stress: 4/5', '🙂 Humor: 2/5', '💚 Gratidão: o abraço da minha filha']);
  });
});
