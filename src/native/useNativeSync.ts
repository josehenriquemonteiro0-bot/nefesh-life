/**
 * Ligações nativas da app do iPhone, chamadas uma vez a partir da App:
 * - Apple Health: traz passos, sono e exercício ao abrir e ao voltar à app;
 * - lembretes: mantém agendadas no telemóvel as notificações da Spirulina, medicação, assistente, ciclo e jejum.
 */
import { useEffect } from 'react';
import { applyHealthDays } from '../domain/healthSync';
import { localReminders } from '../domain/localReminders';
import { isNative } from '../domain/platform';
import type { AppState } from '../domain/types';
import { readNativeHealth } from './health';
import { syncNativeReminders } from './notify';

export function useNativeSync(S: AppState, update: (fn: (d: AppState) => void) => void) {
  const native = isNative();
  const healthOn = native && !!S.health2?.native;

  useEffect(() => {
    if (!healthOn) return;
    let busy = false;
    const run = async () => {
      if (busy) return;
      busy = true;
      try {
        const days = await readNativeHealth();
        if (!Object.keys(days).length) return;
        update((d) => {
          const changed = applyHealthDays(d, days, 'device');
          const old = d.health2?.lastAt ? Date.parse(d.health2.lastAt) : 0;
          if (d.health2 && (changed || Date.now() - old > 3600e3)) d.health2.lastAt = new Date().toISOString();
        });
      } catch {
        /* sem autorização ou sem dados */
      } finally {
        busy = false;
      }
    };
    run();
    const onVis = () => !document.hidden && run();
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [healthOn]); // eslint-disable-line react-hooks/exhaustive-deps

  const items = native && S.notifications && !S.sample ? localReminders(S) : [];
  const key = native ? JSON.stringify(items) : '';
  useEffect(() => {
    if (native) syncNativeReminders(items);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
}
