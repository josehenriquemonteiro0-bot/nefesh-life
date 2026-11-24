/**
 * Premium pela App Store (StoreKit 2): verificação das transações assinadas (JWS) que o iPhone envia.
 *
 * Como a Apple recomenda para a verificação sem rede: a cadeia x5c do cabeçalho tem de ser
 * folha → intermédio → raiz, com a raiz igual ao certificado "Apple Root CA - G3" (comparado byte a byte
 * pelo SHA-256), cada certificado assinado pelo seguinte, a folha com a extensão 1.2.840.113635.100.6.11.1
 * e o intermédio com 1.2.840.113635.100.6.2.1, todos válidos na data em que a Apple assinou (signedDate).
 * Depois: a app certa (bundleId), um produto NEFESH Premium, não revogada e ainda dentro do prazo.
 *
 * Sem bibliotecas: um leitor DER mínimo e a WebCrypto do Worker.
 */
import type { DB } from './social';

export const BUNDLE_ID = 'com.nefesh.life';
export const PRODUCTS = { 'com.nefesh.life.premium.mensal': 'mensal', 'com.nefesh.life.premium.anual': 'anual' } as const;
/** SHA-256 do certificado DER "Apple Root CA - G3" (https://www.apple.com/certificateauthority/). */
export const APPLE_ROOT_G3_SHA256 = '63343abfb89a6a03ebb57e9b3f5fa7be7c4f5c756f3017b3a8c488c3653e9179';

const OID_LEAF = [0x2a, 0x86, 0x48, 0x86, 0xf7, 0x63, 0x64, 0x06, 0x0b, 0x01];
const OID_INTERMEDIATE = [0x2a, 0x86, 0x48, 0x86, 0xf7, 0x63, 0x64, 0x06, 0x02, 0x01];
const OID_P256 = '2a8648ce3d030107';
const OID_P384 = '2b81040022';
const OID_SHA256 = '2a8648ce3d040302';
const OID_SHA384 = '2a8648ce3d040303';

// ---------- DER ----------
interface Node { tag: number; start: number; hdr: number; len: number }
function read(b: Uint8Array, at: number): Node {
  const tag = b[at];
  let len = b[at + 1];
  let hdr = 2;
  if (len & 0x80) {
    const n = len & 0x7f;
    len = 0;
    for (let i = 0; i < n; i++) len = (len << 8) | b[at + 2 + i];
    hdr += n;
  }
  if (at + hdr + len > b.length) throw new Error('DER inválido');
  return { tag, start: at, hdr, len };
}
const body = (b: Uint8Array, n: Node) => b.subarray(n.start + n.hdr, n.start + n.hdr + n.len);
const whole = (b: Uint8Array, n: Node) => b.subarray(n.start, n.start + n.hdr + n.len);
function children(b: Uint8Array, n: Node): Node[] {
  const out: Node[] = [];
  let at = n.start + n.hdr;
  const end = at + n.len;
  while (at < end) {
    const c = read(b, at);
    out.push(c);
    at = c.start + c.hdr + c.len;
  }
  return out;
}
const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
const contains = (hay: Uint8Array, needle: number[]) => {
  outer: for (let i = 0; i + needle.length <= hay.length; i++) {
    for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer;
    return true;
  }
  return false;
};
function derTime(b: Uint8Array, n: Node): number {
  const s = new TextDecoder().decode(body(b, n));
  const full = n.tag === 0x17 ? (Number(s.slice(0, 2)) >= 50 ? '19' : '20') + s : s; // UTCTime → 4 dígitos
  return Date.UTC(+full.slice(0, 4), +full.slice(4, 6) - 1, +full.slice(6, 8), +full.slice(8, 10), +full.slice(10, 12), +full.slice(12, 14));
}

export interface Cert {
  der: Uint8Array;
  tbs: Uint8Array;
  sigAlg: string;
  sig: Uint8Array;
  spki: Uint8Array;
  curve: string;
  notBefore: number;
  notAfter: number;
}
export function parseCert(der: Uint8Array): Cert {
  const root = read(der, 0);
  const [tbsN, algN, sigN] = children(der, root);
  const tbsParts = children(der, tbsN);
  const i = tbsParts[0].tag === 0xa0 ? 1 : 0; // [0] versão é opcional
  const validity = children(der, tbsParts[i + 3]);
  const spkiN = tbsParts[i + 5];
  const spkiAlg = children(der, children(der, spkiN)[0]);
  const sigBits = body(der, sigN);
  return {
    der,
    tbs: whole(der, tbsN),
    sigAlg: hex(body(der, children(der, algN)[0])),
    sig: sigBits.subarray(1), // primeiro byte: bits por usar
    spki: whole(der, spkiN),
    curve: spkiAlg[1] ? hex(body(der, spkiAlg[1])) : '',
    notBefore: derTime(der, validity[0]),
    notAfter: derTime(der, validity[1]),
  };
}

/** Assinatura ECDSA em DER (SEQUENCE de dois INTEGER) → r||s, como a WebCrypto pede. */
export function derSigToRaw(sig: Uint8Array, size: number): Uint8Array {
  const seq = read(sig, 0);
  const [r, s] = children(sig, seq).map((n) => {
    let v = body(sig, n);
    while (v.length > size && v[0] === 0) v = v.subarray(1);
    const out = new Uint8Array(size);
    out.set(v, size - v.length);
    return out;
  });
  const raw = new Uint8Array(size * 2);
  raw.set(r, 0);
  raw.set(s, size);
  return raw;
}

