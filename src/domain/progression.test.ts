import { describe, expect, it } from 'vitest';
import { blankState } from './sample';
import { deloadSuggestion, homeDose, nextLoad, recordProgress } from './progression';
import { advancePlan, currentSession, planSegments, sessionText, startPlan } from './runPlans';
import { RunTrack, compactRoute, fmtPace, haversine, newRecords, runKcal, toGpx, type RunSummary } from './gps';
import type { AppState } from './types';

const S0 = () => ({ ...blankState() }) as AppState;

describe('progressão no ginásio', () => {
  it('sobe com fácil, ou com certo duas vezes; mantém com difícil', () => {
    const S = S0();
    S.prog = recordProgress(undefined, [{ id: 'agachamento_barra', feel: 'facil', kg: 50 }], '2026-11-10');
    expect(nextLoad(S, 'agachamento_barra', null, '2026-11-12')).toMatchObject({ kg: 52.5 });
    S.prog = recordProgress(undefined, [{ id: 'biceps', feel: 'certo', kg: 10 }], '2026-11-10');
    expect(nextLoad(S, 'biceps', null, '2026-11-12')!.kg).toBe(10);
    S.prog = recordProgress(S.prog, [{ id: 'biceps', feel: 'certo', kg: 10 }], '2026-11-12');
    expect(nextLoad(S, 'biceps', null, '2026-11-14')).toMatchObject({ kg: 11 });
    S.prog = recordProgress(S.prog, [{ id: 'biceps', feel: 'dificil', kg: 11 }], '2026-11-14');
    expect(nextLoad(S, 'biceps', null, '2026-11-16')!.kg).toBe(11);
  });

  it('baixa ~10% depois de duas falhas; não sobe com dor nem em semana leve', () => {
    const S = S0();
    S.prog = recordProgress(undefined, [{ id: 'supino_barra', feel: 'falhei', kg: 60 }], '2026-11-10');
    S.prog = recordProgress(S.prog, [{ id: 'supino_barra', feel: 'falhei', kg: 60 }], '2026-11-12');
    expect(nextLoad(S, 'supino_barra', null, '2026-11-14')!.kg).toBe(55);
    S.prog = recordProgress(undefined, [{ id: 'legpress', feel: 'facil', kg: 100 }], '2026-11-10');
    S.logs['2026-11-12'] = { cycle: { pain: 7 } };
    expect(nextLoad(S, 'legpress', null, '2026-11-12')).toMatchObject({ kg: 100, why: expect.stringMatching(/dor/) });
    S.trainDeload = { from: '2026-11-13', to: '2026-11-19' };
    expect(nextLoad(S, 'legpress', null, '2026-11-14')!.kg).toBe(100);
    // sem progressão: parte da última carga registada
    expect(nextLoad(S0(), 'remada_curvada', 40)).toEqual({ kg: 40, why: '' });
  });
});

describe('progressão em casa', () => {
  it('sobe repetições por etapas e passa à variação difícil', () => {
    const S = S0();
    for (let i = 1; i <= 4; i++) S.prog = recordProgress(S.prog, [{ id: 'casa:flexoes', feel: 'facil' }], `2026-11-0${i}`);
    expect(S.prog!['casa:flexoes'].stage).toBe(4);
    expect(homeDose(S, 'flexoes', '10 repetições', 'Flexões').name).toBe('Flexões com os pés elevados');
    const T = S0();
    T.prog = recordProgress(undefined, [{ id: 'casa:prancha', feel: 'facil' }], '2026-11-01');
    expect(homeDose(T, 'prancha', '40 segundos', 'Prancha').dose).toBe('50 segundos');
    T.prog = recordProgress(T.prog, [{ id: 'casa:prancha', feel: 'falhei' }], '2026-11-03');
    T.prog = recordProgress(T.prog, [{ id: 'casa:prancha', feel: 'falhei' }], '2026-11-05');
    expect(homeDose(T, 'prancha', '40 segundos', 'Prancha').dose).toBe('30 segundos');
  });

  it('semana leve: sono e energia em baixo, ou 5 semanas de força', () => {
    const now = new Date('2026-11-21T12:00:00');
    const S = S0();
    for (let i = 0; i < 5; i++) S.logs[`2026-11-${21 - i}`] = { e: 2, sleepH: 6 };
    expect(deloadSuggestion(S, now)!.reason).toMatch(/sono e a energia/);
    const T = S0();
    for (let w = 0; w < 5; w++) { const d = new Date(now); d.setDate(d.getDate() - w * 7 - 1); T.logs[d.toLocaleDateString('en-CA')] = { workouts: [{ sessionId: 'x', title: 'x', minutes: 40, mvpa: 40, strength: true }] }; }
    expect(deloadSuggestion(T, now)!.reason).toMatch(/5 semanas/);
    T.trainDeload = { from: '2026-11-01', to: '2026-11-07' };
    expect(deloadSuggestion(T, now)).toBeNull();
  });
});

