import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { STORAGE_KEY } from '../domain/content';
import { todayKey } from '../domain/dates';
import { blankState } from '../domain/sample';
import type { AppState, DayLog } from '../domain/types';
import { detectEvents, recordEvents } from '../domain/smart';

function load(): AppState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as AppState;
  } catch {
    /* armazenamento indisponível */
  }
  return null;
}

function persist(S: AppState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(S));
  } catch {
    /* armazenamento indisponível: a app continua a funcionar em memória */
  }
}

interface Store {
  S: AppState;
  /** Aplica uma alteração ao estado (sobre uma cópia) e guarda. */
  update: (fn: (draft: AppState) => void) => void;
  /** Substitui o estado. `keepStamp` mantém a data de alteração (dados vindos da nuvem). */
  replace: (next: AppState, opts?: { keepStamp?: boolean }) => void;
  /** Registo de hoje, apenas para leitura. */
  todayLog: DayLog;
  /** Altera o registo de hoje. */
  updateToday: (fn: (l: DayLog) => void) => void;
  toast: (msg: string) => void;
  toastMsg: string | null;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  // primeira utilização: começa vazia, com as boas-vindas. Estados antigos de demonstração são descartados.
  const [S, setS] = useState<AppState>(() => {
    const saved = load();
    // estados antigos sem data de alteração recebem uma, para a sincronização com a conta
    return saved && !saved.sample ? { ...saved, updatedAt: saved.updatedAt ?? new Date().toISOString() } : { ...blankState(), intro: false };
  });
  const [toastMsg, setToast] = useState<string | null>(null);
  const timer = useRef<number>();

  useEffect(() => persist(S), [S]);

  const update = useCallback((fn: (d: AppState) => void) => {
    setS((prev) => {
      const next = structuredClone(prev);
      fn(next);
      // Início inteligente: o que acabou de ser registado hoje fica com a hora (para aprender as rotinas)
      if (!next.sample) {
        const k = todayKey();
        try { recordEvents(next, detectEvents(prev.logs?.[k], next.logs?.[k])); } catch { /* nunca impede o registo */ }
      }
      next.updatedAt = new Date().toISOString();
      return next;
    });
  }, []);

  const updateToday = useCallback(
    (fn: (l: DayLog) => void) =>
      update((d) => {
        const k = todayKey();
        d.logs[k] = d.logs[k] || {};
        fn(d.logs[k]);
      }),
    [update],
  );

  const toast = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), 2400);
  }, []);

  const value: Store = {
    S,
    update,
    replace: (next, opts) => setS(opts?.keepStamp ? next : { ...next, updatedAt: new Date().toISOString() }),
    todayLog: S.logs[todayKey()] || {},
    updateToday,
    toast,
    toastMsg,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore fora de StoreProvider');
  return s;
}
