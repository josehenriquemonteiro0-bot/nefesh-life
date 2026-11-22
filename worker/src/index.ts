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
import { coachLimits, handleCoach } from './coach';
import { handleVoice, type AiBinding } from './voice';
import { handleReport } from './report';
import { handleDocRead } from './docread';
import * as prize from './prize';
import { savePing, statsPage, summarize } from './stats';
import * as social from './social';
import * as push from './push';
import * as verify from './verify';
import { checkSpirulinaPhoto } from './spirulinaPhoto';
import { acceptShot, readHealthShot } from './healthShot';
import * as admin from './admin';
import * as proAI from './proAI';
import * as together from './together';
import * as photos from './photos';
import * as notify from './notify';
import * as pro from './pro';
import { deleteAccount, getData, sessionUser, setConsents, userIdForEmail, healthKey, healthPull, healthPush, login, logout, recover, register, saveData, type Result } from './account';
import { originAllowed } from './origin';
export { originAllowed };

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
  /** "true" na fase de teste (tudo aberto); "false" no lançamento */
  TEST_MODE?: string;
  /** "true" só no servidor de teste: profissionais aprovados sem passar pela página da equipa */
  PRO_AUTO_APPROVE?: string;
  /** endereço da app (para os links das mensagens) */
  APP_URL?: string;
  /** base de dados da comunidade (D1); opcional até estar criada */
  DB?: social.DB;
  /** Workers AI (voz → texto) */
  AI?: AiBinding;
}

/**
 * Segunda-feira a partir das 9h (Lisboa): fecha o ranking da semana anterior, gera os cupões
 * NEFESH15 e avisa os vencedores (notificação). Corre no agendamento de 15 em 15 minutos.
 */
export async function closePrizeWeek(db: social.DB, store: KVNamespace, now = new Date()) {
  const today = social.lisbonDay(now);
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Lisbon', hour: '2-digit', hourCycle: 'h23' }).format(now));
  if (social.weekOf(today) !== today || hour < 9) return null;
  const prev = social.weekOf(new Date(Date.parse(`${today}T12:00:00Z`) - 7 * 86400000).toISOString().slice(0, 10));
  const winners = await prize.closeWeek(db, prev, now);
  for (const w of winners ?? []) {
    await push
      .notifyUser(db, store as never, w.uid, { title: `🏆 Ficou em ${w.rank}.º lugar no ranking!`, body: `Ganhou um cupão de ${prize.PRIZE.percent}% na loja NEFESH. Veja-o na app (Perfil → Os meus benefícios).`, tag: 'nefesh-premio' }, fetch, now)
      .catch(() => 0);
  }
  return winners;
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
    is_screen_photo: { type: 'boolean', description: 'true se é uma foto de um ecrã, de uma imagem impressa ou de outra fotografia (e não do prato ao vivo)' },
  },
  required: ['is_food', 'items', 'note', 'is_screen_photo'],
  additionalProperties: false,
} as const;

const SYSTEM = `És o assistente nutricional da app NEFESH Life. Recebes a fotografia de uma refeição e estimas o que está no prato.

Para cada alimento visível, indica o nome em português de Portugal, o peso aproximado da porção em gramas e os valores dessa porção: calorias, proteína, hidratos de carbono e gordura. Usa valores médios de tabelas de composição de alimentos e tem em conta o modo de confeção que se vê (frito, grelhado, cozido) e molhos ou azeite visíveis.

Usa referências na imagem para estimar tamanhos: o prato (normalmente 26 a 28 cm), talheres, copos, mãos. Agrupa ingredientes que não se distinguem num só item (ex.: "salada mista"). Indica a confiança de cada item: alta, media ou baixa.

Se a pessoa juntar uma nota de texto, usa-a para corrigir a tua leitura (ex.: "o arroz é integral", "comi metade").

Se a imagem não mostrar comida nem bebida, responde com is_food false e items vazio.

A nota final é uma frase curta e útil para a pessoa (ex.: o que pesou mais na estimativa, ou o que conferir). Não faças juízos sobre a alimentação nem conselhos médicos.`;

