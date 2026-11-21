import { describe, expect, it } from 'vitest';
import { blankState } from './sample';
import { areaMetric, challengeState, firstInsight, journeyCard, markChallenge, newChallenge, weakestArea } from './firstWeek';
import { scores } from './plan';
import { provisionalAreas } from './onboarding';
import type { AppState } from './types';

const ans = { name: 'Ana', goal: 'energia', sexo: 'f', idade: 30, altura: 165, peso: 60, ativ: '0', sonoh: '7-8', energia: 4, stress: 2, safe: ['nenhuma'] } as NonNullable<AppState['ans']>;
const at = (d: string, h = 12) => new Date(`${d}T${String(h).padStart(2, '0')}:00:00`);
const S0 = (start = '2026-11-20'): AppState => ({ ...blankState(), ans: { ...ans }, planStart: start, evals: [{ date: start, sc: scores(ans), prov: provisionalAreas(ans) }] });

describe('desafio da semana', () => {
  it('escolhe o pilar mais fraco com resposta (as áreas provisórias ficam de fora)', () => {
    const S = S0();
    expect(weakestArea(S)).toBe('movimento'); // treina raramente
    expect(weakestArea(S, 'movimento')).toBe('energia');
  });

  it('visto diário, resultado ao fim de 7 dias com a semana anterior', () => {
    const S = S0();
    S.challenge = newChallenge(S, '2026-11-20');
    expect(S.challenge.area).toBe('movimento');
    markChallenge(S, at('2026-11-20'));
    markChallenge(S, at('2026-11-21'));
    expect(challengeState(S, at('2026-11-21'))).toMatchObject({ day: 2, ended: false, doneToday: true });
    S.logs['2026-11-15'] = { workouts: [{ sessionId: 'x', title: 'x', minutes: 20, mvpa: 20, strength: false }] };
    S.logs['2026-11-22'] = { workouts: [{ sessionId: 'x', title: 'x', minutes: 30, mvpa: 30, strength: false }] };
    S.logs['2026-11-24'] = { workouts: [{ sessionId: 'x', title: 'x', minutes: 30, mvpa: 30, strength: false }] };
    expect(challengeState(S, at('2026-11-27'))!.result).toEqual({ before: 20, after: 60, better: true, days: 2 });
  });

  it('nos vegetais, o visto também marca o hábito', () => {
    const S = S0();
    S.challenge = { area: 'nutricao', start: '2026-11-20', done: [] };
    markChallenge(S, at('2026-11-21'));
    expect(S.logs['2026-11-21'].hab?.veg).toBe(true);
    expect(areaMetric(S, 'nutricao', '2026-11-20')).toBe(1);
  });
});

describe('jornada dos 7 dias', () => {
  it('um cartão por dia, só na primeira semana, e fecha', () => {
    const S = S0();
    expect(journeyCard(S, at('2026-11-20'))).toBeNull(); // dia 1 sem toma
    expect(journeyCard(S, at('2026-11-21'))!.kind).toBe('receita');
    expect(journeyCard(S, at('2026-11-24'))).toMatchObject({ kind: 'ciencia', video: expect.stringContaining('instagram.com/reel/') });
    expect(journeyCard(S, at('2026-11-26'))!.kind).toBe('semana');
    expect(journeyCard(S, at('2026-11-27'))).toBeNull();
    S.journeySeen = [2];
    expect(journeyCard(S, at('2026-11-21'))).toBeNull();
  });

  it('primeiro padrão só com diferença real; senão um facto verdadeiro', () => {
    const S = S0();
    S.logs['2026-11-20'] = { water: 10, e: 4 };
    S.logs['2026-11-21'] = { water: 10, e: 5 };
    S.logs['2026-11-22'] = { water: 2, e: 2 };
    expect(firstInsight(S, at('2026-11-22'))).toMatch(/Nos 2 dias em que bebeu a meta de água/);
    const T = S0();
    T.logs['2026-11-22'] = { e: 3 };
    expect(firstInsight(T, at('2026-11-22'))).not.toMatch(/energia foi maior/);
  });
});

import { energyInsight, homeVisibility, insightProgress } from './firstWeek';

describe('evolução na primeira semana', () => {
  it('marcos: ontem e hoje, faltam N check-ins, insight com o fator que mais difere', () => {
    const S = S0();
    S.challenge = { area: 'hidratacao', start: '2026-11-20', done: ['2026-11-21'] };
    S.logs['2026-11-20'] = { e: 2, water: 3, sleepH: 6 };
    expect(insightProgress(S, at('2026-11-20'))).toMatchObject({ n: 1, next: 2, left: 1, level: 0, insight: null });
    S.logs['2026-11-21'] = { e: 4, water: 9, sleepH: 6.5 };
    const p = insightProgress(S, at('2026-11-21'));
    expect(p).toMatchObject({ n: 2, next: 4, left: 2, level: 2, yt: { y: 2, t: 4 } });
    expect(p.insight!.text).toBe('No dia em que bebeu 9 copos de água, a sua energia foi 4. Nos outros, 2.');
  });

  it('sem diferença no fator bom, não inventa', () => {
    const S = S0();
    S.logs['2026-11-20'] = { e: 4, water: 2 };
    S.logs['2026-11-21'] = { e: 2, water: 8 };
    expect(energyInsight(S, at('2026-11-21'))).toBeNull();
  });

  it('início progressivo: só para quem começou com esta versão; abre por dias', () => {
    const S = S0('2026-11-20');
    expect(homeVisibility(S, at('2026-11-21')).progressive).toBe(false);
    S.homeProgressive = true;
    const d1 = homeVisibility(S, at('2026-11-20'));
    expect([...d1.show]).toEqual([]);
    expect(homeVisibility(S, at('2026-11-22')).amanha).toBe('passos'); // movimento é o mais fraco
    expect(homeVisibility(S, at('2026-11-23'))).toMatchObject({ novo: 'passos' });
    expect([...homeVisibility(S, at('2026-11-29')).show].sort()).toEqual(['agua', 'comunidade', 'passos', 'habitos'].sort());
    expect(homeVisibility(S, at('2026-12-04')).progressive).toBe(false);
    S.challenge = { area: 'hidratacao', start: '2026-11-20', done: [] };
    expect(homeVisibility(S, at('2026-11-20')).show.has('agua')).toBe(true);
    S.homeAll = true;
    expect(homeVisibility(S, at('2026-11-20')).progressive).toBe(false);
  });
});
