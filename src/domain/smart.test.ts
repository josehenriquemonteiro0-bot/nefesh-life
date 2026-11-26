import { describe, expect, it } from 'vitest';
import { dayKey } from './dates';
import { localReminders } from './localReminders';
import {
  collapsedCards, detectEvents, discoverOfWeek, insightOfDay, insights, learnedNext, markDiscover, noteCard, noteUse, rateInsight, recordEvents,
  routines, skipRoutine, smartShortcuts, toggleFav, moveFav, markInsightShown,
} from './smart';
import type { AppState } from './types';

const base = () => ({ logs: {}, evals: [], ans: { name: 'Ana', goal: 'energia', sexo: 'f', idade: 30, altura: 165, peso: 60, ativ: '1-2', sonoh: '7-8', energia: 3, stress: 3, safe: ['nenhuma'] }, planStart: '2026-10-01' }) as unknown as AppState;
const at = (d: string, hm: string) => new Date(`${d}T${hm}:00`);
const day = (n: number, from = '2026-11-26') => { const t = new Date(`${from}T12:00:00`); t.setDate(t.getDate() - n); return dayKey(t); };

describe('Início inteligente', () => {
  it('reconhece o que foi registado e guarda a hora', () => {
    expect(detectEvents({ water: 2 }, { water: 3, e: 4, workouts: [{ sessionId: 'a', title: 'A', minutes: 30, mvpa: 20, strength: true }] }).sort()).toEqual(['agua', 'checkin', 'treino']);
    expect(detectEvents({ e: 3 }, { e: 4 })).toEqual([]);
    expect(detectEvents(undefined, { doses: [true, false], breath: 5, sleepD: { bed: '23:00', up: '07:00' } }).sort()).toEqual(['diario', 'dose', 'respiracao']);
    const S = base();
    recordEvents(S, ['treino'], at('2026-11-20', '18:10'));
    expect(S.smart?.ev).toEqual([{ k: 'treino', d: '2026-11-20', m: 18 * 60 + 10 }]);
  });

  it('aprende a hora habitual do treino (dias úteis) e sugere-a perto dessa hora, até ser dispensada 3 vezes', () => {
    const S = base();
    // treinos nos dias úteis por volta das 18h
    for (const [n, hm] of [[1, '18:05'], [2, '17:50'], [3, '18:20'], [6, '18:00'], [7, '18:10']] as const) recordEvents(S, ['treino'], at(day(n), hm));
    const now = at('2026-11-26', '17:30'); // quinta-feira
    const r = routines(S, now).find((x) => x.k === 'treino')!;
    expect(r).toMatchObject({ m: 18 * 60 + 5, days: 'uteis' });
    expect(learnedNext(S, {}, now)).toMatchObject({ k: 'treino', when: '18:05' });
    expect(learnedNext(S, {}, at('2026-11-26', '15:00'))).toBeNull();
    // já treinou hoje: não sugere
    expect(learnedNext(S, { workouts: [{ sessionId: 'x', title: 'x', minutes: 20, mvpa: 10, strength: false }] }, now)).toBeNull();
    // dispensada hoje: não volta hoje
    skipRoutine(S, 'treino', now);
    expect(learnedNext(S, {}, now)).toBeNull();
    expect(learnedNext(S, {}, at('2026-11-27', '17:40'))).not.toBeNull();
    skipRoutine(S, 'treino', at('2026-11-27', '17:40'));
    skipRoutine(S, 'treino', at('2026-11-28', '17:40'));
    expect(learnedNext(S, {}, at('2026-11-30', '17:40'))).toBeNull();
    // voltou a treinar: a sugestão regressa
    recordEvents(S, ['treino'], at('2026-11-30', '18:00'));
    expect(S.smart?.skip?.treino).toBeUndefined();
  });

  it('horas muito diferentes não são rotina; com menos de 4 dias também não', () => {
    const S = base();
    for (const [n, hm] of [[1, '07:00'], [2, '13:00'], [3, '21:00'], [6, '10:00'], [7, '18:00']] as const) recordEvents(S, ['meditacao'], at(day(n), hm));
    for (const [n, hm] of [[1, '20:00'], [2, '20:10'], [3, '20:05']] as const) recordEvents(S, ['checkin'], at(day(n), hm));
    expect(routines(S, at('2026-11-26', '12:00'))).toEqual([]);
  });

  it('atalhos: favoritos à frente; o resto pelo uso a esta hora', () => {
    const S = base();
    for (let i = 0; i < 5; i++) noteUse(S, 'respirar', at('2026-11-20', '22:00'));
    const night = smartShortcuts(S, at('2026-11-26', '22:15')).map((x) => x.id);
    expect(night[0]).toBe('respirar');
    expect(night).toContain('checkin');
    expect(night).not.toContain('dose');
    toggleFav(S, 'med');
    toggleFav(S, 'agua');
    moveFav(S, 'agua', -1);
    const list = smartShortcuts(S, at('2026-11-26', '09:00'));
    expect(list.slice(0, 2)).toEqual([{ id: 'agua', fav: true }, { id: 'med', fav: true }]);
    expect(list).toHaveLength(6);
    expect(list.map((x) => x.id)).not.toContain('jejum');
  });

  it('insights a partir dos registos, com 👍/👎', () => {
    const S = base();
    const now = at('2026-11-26', '10:00');
    for (let n = 1; n <= 20; n++) {
      const trained = n % 2 === 0;
      S.logs[day(n)] = { ...(S.logs[day(n)] ?? {}), ...(trained ? { workouts: [{ sessionId: 's', title: 'T', minutes: 40, mvpa: 30, strength: true }] } : {}), e: n % 4 < 2 ? 4 : 2, sleepH: n % 4 < 2 ? 7.5 : 6 };
    }
    // a noite depois de treinar (dia n-1) tem mais sono
    for (let n = 1; n <= 20; n++) if (n % 2 === 0) S.logs[day(n - 1)] = { ...(S.logs[day(n - 1)] ?? {}), sleepH: 7.8 }; else S.logs[day(n - 1)] = { ...(S.logs[day(n - 1)] ?? {}), sleepH: 6.4 };
    const ids = insights(S, now).map((x) => x.id);
    expect(ids).toContain('treino-sono');
    const first = insightOfDay(S, now)!;
    markInsightShown(S, first.id, now);
    expect(insightOfDay(S, at('2026-11-26', '20:00'))!.id).toBe(first.id);
    rateInsight(S, first.id, -1, now);
    const next = insightOfDay(S, at('2026-11-27', '10:00'));
    expect(next?.id).not.toBe(first.id);
    // sem dados suficientes, nada
    expect(insights(base(), now)).toEqual([]);
  });

  it('Descobrir: uma função não usada por semana; fechada não volta', () => {
    const S = base();
    const now = at('2026-11-26', '10:00');
    const d = discoverOfWeek(S, now)!;
    expect(d.id).toBe('foto');
    markDiscover(S, d.id, true, now);
    expect(discoverOfWeek(S, now)).toBeNull();
    expect(discoverOfWeek(S, at('2026-12-01', '10:00'))!.id).not.toBe('foto');
  });

  it('Início adaptativo: só depois de 14 dias; o que não usa recolhe; "mostrar tudo" desliga', () => {
    const S = base();
    const now = at('2026-11-26', '10:00');
    S.smart = { since: '2026-11-20' };
    expect(collapsedCards(S, now).size).toBe(0);
    S.smart = { since: '2026-11-01' };
    noteCard(S, 'energia', at('2026-11-25', '10:00'));
    const c = collapsedCards(S, now);
    expect(c.has('energia')).toBe(false);
    expect(c.has('comunidade')).toBe(true);
    S.smart!.all = true;
    expect(collapsedCards(S, now).size).toBe(0);
  });

  it('lembretes nos horários aprendidos só quando a pessoa os liga', () => {
    const S = base();
    for (const n of [1, 2, 3, 6, 7]) recordEvents(S, ['treino'], at(day(n), '18:00'));
    const now = at('2026-11-26', '09:00');
    expect(localReminders(S, now).some((r) => r.body.includes('treino'))).toBe(false);
    S.smart!.remind = true;
    expect(localReminders(S, now).find((r) => r.body.includes('treino'))?.daily).toBe('17:45');
  });
});
