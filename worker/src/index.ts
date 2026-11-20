/**
 * NEFESH Foto: estima os alimentos e as calorias de uma fotografia de refeição.
 *
 * A app envia { image (base64 JPEG), device, hint? }. O Worker guarda a chave da
 * Anthropic (nunca vai para a app) e aplica limites diários de fotos.
 *
 * Variáveis (wrangler.toml e segredos):
 *   ANTHROPIC_API_KEY  segredo - chave da Anthropic
 *   LIMITS             KV - contadores diários
 *   DAILY_LIMIT        fotos por telemóvel por dia (15)
 *   IP_LIMIT           fotos por rede por dia (45)
 *   GLOBAL_LIMIT       fotos no total por dia (200)
 *   ALLOWED_ORIGIN     opcional - origem da app (ex.: https://josehenriquemonteiro0-bot.github.io)
 *   MODEL              opcional - modelo (por omissão claude-opus-5-5; claude-haiku-5-5 é mais barato)
 *   STATS_KEY          segredo opcional - chave da página de estatísticas (/stats?key=...)
 */
import Anthropic from '@anthropic-ai/sdk';
import { LIMIT_MESSAGES, check, cleanDeviceId, count, dayKey, type Limits } from './limits';
import { handlePlan, type PlanBody } from './plan';
import { handleTip } from './tips';
import { savePing, statsPage, summarize } from './stats';
import { deleteAccount, getData, healthKey, healthPull, healthPush, login, logout, recover, register, saveData, type Result } from './account';

/** Tentativas falhadas de entrar e contas novas, por dia. */
const LOGIN_LIMITS = { device: 20, ip: 40, global: 5000 };
const SIGNUP_LIMITS = { device: 5, ip: 10, global: 500 };

export interface Env {
  ANTHROPIC_API_KEY: string;
  LIMITS: KVNamespace;
  DAILY_LIMIT?: string;
  IP_LIMIT?: string;
  GLOBAL_LIMIT?: string;
  ALLOWED_ORIGIN?: string;
  MODEL?: string;
  /** segredo opcional que protege a página /stats */
  STATS_KEY?: string;
}

const num = (v: string | undefined, def: number) => (v !== undefined && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : def);
const limitsOf = (env: Env): Limits => ({
  device: num(env.DAILY_LIMIT, 15),
  ip: num(env.IP_LIMIT, 45),
  global: num(env.GLOBAL_LIMIT, 200),
});

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

