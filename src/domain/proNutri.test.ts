import { describe, expect, it } from 'vitest';
import { cleanAnamnese, cleanDayLog, cleanNutri, dayFor, dayTotals, emptyRx, itemFrom, nutriAttention, nutriFilled, scaleItem, suggestTargets, toDailyPlan, vsTargets, type NutriRx } from './proNutri';
import { searchNFoods } from './foodSearch';
import { cleanProfile } from './proProfile';

const rice = { name: 'Arroz, integral, cozido', kcal: 124, p: 2.6, c: 25.8, f: 1, fib: 2.7 };
const chicken = { name: 'Frango, peito, sem pele, grelhado', kcal: 159, p: 32, c: 0, f: 2.5, fib: 0 };
const rx = (): NutriRx => {
  const r = emptyRx();
  r.days[0].meals[1].options[0].items = [itemFrom(rice, 150, '4 col. de sopa'), itemFrom(chicken, 120, '1 filé médio')];
  r.days.push({ name: 'Dias de treino', weekdays: [1, 3, 5], meals: [{ ...r.days[0].meals[1], label: 'Pós-treino' }] });
  r.targets = { kcal: 1800, protein: 130, carbs: 180, fat: 60, fiber: 25, water: 2.5 };
  return r;
};

describe('NEFESH Pro para nutricionistas: plano alimentar', () => {
  it('calcula os valores pela quantidade e muda proporcionalmente', () => {
    const it1 = itemFrom(rice, 150);
    expect(it1).toMatchObject({ kcal: 186, p: 3.9, c: 38.7, f: 1.5, fib: 4.1 });
    expect(scaleItem(it1, 75)).toMatchObject({ kcal: 93, p: 2 });
    const t = dayTotals(rx().days[0]);
    expect(t.kcal).toBe(186 + 191);
    expect(vsTargets(t, rx().targets).kcal).toBe(21);
  });
  it('tipo de dia pela semana: seg/qua/sex é dia de treino, os outros "Todos os dias"', () => {
    expect(dayFor(rx(), new Date('2026-11-23T10:00:00')).name).toBe('Dias de treino'); // segunda
    expect(dayFor(rx(), new Date('2026-11-24T10:00:00')).name).toBe('Todos os dias');
  });
  it('vai para o diário do paciente no formato do plano (refeições, opções, metas)', () => {
    const p = toDailyPlan(rx(), new Date('2026-11-24T10:00:00'), 'Ana Nutri');
    expect(p.meals).toHaveLength(1); // só as refeições com alimentos
    expect(p.meals[0]).toMatchObject({ meal: 'almoco', label: 'Almoço', time: '13:00' });
    expect(p.meals[0].options[0].items[0]).toMatchObject({ name: 'Arroz, integral, cozido', quantity: '4 col. de sopa (150 g)', kcal: 186 });
    expect(p).toMatchObject({ daily_kcal: 1800, daily_protein_g: 130, professional: 'Ana Nutri' });
  });
  it('limpa o que vem do telemóvel (limites, horas, opções vazias)', () => {
    const c = cleanNutri({ days: [{ name: '', weekdays: [1, 9, 1], meals: [{ key: 'xx', time: '25:00', options: [{ items: [{ food: 'Ovo', grams: 50, kcal: 72 }, { food: '' }] }] }] }], targets: { kcal: 99999 }, spirulina: 3 })!;
    expect(c.days[0]).toMatchObject({ name: 'Todos os dias', weekdays: [1] });
    expect(c.days[0].meals[0]).toMatchObject({ key: 'almoco', time: '13:00' });
    expect(c.days[0].meals[0].options[0].items).toHaveLength(1);
    expect(c.targets.kcal).toBe(6000);
    expect(c.spirulina).toBe(3);
    expect(cleanNutri({ days: [] })).toBeNull();
    expect(nutriFilled(c)).toBe(true);
    expect(nutriFilled(emptyRx())).toBe(false);
  });
  it('metas sugeridas pelo perfil', () => {
    const t = suggestTargets({ sexo: 'f', idade: 35, altura: 165, peso: 70, objetivo: 'Emagrecimento', dias: 3 })!;
    expect(t.kcal).toBeGreaterThan(1500);
    expect(t.kcal).toBeLessThan(1900);
    expect(t.protein).toBe(126);
    expect(suggestTargets({ peso: 70 })).toBeNull();
  });
  it('anamnese fica no perfil (limpa)', () => {
    expect(cleanAnamnese({ patologias: ' diabetes tipo 2 ', xpto: 'x', alergias: '' })).toEqual({ patologias: 'diabetes tipo 2' });
    expect(cleanProfile({ anamnese: { alergias: 'lactose' } }).anamnese).toEqual({ alergias: 'lactose' });
  });
  it('base de alimentos: TACO e a base da app, sem acentos', () => {
    const r = searchNFoods('frango grelhado');
    expect(r.length).toBeGreaterThan(0);
    expect(r.slice(0, 3).every((x) => /frango/i.test(x.name))).toBe(true);
    expect(searchNFoods('feijao').some((x) => x.src === 'TACO')).toBe(true);
    expect(searchNFoods('')).toEqual([]);
  });
  it('painel de atenção: adesão baixa, sem registos, fome, peso', () => {
    const now = new Date('2026-11-23T12:00:00');
    const d = (k: string, pct: number, extra = {}) => ({ day: k, data: cleanDayLog({ meals: [{ label: 'Almoço', status: pct ? 'seguido' : 'saltado' }], pct, ...extra }) });
    const logs = [d('2026-11-22', 30, { hunger: 4, weight: 72 }), d('2026-11-21', 40, { hunger: 5 }), d('2026-11-20', 20, { hunger: 4 }), d('2026-11-14', 90, { weight: 70 })];
    const a = nutriAttention(logs, { linked: true, hasPlan: true }, now).map((x) => x.kind);
    expect(a).toEqual(expect.arrayContaining(['adesao', 'fome', 'peso']));
    expect(nutriAttention([], { linked: true, hasPlan: true, planSince: '2026-11-10T10:00:00Z' }, now)[0].kind).toBe('parado');
    expect(nutriAttention([], { linked: true, hasPlan: false }, now)[0].kind).toBe('enviar');
  });
});

