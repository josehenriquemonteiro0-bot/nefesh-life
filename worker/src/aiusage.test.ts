import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import * as so from './social';
import { aiClient, costUsd, purgeUsage, recordUsage, usageSummary } from './aiusage';
import { aiCostPage } from './admin';

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

const NOW = new Date('2027-03-15T12:00:00Z');
const U = { input_tokens: 466, output_tokens: 300, cache_read_input_tokens: 12127, cache_creation_input_tokens: 0 };

describe('custo da IA', () => {
  it('calcula o custo com a cache (como na avaliação)', () => {
    // 466 + 12127 × 0,1 = 1678,7 tokens a 4 US$ + 300 a 20 US$ por milhão
    expect(costUsd('claude-opus-5-5', U)).toBeCloseTo((1678.7 * 4 + 300 * 20) / 1e6, 8);
    expect(costUsd('claude-haiku-5-5', { input_tokens: 1e6, output_tokens: 0 })).toBeCloseTo(0.1);
  });

  it('junta por dia, pessoa e função, sem guardar o aparelho', async () => {
    const db = memoryDB();
    await recordUsage(db, 'coach', 'aparelho-123', 'claude-opus-5-5', U, NOW);
    await recordUsage(db, 'coach', 'aparelho-123', 'claude-opus-5-5', U, NOW);
    await recordUsage(db, 'foto', 'aparelho-456', 'claude-opus-5-5', { input_tokens: 2000, output_tokens: 400 }, NOW);
    const { results } = await db.prepare('SELECT * FROM ai_usage ORDER BY feature').all<{ who: string; feature: string; calls: number; tout: number }>();
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ feature: 'coach', calls: 2, tout: 600 });
    expect(JSON.stringify(results)).not.toContain('aparelho');
  });

  it('resume por pessoa por mês e por função', async () => {
    const db = memoryDB();
    for (let d = 0; d < 10; d++) {
      const day = new Date(NOW.getTime() - d * 864e5);
      for (let i = 0; i < 3; i++) await recordUsage(db, 'coach', 'a', 'claude-opus-5-5', U, day);
      await recordUsage(db, 'foto', 'b', 'claude-opus-5-5', { input_tokens: 2000, output_tokens: 400 }, day);
    }
    const s = await usageSummary(db, 30, NOW);
    expect(s.people).toBe(2);
    expect(s.days).toBe(10);
    expect(s.calls).toBe(40);
    // 10 dias de dados projetados para 30
    const a = costUsd('claude-opus-5-5', U) * 30 * 3;
    const b = costUsd('claude-opus-5-5', { input_tokens: 2000, output_tokens: 400 }) * 30;
    expect(s.perPersonMonth.mean).toBeCloseTo((a + b) / 2, 6);
    expect(s.features[0].feature).toBe('coach');
    const html = aiCostPage('k', s, 30, 5.5);
    expect(html).toContain('Por pessoa ativa, por mês');
    expect(html).toContain('Assistente (conversa)');
  });

  it('apaga o que tem mais de 400 dias', async () => {
    const db = memoryDB();
    await recordUsage(db, 'coach', 'a', 'claude-opus-5-5', U, new Date('2025-01-01T12:00:00Z'));
    await recordUsage(db, 'coach', 'a', 'claude-opus-5-5', U, NOW);
    await purgeUsage(db, NOW);
    expect((await db.prepare('SELECT COUNT(*) AS n FROM ai_usage').first<{ n: number }>())!.n).toBe(1);
  });

  it('o cliente regista cada resposta e devolve-a sem mudanças', async () => {
    const db = memoryDB();
    const fake = { model: 'claude-opus-5-5', usage: U, content: [] };
    // cliente falso (sem rede nem biblioteca): o medidor embrulha o create e regista o uso
    const make = () => ({ messages: { create: async () => fake }, beta: { messages: { create: async () => fake } } }) as never;
    const c3 = aiClient(make, db, 'coach', 'pessoa');
    const r = await (c3.beta.messages.create as unknown as () => Promise<unknown>)();
    expect(r).toBe(fake);
    expect((await db.prepare('SELECT calls FROM ai_usage').first<{ calls: number }>())!.calls).toBe(1);
  });
});
