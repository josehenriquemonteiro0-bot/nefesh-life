/**
 * Avisos automáticos de falhas: quando algo corre mal na app, envia ao servidor um relatório anónimo
 * (mensagem do erro, percurso no código, ecrã, versão e plataforma). Sem nome, e-mail, conta nem dados de saúde.
 * No máximo 5 relatórios por sessão, e cada falha só uma vez.
 */
import { PHOTO_API, deviceId } from './photo';
import { isNative } from './platform';

declare const __APP_VERSION__: string;
const VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';

const sent = new Set<string>();
let where = '';
/** Ecrã atual, para o relatório saber onde aconteceu. */
export const setCrashScreen = (s: string) => { where = s; };

export function reportCrash(err: unknown, kind: 'erro' | 'promessa' | 'ecra' = 'erro') {
  try {
    const e = err instanceof Error ? err : new Error(typeof err === 'string' ? err : JSON.stringify(err ?? 'erro'));
    const message = `${e.name}: ${e.message}`.slice(0, 300);
    // erros sem interesse: rede em baixo, pedidos cancelados, extensões do navegador
    if (/AbortError|Load failed|Failed to fetch|NetworkError|ResizeObserver loop|chrome-extension|moz-extension/i.test(message + (e.stack ?? ''))) return;
    const key = message + (e.stack ?? '').split('\n')[1];
    if (sent.has(key) || sent.size >= 5 || !PHOTO_API) return;
    sent.add(key);
    const body = JSON.stringify({ message, stack: (e.stack ?? '').slice(0, 1500), where, version: VERSION, platform: isNative() ? 'ios' : 'web', kind, device: deviceId() });
    fetch(`${PHOTO_API.replace(/\/$/, '')}/falha`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => undefined);
  } catch {
    /* o aviso nunca pode causar outra falha */
  }
}

/** Erros soltos e promessas rejeitadas sem tratamento. */
export function installCrashReporting() {
  if (typeof window === 'undefined') return;
  window.addEventListener('error', (ev) => reportCrash(ev.error ?? ev.message));
  window.addEventListener('unhandledrejection', (ev) => reportCrash(ev.reason, 'promessa'));
}
