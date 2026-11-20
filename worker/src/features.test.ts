import { describe, expect, it } from 'vitest';
import { canAccess, dailyQuota, isTestMode } from './features';
import { cleanPing } from './stats';

describe('feature flags no servidor', () => {
  it('TEST_MODE abre tudo; sem ele, premium exige Premium', () => {
    expect(isTestMode({})).toBe(true);
    expect(canAccess({ TEST_MODE: 'true' }, 'voz', false)).toBe(true);
    expect(canAccess({ TEST_MODE: 'false' }, 'voz', false)).toBe(false);
    expect(canAccess({ TEST_MODE: 'false' }, 'voz', true)).toBe(true);
    expect(canAccess({ TEST_MODE: 'false' }, 'checkin', false)).toBe(true);
    expect(canAccess({ TEST_MODE: 'true' }, 'inexistente', true)).toBe(false);
    expect(dailyQuota({ TEST_MODE: 'false' }, 'coach', false)).toBe(5);
  });
  it('as estatísticas só aceitam usos de funcionalidades Premium conhecidas', () => {
    const p = cleanPing({ premium: true, premiumUses: { fotoPrato: 3, checkin: 9, hack: 5, lerPlano: 99999 } });
    expect(p.premium).toBe(true);
    expect(p.premiumUses).toEqual({ fotoPrato: 3, lerPlano: 999 });
  });
});

describe('origens permitidas (CORS)', async () => {
  const { originAllowed } = await import('./index');
  it('aceita a origem exata, listas e curingas', () => {
    expect(originAllowed('https://josehenriquemonteiro0-bot.github.io', 'https://josehenriquemonteiro0-bot.github.io')).toBe(true);
    expect(originAllowed('https://josehenriquemonteiro0-bot.github.io', 'https://outro.site')).toBe(false);
    expect(originAllowed('https://*nefesh-life-v2*.pages.dev', 'https://nefesh-life-v2.pages.dev')).toBe(true);
    expect(originAllowed('https://*nefesh-life-v2*.pages.dev', 'https://abc123.nefesh-life-v2-9x.pages.dev')).toBe(true);
    expect(originAllowed('https://*nefesh-life-v2*.pages.dev', 'https://nefesh-life-v2.pages.dev.mau.com')).toBe(false);
    expect(originAllowed('', 'https://qualquer.coisa')).toBe(true);
  });
});
