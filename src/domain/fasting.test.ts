import { describe, expect, it } from 'vitest';
import { canActivate, endFast, ensureSession, fastDays, fastState, fastingReminders, fastingSafety, lowDayToday, mealPlan, proteinPerMeal, startFast, windowOn, type FastingSettings } from './fasting';
import type { AppState } from './types';

const f168: FastingSettings = { on: true, protocol: '16:8', open: '12:00', since: '2026-11-01', reminders: true };
const at = (s: string) => new Date(s);
const base = (over: Partial<AppState> = {}) => ({ ans: { sexo: 'f', idade: 40, altura: 165, peso: 70 }, logs: {}, fasting: f168, fastSessions: [], ...over }) as unknown as AppState;

describe('jejum intermitente', () => {
  it('janela de 16:8 a abrir às 12h fecha às 20h; ao fim de semana pode abrir a outra hora', () => {
    const w = windowOn(f168, at('2026-11-23T09:00:00'));
    expect([w.openText, w.closeText]).toEqual(['12:00', '20:00']);
    expect(windowOn({ ...f168, weekendOpen: '13:00' }, at('2026-11-22T09:00:00')).openText).toBe('13:00');
  });
  it('fora da janela conta o jejum desde que a janela fechou; dentro mostra quando fecha', () => {
    const st = fastState(f168, [], at('2026-11-23T10:00:00'));
    expect(st.kind).toBe('jejum');
    if (st.kind === 'jejum') { expect(st.since.getHours()).toBe(20); expect(Math.round(st.hours)).toBe(14); expect(st.reached).toBe(false); }
    // dentro da janela sem refeição registada: o jejum continua, com a meta cumprida
    const k = fastState(f168, [], at('2026-11-23T13:00:00'));
    expect(k.kind === 'jejum' && k.reached).toBe(true);
    // depois de comer: janela aberta até às 20h
    const j = fastState(f168, [{ start: '2026-11-22T20:00:00', end: at('2026-11-23T12:10:00').toISOString(), target: 16 }], at('2026-11-23T15:00:00'));
    expect(j.kind === 'janela' && j.closeText).toBe('20:00');
  });
  it('a primeira refeição termina o jejum; menos de 1 hora conta como engano', () => {
    const S = base();
    expect(ensureSession(S, at('2026-11-23T09:00:00'))).toBe(true);
    expect(ensureSession(S, at('2026-11-23T09:30:00'))).toBe(false);
    const r = endFast(S, at('2026-11-23T12:30:00'))!;
    expect(r.reached).toBe(true);
    expect(Math.round(r.hours * 10) / 10).toBe(16.5);
    expect(fastDays(S, 7, at('2026-11-23T13:00:00'))).toEqual([{ date: '2026-11-23', hours: 16.5, target: 16, reached: true }]);
    // depois de comer fica com a janela aberta
    expect(fastState(f168, S.fastSessions!, at('2026-11-23T13:00:00')).kind).toBe('janela');
    startFast(S, at('2026-11-23T19:00:00'));
    expect(endFast(S, at('2026-11-23T19:30:00'))).toMatchObject({ reached: false });
    expect(S.fastSessions!.filter((s) => s.start.startsWith('2026-11-23T19'))).toHaveLength(0);
  });
  it('quebrar o jejum mais cedo (antes da janela) deixa a janela aberta até ao fecho', () => {
    const S = base();
    ensureSession(S, at('2026-11-23T08:00:00'));
    endFast(S, at('2026-11-23T09:00:00'));
    const st = fastState(f168, S.fastSessions!, at('2026-11-23T10:00:00'));
    expect(st.kind).toBe('janela');
    if (st.kind === 'janela') expect(st.lastFast?.reached).toBe(false);
  });
  it('segurança: gravidez, menores, IMC baixo e distúrbio alimentar bloqueiam; diabetes com medicação pede acompanhamento', () => {
    expect(fastingSafety(base({ ans: { safe: ['gravidez'], idade: 30, altura: 165, peso: 60 } } as never), f168).block).toHaveLength(1);
    expect(fastingSafety(base({ ans: { idade: 16, altura: 165, peso: 60 } } as never), f168).block).toHaveLength(1);
    expect(fastingSafety(base({ ans: { idade: 30, altura: 170, peso: 50 } } as never), f168).block).toHaveLength(1);
    expect(canActivate(fastingSafety(base(), { ...f168, eatingDisorder: true }))).toBe(false);
    const d = fastingSafety(base(), { ...f168, diabetesMeds: true });
    expect(canActivate(d)).toBe(false);
    expect(canActivate(fastingSafety(base(), { ...f168, diabetesMeds: true, supervised: true }))).toBe(true);
    expect(canActivate(fastingSafety(base(), { ...f168, protocol: '20:4' }))).toBe(false);
    expect(canActivate(fastingSafety(base(), f168))).toBe(true);
  });
  it('refeições dentro da janela: sem pequeno-almoço quando a janela abre ao meio-dia', () => {
    expect(mealPlan(f168, at('2026-11-23T09:00:00'))).toEqual([
      { key: 'almoco', time: '12:00', first: true, last: false },
      { key: 'lanche', time: '15:45', first: false, last: false },
      { key: 'jantar', time: '19:30', first: false, last: true },
    ]);
    expect(mealPlan({ ...f168, protocol: '20:4', open: '14:00' }).map((m) => m.key)).toEqual(['almoco', 'jantar']);
    expect(proteinPerMeal(126, 2)).toEqual({ per: 63, hard: true });
  });
  it('5:2: dia de poucas calorias', () => {
    const S = base({ fasting: { on: true, protocol: '5:2', open: '12:00', lowDays: [1, 4], since: '2026-11-01' } });
    expect(lowDayToday(S, at('2026-11-23T10:00:00'))).toBe(500); // segunda
    expect(lowDayToday(S, at('2026-11-24T10:00:00'))).toBeNull();
  });
  it('lembretes: abre a janela e faltam 30 min para fechar', () => {
    const r = fastingReminders(base(), at('2026-11-23T13:00:00'));
    expect(r[0]).toMatchObject({ date: '2026-11-23', time: '19:30' });
    expect(r[1]).toMatchObject({ date: '2026-11-24', time: '12:00' });
    expect(r.every((x) => /^[a-z0-9]{4,24}$/.test(x.id))).toBe(true);
    expect(fastingReminders(base({ fasting: { ...f168, reminders: false } }))).toEqual([]);
  });
});

