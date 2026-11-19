import { describe, expect, it } from 'vitest';
import { daysSince, keyDaysAgo, todayKey } from './dates';
import { calcPlan, indexOf, scores, slotsFor, splitDose } from './plan';
import { blankState, sampleState } from './sample';
import { adherence, bestStreak, changeSinceStart, report, stock, streak, took } from './stats';
import type { AppState } from './types';

const NOW = new Date(2026, 10, 19, 10, 0);

describe('calcPlan', () => {
  it('sugere a dose dos estudos e mostra quando fica acima do rótulo', () => {
    const c = calcPlan({ goal: 'energia', peso: 70 });
    expect(c).toMatchObject({ g: 3, caps: 6, gStudy: 3, aboveLabel: true, capped: false, water: 10 });
    expect(calcPlan({ goal: 'energia', peso: 70 }, { format: 'po' })).toMatchObject({ g: 3, aboveLabel: false });
  });
  it('segue o rótulo quando a pessoa prefere', () => {
    const c = calcPlan({ goal: 'energia', peso: 70 }, { followLabel: true });
    expect(c).toMatchObject({ g: 2, caps: 4, capped: true, aboveLabel: false });
  });
  it('ajusta a referência dos estudos pelo peso e pelo treino', () => {
    expect(calcPlan({ goal: 'desporto', peso: 105, ativ: '5+' }).gStudy).toBe(8);
    expect(calcPlan({ goal: 'energia', peso: 50 }).gStudy).toBe(2.5);
    expect(calcPlan({ goal: 'peso', peso: 85 }).gStudy).toBe(5);
  });
  it('a dose de um profissional substitui o rótulo, com limite de 8 g', () => {
    const pro = { g: 6, by: 'Dra. Teste', at: '2026-11-19' };
    expect(calcPlan({ goal: 'desporto', peso: 85 }, { pro }).g).toBe(6);
    expect(calcPlan({ goal: 'desporto' }, { pro: { ...pro, g: 20 } }).g).toBe(8);
  });
  it('marca a origem de cada passo e calcula g/kg', () => {
    const c = calcPlan({ goal: 'desporto', peso: 85, ativ: '5+' });
    expect(c.why.map((w) => w.kind)).toEqual(['evidencia', 'criterio', 'criterio', 'rotulo']);
    expect(c.why[0].studies).toEqual(['kalafati2010']);
    expect(c.gPerKg).toBeCloseTo(7 / 85, 3);
  });
  it('sinaliza situações que pedem um profissional', () => {
    expect(calcPlan({ goal: 'energia', safe: ['nenhuma'] }).flags).toEqual([]);
    expect(calcPlan({ goal: 'energia', safe: ['gravidez', 'renal'] }).flags).toEqual(['gravidez', 'renal']);
  });
  it('só faz semana de adaptação a quem não toma regularmente', () => {
    expect(calcPlan({ prior: 'nunca' }).start).toBe(true);
    expect(calcPlan({ prior: 'regular' }).start).toBe(false);
  });
});

describe('scores', () => {
  it('dá 100 em todas as áreas a respostas ideais', () => {
    const sc = scores({ energia: 5, stress: 1, sonoh: '7-8', sonoq: 5, veg: '4+', proc: 'raro', agua: '10+', ativ: '5+' });
    expect(sc).toEqual({ energia: 100, sono: 100, nutricao: 100, hidratacao: 100, movimento: 100 });
    expect(indexOf(sc)).toBe(100);
  });
  it('penaliza a hidratação com muita cafeína', () => {
    expect(scores({ agua: '7-9', cafe: '3+' }).hidratacao).toBe(75);
  });
});

describe('splitDose', () => {
  it('uma toma abaixo de 6 cápsulas, duas a partir daí', () => {
    expect(splitDose(5, 'energia')).toEqual([{ l: 'Manhã', n: 5 }]);
    expect(splitDose(7, 'desporto')).toEqual([{ l: 'Manhã', n: 4 }, { l: 'Pré-treino', n: 3 }]);
    expect(splitDose(8, 'peso')[0].l).toBe('Antes do almoço');
    expect(splitDose(8, 'energia', 'po')).toHaveLength(1);
  });
  it('reduz para metade na primeira semana', () => {
    const S: AppState = { ...blankState(NOW), ans: { goal: 'energia', peso: 70, prior: 'nunca' }, planStart: keyDaysAgo(2, NOW) };
    expect(slotsFor(S, NOW)).toEqual([{ l: 'Manhã', n: 3 }]);
    S.planStart = keyDaysAgo(8, NOW);
    expect(slotsFor(S, NOW)).toEqual([{ l: 'Manhã', n: 3 }, { l: 'Almoço', n: 3 }]);
  });
});

describe('estatísticas', () => {
  // estes testes usam a dose do rótulo (4 cápsulas, 1 toma) para simplificar
  const base = (): AppState => ({ ...blankState(NOW), followLabel: true, ans: { goal: 'energia', peso: 70, prior: 'regular' }, planStart: keyDaysAgo(20, NOW), stockStart: keyDaysAgo(20, NOW) });

  it('conta a sequência sem quebrar por hoje ainda não estar feito', () => {
    const S = base();
    for (let i = 1; i <= 5; i++) S.logs[keyDaysAgo(i, NOW)] = { doses: [true, true] };
    expect(streak(S, NOW)).toBe(5);
    S.logs[todayKey(NOW)] = { doses: [true, true] };
    expect(streak(S, NOW)).toBe(6);
    S.logs[keyDaysAgo(3, NOW)] = { doses: [false] };
    expect(streak(S, NOW)).toBe(3);
    expect(bestStreak(S, NOW)).toBe(3);
  });

  it('calcula a adesão e o stock restante', () => {
    const S = base();
    for (let i = 0; i < 7; i++) S.logs[keyDaysAgo(i, NOW)] = { doses: [true, true] };
    expect(adherence(S, 14, NOW)).toBe(50);
    const st = stock(S, NOW);
    expect(st.used).toBe(28);
    expect(st.left).toBe(92);
    expect(st.days).toBe(23);
  });

  it('exige todas as tomas para o ritual contar', () => {
    const S = base();
    expect(took(S, { doses: [false] }, NOW)).toBe(false);
    expect(took(S, { doses: [true] }, NOW)).toBe(true);
  });

  it('precisa de 10 check-ins para o resumo de evolução', () => {
    const S = base();
    for (let i = 0; i < 9; i++) S.logs[keyDaysAgo(i, NOW)] = { e: 3 };
    expect(changeSinceStart(S, 'e')).toBeNull();
  });
});

describe('estado de demonstração', () => {
  it('gera 30 dias coerentes e um relatório', () => {
    const S = sampleState(NOW);
    expect(Object.keys(S.logs)).toHaveLength(30);
    expect(daysSince(S.planStart!, NOW)).toBe(30);
    expect(changeSinceStart(S, 'e')).toBeGreaterThan(0);
    const r = report(S, NOW);
    expect(r).toContain('Nome: Ana');
    expect(r).toContain('Dose atual: 3 g/dia (6 cápsulas');
    expect(r).toContain('Base científica: Johnson et al., 2016');
  });
});
