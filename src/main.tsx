import './testDate';
import { PHOTO_API } from './domain/photo';
import { isNative } from './domain/platform';
import { startLocale } from './i18n/dom';
import { currentLocale } from './i18n/locale';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { StoreProvider } from './state/store';
// letras incluídas na app (não carregadas do Google: o IP das pessoas não vai para terceiros)
import '@fontsource/sora/500.css';
import '@fontsource/sora/600.css';
import '@fontsource/sora/700.css';
import '@fontsource/manrope/400.css';
import '@fontsource/manrope/500.css';
import '@fontsource/manrope/600.css';
import '@fontsource/manrope/700.css';
import './styles.css';

// idioma: aplica o vocabulário do país escolhido a todo o texto da app
startLocale(currentLocale());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </StrictMode>,
);

// na app nativa não há service worker (as notificações e o funcionamento sem rede são nativos)
if ('serviceWorker' in navigator && import.meta.env.PROD && !isNative()) {
  window.addEventListener('load', () => {
    // o service worker sabe a que servidor pedir as mensagens das notificações (a cópia de teste tem o seu)
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js?api=${encodeURIComponent(PHOTO_API)}`).catch(() => {});
  });
}