describe('jejum prescrito por um profissional', () => {
  it('chega como prescrição por ativar; não repete se já estiver ativo', async () => {
    const { applyProPlan } = await import('./pro');
    const S = base({ fasting: null, trainPlan: null } as never);
    const plan = { is_workout: true, workouts: [], per_week: 3, professional: 'Ana', notes: '', jejum: { protocol: '16:8' as const, open: '12:00', notes: '' } };
    applyProPlan(S, { code: 'NP-AAAA-BBBB', pro: 'Ana', plan, version: 1 });
    expect(S.fastingRx).toMatchObject({ protocol: '16:8', open: '12:00', by: 'Ana' });
    expect(S.trainPlan).toBeNull();
    S.fastingRx = null;
    S.fasting = { on: true, protocol: '16:8', open: '12:00', by: 'Ana', since: '2026-11-01' };
    applyProPlan(S, { code: 'NP-AAAA-BBBB', pro: 'Ana', plan, version: 2 });
    expect(S.fastingRx).toBeNull();
  });
  it('assistente: "comecei o jejum às 20h" e "terminei o jejum"', async () => {
    const { applyCoachActions } = await import('./coach');
    const S = base();
    const act = (value: number, time = '') => ({ type: 'jejum', value, time, meal: '', intensity: '', title: '' }) as never;
    const d1 = applyCoachActions(S, [act(1, '20:00')], at('2026-11-23T21:00:00'));
    expect(d1[0]).toContain('20:00');
    const d2 = applyCoachActions(S, [act(0)], at('2026-11-24T12:30:00'));
    expect(d2[0]).toContain('16 h 30 min ✓');
    expect(fastDays(S, 7, at('2026-11-24T13:00:00'))[0]).toMatchObject({ hours: 16.5, reached: true });
  });
});

describe('jejum pontual pelo assistente (sem configurar)', () => {
  const act = (value: number, option = 0, time = '') => ({ type: 'jejum', value, option, time, meal: '', intensity: '', title: '' }) as never;
  it('"vou fazer jejum agora até às 16h" começa um jejum pontual com a meta certa', async () => {
    const { applyCoachActions } = await import('./coach');
    const { activeFast } = await import('./fasting');
    const S = base({ fasting: null });
    const d = applyCoachActions(S, [act(1, 15.25)], at('2026-11-23T00:45:00'));
    expect(d[0]).toContain('meta 15 h 15 min (até às 16:00)');
    expect(d[0]).toContain('jejum pontual');
    expect(activeFast(S.fastSessions, at('2026-11-23T10:00:00'))).toMatchObject({ target: 15.25, reached: false });
    const e = applyCoachActions(S, [act(0)], at('2026-11-23T16:10:00'));
    expect(e[0]).toContain('✓');
  });
  it('"até às 16h" (hora de fim) dá a meta exata', async () => {
    const { applyCoachActions } = await import('./coach');
    const S = base({ fasting: null });
    const d = applyCoachActions(S, [{ type: 'jejum', value: 1, option: 15, note: '16:00', time: '', meal: '', intensity: '', title: '' } as never], at('2026-11-23T00:54:00'));
    expect(d[0]).toContain('meta 15 h 6 min (até às 16:00)');
  });
  it('as regras de segurança também valem para o jejum pontual', async () => {
    const { applyCoachActions } = await import('./coach');
    const S = base({ fasting: null, ans: { safe: ['gravidez'], idade: 30, altura: 165, peso: 60 } } as never);
    expect(applyCoachActions(S, [act(1, 16)], at('2026-11-23T00:45:00'))[0]).toContain('⛔');
    expect(applyCoachActions(base({ fasting: null }), [act(1, 30)], at('2026-11-23T00:45:00'))[0]).toContain('24 horas');
    expect(S.fastSessions ?? []).toHaveLength(0);
  });
});
