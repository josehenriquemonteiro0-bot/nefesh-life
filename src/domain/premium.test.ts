import { describe, expect, it } from 'vitest';
import { PLANS, annualDeal, money, premiumFromStore } from './premium';

const NOW = Date.parse('2026-11-24T12:00:00Z');
describe('NEFESH Premium', () => {
  it('o anual sai a menos de metade do mensal (Brasil) e com 42% de poupança (euro)', () => {
    expect(annualDeal(39.9, 249.9)).toEqual({ perMonth: 20.82, saving: 48 });
    expect(annualDeal(9.99, 69.99)).toEqual({ perMonth: 5.83, saving: 42 });
    expect(money(249.9, 'BRL').replace(/\s/g, ' ')).toBe('R$ 249,90');
    expect(money(69.99, 'EUR').replace(/\s/g, ' ')).toBe('69,99 €');
  });

  it('ativa só com assinaturas confirmadas, do produto certo e dentro do prazo', () => {
    const t = { jws: 'x', verified: true, productId: PLANS.anual.id, expires: Date.parse('2027-11-24T12:00:00Z') };
    expect(premiumFromStore([t], NOW)).toEqual({ source: 'subscription', until: '2027-11-24' });
    expect(premiumFromStore([{ ...t, verified: false }], NOW)).toBeNull();
    expect(premiumFromStore([{ ...t, revoked: true }], NOW)).toBeNull();
    expect(premiumFromStore([{ ...t, expires: NOW - 1 }], NOW)).toBeNull();
    expect(premiumFromStore([{ ...t, productId: 'outra.app' }], NOW)).toBeNull();
    expect(premiumFromStore([], NOW)).toBeNull();
  });
});
