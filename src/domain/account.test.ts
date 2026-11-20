import { describe, expect, it } from 'vitest';
import { mergeDecision } from './account';
import { blankState } from './sample';

const withPlan = (updatedAt?: string) => ({ ...blankState(), ans: { name: 'Ana' }, updatedAt });

describe('sincronização com a conta', () => {
  it('telemóvel novo traz os dados da conta', () => {
    expect(mergeDecision(blankState(), '2026-11-20T10:00:00Z')).toBe('usar-nuvem');
  });
  it('conta vazia recebe os dados do telemóvel', () => {
    expect(mergeDecision(withPlan('2026-11-20T10:00:00Z'), null)).toBe('enviar');
    expect(mergeDecision(blankState(), null)).toBe('nada');
  });
  it('só um dos lados mudou desde a última sincronização', () => {
    expect(mergeDecision(withPlan('2026-11-20T12:00:00Z'), '2026-11-20T10:00:00Z', '2026-11-20T10:00:00Z')).toBe('enviar');
    expect(mergeDecision(withPlan('2026-11-20T09:00:00Z'), '2026-11-20T12:00:00Z', '2026-11-20T10:00:00Z')).toBe('usar-nuvem');
    expect(mergeDecision(withPlan('2026-11-20T10:00:00Z'), '2026-11-20T10:00:00Z', '2026-11-20T10:00:00Z')).toBe('nada');
  });
  it('os dois lados mudaram: pergunta', () => {
    expect(mergeDecision(withPlan('2026-11-20T12:00:00Z'), '2026-11-20T11:00:00Z', '2026-11-20T10:00:00Z')).toBe('perguntar');
    // entrar num telemóvel que já tinha outro plano
    expect(mergeDecision(withPlan('2026-11-20T12:00:00Z'), '2026-11-20T11:00:00Z', null)).toBe('perguntar');
  });
});
