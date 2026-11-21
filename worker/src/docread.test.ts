import { describe, expect, it } from 'vitest';
import { LAB_KEYS, handleDocRead } from './docread';
import { LABS } from '../../src/domain/care';

const kv = () => { const m = new Map<string, string>(); return { get: async (k: string) => m.get(k) ?? null, put: async (k: string, v: string) => void m.set(k, v) }; };
const json = (b: unknown, s: number) => new Response(JSON.stringify(b), { status: s });

describe('leitura de rótulos e análises', () => {
  it('as análises conhecidas são as mesmas da app', () => {
    expect([...LAB_KEYS]).toEqual(LABS.map((l) => l.key));
  });
  it('lê um boletim (PDF) e recusa formatos errados', async () => {
    const calls: { messages: { content: { type: string }[] }[] }[] = [];
    const client = { beta: { messages: { create: async (r: never) => { calls.push(r); return { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ is_labs: true, date: '2026-10-05', results: [{ key: 'ldl', name: 'Colesterol LDL', value: 128, unit: 'mg/dL', ref_low: -1, ref_high: 115 }] }) }] }; } } } } as never;
    const r = await handleDocRead('analises', { file: 'AAAA', media_type: 'application/pdf' }, kv(), client, 'm', 'dev-12345678', 'ip', json);
    expect((await r.json()).results[0]).toMatchObject({ key: 'ldl', value: 128 });
    expect(calls[0].messages[0].content[0].type).toBe('document');
    expect((await handleDocRead('rotulo', { file: 'AAAA', media_type: 'application/pdf' }, kv(), client, 'm', 'd', 'i', json)).status).toBe(400);
    expect((await handleDocRead('analises', { file: '', media_type: 'image/jpeg' }, kv(), client, 'm', 'd', 'i', json)).status).toBe(400);
  });
});
