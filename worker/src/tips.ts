/** Dicas de execução de um exercício (para exercícios de planos de personal sem animação). */
import Anthropic from '@anthropic-ai/sdk';
import { check, count, type CounterStore, type Limits } from './limits';

export const TIP_LIMITS: Limits = { device: 30, ip: 90, global: 600 };

const TIP_SCHEMA = {
  type: 'object',
  properties: {
    steps: { type: 'array', items: { type: 'string' }, description: '3 ou 4 passos curtos de execução, pela ordem' },
    mistakes: { type: 'array', items: { type: 'string' }, description: '2 ou 3 erros comuns a evitar' },
    breathing: { type: 'string', description: 'como respirar, numa frase' },
    muscles: { type: 'string', description: 'músculos principais trabalhados' },
    safety: { type: 'string', description: 'um cuidado de segurança relevante, numa frase' },
  },
  required: ['steps', 'mistakes', 'breathing', 'muscles', 'safety'],
  additionalProperties: false,
} as const;

const SYSTEM = `És um profissional de exercício da app NEFESH Life. Explicas como executar um exercício de ginásio ou de casa, de forma clara e curta, em português de Portugal.
- Frases curtas e práticas, na segunda pessoa ("Mantenha as costas direitas").
- Se o nome trouxer variantes (pegada, máquina, polia), considera-as.
- Se o personal deixou observações, respeita-as e não as contradigas.
- Não dês cargas nem número de repetições: isso é definido pelo personal.
- Se o nome não for um exercício reconhecível, explica de forma genérica e diz para confirmar com o personal.`;

export async function handleTip(body: { name?: string; notes?: string }, store: CounterStore, client: Anthropic, model: string, device: string, ip: string, json: (b: unknown, s: number) => Response) {
  const name = String(body.name ?? '').trim().slice(0, 120);
  if (!name) return json({ error: 'Falta o nome do exercício.' }, 400);
  const allowed = await check(store, TIP_LIMITS, device, ip, new Date(), 't');
  if (!allowed.ok) return json({ error: 'Já pediu muitas dicas hoje. Tente amanhã.' }, 429);
  const notes = String(body.notes ?? '').trim().slice(0, 300);
  const response = await client.beta.messages.create({
    model,
    max_tokens: 3000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: SYSTEM,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: TIP_SCHEMA } },
    messages: [{ role: 'user', content: `Exercício: ${name}${notes ? `\nObservações do personal: ${notes}` : ''}` }],
  });
  if (response.stop_reason === 'refusal') return json({ error: 'Não foi possível gerar dicas para este exercício.' }, 422);
  const text = response.content.find((b) => b.type === 'text');
  if (!text || text.type !== 'text') return json({ error: 'resposta vazia' }, 502);
  const result = JSON.parse(text.text);
  await count(store, TIP_LIMITS, device, ip, new Date(), 't');
  return json(result, 200);
}
