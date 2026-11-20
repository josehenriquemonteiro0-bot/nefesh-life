import { describe, expect, it } from 'vitest';
import { deleteAccount, getData, login, recover, register, saveData, type AccountStore } from './account';

function memory(): AccountStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, get: async (k) => data.get(k) ?? null, put: async (k, v) => void data.set(k, v), delete: async (k) => void data.delete(k) };
}

describe('contas', () => {
  it('regista, entra, guarda e lê os dados', async () => {
    const s = memory();
    const r = await register(s, ' Ana@Exemplo.pt ', 'segredo123');
    expect(r.status).toBe(200);
    expect(r.body.recovery).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    // nada guardado em claro
    const all = [...s.data.entries()].join(' ');
    expect(all).not.toContain('segredo123');
    expect(all).not.toContain(String(r.body.recovery));
    expect((await register(s, 'ana@exemplo.pt', 'outra1234')).status).toBe(409);
    expect((await login(s, 'ana@exemplo.pt', 'errada123')).status).toBe(401);
    const l = await login(s, 'ANA@exemplo.pt', 'segredo123');
    expect(l.status).toBe(200);
    await saveData(s, l.body.token, { ans: { name: 'Ana' } }, '2026-11-20T10:00:00.000Z');
    const d = await getData(s, r.body.token);
    expect(d.body).toEqual({ data: { ans: { name: 'Ana' } }, updatedAt: '2026-11-20T10:00:00.000Z' });
    expect((await login(s, 'ana@exemplo.pt', 'segredo123')).body.updatedAt).toBe('2026-11-20T10:00:00.000Z');
  });

  it('valida e-mail e palavra-passe', async () => {
    const s = memory();
    expect((await register(s, 'sem-arroba', 'segredo123')).status).toBe(400);
    expect((await register(s, 'a@b.pt', 'curta')).status).toBe(400);
    expect((await getData(s, 'token-falso')).status).toBe(401);
  });

  it('recupera a palavra-passe com o código e troca o código', async () => {
    const s = memory();
    const r = await register(s, 'a@b.pt', 'segredo123');
    const code = String(r.body.recovery);
    expect((await recover(s, 'a@b.pt', 'AAAA-BBBB-CCCC-DDDD', 'nova12345')).status).toBe(401);
    const ok = await recover(s, 'a@b.pt', code.toLowerCase().replace(/-/g, ' '), 'nova12345');
    expect(ok.status).toBe(200);
    expect(ok.body.recovery).not.toBe(code);
    expect((await login(s, 'a@b.pt', 'nova12345')).status).toBe(200);
    expect((await login(s, 'a@b.pt', 'segredo123')).status).toBe(401);
    expect((await recover(s, 'a@b.pt', code, 'outra12345')).status).toBe(401);
  });

  it('apaga a conta e os dados', async () => {
    const s = memory();
    const r = await register(s, 'a@b.pt', 'segredo123');
    await saveData(s, r.body.token, { x: 1 }, undefined);
    expect((await deleteAccount(s, r.body.token, 'a@b.pt', 'errada123')).status).toBe(401);
    expect((await deleteAccount(s, r.body.token, 'a@b.pt', 'segredo123')).status).toBe(200);
    expect(s.data.size).toBe(0);
  });
});

describe('app Saúde pelo atalho do iPhone', async () => {
  const { healthKey, healthPull, healthPush, sleepHours } = await import('./account');
  it('aceita sono em horas, minutos ou segundos', () => {
    expect(sleepHours('7,5')).toBe(7.5);
    expect(sleepHours(450)).toBe(7.5);
    expect(sleepHours(27000)).toBe(7.5);
    expect(sleepHours('')).toBeUndefined();
  });
  it('o atalho envia com a chave e a app recebe', async () => {
    const s = memory();
    const r = await register(s, 'a@b.pt', 'segredo123');
    const k = await healthKey(s, r.body.token);
    expect((await healthKey(s, r.body.token)).body.key).toBe(k.body.key);
    expect((await healthPush(s, { chave: 'f'.repeat(24), passos: 10 }, '2026-11-20')).status).toBe(401);
    const ok = await healthPush(s, { chave: k.body.key, passos: '7 200', sono: '450', exercicio: '32' }, '2026-11-20');
    expect(ok.status).toBe(200);
    await healthPush(s, { chave: k.body.key, passos: 9000 }, '2026-11-20');
    const d = await healthPull(s, r.body.token);
    expect(d.body.days).toMatchObject({ '2026-11-20': { steps: 9000, sleepH: 7.5, exMin: 32 } });
    // chave nova: a antiga deixa de servir
    const k2 = await healthKey(s, r.body.token, true);
    expect(k2.body.key).not.toBe(k.body.key);
    expect((await healthPush(s, { chave: k.body.key, passos: 1 }, '2026-11-20')).status).toBe(401);
    expect((await healthPush(s, { chave: k2.body.key, passos: 1 }, '2026-11-20')).status).toBe(200);
    await deleteAccount(s, r.body.token, 'a@b.pt', 'segredo123');
    expect(s.data.size).toBe(0);
  });
});

describe('consentimentos', async () => {
  const { setConsents } = await import('./account');
  it('guarda cada escolha com a data; o e-mail só com marketing e só o da própria conta', async () => {
    const s = memory();
    const r = await register(s, 'ana@exemplo.pt', 'segredo123');
    await register(s, 'rui@exemplo.pt', 'segredo123');
    const t = r.body.token as string;
    const a = await setConsents(s, t, { rd: true, marketing: false }, new Date('2026-11-20T10:00:00Z'));
    expect(a.status).toBe(200);
    const key = [...s.data.keys()].find((k) => k.startsWith('cs:'))!;
    expect(JSON.parse(s.data.get(key)!)).toEqual({ rd: { on: true, at: '2026-11-20T10:00:00.000Z' }, marketing: { on: false, at: '2026-11-20T10:00:00.000Z' } });
    expect((await setConsents(s, t, { rd: true, marketing: true, email: 'rui@exemplo.pt' })).status).toBe(400); // e-mail de outra conta
    await setConsents(s, t, { rd: true, marketing: true, email: 'ana@exemplo.pt' }, new Date('2026-11-21T10:00:00Z'));
    const c = JSON.parse(s.data.get(key)!);
    expect(c.email).toBe('ana@exemplo.pt');
    expect(c.rd.at).toBe('2026-11-20T10:00:00.000Z'); // não mudou: mantém a data
    expect(c.marketing.at).toBe('2026-11-21T10:00:00.000Z');
    await setConsents(s, t, { rd: false, marketing: false });
    expect(JSON.parse(s.data.get(key)!).email).toBeUndefined();
    expect((await setConsents(s, 'x'.repeat(64), { rd: true })).status).toBe(401);
  });
});
