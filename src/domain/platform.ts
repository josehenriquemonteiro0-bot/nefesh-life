/**
 * Onde a app está a correr: no navegador (versão web) ou dentro da app nativa (Capacitor, iPhone).
 */
import { currentLocale } from '../i18n/locale';
import { Capacitor } from '@capacitor/core';

export const isNative = () => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

/**
 * Endereço público da app, para os links que se partilham (convites, Chave do dia, Pro).
 * Na app nativa a página interna é capacitor://localhost, que não serve a ninguém fora do telemóvel.
 */
export function appUrl(): string {
  if (isNative()) return import.meta.env.VITE_PUBLIC_URL || 'https://josehenriquemonteiro0-bot.github.io/nefesh-life/';
  return `${location.origin}${import.meta.env.BASE_URL}`;
}

/** Política de privacidade e termos (páginas públicas, com versão do Brasil e de Portugal). */
export const legalUrl = (page: 'privacidade' | 'termos') => `${appUrl()}legal/${page}.html?v=${currentLocale() === 'pt-PT' ? 'pt' : 'br'}`;