/** ALLOWED_ORIGIN aceita uma lista separada por vírgulas e * como curinga (ex.: https://*nefesh-life-v2*.pages.dev). */
function cors(env: Env, origin: string | null): Record<string, string> {
  const ok = originAllowed(env.ALLOWED_ORIGIN, origin);
  const first = (env.ALLOWED_ORIGIN ?? '').split(',')[0]?.trim();
  return {
    'Access-Control-Allow-Origin': ok ? origin ?? '*' : first || '*',
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
  /** a cada 15 minutos: lembretes da toma e aviso de fim da liga */
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    if (!env.DB) return;
    ctx.waitUntil(push.runSchedule(env.DB, env.LIMITS));
    ctx.waitUntil(closePrizeWeek(env.DB, env.LIMITS));
  },

  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const h = cors(env, req.headers.get('Origin'));
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    const url = new URL(req.url);
    // página da equipa: códigos únicos de frasco (só com o segredo STATS_KEY configurado)
    if (url.pathname === '/admin/marketing' && req.method === 'POST') {
      const key = env.STATS_KEY?.trim();
      const f = await req.formData();
      const html = (body: string, status = 200) => new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
      if (!key || String(f.get('key') ?? '').trim() !== key) return html(admin.adminLogin(true), 403);
      const rows: { email: string; at: string }[] = [];
      let cursor: string | undefined;
      for (let i = 0; i < 20; i++) {
        const r = await env.LIMITS.list({ prefix: 'cs:', cursor, limit: 1000 });
        for (const k of r.keys) {
          const c = JSON.parse((await env.LIMITS.get(k.name)) ?? 'null') as { email?: string; marketing?: { on: boolean; at: string } } | null;
          if (c?.marketing?.on && c.email) rows.push({ email: c.email, at: c.marketing.at });
        }
        if (r.list_complete) break;
        cursor = r.cursor;
      }
      return html(admin.marketingPage(key, rows.sort((a, b) => b.at.localeCompare(a.at))));
    }
    if ((url.pathname === '/admin/profissionais' || url.pathname === '/admin/profissional') && req.method === 'POST') {
      const key = env.STATS_KEY?.trim();
      const html = (body: string, status = 200) => new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
      if (!key || !env.DB) return html('Página indisponível.', 403);
      const f = await req.formData();
      if (String(f.get('key') ?? '').trim() !== key) return html(admin.adminLogin(true), 403);
      if (url.pathname === '/admin/profissional') await pro.setProStatus(env.DB, String(f.get('uid') ?? ''), String(f.get('status') ?? ''));
      return html(admin.prosPage(key, await pro.proList(env.DB)));
    }
    if ((url.pathname === '/admin/premios' || url.pathname === '/admin/premio') && req.method === 'POST') {
      const key = env.STATS_KEY?.trim();
      const html = (body: string, status = 200) => new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
      if (!key || !env.DB) return html('Página indisponível.', 403);
      const f = await req.formData();
      if (String(f.get('key') ?? '').trim() !== key) return html(admin.adminLogin(true), 403);
      if (url.pathname === '/admin/premio') {
        const st = String(f.get('status') ?? '');
        if (st === 'enviado' || st === 'usado' || st === 'atribuido') await prize.setCouponStatus(env.DB, String(f.get('code') ?? ''), st);
      }
      return html(admin.prizesPage(key, await prize.couponList(env.DB), (r) => prize.prizeEmail(r.nick ?? '', r.rank, r.code, r.expires)));
    }
    if (url.pathname === '/admin' || url.pathname === '/admin/gerar') {
      const key = env.STATS_KEY?.trim();
      const html = (body: string, status = 200) => new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
      if (!key || !env.DB) return html('Página indisponível: falta configurar o segredo STATS_KEY.', 403);
      const same = (v: unknown) => typeof v === 'string' && v.trim() === key;
      if (req.method === 'POST') {
        const f = await req.formData();
        if (!same(f.get('key'))) return html(admin.adminLogin(true), 403);
        // entrada com a palavra-passe: mostra o formulário
        if (url.pathname === '/admin') return html(admin.adminForm(key));
        const r = await admin.generateCodes(env.DB, String(f.get('produto') ?? 'caps'), Number(f.get('quantidade')) || 1);
        return html(admin.adminResult(key, r.product, r.codes, String(f.get('nome') ?? '').slice(0, 60), String(f.get('telefone') ?? ''), String(f.get('email') ?? '').slice(0, 120), env.APP_URL?.trim() || undefined));
      }
      if (!same(url.searchParams.get('key'))) return html(admin.adminLogin(url.searchParams.has('key')));
      return html(admin.adminForm(key));
    }
    if (url.pathname === '/stats' && (req.method === 'GET' || req.method === 'POST')) {
      const key = env.STATS_KEY?.trim();
      const given = req.method === 'POST' ? String((await req.formData()).get('key') ?? '') : url.searchParams.get('key') ?? '';
      if (key && given.trim() !== key) {
        return new Response(admin.adminLogin(!!given).replace('action="/admin"', 'action="/stats"').replace('Códigos de frasco para enviar aos clientes.', 'Estatísticas da NEFESH Life.'), {
          status: given ? 403 : 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
        });
      }
      const community = env.DB ? await social.communityStats(env.DB).catch(() => null) : null;
      const html = statsPage(await summarize(env.LIMITS as never), community);
      return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
    }
    // fotos dos momentos (públicas para a comunidade durante 24 horas)
    if (req.method === 'GET' && url.pathname.startsWith('/foto/') && env.DB) {
      const bytes = await photos.photoBytes(env.DB, url.pathname.slice(6));
      if (!bytes) return new Response('Esta foto já não está disponível.', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      return new Response(bytes, { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=3600', 'X-Robots-Tag': 'noindex' } });
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

    if (url.pathname.startsWith('/push/')) {
      if (!env.DB) return json({ error: 'indisponível' }, 503, h);
      let b: Record<string, unknown>;
      try {
        b = await req.json();
      } catch {
        return json({ error: 'pedido inválido' }, 400, h);
      }
      const action = url.pathname.slice('/push/'.length);
      let r: { status: number; body: Record<string, unknown> };
      if (action === 'chave') r = { status: 200, body: { key: (await push.vapid(env.LIMITS)).pub } };
      else if (action === 'inscrever') r = await push.subscribe(env.DB, b, b.token ? await sessionUser(env.LIMITS as never, b.token) : null);
      else if (action === 'feito') r = await push.markDone(env.DB, b);
      else if (action === 'sair') r = await push.unsubscribe(env.DB, b);
      else if (action === 'mensagem') r = await push.pendingMessage(env.DB, b);
      else if (action === 'reposicao') r = await push.setStockEnd(env.DB, b);
      else if (action === 'medicacao') r = await push.setMedTimes(env.DB, b);
      else if (action === 'lembretes') r = await push.setReminders(env.DB, b);
      else r = { status: 404, body: { error: 'rota desconhecida' } };
      return json(r.body, r.status, h);
    }

    // NEFESH Life Pro: o profissional monta o treino; o aluno liga-se com um código
    if (url.pathname.startsWith('/pro/')) {
      if (!env.DB) return json({ error: 'Indisponível de momento. Tente mais tarde.' }, 503, h);
      let b: Record<string, unknown>;
      try {
        b = await req.json();
      } catch {
        return json({ error: 'pedido inválido' }, 400, h);
      }
      const db = env.DB;
      const action = url.pathname.slice('/pro/'.length);
      const uid = b.token ? await sessionUser(env.LIMITS as never, b.token) : null;
      // lado do aluno: com conta ou só com este telemóvel
      const student: Record<string, () => Promise<{ status: number; body: Record<string, unknown> }>> = {
        'aluno/ligar': () => pro.linkStudent(db, key!, b),
        'aluno/plano': () => pro.studentPlan(db, key!, b),
        'aluno/sair': () => pro.unlinkStudent(db, key!, b),
        'aluno/treino': () => pro.logWorkout(db, env.LIMITS as never, key!, b),
      };
      const key = pro.studentKey(uid, b.device);
      if (student[action]) {
        if (!key) return json({ error: 'pedido inválido' }, 400, h);
        const r = await student[action]();
        return json(r.body, r.status, h);
      }
      // lado do profissional: precisa de conta
      if (!uid) return json({ error: 'Entre na sua conta para usar o NEFESH Life Pro.' }, 401, h);
      const routes: Record<string, () => Promise<{ status: number; body: Record<string, unknown> }>> = {
        registar: () => pro.registerPro(db, uid, b, new Date(), env.PRO_AUTO_APPROVE === 'true'),
        estado: () => pro.proState(db, uid, new Date(), env.PRO_AUTO_APPROVE === 'true'),
        'aluno/novo': () => pro.newStudent(db, uid, b),
        'aluno/guardar': () => pro.savePlan(db, uid, b),
        'aluno/registos': () => pro.studentLogs(db, uid, b),
        'aluno/apagar': () => pro.removeStudent(db, uid, b),
        'aluno/perfil': () => pro.saveProfile(db, uid, b),
        'aluno/rascunho': () => pro.saveDraft(db, uid, b),
      };
      // IA no montador (ditado por voz e revisão técnica): só profissionais aprovados
      if (action === 'ia/ditado' || action === 'ia/rever' || action === 'ia/avaliacao') {
        if ((await pro.proOf(db, uid))?.status !== 'aprovado') return json({ error: 'Acesso de profissional ainda não aprovado.' }, 403, h);
        try {
          const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
          const model = env.MODEL?.trim() || 'claude-opus-5-5';
          const ipx = req.headers.get('CF-Connecting-IP') ?? 'sem-ip';
          const r = action === 'ia/ditado' ? await proAI.dictate(client, model, env.LIMITS, uid, ipx, b) : action === 'ia/rever' ? await proAI.review(client, model, env.LIMITS, uid, ipx, b) : await proAI.readAssessment(client, model, env.LIMITS, uid, ipx, b);
          return json(r.body, r.status, h);
        } catch (err) {
          return apiError(err, h);
        }
      }
      const fn = routes[action];
      if (!fn) return json({ error: 'pedido inválido' }, 404, h);
      const r = await fn();
      return json(r.body, r.status, h);
    }

    if (url.pathname.startsWith('/social/')) {
      if (!env.DB) return json({ error: 'A comunidade ainda está a ser preparada. Tente mais tarde.' }, 503, h);
      let b: Record<string, unknown>;
      try {
        b = await req.json();
      } catch {
        return json({ error: 'pedido inválido' }, 400, h);
      }
      const db = env.DB;
      const action = url.pathname.slice('/social/'.length);
      if (action === 'evolucao') {
        const r = await social.evolution(db);
        return json(r.body, r.status, h);
      }
      const uid = await sessionUser(env.LIMITS as never, b.token);
      if (!uid) return json({ error: 'A sessão terminou. Entre outra vez na sua conta.' }, 401, h);
      const routes: Record<string, () => Promise<{ status: number; body: Record<string, unknown> }>> = {
        estado: async () => {
          const r = await social.state(db, uid);
          if (r.status === 200) {
            const today = social.lisbonDay();
            Object.assign(r.body, await prize.prizeState(db, uid, social.weekOf(today), today).catch(() => ({})));
          }
          return r;
        },
        'cupao-visto': () => prize.couponSeen(db, uid),
        perfil: () => social.upsertProfile(db, uid, b),
        'perfil-foto': () => social.updateAvatar(db, uid, b.avatar),
        'notificacoes-comunidade': () => notify.setCommunityPush(db, uid, b.on),
        sincronizar: async () => {
          // dados do app Saúde recebidos pelo atalho contam como verificados
          const raw = await env.LIMITS.get(`hd:${uid}`);
          const notes: notify.Note[] = [];
          const r = await social.sync(db, uid, b as social.SyncBody, new Date(), raw ? JSON.parse(raw) : {}, notes);
          // e-mail da conta, para a equipa entregar o cupão (só se for mesmo desta conta)
          if (b.email && (await userIdForEmail(env.LIMITS as never, b.email)) === uid) await prize.saveContact(db, uid, String(b.email).trim().toLowerCase());
          if (notes.length) ctx.waitUntil(notify.sendNotes(db, env.LIMITS, notes));
          return r;
        },
        frasco: () => verify.registerBottle(db, uid, b.code, b.product),
        foto: async () => {
          const kind = String(b.kind);
          if (!(photos.PHOTO_KINDS as readonly string[]).includes(kind)) return { status: 400, body: { error: 'Momento desconhecido.' } };
          if (!photos.validImage(b.image)) return { status: 400, body: { error: 'Imagem inválida ou demasiado grande.' } };
          const lim = { device: 2, ip: 30, global: 2000 };
          const ipc = req.headers.get('CF-Connecting-IP') ?? 'sem-ip';
          if (!(await check(env.LIMITS, lim, uid, ipc, new Date(), 'f')).ok) return { status: 429, body: { error: 'Já partilhou 2 fotos hoje. Amanhã há mais!' } };
          if (!(await verify.newPhoto(db, uid, b.image))) return { status: 200, body: { ok: false, note: 'Esta foto já foi partilhada.' } };
          const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
          const m = await photos.moderate(client, env.MODEL?.trim() || 'claude-opus-5-5', b.image, kind);
          if (!m.safe || !m.fits) return { status: 200, body: { ok: false, note: m.safe ? `Esta foto não parece ser de ${kind === 'spirulina' ? 'Spirulina' : kind === 'treino' ? 'um treino' : 'comida'}. ${m.note}` : 'Esta foto não pode ser partilhada na comunidade.' } };
          await count(env.LIMITS, lim, uid, ipc, new Date(), 'f');
          const id = await photos.savePhoto(db, uid, b.image, kind, Math.round(Number(b.value) || 0));
          // avisa amigos e equipa (uma vez por dia por pessoa)
          const me = await social.getProfile(db, uid);
          const day = social.lisbonDay();
          const circle = await notify.circleOf(db, uid);
          ctx.waitUntil(notify.sendNotes(db, env.LIMITS, circle.map((to) => ({ to, once: `foto:${uid}:${day}:${to}`, msg: { title: `${me?.nick ?? 'Um amigo'} partilhou um momento 📸`, body: 'Veja nos Momentos de hoje, na Comunidade.', tag: 'nefesh-momento' } }))));
          return { status: 200, body: { ok: true, id, note: m.other_people ? 'Publicada. Lembre-se de pedir autorização a quem aparece na foto.' : 'Publicada nos Momentos de hoje durante 24 horas.' } };
        },
        'denunciar-foto': () => photos.report(db, uid, b.id),
        'apagar-foto': () => photos.deletePhoto(db, uid, b.id),
        'equipa-criar': () => together.createTeam(db, uid, b.name, new Date(), b.kind),
        convite: () => social.acceptInvite(db, uid, b.code, b.cid),
        'equipa-entrar': () => together.joinTeam(db, uid, b.code),
        'equipa-sair': () => together.leaveTeam(db, uid),
        momento: () => together.moment(db, uid, b.kind, b.value),
        'parceiro-convidar': async () => {
          const r = await together.invitePartner(db, uid, b.id);
          if (r.status === 200) {
            const me = await social.getProfile(db, uid);
            ctx.waitUntil(push.notifyUser(db, env.LIMITS, String(b.id), { title: 'Convite para parceiro de ritual 🌿', body: `${me?.nick ?? 'Um amigo'} quer fazer o ritual da Spirulina consigo. Abra a Comunidade para aceitar.`, tag: 'nefesh-parceiro' }));
          }
          return r;
        },
        'parceiro-aceitar': () => together.acceptPartner(db, uid),
        'parceiro-terminar': () => together.endPartner(db, uid),
        reagir: async () => {
          const { r, owner } = await together.react(db, uid, b.id, b.kind);
          if (owner) {
            const me = await social.getProfile(db, uid);
            ctx.waitUntil(push.notifyUser(db, env.LIMITS, owner, { title: `${me?.nick ?? 'Um amigo'} reagiu ${String(b.kind)}`, body: 'à sua conquista na NEFESH Life.', tag: 'nefesh-reacao' }));
          }
          return r;
        },
        responder: async () => {
          const { r, owner } = await together.reply(db, uid, b.id, b.kind);
          if (owner) {
            const me = await social.getProfile(db, uid);
            ctx.waitUntil(push.notifyUser(db, env.LIMITS, owner, { title: `${me?.nick ?? 'Um amigo'} respondeu`, body: together.REPLIES[String(b.kind)] ?? '', tag: 'nefesh-reacao' }));
          }
          return r;
        },
        'prova-saude': async () => {
          const image = String(b.image ?? '');
          if (!image || image.length > MAX_IMAGE_CHARS || !/^[A-Za-z0-9+/=]+$/.test(image)) return { status: 400, body: { error: 'imagem inválida' } };
          const lim = { device: 6, ip: 60, global: 3000 };
          const ipc = req.headers.get('CF-Connecting-IP') ?? 'sem-ip';
          if (!(await check(env.LIMITS, lim, uid, ipc, new Date(), 'k')).ok) return { status: 429, body: { error: 'Já enviou capturas suficientes hoje.' } };
          await count(env.LIMITS, lim, uid, ipc, new Date(), 'k');
          if (!(await verify.newPhoto(db, uid, image))) return { status: 200, body: { ok: false, note: 'Esta captura já foi usada. Tire uma captura nova.' } };
          const today = social.lisbonDay();
          const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
          const mt = b.media_type === 'image/png' ? 'image/png' : b.media_type === 'image/webp' ? 'image/webp' : 'image/jpeg';
          const shot = await readHealthShot(client, env.MODEL?.trim() || 'claude-opus-5-5', image, mt, today);
          const got = acceptShot(shot);
          if (!got) return { status: 200, body: { ok: false, note: shot.day === 'outro' ? 'Esta captura não é de hoje. Tire uma captura do dia de hoje.' : shot.looks_edited ? 'A captura parece editada, por isso não conta.' : shot.note } };
          // junta aos dados de saúde da conta (os mesmos do atalho do iPhone)
          const raw = await env.LIMITS.get(`hd:${uid}`);
          const all = (raw ? JSON.parse(raw) : {}) as Record<string, Record<string, unknown>>;
          all[today] = { ...all[today], ...got, at: new Date().toISOString(), src: 'captura' };
          const keep = Object.keys(all).sort().slice(-21);
          await env.LIMITS.put(`hd:${uid}`, JSON.stringify(Object.fromEntries(keep.map((k) => [k, all[k]]))));
          return { status: 200, body: { ok: true, date: today, ...got, note: shot.note } };
        },
        'prova-spirulina': async () => {
          const image = String(b.image ?? '');
          if (!image || image.length > MAX_IMAGE_CHARS || !/^[A-Za-z0-9+/=]+$/.test(image)) return { status: 400, body: { error: 'imagem inválida' } };
          const lim = { device: 4, ip: 40, global: 2000 };
          const ipc = req.headers.get('CF-Connecting-IP') ?? 'sem-ip';
          if (!(await check(env.LIMITS, lim, uid, ipc, new Date(), 'v')).ok) return { status: 429, body: { error: 'Já enviou fotos suficientes hoje.' } };
          await count(env.LIMITS, lim, uid, ipc, new Date(), 'v');
          if (!(await verify.newPhoto(db, uid, image))) return { status: 200, body: { ok: false, note: 'Esta foto já foi usada. Tire uma foto nova da sua Spirulina.' } };
          const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
          const mt = b.media_type === 'image/png' ? 'image/png' : b.media_type === 'image/webp' ? 'image/webp' : 'image/jpeg';
          const r = await checkSpirulinaPhoto(client, env.MODEL?.trim() || 'claude-opus-5-5', image, mt);
          const accepted = r.shows_spirulina && !r.is_screen_photo;
          if (accepted) await verify.addProof(db, uid, social.lisbonDay(), 'spirulina');
          return { status: 200, body: { ok: accepted, note: r.is_screen_photo ? 'Parece uma foto de um ecrã ou de uma imagem. Fotografe a sua Spirulina ao vivo.' : r.note } };
        },
        amigo: () => social.addFriend(db, uid, b.code),
        'remover-amigo': () => social.removeFriend(db, uid, b.id),
        mensagem: async () => {
          const r = await social.sendMessage(db, uid, b.to, b.kind);
          // avisa o amigo no telemóvel, mesmo com a app fechada
          if (r.status === 200) {
            const me = await social.getProfile(db, uid);
            ctx.waitUntil(push.notifyFriend(db, env.LIMITS, String(b.to), String(me?.nick ?? 'Um amigo'), String(b.kind)));
          }
          return r;
        },
        lidas: () => social.markSeen(db, uid),
        aplaudir: () => social.cheer(db, uid, b.id),
        'resultado-visto': () => social.clearResult(db, uid),
        desafio: () => social.createChallenge(db, uid, b.kind, b.friends),
        'sair-desafio': () => social.leaveChallenge(db, uid, b.id),
        sair: () => social.leave(db, uid),
      };
      const fn = routes[action];
      if (!fn) return json({ error: 'rota desconhecida' }, 404, h);
      const r = await fn();
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
      if (action === 'consentimentos') return send(await setConsents(store, b.token, b));
      if (action === 'apagar') {
        const uid = await sessionUser(store, b.token);
        const r = await deleteAccount(store, b.token, b.email, b.password);
        // apagar a conta também apaga a participação na comunidade
        if (r.status === 200 && uid && env.DB) await social.leave(env.DB, uid);
        return send(r);
      }
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
    // voz → texto (Coach no iPhone)
    if (path === '/voz') {
      try {
        return await handleVoice(body as Record<string, unknown>, env.AI, env.LIMITS, device, ip, (b, st) => json(b, st, h));
      } catch {
        return json({ error: 'Não foi possível perceber a gravação. Tente outra vez ou escreva.' }, 502, h);
      }
    }
    // tabela nutricional (produto fora da Open Food Facts) e boletins de análises
    if (path === '/rotulo' || path === '/analises') {
      try {
        const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
        return await handleDocRead(path === '/rotulo' ? 'rotulo' : 'analises', body as Record<string, unknown>, env.LIMITS, client, env.MODEL?.trim() || 'claude-opus-5-5', device, ip, (b, st) => json(b, st, h));
      } catch (err) {
        return apiError(err, h);
      }
    }
    // relatório semanal: o que a IA percebeu
    if (path === '/relatorio') {
      try {
        const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
        return await handleReport(body as Record<string, unknown>, env.LIMITS, client, env.MODEL?.trim() || 'claude-opus-5-5', device, ip, (b, st) => json(b, st, h));
      } catch (err) {
        return apiError(err, h);
      }
    }
    // AI Coach por texto
    if (path === '/coach') {
      try {
        const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
        return await handleCoach(body as Record<string, unknown>, env.LIMITS, coachLimits(env), client, env.MODEL?.trim() || 'claude-opus-5-5', device, ip, (b, st) => json(b, st, h));
      } catch (err) {
        return apiError(err, h);
      }
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
      // prova para os pontos: foto real de comida, nunca usada antes, de alguém com conta
      let verified = false;
      if (env.DB && result.is_food && !result.is_screen_photo) {
        const uid = await sessionUser(env.LIMITS as never, (body as { token?: string }).token);
        if (uid && (await verify.newPhoto(env.DB, uid, image))) {
          await verify.addProof(env.DB, uid, social.lisbonDay(), 'refeicao');
          verified = true;
        }
      }
      result.verified = verified;
      return json({ ...result, remaining, limit: limits.device, model: response.model, usage: { input: response.usage.input_tokens, output: response.usage.output_tokens } }, 200, h);
    } catch (err) {
      return apiError(err, h);
    }
  },
};
