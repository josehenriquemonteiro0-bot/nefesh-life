/**
 * Custo real da IA: cada pedido ao modelo regista os tokens e o custo estimado, por dia, por função
 * (assistente, foto do prato, leitura do plano…) e por pessoa.
 *
 * Privacidade: não se guarda o conteúdo das conversas nem o aparelho/conta. A pessoa é identificada
 * por um código irreversível (SHA-256 truncado); as linhas apagam-se ao fim de 400 dias.
 * Serve para o plano de negócio: quanto custa a IA por pessoa ativa por mês, com o uso real.
 */
import type Anthropic from '@anthropic-ai/sdk';
import type { DB } from './social';

/** Preço por milhão de tokens (entrada, saída), em dólares. A cache: escrita 1,25× e leitura 0,1× da entrada. */
export const PRICE: Record<string, [number, number]> = { 'claude-opus-5-5': [4, 20], 'claude-sonnet-5-5': [2, 10], 'claude-haiku-5-5': [0.1, 0.5] };
export const KEEP_DAYS = 400;

export interface Usage { input_tokens: number; output_tokens: number; cache_creation_input_tokens?: number | null; cache_read_input_tokens?: number | null }

export function costUsd(model: string, u: Usage) {
  const key = Object.keys(PRICE).find((k) => model.startsWith(k));
  const p = key ? PRICE[key] : PRICE['claude-opus-5-5'];
  const inTok = u.input_tokens + (u.cache_creation_input_tokens ?? 0) * 1.25 + (u.cache_read_input_tokens ?? 0) * 0.1;
  return (inTok * p[0] + u.output_tokens * p[1]) / 1e6;
}

const sha = async (s: string) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`nefesh-ia:${s}`)))].slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('');
const lisbonDay = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(d);

export async function recordUsage(db: DB, feature: string, who: string, model: string, u: Usage, now = new Date()) {
  const id = await sha(who || 'anónimo');
  await db
    .prepare(
      `INSERT INTO ai_usage (day, who, feature, model, calls, tin, tout, tcw, tcr, usd) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
       ON CONFLICT(day, who, feature, model) DO UPDATE SET calls = calls + 1, tin = tin + excluded.tin, tout = tout + excluded.tout, tcw = tcw + excluded.tcw, tcr = tcr + excluded.tcr, usd = usd + excluded.usd`,
    )
    .bind(lisbonDay(now), id, feature.slice(0, 40), model.slice(0, 60), u.input_tokens | 0, u.output_tokens | 0, (u.cache_creation_input_tokens ?? 0) | 0, (u.cache_read_input_tokens ?? 0) | 0, costUsd(model, u))
    .run();
}

interface Ctx { waitUntil(p: Promise<unknown>): void }

/**
 * Cliente da IA que regista o uso de cada resposta (sem atrasar a resposta: o registo corre em segundo plano).
 * `feature` diz para que foi o pedido; `who` é o aparelho ou a conta (vira um código irreversível).
 */
export function aiClient(make: () => Anthropic, db: DB | undefined, feature: string, who: string, ctx?: Ctx): Anthropic {
  const client = make();
  if (!db) return client;
  const wrap = <T extends { create: (...a: never[]) => unknown }>(target: T) => {
    const real = target.create.bind(target) as (...a: unknown[]) => Promise<unknown>;
    (target as { create: unknown }).create = async (...a: unknown[]) => {
      const r = (await real(...a)) as { model?: string; usage?: Usage };
      if (r?.usage) {
        const p = recordUsage(db, feature, who, r.model ?? String((a[0] as { model?: string })?.model ?? ''), r.usage).catch(() => undefined);
        if (ctx) ctx.waitUntil(p);
        else await p;
      }
      return r;
    };
  };
  wrap(client.messages as never);
  wrap(client.beta.messages as never);
  return client;
}

