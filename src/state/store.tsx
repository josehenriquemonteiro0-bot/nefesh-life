import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { STORAGE_KEY } from '../domain/content';
import { todayKey } from '../domain/dates';
import { sampleState } from '../domain/sample';
import type { AppState, DayLog } from '../domain/types';

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
  replace: (next: AppState) => void;
  /** Registo de hoje, apenas para leitura. */
  todayLog: DayLog;
  /** Altera o registo de hoje. */
  updateToday: (fn: (l: DayLog) => void) => void;
  toast: (msg: string) => void;
  toastMsg: string | null;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [S, setS] = useState<AppState>(() => load() || sampleState());
  const [toastMsg, setToast] = useState<string | null>(null);
  const timer = useRef<number>();

  useEffect(() => persist(S), [S]);

  const update = useCallback((fn: (d: AppState) => void) => {
    setS((prev) => {
      const next = structuredClone(prev);
      fn(next);
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
    replace: setS,
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
