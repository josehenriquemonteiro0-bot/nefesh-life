import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import * as so from './social';
import * as as from './appstore';
import fx from './appstore.fixtures.json';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite');
function memoryDB(): so.DB {
  const db = new DatabaseSync(':memory:');
  db.exec(so.SCHEMA);
  const stmt = (sql: string, args: unknown[] = []): so.Stmt => ({
    bind: (...v: unknown[]) => stmt(sql, v),
    first: async <T,>() => ((db.prepare(sql).get(...(args as never[])) as T) ?? null),
    all: async <T,>() => ({ results: db.prepare(sql).all(...(args as never[])) as T[] }),
    run: async () => db.prepare(sql).run(...(args as never[])),
  });
  return { prepare: (sql) => stmt(sql), batch: async (s) => { for (const x of s) await x.run(); return []; } };
}
const b64url = (b: Uint8Array | string) => Buffer.from(b).toString('base64url');
const NOW = Date.parse('2026-12-01T12:00:00Z');
const tx = (o: Partial<as.AppleTransaction> = {}) => ({
  bundleId: as.BUNDLE_ID,
  productId: 'com.nefesh.life.premium.anual',
  transactionId: '2000000001',
  originalTransactionId: '2000000000',
  expiresDate: Date.parse('2027-11-24T12:00:00Z'),
  signedDate: NOW,
  environment: 'Sandbox',
  type: 'Auto-Renewable Subscription',
  ...o,
});
async function sign(payload: object, chain = [fx.leaf, fx.inter, fx.root]) {
  const h = b64url(JSON.stringify({ alg: 'ES256', x5c: chain }));
  const p = b64url(JSON.stringify(payload));
  const key = await crypto.subtle.importKey('pkcs8', Buffer.from(fx.leafKey, 'base64'), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const s = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(`${h}.${p}`)));
  return `${h}.${p}.${b64url(s)}`;
}

// certificado público "Apple Root CA - G3" (apple.com/certificateauthority), para confirmar o leitor e a impressão digital
const APPLE_ROOT = 'MIICQzCCAcmgAwIBAgIILcX8iNLFS5UwCgYIKoZIzj0EAwMwZzEbMBkGA1UEAwwSQXBwbGUgUm9vdCBDQSAtIEczMSYwJAYDVQQLDB1BcHBsZSBDZXJ0aWZpY2F0aW9uIEF1dGhvcml0eTETMBEGA1UECgwKQXBwbGUgSW5jLjELMAkGA1UEBhMCVVMwHhcNMTQwNDMwMTgxOTA2WhcNMzkwNDMwMTgxOTA2WjBnMRswGQYDVQQDDBJBcHBsZSBSb290IENBIC0gRzMxJjAkBgNVBAsMHUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9yaXR5MRMwEQYDVQQKDApBcHBsZSBJbmMuMQswCQYDVQQGEwJVUzB2MBAGByqGSM49AgEGBSuBBAAiA2IABJjpLz1AcqTtkyJygRMc3RCV8cWjTnHcFBbZDuWmBSp3ZHtfTjjTuxxEtX/1H7YyYl3J6YRbTzBPEVoA/VhYDKX1DyxNB0cTddqXl5dvMVztK517IDvYuVTZXpmkOlEKMaNCMEAwHQYDVR0OBBYEFLuw3qFYM4iapIqZ3r6966/ayySrMA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgEGMAoGCCqGSM49BAMDA2gAMGUCMQCD6cHEFl4aXTQY2e3v9GwOAEZLuN+yRhHFD/3meoyhpmvOwgPUnPWTxnS4at+qIxUCMG1mihDK1A3UT82NQz60imOlM27jbdoXt2QfyFMm+YhidDkLF1vLUagM6BgD56KyKA==';

describe('compras da App Store (StoreKit 2)', () => {
  it('lê o certificado raiz verdadeiro da Apple e confere a impressão digital fixada', async () => {
    const der = Buffer.from(APPLE_ROOT, 'base64');
    const c = as.parseCert(new Uint8Array(der));
    expect(c.notAfter).toBe(Date.UTC(2039, 3, 30, 18, 19, 6));
    const sha = Buffer.from(await crypto.subtle.digest('SHA-256', der)).toString('hex');
    expect(sha).toBe(as.APPLE_ROOT_G3_SHA256);
  });

  it('aceita uma transação com a cadeia completa e recusa as alteradas', async () => {
    const jws = await sign(tx());
    const ok = await as.verifyTransaction(jws, fx.rootSha256);
    expect(ok).toMatchObject({ ok: true, tx: { productId: 'com.nefesh.life.premium.anual' } });
    // raiz que não é a da Apple
    expect(await as.verifyTransaction(jws)).toMatchObject({ ok: false, why: 'raiz' });
    // conteúdo alterado depois de assinado
    const [h, , s] = jws.split('.');
    expect(await as.verifyTransaction(`${h}.${b64url(JSON.stringify(tx({ expiresDate: 4e12 })))}.${s}`, fx.rootSha256)).toMatchObject({ ok: false, why: 'assinatura' });
    // folha que não foi emitida pelo intermédio
    expect(await as.verifyTransaction(await sign(tx(), [fx.other, fx.inter, fx.root]), fx.rootSha256)).toMatchObject({ ok: false });
    // assinada fora da validade dos certificados
    expect(await as.verifyTransaction(await sign(tx({ signedDate: Date.parse('2001-01-01') })), fx.rootSha256)).toMatchObject({ ok: false, why: 'validade' });
    expect(await as.verifyTransaction('lixo')).toMatchObject({ ok: false });
  });

  it('ativa o Premium da conta, passa a assinatura para a última conta e ignora as expiradas', async () => {
    const db = memoryDB();
    const jws = await sign(tx());
    const save = (uid: string, list: unknown) => as.savePremium(db, uid, list, NOW, fx.rootSha256);
    expect((await save('ana', [jws])).body.premium).toMatchObject({ until: '2027-11-24', plan: 'anual', env: 'teste' });
    // a mesma assinatura numa outra conta NEFESH: fica só na última
    await save('rui', [jws]);
    expect(await as.premiumOf(db, 'ana', NOW)).toBeNull();
    expect(await as.premiumOf(db, 'rui', NOW)).toMatchObject({ plan: 'anual' });
    // expirada ou revogada: não ativa
    expect((await save('eva', [await sign(tx({ originalTransactionId: '9', expiresDate: NOW - 1 }))])).body.premium).toBeNull();
    expect((await save('eva', [await sign(tx({ originalTransactionId: '9', revocationDate: NOW }))])).body.premium).toBeNull();
    // outra app ou outro produto: recusado
    const r = await save('eva', [await sign(tx({ bundleId: 'com.outra.app' }))]);
    expect(r).toMatchObject({ status: 400, body: { premium: null, refused: ['produto'] } });
    // depois de expirar, deixa de contar
    expect(await as.premiumOf(db, 'rui', Date.parse('2027-12-01'))).toBeNull();
  });
});