export async function purgeUsage(db: DB, now = new Date()) {
  await db.prepare('DELETE FROM ai_usage WHERE day < ?').bind(lisbonDay(new Date(now.getTime() - KEEP_DAYS * 864e5))).run();
}

export interface UsageRow { day: string; who: string; feature: string; model: string; calls: number; tin: number; tout: number; tcw: number; tcr: number; usd: number }

const FEATURE_LABEL: Record<string, string> = {
  coach: 'Assistente (conversa)',
  foto: 'Foto do prato',
  plano: 'Leitura do plano do nutricionista',
  treino: 'Leitura do plano de treino',
  relatorio: 'Relatório semanal',
  dica: 'Dica de alimento',
  rotulo: 'Tabela nutricional',
  analises: 'Boletim de análises',
  receita: 'Receita',
  'corpo-relatorio': 'Relatório do corpo',
  'pro-ditado': 'Pro: ditado do treino',
  'pro-rever': 'Pro: revisão do treino',
  'pro-avaliacao': 'Pro: avaliação física',
  'pro-nutri-ditado': 'Pro: ditado do plano alimentar',
  'pro-nutri-rever': 'Pro: revisão do plano alimentar',
  'pro-exames': 'Pro: leitura de exames',
  'pro-integ-anamnese': 'Pro: anamnese integrativa',
  'comunidade-foto': 'Comunidade: verificação de foto',
  'captura-saude': 'Captura do app Saúde',
  'prova-spirulina': 'Prova da Spirulina',
};
export const featureLabel = (f: string) => FEATURE_LABEL[f] ?? f;

/** Resumo dos últimos n dias: custo total, pessoas ativas, custo por pessoa por mês (média, mediana, p90) e por função. */
export async function usageSummary(db: DB, days = 30, now = new Date()) {
  const from = lisbonDay(new Date(now.getTime() - (days - 1) * 864e5));
  const { results } = await db.prepare('SELECT * FROM ai_usage WHERE day >= ?').bind(from).all<UsageRow>();
  const rows = results ?? [];
  const perWho = new Map<string, number>();
  const perFeat = new Map<string, { calls: number; usd: number; who: Set<string> }>();
  const perDay = new Map<string, { calls: number; usd: number; who: Set<string> }>();
  let usd = 0;
  let calls = 0;
  for (const r of rows) {
    usd += r.usd;
    calls += r.calls;
    perWho.set(r.who, (perWho.get(r.who) ?? 0) + r.usd);
    const f = perFeat.get(r.feature) ?? { calls: 0, usd: 0, who: new Set() };
    f.calls += r.calls;
    f.usd += r.usd;
    f.who.add(r.who);
    perFeat.set(r.feature, f);
    const d = perDay.get(r.day) ?? { calls: 0, usd: 0, who: new Set() };
    d.calls += r.calls;
    d.usd += r.usd;
    d.who.add(r.who);
    perDay.set(r.day, d);
  }
  const daysWithData = Math.max(1, perDay.size);
  const scale = 30 / Math.min(days, daysWithData); // se ainda há menos de 30 dias de dados, projeta para um mês
  const people = [...perWho.values()].map((v) => v * scale).sort((a, b) => a - b);
  const q = (p: number) => (people.length ? people[Math.min(people.length - 1, Math.floor(p * people.length))] : 0);
  return {
    from,
    days: daysWithData,
    usd,
    calls,
    people: perWho.size,
    perPersonMonth: { mean: people.length ? people.reduce((a, b) => a + b, 0) / people.length : 0, median: q(0.5), p90: q(0.9) },
    features: [...perFeat.entries()].map(([k, v]) => ({ feature: k, label: featureLabel(k), calls: v.calls, usd: v.usd, people: v.who.size, perCall: v.usd / Math.max(1, v.calls) })).sort((a, b) => b.usd - a.usd),
    daily: [...perDay.entries()].map(([d, v]) => ({ day: d, calls: v.calls, usd: v.usd, people: v.who.size })).sort((a, b) => b.day.localeCompare(a.day)),
  };
}
