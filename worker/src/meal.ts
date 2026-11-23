/**
 * Análise da foto do prato: o pedido à IA num só sítio (usado pelo servidor e pelo teste da publicação).
 * Sem dependências além do SDK, para correr também com `node --experimental-strip-types`.
 */
import Anthropic from '@anthropic-ai/sdk';

export const SCHEMA = {
  type: 'object',
  properties: {
    is_food: { type: 'boolean', description: 'true se a foto mostra comida ou bebida' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'nome do alimento em português de Portugal' },
          grams: { type: 'number', description: 'peso estimado da porção visível, em gramas' },
          kcal: { type: 'number' },
          protein_g: { type: 'number' },
          carbs_g: { type: 'number' },
          fat_g: { type: 'number' },
          confidence: { type: 'string', enum: ['alta', 'media', 'baixa'] },
        },
        required: ['name', 'grams', 'kcal', 'protein_g', 'carbs_g', 'fat_g', 'confidence'],
        additionalProperties: false,
      },
    },
    note: { type: 'string', description: 'uma frase curta para a pessoa, em português de Portugal' },
    is_screen_photo: { type: 'boolean', description: 'true se é uma foto de um ecrã, de uma imagem impressa ou de outra fotografia (e não do prato ao vivo)' },
  },
  required: ['is_food', 'items', 'note', 'is_screen_photo'],
  additionalProperties: false,
} as const;

export const SYSTEM = `És o assistente nutricional da app NEFESH Life. Recebes a fotografia de uma refeição e estimas o que está no prato.

Para cada alimento visível, indica o nome em português de Portugal, o peso aproximado da porção em gramas e os valores dessa porção: calorias, proteína, hidratos de carbono e gordura. Usa valores médios de tabelas de composição de alimentos e tem em conta o modo de confeção que se vê (frito, grelhado, cozido) e molhos ou azeite visíveis.

Usa referências na imagem para estimar tamanhos: o prato (normalmente 26 a 28 cm), talheres, copos, mãos. Agrupa ingredientes que não se distinguem num só item (ex.: "salada mista"). Indica a confiança de cada item: alta, media ou baixa.

Se a pessoa juntar uma nota de texto, usa-a para corrigir a tua leitura (ex.: "o arroz é integral", "comi metade").

Se a imagem não mostrar comida nem bebida, responde com is_food false e items vazio.

A nota final é uma frase curta e útil para a pessoa (ex.: o que pesou mais na estimativa, ou o que conferir). Não faças juízos sobre a alimentação nem conselhos médicos.`;

type Media = 'image/jpeg' | 'image/png' | 'image/webp';

/**
 * Pede a estimativa. Primeiro com o modelo de recurso (se o modelo recusar, outro responde);
 * se a API recusar o pedido como inválido (400), tenta uma vez o pedido simples, sem opções beta.
 */
export async function analyzeMealPhoto(client: Anthropic, model: string, image: string, mediaType: Media, hint: string) {
  const content: Anthropic.ContentBlockParam[] = [
    { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
    { type: 'text', text: hint ? `Nota da pessoa: ${hint}` : 'Estima esta refeição.' },
  ];
  const base = {
    model,
    max_tokens: 4000,
    system: SYSTEM,
    // esforço baixo: uma estimativa visual não precisa de raciocínio longo, e fica mais barata e rápida
    output_config: { effort: 'low' as const, format: { type: 'json_schema' as const, schema: SCHEMA } },
    messages: [{ role: 'user' as const, content }],
  };
  try {
    return await client.beta.messages.create({ ...base, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } as never) as unknown as Anthropic.Message;
  } catch (err) {
    if (!(err instanceof Anthropic.BadRequestError)) throw err;
    return await client.messages.create(base as never) as unknown as Anthropic.Message;
  }
}
