/**
 * Foto da Spirulina nos dias de verificação: a IA confirma que a imagem mostra
 * Spirulina (cápsulas, pó, palhinha/nibs ou o frasco NEFESH) fotografada ao vivo.
 */
import Anthropic from '@anthropic-ai/sdk';

const SCHEMA = {
  type: 'object',
  properties: {
    shows_spirulina: { type: 'boolean', description: 'true se a foto mostra Spirulina: cápsulas verde-escuras, pó verde, palhinha/nibs verdes ou um frasco/embalagem de Spirulina' },
    is_screen_photo: { type: 'boolean', description: 'true se é uma foto de um ecrã, de uma imagem impressa ou de outra fotografia' },
    note: { type: 'string', description: 'frase curta para a pessoa, em português de Portugal' },
  },
  required: ['shows_spirulina', 'is_screen_photo', 'note'],
  additionalProperties: false,
} as const;

const SYSTEM = `Verificas fotografias da app NEFESH Life. A pessoa fotografa a Spirulina que vai tomar hoje (cápsulas na mão, pó numa colher ou no copo, palhinha/nibs, ou o frasco NEFESH).
Responde se a imagem mostra Spirulina e se parece uma fotografia tirada ao vivo (e não a um ecrã, a uma imagem impressa ou a outra fotografia: moiré, píxeis, reflexos de ecrã, molduras de telemóvel).
A nota é uma frase simpática e curta. Não faças juízos sobre saúde.`;

export async function checkSpirulinaPhoto(client: Anthropic, model: string, image: string, mediaType: 'image/jpeg' | 'image/png' | 'image/webp') {
  const r = await client.beta.messages.create({
    model,
    max_tokens: 1000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: SYSTEM,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
    messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: mediaType, data: image } }, { type: 'text', text: 'Verifica esta foto.' }] }],
  });
  const t = r.content.find((x) => x.type === 'text');
  if (r.stop_reason === 'refusal' || !t || t.type !== 'text') return { shows_spirulina: false, is_screen_photo: false, note: 'Não foi possível analisar a foto.' };
  return JSON.parse(t.text) as { shows_spirulina: boolean; is_screen_photo: boolean; note: string };
}
