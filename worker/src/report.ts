/**
 * Relatório semanal: "O que a IA percebeu" (2–3 frases) a partir do resumo da semana
 * calculado na app (só números e o objetivo, sem dados de identificação).
 */
import Anthropic from '@anthropic-ai/sdk';
import { check, count, type CounterStore, type Limits } from './limits';

export const REPORT_LIMITS: Limits = { device: 6, ip: 30, global: 3000 };

const SCHEMA = {
  type: 'object',
  properties: {
    insights: { type: 'string', description: '2 ou 3 frases curtas sobre padrões da semana, em português de Portugal' },
  },
  required: ['insights'],
  additionalProperties: false,
} as const;

export const REPORT_SYSTEM = `És o NEFESH Voice Assistant e escreves a parte "O que a IA percebeu" do relatório semanal da app NEFESH Life.
- 2 ou 3 frases curtas, em português de Portugal, calorosas e concretas, na forma de tratamento neutra ("você" ou sem pronome).
- Aponta padrões e ligações entre áreas (ex.: noites com mais sono e energia mais alta; dias sem Spirulina; treino e passos). Começa por algo positivo, se houver.
- Áreas "sem registos" não são falhas: não critiques a falta de dados; quando muito, sugere registar.
- Não repitas a prioridade da app nem dês outra prioridade.
- Não fazes diagnósticos, não falas de doenças e não prometes resultados de saúde com a Spirulina. Escreve "Spirulina", nunca "espirulina".
- Não inventes números: usa só os do resumo.`;

export async function handleReport(body: Record<string, unknown>, store: CounterStore, client: Anthropic, model: string, device: string, ip: string, json: (b: unknown, s: number) => Response) {
  const summary = String(body.summary ?? '').trim().slice(0, 2500);
  if (!summary) return json({ error: 'Resumo em falta.' }, 400);
  const allowed = await check(store, REPORT_LIMITS, device, ip, new Date(), 'r');
  if (!allowed.ok) return json({ error: 'Já gerou o relatório várias vezes hoje. Tente amanhã.' }, 429);
  const response = await client.beta.messages.create({
    model,
    max_tokens: 1500,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: REPORT_SYSTEM,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
    messages: [{ role: 'user', content: `Resumo da semana:\n${summary}` }],
  });
  if (response.stop_reason === 'refusal') return json({ insights: '' }, 200);
  const text = response.content.find((b) => b.type === 'text');
  if (!text || text.type !== 'text') return json({ error: 'resposta vazia' }, 502);
  const r = JSON.parse(text.text) as { insights?: string };
  await count(store, REPORT_LIMITS, device, ip, new Date(), 'r');
  return json({ insights: String(r.insights ?? '').slice(0, 800) }, 200);
}
