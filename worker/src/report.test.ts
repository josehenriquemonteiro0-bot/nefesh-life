import { describe, expect, it } from 'vitest';
import { REPORT_SYSTEM, handleReport } from './report';

const kv = () => { const m = new Map<string, string>(); return { get: async (k: string) => m.get(k) ?? null, put: async (k: string, v: string) => void m.set(k, v) }; };
const json = (b: unknown, s: number) => new Response(JSON.stringify(b), { status: s });

describe('relatório semanal (IA)', () => {
  it('as regras estão no prompt e devolve 2–3 frases', async () => {
    expect(REPORT_SYSTEM).toMatch(/não são falhas/);
    expect(REPORT_SYSTEM).toMatch(/Não fazes diagnósticos/);
    const calls: { messages: { content: string }[] }[] = [];
    const client = { beta: { messages: { create: async (r: never) => { calls.push(r); return { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ insights: 'Boa semana.' }) }] }; } } } } as never;
    const r = await handleReport({ summary: 'Spirulina 6 de 7' }, kv(), client, 'm', 'dev-12345678', 'ip', json);
    expect(await r.json()).toEqual({ insights: 'Boa semana.' });
    expect(calls[0].messages[0].content).toContain('Spirulina 6 de 7');
    expect((await handleReport({}, kv(), client, 'm', 'd', 'i', json)).status).toBe(400);
  });
});
