import { useCallback, useEffect, useRef, useState } from 'react';
import { getAuth, healthDays, mergeDecision, patchAuth, pull, push, useAuth } from '../domain/account';
import { applyHealthDays, lastHealthAt } from '../domain/healthSync';
import type { AppState } from '../domain/types';
import { useStore } from './store';

/** Espera depois de uma alteração antes de enviar (junta várias alterações num só envio). */
const DEBOUNCE_MS = 60_000;

/**
 * Sincronização com a conta:
 * - ao entrar e ao voltar à app, compara com a nuvem e traz ou envia o que for mais recente;
 * - depois de cada alteração, envia ao fim de 1 minuto, ou logo que a app vai para segundo plano.
 */
export function useCloudSync() {
  const { S, replace, update, toast } = useStore();
  const auth = useAuth();
  const ref = useRef<AppState>(S);
  ref.current = S;
  const [conflict, setConflict] = useState<{ data: AppState; cloudAt: string } | null>(null);
  const busy = useRef(false);

  const reconcile = useCallback(async () => {
    const a = getAuth();
    if (!a || busy.current) return;
    busy.current = true;
    try {
      const cloud = await pull();
      const local = ref.current;
      const d = mergeDecision(local, cloud.updatedAt, a.cloudAt);
      if (d === 'usar-nuvem' && cloud.data) {
        replace({ ...cloud.data, sample: false, intro: true }, { keepStamp: true });
        patchAuth({ cloudAt: cloud.updatedAt, syncedAt: new Date().toISOString() });
        if (!local.ans) toast('Dados da sua conta recuperados.');
      } else if (d === 'enviar') {
        await push(local);
      } else if (d === 'perguntar' && cloud.data && cloud.updatedAt) {
        setConflict({ data: cloud.data, cloudAt: cloud.updatedAt });
      } else {
        patchAuth({ cloudAt: cloud.updatedAt, syncedAt: new Date().toISOString() });
      }
      // dados do app Saúde enviados pelo atalho
      if (ref.current.health2) {
        const days = await healthDays();
        const probe = structuredClone(ref.current);
        const lastAt = lastHealthAt(days);
        if (applyHealthDays(probe, days) || (lastAt && lastAt !== ref.current.health2.lastAt)) {
          update((dr) => {
            applyHealthDays(dr, days);
            if (dr.health2 && lastAt) dr.health2.lastAt = lastAt;
          });
        }
      }
    } catch {
      /* sem rede: tenta mais tarde */
    } finally {
      busy.current = false;
    }
  }, [replace, update, toast]);

  // ao entrar na conta e ao abrir a app
  useEffect(() => {
    if (auth?.token) reconcile();
  }, [auth?.token, reconcile]);

  // envio depois das alterações
  useEffect(() => {
    if (!auth || conflict || S.sample || !S.updatedAt || S.updatedAt === auth.cloudAt) return;
    const t = window.setTimeout(() => push(ref.current).catch(() => undefined), DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [S.updatedAt, auth, conflict, S.sample]);

  // segundo plano: envia já; ao voltar depois de 1 minuto: compara com a nuvem e traz dados do app Saúde
  useEffect(() => {
    let hiddenAt = 0;
    const onVis = () => {
      const a = getAuth();
      if (!a) return;
      if (document.hidden) {
        hiddenAt = Date.now();
        const cur = ref.current;
        if (!conflict && !cur.sample && cur.updatedAt && cur.updatedAt !== a.cloudAt) push(cur).catch(() => undefined);
      } else if (hiddenAt && Date.now() - hiddenAt > 60 * 1000) reconcile();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [reconcile, conflict]);

  const resolve = async (pick: 'nuvem' | 'local') => {
    const c = conflict;
    setConflict(null);
    if (!c) return;
    if (pick === 'nuvem') {
      replace({ ...c.data, sample: false, intro: true }, { keepStamp: true });
      patchAuth({ cloudAt: c.cloudAt, syncedAt: new Date().toISOString() });
      toast('Dados da conta carregados.');
    } else {
      await push(ref.current).catch((e) => toast((e as Error).message));
      toast('Dados deste telemóvel guardados na conta.');
    }
  };

  const syncNow = async () => {
    await push(ref.current);
  };

  return { conflict, resolve, syncNow, reconcile };
}
