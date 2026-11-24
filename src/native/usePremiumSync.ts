/**
 * Mantém o Premium da pessoa em dia: no iPhone, lê as assinaturas ativas da App Store ao abrir,
 * ao voltar à app e quando a Apple avisa (renovação, reembolso); com conta, confirma no servidor,
 * que também passa o Premium para a versão web. Não mexe em Premium de outras origens (testes, clientes NEFESH).
 */
import { useEffect } from 'react';
import { getAuth, syncPremium, useAuth } from '../domain/account';
import { premiumFromStore, type StoreTransaction } from '../domain/premium';
import type { AppState } from '../domain/types';
import { onStoreTransaction, storeAvailable, storeEntitlements } from './store';

export function usePremiumSync(update: (fn: (d: AppState) => void) => void) {
  const auth = useAuth();
  useEffect(() => {
    const native = storeAvailable();
    if (!native && !auth) return;
    let busy = false;
    const run = async (extra: StoreTransaction[] = []) => {
      if (busy) return;
      busy = true;
      try {
        const list = native ? [...(await storeEntitlements().catch(() => [])), ...extra] : [];
        const local = premiumFromStore(list);
        const server = getAuth() ? await syncPremium(list.map((t) => t.jws)).catch(() => undefined) : undefined;
        // sem resposta do servidor nem da loja: não mexe
        if (server === undefined && !native) return;
        const p = local ?? server ?? null;
        update((d) => {
          const cur = d.premium && d.premium !== true ? d.premium : null;
          if (d.premium === true || (cur && cur.source !== 'subscription')) return;
          if (p) {
            if (cur?.until !== p.until) d.premium = p;
          } else if (cur) delete d.premium;
        });
      } finally {
        busy = false;
      }
    };
    run();
    const onVis = () => !document.hidden && run();
    document.addEventListener('visibilitychange', onVis);
    const sub = onStoreTransaction((t) => run([t]));
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      sub?.then((h) => h.remove());
    };
  }, [auth?.token]); // eslint-disable-line react-hooks/exhaustive-deps
}
