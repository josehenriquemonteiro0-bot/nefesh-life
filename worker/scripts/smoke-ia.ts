/**
 * Teste rápido da IA na publicação: faz o mesmo pedido da foto do prato (com uma imagem gerada)
 * e mostra se a API aceita. Não mostra a chave. Uso: node --experimental-strip-types scripts/smoke-ia.ts
 */
import Anthropic from '@anthropic-ai/sdk';
import { deflateSync } from 'node:zlib';
import { SCHEMA, SYSTEM } from '../src/meal.ts';

// PNG 64×64 de uma cor (sem dependências)
function png(w: number, h: number) {
  const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b: Buffer) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t: string, d: Buffer) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.set([200, 120, 40], y * (w * 3 + 1) + 1 + x * 3);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const client = new Anthropic();
const model = process.env.MODEL || 'claude-opus-5-5';
const content = [
  { type: 'image' as const, source: { type: 'base64' as const, media_type: 'image/png' as const, data: png(64, 64).toString('base64') } },
  { type: 'text' as const, text: 'Estima esta refeição.' },
];
const base = { model, max_tokens: 4000, system: SYSTEM, output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } }, messages: [{ role: 'user', content }] };
const tries: [string, () => Promise<unknown>][] = [
  ['com modelo de recurso (beta)', () => client.beta.messages.create({ ...base, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } as never)],
  ['pedido simples', () => client.messages.create(base as never)],
  ['sem formato JSON', () => client.messages.create({ model, max_tokens: 500, messages: [{ role: 'user', content }] } as never)],
];
let fail = 0;
for (const [name, run] of tries) {
  try {
    const r = (await run()) as { stop_reason: string; model: string };
    console.log(`✓ ${name}: ${r.model}, stop_reason=${r.stop_reason}`);
  } catch (e) {
    fail++;
    const err = e as { status?: number; message?: string };
    console.log(`✗ ${name}: HTTP ${err.status ?? '?'} — ${String(err.message).slice(0, 400)}`);
  }
}
if (fail === tries.length) process.exitCode = 1;