const curveName = (oid: string) => (oid === OID_P256 ? 'P-256' : oid === OID_P384 ? 'P-384' : '');
const importKey = (c: Cert) => {
  const namedCurve = curveName(c.curve);
  if (!namedCurve) throw new Error('curva não suportada');
  return crypto.subtle.importKey('spki', c.spki, { name: 'ECDSA', namedCurve }, false, ['verify']);
};
/** O certificado `c` foi assinado pela chave de `issuer`? */
async function signedBy(c: Cert, issuer: Cert) {
  const hash = c.sigAlg === OID_SHA256 ? 'SHA-256' : c.sigAlg === OID_SHA384 ? 'SHA-384' : '';
  if (!hash) return false;
  const size = curveName(issuer.curve) === 'P-384' ? 48 : 32;
  return crypto.subtle.verify({ name: 'ECDSA', hash }, await importKey(issuer), derSigToRaw(c.sig, size), c.tbs);
}

// ---------- JWS ----------
const b64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), (c) => c.charCodeAt(0));
const sha256hex = async (b: Uint8Array) => hex(new Uint8Array(await crypto.subtle.digest('SHA-256', b)));

export interface AppleTransaction {
  bundleId: string;
  productId: string;
  transactionId: string;
  originalTransactionId: string;
  expiresDate?: number;
  revocationDate?: number;
  signedDate: number;
  environment: string;
  type?: string;
}

/** Verifica a JWS de uma transação; devolve o conteúdo ou um motivo de recusa. */
export async function verifyTransaction(jws: string, rootSha256 = APPLE_ROOT_G3_SHA256): Promise<{ ok: true; tx: AppleTransaction } | { ok: false; why: string }> {
  try {
    const [h, p, s] = String(jws).split('.');
    if (!h || !p || !s) return { ok: false, why: 'formato' };
    const header = JSON.parse(new TextDecoder().decode(b64(h))) as { alg?: string; x5c?: string[] };
    if (header.alg !== 'ES256' || !Array.isArray(header.x5c) || header.x5c.length !== 3) return { ok: false, why: 'cabeçalho' };
    const [leaf, inter, root] = header.x5c.map((c) => parseCert(b64(c)));
    if ((await sha256hex(root.der)) !== rootSha256) return { ok: false, why: 'raiz' };
    if (!contains(leaf.tbs, OID_LEAF) || !contains(inter.tbs, OID_INTERMEDIATE)) return { ok: false, why: 'extensões' };
    if (!(await signedBy(inter, root)) || !(await signedBy(leaf, inter))) return { ok: false, why: 'cadeia' };
    const okSig = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, await importKey(leaf), b64(s), new TextEncoder().encode(`${h}.${p}`));
    if (!okSig) return { ok: false, why: 'assinatura' };
    const tx = JSON.parse(new TextDecoder().decode(b64(p))) as AppleTransaction;
    const at = Number(tx.signedDate) || 0;
    for (const c of [leaf, inter, root]) if (at < c.notBefore - 60000 || at > c.notAfter + 60000) return { ok: false, why: 'validade' };
    return { ok: true, tx };
  } catch {
    return { ok: false, why: 'formato' };
  }
}

// ---------- Premium da conta ----------
export interface PremiumState { source: 'subscription'; until: string; plan: string; env: string }

export async function premiumOf(db: DB, uid: string, now = Date.now()): Promise<PremiumState | null> {
  const r = await db.prepare('SELECT product, expires, env FROM premium WHERE uid = ?').bind(uid).first<{ product: string; expires: string; env: string }>();
  if (!r || Date.parse(r.expires) < now) return null;
  return { source: 'subscription', until: r.expires.slice(0, 10), plan: PRODUCTS[r.product as keyof typeof PRODUCTS] ?? r.product, env: r.env };
}

/**
 * Recebe as transações do iPhone (compra nova ou "Restaurar compras") e atualiza o Premium da conta.
 * Uma assinatura só fica numa conta NEFESH de cada vez: a última que a apresenta fica com ela.
 */
export async function savePremium(db: DB, uid: string, list: unknown, now = Date.now(), rootSha256 = APPLE_ROOT_G3_SHA256) {
  const items = (Array.isArray(list) ? list : []).slice(0, 10).map(String);
  let best: AppleTransaction | null = null;
  const refused: string[] = [];
  for (const jws of items) {
    const v = await verifyTransaction(jws, rootSha256);
    if (!v.ok) { refused.push(v.why); continue; }
    const tx = v.tx;
    if (tx.bundleId !== BUNDLE_ID || !(tx.productId in PRODUCTS)) { refused.push('produto'); continue; }
    if (tx.revocationDate || !tx.expiresDate || tx.expiresDate < now) continue;
    if (!best || tx.expiresDate > (best.expiresDate ?? 0)) best = tx;
  }
  if (best) {
    const at = new Date(now).toISOString();
    await db.prepare('DELETE FROM premium WHERE otid = ? AND uid <> ?').bind(String(best.originalTransactionId), uid).run();
    await db
      .prepare('INSERT INTO premium (uid, product, otid, expires, env, updated) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(uid) DO UPDATE SET product = excluded.product, otid = excluded.otid, expires = excluded.expires, env = excluded.env, updated = excluded.updated')
      .bind(uid, best.productId, String(best.originalTransactionId), new Date(best.expiresDate!).toISOString(), best.environment === 'Production' ? 'producao' : 'teste', at)
      .run();
  }
  return { status: items.length && !best && refused.length === items.length ? 400 : 200, body: { premium: await premiumOf(db, uid, now), refused } };
}
