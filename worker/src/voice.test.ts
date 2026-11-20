import { describe, expect, it } from 'vitest';
import { handleVoice, VOICE_MODEL } from './voice';

const kv = () => { const m = new Map<string, string>(); return { get: async (k: string) => m.get(k) ?? null, put: async (k: string, v: string) => void m.set(k, v) }; };
const json = (b: unknown, s: number) => new Response(JSON.stringify(b), { status: s });

describe('voz → texto', () => {
  it('transcreve em português com o Whisper e devolve o texto', async () => {
    const calls: [string, Record<string, unknown>][] = [];
    const ai = { run: async (m: string, i: Record<string, unknown>) => { calls.push([m, i]); return { text: '  tomei a Spirulina   e bebi dois copos ' }; } };
    const r = await handleVoice({ audio: 'AAAA' }, ai, kv(), 'dev-12345678', '1.1.1.1', json);
    expect(await r.json()).toEqual({ text: 'tomei a Spirulina e bebi dois copos' });
    expect(calls[0][0]).toBe(VOICE_MODEL);
    expect(calls[0][1]).toMatchObject({ audio: 'AAAA', language: 'pt' });
  });
  it('recusa gravações inválidas e funciona sem o serviço configurado', async () => {
    const ai = { run: async () => ({ text: 'x' }) };
    expect((await handleVoice({ audio: 'não é base64!' }, ai, kv(), 'd', 'i', json)).status).toBe(400);
    expect((await handleVoice({ audio: 'A'.repeat(3_000_000) }, ai, kv(), 'd', 'i', json)).status).toBe(400);
    expect((await handleVoice({ audio: 'AAAA' }, undefined, kv(), 'd', 'i', json)).status).toBe(503);
  });
});
