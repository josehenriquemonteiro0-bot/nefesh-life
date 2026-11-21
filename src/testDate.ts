/**
 * Modo de teste (só na cópia de teste): avança a data da app N dias, para ver o 3.º ou o
 * 7.º dia sem esperar. Guardado neste telemóvel; "Voltar a hoje" no Perfil desliga.
 * Tem de ser importado antes de tudo o resto (main.tsx).
 */
export const TEST_DAYS_KEY = 'nefesh-life-dias-teste';
export const isTestCopy = () => typeof location !== 'undefined' && /nefesh-life-v2|localhost|127\.0\.0\.1/.test(location.hostname);

export function testDays(): number {
  try {
    return isTestCopy() ? Number(localStorage.getItem(TEST_DAYS_KEY) || 0) || 0 : 0;
  } catch {
    return 0;
  }
}

const off = testDays();
if (off) {
  const Real = Date;
  const shift = off * 86400000;
  class ShiftedDate extends Real {
    constructor(...a: unknown[]) {
      if (a.length === 0) super(Real.now() + shift);
      else super(...(a as [string]));
    }
    static now() {
      return Real.now() + shift;
    }
  }
  (globalThis as unknown as { Date: DateConstructor }).Date = ShiftedDate as unknown as DateConstructor;
}