function apiError(err: unknown, h: Record<string, string>) {
  if (err instanceof Anthropic.AuthenticationError) return json({ error: 'chave da Anthropic inválida no servidor' }, 500, h);
  if (err instanceof Anthropic.RateLimitError) return json({ error: 'Muitos pedidos. Tente daqui a um minuto.' }, 429, h);
  if (err instanceof Anthropic.BadRequestError) return json({ error: 'O ficheiro não pôde ser lido.' }, 400, h);
  if (err instanceof Anthropic.APIError) return json({ error: `serviço indisponível (${err.status})` }, 502, h);
  if (err instanceof SyntaxError) return json({ error: 'resposta inválida' }, 502, h);
  return json({ error: 'erro inesperado' }, 500, h);
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const h = cors(env, req.headers.get('Origin'));
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    const url = new URL(req.url);
    if (req.method === 'GET' && url.pathname === '/stats') {
      const key = env.STATS_KEY?.trim();
      if (key && url.searchParams.get('key') !== key) return new Response('Acesso reservado.', { status: 403, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      const html = statsPage(await summarize(env.LIMITS as never));
      return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
    }
    if (req.method === 'GET') return json({ ok: true, service: 'nefesh-foto' }, 200, h);
    if (req.method !== 'POST') return json({ error: 'method' }, 405, h);

    // atalho do iPhone: envia passos, sono e minutos de exercício do app Saúde
    if (url.pathname === '/saude' && req.method === 'POST') {
      let b: Record<string, unknown>;
      try {
        b = await req.json();
      } catch {
        return json({ error: 'pedido inválido' }, 400, h);
      }
      const ipc = req.headers.get('CF-Connecting-IP') ?? 'sem-ip';
      const k = String(b.chave ?? '').slice(0, 24).replace(/[^0-9a-f]/gi, '') || 'sem-chave';
      const lim = { device: 48, ip: 200, global: 20000 };
      const ok = await check(env.LIMITS, lim, `hk-${k}`, ipc, new Date(), 'h');
      if (!ok.ok) return json({ error: 'Muitos envios hoje. Tente amanhã.' }, 429, h);
      const r = await healthPush(env.LIMITS as never, b, dayKey());
      if (r.status === 200) await count(env.LIMITS, lim, `hk-${k}`, ipc, new Date(), 'h');
      return json(r.body, r.status, h);
    }

    if (url.pathname.startsWith('/conta/')) {
      let b: Record<string, unknown>;
      try {
        b = await req.json();
      } catch {
        return json({ error: 'pedido inválido' }, 400, h);
      }
      const store = env.LIMITS as never;
      const dev = cleanDeviceId(b.device);
      const ipc = req.headers.get('CF-Connecting-IP') ?? 'sem-ip';
      const send = (r: Result) => json(r.body, r.status, h);
      const action = url.pathname.slice('/conta/'.length);
      if (action === 'registar') {
        const ok = await check(env.LIMITS, SIGNUP_LIMITS, dev, ipc, new Date(), 'r');
        if (!ok.ok) return json({ error: 'Foram criadas muitas contas a partir desta rede hoje. Tente amanhã.' }, 429, h);
        const r = await register(store, b.email, b.password);
        if (r.status === 200) await count(env.LIMITS, SIGNUP_LIMITS, dev, ipc, new Date(), 'r');
        return send(r);
      }
      if (action === 'entrar' || action === 'recuperar') {
        const ok = await check(env.LIMITS, LOGIN_LIMITS, dev, ipc, new Date(), 'l');
        if (!ok.ok) return json({ error: 'Demasiadas tentativas hoje. Tente amanhã.' }, 429, h);
        const r = action === 'entrar' ? await login(store, b.email, b.password) : await recover(store, b.email, b.code, b.password);
        if (r.status === 401) await count(env.LIMITS, LOGIN_LIMITS, dev, ipc, new Date(), 'l');
        return send(r);
      }
      if (action === 'sair') return send(await logout(store, b.token));
      if (action === 'dados') return send(await getData(store, b.token));
      if (action === 'guardar') return send(await saveData(store, b.token, b.data, b.updatedAt));
      if (action === 'saude-chave') return send(await healthKey(store, b.token, b.nova === true));
      if (action === 'saude-dados') return send(await healthPull(store, b.token));
      if (action === 'apagar') return send(await deleteAccount(store, b.token, b.email, b.password));
      return json({ error: 'rota desconhecida' }, 404, h);
    }

    let body: { image?: string; media_type?: string; device?: string; hint?: string; notes?: string } & PlanBody;
    try {
      body = await req.json();
    } catch {
      return json({ error: 'pedido inválido' }, 400, h);
    }
    const device = cleanDeviceId(body.device);
    const ip = req.headers.get('CF-Connecting-IP') ?? 'sem-ip';

    const path = url.pathname;
    if (path === '/evento') {
      await savePing(env.LIMITS as never, device, body as Record<string, unknown>);
      return new Response(null, { status: 204, headers: h });
    }
    // leitura do plano alimentar do nutricionista
    if (path === '/dica') {
      try {
        const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
        return await handleTip(body as { name?: string; notes?: string }, env.LIMITS, client, env.MODEL?.trim() || 'claude-opus-5-5', device, ip, (b, st) => json(b, st, h));
      } catch (err) {
        return apiError(err, h);
      }
    }
    if (path === '/plano' || path === '/treino') {
      try {
        const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
        return await handlePlan(body, env.LIMITS, client, env.MODEL?.trim() || 'claude-opus-5-5', device, ip, (b, st) => json(b, st, h), path === '/treino' ? 'treino' : 'nutri');
      } catch (err) {
        return apiError(err, h);
      }
    }

    const limits = limitsOf(env);
    const allowed = await check(env.LIMITS, limits, device, ip);
    if (!allowed.ok) return json({ error: LIMIT_MESSAGES[allowed.reason!], remaining: 0, limit: limits.device }, 429, h);
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
      // só conta as fotos analisadas com sucesso
      const remaining = await count(env.LIMITS, limits, device, ip);
      return json({ ...result, remaining, limit: limits.device, model: response.model, usage: { input: response.usage.input_tokens, output: response.usage.output_tokens } }, 200, h);
    } catch (err) {
      return apiError(err, h);
    }
  },
};
