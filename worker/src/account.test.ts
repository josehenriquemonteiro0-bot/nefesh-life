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