describe('GPS', () => {
  // ~100 m para norte a cada 30 s (12 km/h)
  const pts = (n: number, t0 = 0, lat0 = 38.7) => Array.from({ length: n }, (_, i) => ({ lat: lat0 + (i * 100) / 111195, lon: -9.14, t: t0 + i * 30000, acc: 5 }));

  it('distância, tempo em movimento e parciais por km', () => {
    const tr = new RunTrack('corrida');
    for (const p of pts(26)) tr.add(p);
    expect(Math.round(tr.dist)).toBe(2500);
    expect(tr.moving).toBe(750);
    expect(tr.splits).toEqual([300, 600]);
    expect(fmtPace(300)).toBe('5:00');
  });

  it('ignora pontos imprecisos e saltos impossíveis; pausa automática parado', () => {
    const tr = new RunTrack('corrida');
    tr.add({ lat: 38.7, lon: -9.14, t: 0, acc: 5 });
    expect(tr.add({ lat: 38.7009, lon: -9.14, t: 30000, acc: 80 })).toBe(false);
    expect(tr.add({ lat: 38.75, lon: -9.14, t: 30000, acc: 5 })).toBe(false); // 5,5 km em 30 s
    for (let i = 1; i <= 10; i++) tr.add({ lat: 38.7, lon: -9.14, t: i * 10000, acc: 5 }); // parado 100 s
    expect(tr.moving).toBeLessThanOrEqual(10);
    expect(tr.dist).toBe(0);
  });

  it('recordes, calorias, percurso compacto e GPX', () => {
    const run = (id: string, splits: number[], dist: number): RunSummary => ({ id, date: '2026-11-20', kind: 'corrida', dist, secs: 0, moving: splits[splits.length - 1] ?? 600, splits, kcal: 0 });
    const prev = [run('a', [330, 660, 990, 1320, 1650], 5000)];
    expect(newRecords(prev, run('b', [320, 640, 960, 1280, 1600, 1950], 6100))).toEqual(['Maior distância: 6,10 km', 'Km mais rápido: 5:20', 'Melhor 5 km: 26:40']);
    expect(newRecords([], run('c', [300], 1000))).toEqual([]);
    expect(runKcal('corrida', 5000, 1800, 70)).toBe(350);
    const r = compactRoute(pts(26).map((p) => ({ ...p, alt: 10 })));
    expect(r.length).toBe(26);
    expect(haversine({ lat: 0, lon: 0 }, { lat: 0, lon: 1 })).toBeGreaterThan(111000);
    expect(toGpx(run('a', [300], 1000), r)).toMatch(/<trkpt lat="38.7" lon="-9.14"><ele>10<\/ele><time>/);
  });
});

describe('planos de corrida', () => {
  it('começa na semana 1 e descreve a sessão', () => {
    const st = startPlan('c5k', '2026-11-01');
    expect(sessionText(planSegments(st))).toBe('6 × 1 min a correr com 1:30 min a caminhar');
    expect(sessionText(planSegments({ ...st, week: 8 }))).toBe('30 min a correr sem parar');
    expect(sessionText(planSegments({ ...startPlan('k10'), session: 2 }))).toMatch(/10 min em ritmo mais rápido/);
  });

  it('avança, repete, volta atrás e salta conforme correu', () => {
    let st = startPlan('c5k', '2026-11-01');
    st = advancePlan(st, true, 'certo', '2026-11-02', new Date('2026-11-02T20:00:00')).state;
    expect([st.week, st.session]).toEqual([1, 2]);
    st = advancePlan(st, false, 'certo', '2026-11-04', new Date('2026-11-04T20:00:00')).state; // incompleta: repete
    expect([st.week, st.session]).toEqual([1, 2]);
    st = advancePlan({ ...st, week: 3, session: 1 }, true, 'dificil', '2026-11-06', new Date('2026-11-06T20:00:00')).state;
    const r = advancePlan(st, true, 'dificil', '2026-11-08', new Date('2026-11-08T20:00:00'));
    expect([r.state.week, r.state.session]).toEqual([2, 1]);
    expect(r.why).toMatch(/volta uma semana/);
    let f = advancePlan(startPlan('c5k'), true, 'facil', '2026-11-10', new Date('2026-11-10T20:00:00')).state;
    f = advancePlan(f, true, 'facil', '2026-11-12', new Date('2026-11-12T20:00:00')).state;
    expect([f.week, f.session]).toEqual([2, 1]);
  });

  it('mais de 10 dias parado repete a última sessão', () => {
    const st = advancePlan(startPlan('c5k'), true, 'certo', '2026-11-01', new Date('2026-11-01T12:00:00')).state;
    expect(currentSession(st, new Date('2026-11-20T12:00:00'))).toEqual({ week: 1, session: 1, back: true });
  });
});
