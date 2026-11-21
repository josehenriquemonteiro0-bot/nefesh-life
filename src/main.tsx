import './testDate';
import { PHOTO_API } from './domain/photo';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { StoreProvider } from './state/store';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    // o service worker sabe a que servidor pedir as mensagens das notificações (a cópia de teste tem o seu)
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js?api=${encodeURIComponent(PHOTO_API)}`).catch(() => {});
  });
}
