/**
 * Registos de acesso à aplicação (Marco Civil da Internet, Lei 12.965/2014, art. 15):
 * quem tem conta e usa a app → endereço IP e data/hora (UTC), guardados 6 meses em ambiente
 * controlado e apagados depois automaticamente. Só se entregam com ordem judicial.
 * Para não guardar um registo por pedido, fica um por pessoa, IP e hora (com o primeiro instante).
 * Não guarda o conteúdo dos pedidos, nem o que a pessoa fez.
 */
import type { DB } from './social';

export const KEEP_MONTHS = 6;

export async function logAccess(db: DB, uid: string | null | undefined, ip: string | null, now = new Date()) {
  if (!uid || !ip) return;
  const at = now.toISOString();
  await db.prepare('INSERT OR IGNORE INTO access_logs (uid, ip, hour, at) VALUES (?, ?, ?, ?)').bind(uid, ip.slice(0, 64), at.slice(0, 13), at).run();
}

/** Data limite: o que for anterior a isto já passou dos 6 meses. */
export function cutoff(now = new Date()) {
  const d = new Date(now);
  d.setUTCMonth(d.getUTCMonth() - KEEP_MONTHS);
  return d.toISOString().slice(0, 13);
}

export async function purgeAccess(db: DB, now = new Date()) {
  await db.prepare('DELETE FROM access_logs WHERE hour < ?').bind(cutoff(now)).run();
}

/** Para responder a uma ordem judicial (página da equipa): acessos de uma pessoa num intervalo. */
export async function accessOf(db: DB, uid: string, from: string, to: string) {
  const { results } = await db
    .prepare('SELECT ip, at FROM access_logs WHERE uid = ? AND hour >= ? AND hour <= ? ORDER BY at')
    .bind(uid, from.slice(0, 13), to.slice(0, 13))
    .all<{ ip: string; at: string }>();
  return results;
}

/** O token da sessão vem no corpo JSON dos pedidos (ou na resposta de entrar/criar conta). */
export async function tokenOf(req: Request | null, res: Response | null): Promise<string | null> {
  const pick = async (r: Request | Response | null) => {
    if (!r || !(r.headers.get('Content-Type') ?? '').includes('application/json')) return null;
    try {
      const t = ((await r.json()) as { token?: unknown })?.token;
      return typeof t === 'string' && /^[0-9a-f]{64}$/.test(t) ? t : null;
    } catch {
      return null;
    }
  };
  return (await pick(req)) ?? (await pick(res));
}