describe('paciente: o plano do nutricionista no diário', () => {
  it('aplica o plano (diário, metas, dose) e muda o tipo de dia à meia-noite', async () => {
    const { applyNutriPlan, refreshNutriDay, nutriDayLog, applyProPlan } = await import('./pro');
    const S = { logs: {}, evals: [], ans: { sexo: 'f', idade: 40, altura: 165, peso: 70 } } as never as import('./types').AppState;
    const r = rx(); r.spirulina = 3;
    applyProPlan(S, { code: 'NP-AAAA-BBBB', pro: 'Ana', kind: 'nutricionista', plan: { is_workout: true, workouts: [], per_week: 3, professional: 'Ana', notes: '', nutri: r }, version: 1 });
    expect(S.nutriLink?.pro).toBe('Ana');
    expect(S.proLink).toBeUndefined();
    expect(S.plans?.nutri?.type).toBe('nefesh-pro');
    expect(S.nutriPro).toMatchObject({ kcal: 1800, protein: 130, by: 'Ana' });
    expect(S.proDose).toMatchObject({ g: 3, by: 'Ana' });
    S.nutriPlan = { ...S.nutriPlan!, at: '2026-11-22' };
    expect(refreshNutriDay(S, new Date('2026-11-23T08:00:00'))).toBe(true); // segunda: dia de treino
    expect((S.nutriPlan as { day?: string }).day).toBe('Dias de treino');
    expect(refreshNutriDay(S, new Date('2026-11-23T20:00:00'))).toBe(false);
    S.logs['2026-11-23'] = { planLog: { '0': { status: 'alterado', option: 0, changes: ['sem arroz'] } }, hunger: 3 } as never;
    expect(nutriDayLog(S, '2026-11-23')).toMatchObject({ pct: 50, hunger: 3, meals: [{ label: 'Pós-treino', status: 'alterado', changes: ['sem arroz'] }] });
  });
});
