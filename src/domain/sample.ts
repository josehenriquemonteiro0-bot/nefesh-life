import { CAPS_PER_BOTTLE } from './content';
import { keyDaysAgo, todayKey } from './dates';
import { scores } from './plan';
import type { Answers, AppState, DayLog } from './types';

/** Estado de demonstração: 30 dias de ritual de uma utilizadora fictícia. */
export function sampleState(now = new Date()): AppState {
  const logs: Record<string, DayLog> = {};
  const w = (x: number) => Math.max(1, Math.min(5, Math.round(x)));
  for (let i = 29; i >= 1; i--) {
    const t = (29 - i) / 28;
    const miss = i === 17 || i === 9;
    logs[keyDaysAgo(i, now)] = {
      doses: [!miss && i !== 22],
      water: Math.max(3, Math.round(5 + t * 5.5 + Math.sin(i * 1.9) * 1.2)),
      hab: { sono: i % 3 !== 0, passos: i % 2 === 0, resp: i % 4 === 0 },
      e: w(2.7 + t * 1.6 + Math.sin(i * 1.7) * 0.6),
      s: w(2.6 + t * 1.5 + Math.cos(i * 1.3) * 0.6),
      d: w(2.8 + t * 1.5 + Math.sin(i * 2.1) * 0.5),
      t: i % 2 === 0 ? 2 : 0,
    };
  }
  logs[todayKey(now)] = { doses: [false], water: 3, hab: { sono: true, passos: false, resp: false } };
  const ans: Answers = {
    name: 'Ana', goal: 'energia', sexo: 'f', idade: '30-44', peso: 68, ativ: '1-2', sonoh: '7-8', sonoq: 4,
    energia: 3, stress: 3, agua: '7-9', cafe: '1-2', veg: '2-3', proc: 'as-vezes', dieta: 'omni', prior: 'as-vezes', safe: ['nenhuma'],
  };
  return {
    sample: true,
    health: true,
    ans,
    planStart: keyDaysAgo(30, now),
    reminder: '08:30',
    stockStart: keyDaysAgo(30, now),
    stockCaps: CAPS_PER_BOTTLE * 2,
    format: 'caps',
    logs,
    bottles: [
      { at: keyDaysAgo(30, now), product: 'caps', code: 'GCL_26_1372', url: null },
      { at: keyDaysAgo(12, now), product: 'caps', code: 'GCL_26_1372', url: null },
    ],
    evals: [
      { date: keyDaysAgo(30, now), sc: { energia: 35, sono: 55, nutricao: 57, hidratacao: 40, movimento: 50 } },
      { date: todayKey(now), sc: scores(ans) },
    ],
  };
}

export function blankState(now = new Date()): AppState {
  return { sample: false, intro: true, ans: null, planStart: null, reminder: '08:30', stockStart: todayKey(now), stockCaps: CAPS_PER_BOTTLE, logs: {}, evals: [] };
}
