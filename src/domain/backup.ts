import { APP_VERSION } from './content';
import type { AppState } from './types';

/** Cópia de segurança: um ficheiro JSON que a pessoa guarda onde quiser. */
export function makeBackup(S: AppState, now = new Date()) {
  return JSON.stringify({ app: 'nefesh-life', version: APP_VERSION, exportedAt: now.toISOString(), state: S }, null, 2);
}

export function backupFileName(now = new Date()) {
  const d = now.toISOString().slice(0, 10);
  return `nefesh-life-copia-${d}.json`;
}

/** Lê uma cópia de segurança. Lança um erro com uma mensagem legível se o ficheiro não servir. */
export function readBackup(text: string): AppState {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('O ficheiro não é uma cópia da NEFESH Life.');
  }
  const d = data as { app?: string; state?: AppState };
  const S = d && d.app === 'nefesh-life' ? d.state : null;
  if (!S || typeof S !== 'object' || typeof S.logs !== 'object' || !Array.isArray(S.evals)) {
    throw new Error('O ficheiro não é uma cópia da NEFESH Life.');
  }
  return { ...S, sample: false };
}
