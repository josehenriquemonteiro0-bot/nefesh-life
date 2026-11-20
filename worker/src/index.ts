/**
 * NEFESH Foto: estima os alimentos e as calorias de uma fotografia de refeição.
 *
 * A app envia { image (base64 JPEG), code, hint? }. O Worker guarda a chave da
 * Anthropic (nunca vai para a app) e só responde a quem tiver o código de acesso.
 *
 * Variáveis (Cloudflare → Worker → Settings → Variables):
 *   ANTHROPIC_API_KEY  segredo - chave da Anthropic
 *   ACCESS_CODE        segredo - código que os testadores escrevem na app
 *   ALLOWED_ORIGIN     opcional - origem da app (ex.: https://josehenriquemonteiro0-bot.github.io)
 *   MODEL              opcional - modelo (por omissão claude-opus-5-5; claude-haiku-5-5 é mais barato)
 */
import Anthropic from '@anthropic-ai/sdk';

export interface Env {
  ANTHROPIC_API_KEY: string;
  ACCESS_CODE: string;
  ALLOWED_ORIGIN?: string;
  MODEL?: string;
}

/** Tamanho máximo da imagem em base64 (~1,5 MB): a app já envia fotos reduzidas a 1024 px. */
const MAX_IMAGE_CHARS = 2_000_000;

const SCHEMA = {
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
  },
  required: ['is_food', 'items', 'note'],
  additionalProperties: false,
} as const;

const SYSTEM = `És o assistente nutricional da app NEFESH Life. Recebes a fotografia de uma refeição e estimas o que está no prato.

Para cada alimento visível, indica o nome em português de Portugal, o peso aproximado da porção em gramas e os valores dessa porção: calorias, proteína, hidratos de carbono e gordura. Usa valores médios de tabelas de composição de alimentos e tem em conta o modo de confeção que se vê (frito, grelhado, cozido) e molhos ou azeite visíveis.

Usa referências na imagem para estimar tamanhos: o prato (normalmente 26 a 28 cm), talheres, copos, mãos. Agrupa ingredientes que não se distinguem num só item (ex.: "salada mista"). Indica a confiança de cada item: alta, media ou baixa.

Se a pessoa juntar uma nota de texto, usa-a para corrigir a tua leitura (ex.: "o arroz é integral", "comi metade").

Se a imagem não mostrar comida nem bebida, responde com is_food false e items vazio.

A nota final é uma frase curta e útil para a pessoa (ex.: o que pesou mais na estimativa, ou o que conferir). Não faças juízos sobre a alimentação nem conselhos médicos.`;

function cors(env: Env, origin: string | null): Record<string, string> {
  const allowed = env.ALLOWED_ORIGIN?.trim();
  const ok = !allowed || origin === allowed;
  return {
    'Access-Control-Allow-Origin': ok ? origin ?? '*' : allowed!,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' } });
}

/** Comparação em tempo constante, para não revelar o código pela duração da resposta. */
function sameCode(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const h = cors(env, req.headers.get('Origin'));
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    if (req.method === 'GET') return json({ ok: true, service: 'nefesh-foto' }, 200, h);
    if (req.method !== 'POST') return json({ error: 'method' }, 405, h);

    let body: { image?: string; media_type?: string; code?: string; hint?: string };
    try {
      body = await req.json();
    } catch {
      return json({ error: 'pedido inválido' }, 400, h);
    }
    if (!env.ACCESS_CODE || !sameCode(String(body.code ?? '').trim(), env.ACCESS_CODE.trim())) {
      return json({ error: 'código de acesso inválido' }, 401, h);
    }
    const image = String(body.image ?? '');
    if (!image || image.length > MAX_IMAGE_CHARS || !/^[A-Za-z0-9+/=]+$/.test(image)) {
      return json({ error: 'imagem inválida ou demasiado grande' }, 400, h);
    }
    const mediaType = body.media_type === 'image/png' ? 'image/png' : body.media_type === 'image/webp' ? 'image/webp' : 'image/jpeg';
    const hint = String(body.hint ?? '').slice(0, 300).trim();

    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    try {
      const response = await client.beta.messages.create({
        model: env.MODEL?.trim() || 'claude-opus-5-5',
        max_tokens: 4000,
        // se o modelo recusar o pedido, a API repete-o num modelo de recurso
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: SYSTEM,
        // esforço baixo: uma estimativa visual não precisa de raciocínio longo, e fica mais barata e rápida
        output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
              { type: 'text', text: hint ? `Nota da pessoa: ${hint}` : 'Estima esta refeição.' },
            ],
          },
        ],
      });

      if (response.stop_reason === 'refusal') return json({ error: 'Não foi possível analisar esta imagem.' }, 422, h);
      if (response.stop_reason === 'max_tokens') return json({ error: 'A resposta ficou incompleta. Tente outra vez.' }, 502, h);
      const text = response.content.find((b) => b.type === 'text');
      if (!text || text.type !== 'text') return json({ error: 'resposta vazia' }, 502, h);
      const result = JSON.parse(text.text);
      return json({ ...result, model: response.model, usage: { input: response.usage.input_tokens, output: response.usage.output_tokens } }, 200, h);
    } catch (err) {
      if (err instanceof Anthropic.AuthenticationError) return json({ error: 'chave da Anthropic inválida no servidor' }, 500, h);
      if (err instanceof Anthropic.RateLimitError) return json({ error: 'Muitos pedidos. Tente daqui a um minuto.' }, 429, h);
      if (err instanceof Anthropic.BadRequestError) return json({ error: 'A imagem não pôde ser lida.' }, 400, h);
      if (err instanceof Anthropic.APIError) return json({ error: `serviço indisponível (${err.status})` }, 502, h);
      if (err instanceof SyntaxError) return json({ error: 'resposta inválida' }, 502, h);
      return json({ error: 'erro inesperado' }, 500, h);
    }
  },
};
