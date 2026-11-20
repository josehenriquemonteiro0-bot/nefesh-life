import { useEffect, useRef } from 'react';
import { useAuth } from '../domain/account';
import { weekPayload } from '../domain/points';
import { refresh, syncWeek } from '../domain/social';
import type { AppState } from '../domain/types';
import { useStore } from './store';

let lastSent = '';

/** Envia os pontos da semana à comunidade (só quando mudam), 30 s depois das alterações e ao sair da app. */
export async function pushPoints(S: AppState, force = false) {
  if (!S.community || S.sample) return;
  const payload = weekPayload(S);
  const key = JSON.stringify(payload);
  if (!force && key === lastSent) return;
  try {
    await syncWeek(payload);
    lastSent = key;
    refresh();
  } catch {
    /* sem rede: tenta mais tarde */
  }
}

export function useSocialSync() {
  const { S } = useStore();
  const auth = useAuth();
  const ref = useRef(S);
  ref.current = S;
  const active = !!auth && !!S.community;

  useEffect(() => {
    if (!active) return;
    const t = window.setTimeout(() => pushPoints(ref.current), 30_000);
    return () => window.clearTimeout(t);
  }, [S.updatedAt, active]);

  useEffect(() => {
    if (!active) return;
    pushPoints(ref.current, true);
    const onVis = () => document.hidden && pushPoints(ref.current);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [active]);
}
