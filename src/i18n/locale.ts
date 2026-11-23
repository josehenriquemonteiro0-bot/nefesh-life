/**
 * Idioma da app. Hoje: português de Portugal (texto original) e português do Brasil.
 * Para juntar outro idioma: acrescentar a LOCALES e um conversor/tradução em convertText.
 */
import { toBR } from './ptBR';

export type Locale = 'pt-PT' | 'pt-BR';

export const LOCALES: { id: Locale; flag: string; name: string; short: string }[] = [
  { id: 'pt-BR', flag: '🇧🇷', name: 'Português (Brasil)', short: 'Brasil' },
  { id: 'pt-PT', flag: '🇵🇹', name: 'Português (Portugal)', short: 'Portugal' },
];

const KEY = 'nefesh-life-idioma';

/** Idioma sugerido pelo telemóvel: pt-PT só quando o aparelho está em português de Portugal. */
export function guessLocale(nav = typeof navigator !== 'undefined' ? navigator.language : ''): Locale {
  return /^pt-PT/i.test(nav || '') ? 'pt-PT' : 'pt-BR';
}

/** Idioma escolhido (ou null se a pessoa ainda não escolheu). */
export function storedLocale(): Locale | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'pt-PT' || v === 'pt-BR' ? v : null;
  } catch {
    return null;
  }
}

export const currentLocale = (): Locale => storedLocale() ?? guessLocale();

/** Guarda a escolha. Recarrega a app para todos os textos mudarem de uma vez. */
export function setLocale(l: Locale, reload = true) {
  try {
    localStorage.setItem(KEY, l);
  } catch {
    /* sem armazenamento */
  }
  if (reload && typeof location !== 'undefined') location.reload();
}

/** Texto no idioma escolhido (o texto da app está escrito em português de Portugal). */
export function convertText(t: string, l: Locale = currentLocale()) {
  return l === 'pt-BR' ? toBR(t) : t;
}
