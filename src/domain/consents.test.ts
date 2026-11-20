import { describe, expect, it } from 'vitest';
import { buildPing } from './analytics';
import { rdSummary } from './consents';
import { blankState } from './sample';
import { keyDaysAgo } from './dates';

const NOW = new Date('2026-11-20T12:00:00');
const person = () => {
  const S = { ...blankState(NOW), ans: { goal: 'foco' as const, peso: 70, name: 'Belinha' }, planStart: '2026-10-01' };
  for (let i = 0; i < 20; i++) S.logs[keyDaysAgo(i, NOW)] = { e: i < 7 ? 4 : 2, sleepH: i < 7 ? 7.5 : 6 };
  return S;
};

describe('consentimento de investigação', () => {
  it('sem autorização, nada de dados de investigação no resumo diário', () => {
    expect(rdSummary(person(), NOW)).toBeNull();
    expect(buildPing(person(), 'dev', NOW).rd).toBeNull();
  });
  it('com autorização: só médias arredondadas, sem nome nem datas', () => {
    const S = { ...person(), consents: { rd: { on: true, at: '2026-11-01T00:00:00Z' } } };
    const rd = rdSummary(S, NOW)!;
    expect(rd).toEqual({ goal: 'foco', eStart: 2, eNow: 4, sStart: 6, sNow: 7.5, idxStart: null, idxNow: null });
    expect(JSON.stringify(buildPing(S, 'dev', NOW).rd)).not.toMatch(/Belinha|2026/);
  });
});
