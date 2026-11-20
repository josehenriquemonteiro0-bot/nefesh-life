import { describe, expect, it } from 'vitest';
import { FEATURES, canAccess, dailyQuota, isPremium, premiumOf, type Feature } from './features';

describe('planos e feature flags', () => {
  const free = {};
  const sub = { premium: { source: 'subscription' as const, until: '2027-12-31' } };
  const expired = { premium: { source: 'nefesh_member' as const, until: '2026-01-01' } };

  it('na fase de teste está tudo aberto', () => {
    for (const k of Object.keys(FEATURES) as Feature[]) expect(canAccess(free, k, true)).toBe(true);
  });

  it('no lançamento, premium exige Premium ativo; grátis fica sempre aberto', () => {
    expect(canAccess(free, 'checkin', false)).toBe(true);
    expect(canAccess(free, 'fotoPrato', false)).toBe(false);
    expect(canAccess(sub, 'fotoPrato', false)).toBe(true);
    expect(canAccess(expired, 'fotoPrato', false)).toBe(false);
  });

  it('o AI Coach tem 5 mensagens grátis por dia', () => {
    expect(dailyQuota(free, 'coach', false)).toBe(5);
    expect(dailyQuota(sub, 'coach', false)).toBe(Infinity);
    expect(dailyQuota(free, 'voz', false)).toBe(0);
  });

  it('origem do Premium e compatibilidade com o formato antigo', () => {
    expect(premiumOf({ premium: true })).toEqual({ source: 'test' });
    expect(isPremium({ premium: false })).toBe(false);
    expect(premiumOf(sub, '2027-06-01')?.source).toBe('subscription');
  });

  it('a tabela segue a especificação v2', () => {
    const premium = (Object.keys(FEATURES) as Feature[]).filter((k) => FEATURES[k].tier === 'premium');
    expect(premium).toEqual(expect.arrayContaining(['coach', 'voz', 'fotoPrato', 'treinoCompleto', 'sonoTendencias', 'relatorioCompleto', 'planosAdaptativos', 'timeline', 'descontoConsultas']));
    for (const k of ['perfil', 'planoSpirulina', 'checkin', 'agua', 'comunidade', 'ranking', 'profissionais'] as Feature[]) expect(FEATURES[k].tier).toBe('free');
  });
});
