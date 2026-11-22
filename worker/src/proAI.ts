/**
 * NEFESH Life Pro com IA:
 * - ditado: o profissional fala/escreve o treino ("no treino A quero agachamento búlgaro 4 de 10…")
 *   e a IA transforma-o no plano (treinos, exercícios, séries, repetições, carga, descanso, notas);
 * - revisão: no fim, observações técnicas e notas sugeridas por exercício, que o profissional aceita ou não.
 * A decisão é sempre do profissional: a IA só propõe.
 */
import Anthropic from '@anthropic-ai/sdk';
import { LIBRARY } from '../../src/domain/proLibrary';
import { check, count, type CounterStore, type Limits } from './limits';
import { cleanPlan } from './pro';
import { MEASURE_KEYS, cleanProfile } from '../../src/domain/proProfile';

export const DICTATE_LIMITS: Limits = { device: 80, ip: 200, global: 4000 };
export const REVIEW_LIMITS: Limits = { device: 30, ip: 100, global: 2000 };

const EX = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    sets: { type: 'integer' },
    reps: { type: 'string' },
    load: { type: 'string' },
    rest: { type: 'string' },
    notes: { type: 'string' },
  },
  required: ['name', 'sets', 'reps', 'load', 'rest', 'notes'],
  additionalProperties: false,
} as const;

const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    workouts: {
      type: 'array',
      items: {
        type: 'object',
        properties: { name: { type: 'string' }, focus: { type: 'string' }, day: { type: 'string' }, exercises: { type: 'array', items: EX } },
        required: ['name', 'focus', 'day', 'exercises'],
        additionalProperties: false,
      },
    },
    per_week: { type: 'integer' },
    notes: { type: 'string' },
    summary: { type: 'string', description: 'uma frase curta com o que foi mudado' },
    doubts: { type: 'string', description: 'o que não ficou claro no ditado (vazio se nada)' },
  },
  required: ['workouts', 'per_week', 'notes', 'summary', 'doubts'],
  additionalProperties: false,
} as const;

const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    general: { type: 'array', items: { type: 'string' }, description: '2 a 5 observações técnicas sobre o plano no seu todo' },
    notes: {
      type: 'array',
      items: {
        type: 'object',
        properties: { workout: { type: 'integer' }, exercise: { type: 'integer' }, note: { type: 'string' } },
        required: ['workout', 'exercise', 'note'],
        additionalProperties: false,
      },
      description: 'nota técnica curta para o aluno, por exercício (índices a contar de 0)',
    },
  },
  required: ['general', 'notes'],
  additionalProperties: false,
} as const;

const NAMES = LIBRARY.map((e) => e.name).join('; ');

export const DICTATE_SYSTEM = `Ajudas um profissional de educação física a montar o treino de um aluno na app NEFESH Life Pro.
Recebes o plano atual (JSON) e o que o profissional ditou por voz (pode ter erros de transcrição, hesitações e repetições).
Devolves o plano COMPLETO atualizado:
- Aplica só o que foi pedido; mantém tudo o resto exatamente como está (inclusive a ordem).
- "Treino A", "treino B"… referem-se aos treinos pela ordem; se pedir um treino que ainda não existe, cria-o com o nome "Treino X". Se disser a divisão ("ABC", "3 treinos"), cria esses treinos.
- Junta os exercícios ao fim do treino indicado, pela ordem em que foram ditos. "Tira", "remove", "troca" mudam o que já existe.
- Usa, quando corresponder, o nome desta lista (corrige a transcrição: "extensora" → "Cadeira extensora", "búlgaro" → "Agachamento búlgaro"): ${NAMES}. Se não houver correspondência, escreve o nome como o profissional disse, com maiúscula inicial.
- "4 de 10", "4 por 10", "4x10" = 4 séries de 10 repetições. Sem séries/repetições ditas: usa 3 séries e "12" (ou "8-10" nos exercícios compostos pesados). Descanso por omissão "60 s" (compostos "90 s"); "1 minuto" = "60 s". Carga só se for dita ("20 quilos" = "20 kg").
- As observações para o aluno vão em "notes" desse exercício, reescritas de forma curta e clara, dirigidas ao aluno (ex.: "Desça devagar, 3 s na descida").
- Observações gerais (aquecimento, frequência) vão em "notes" do plano; "per_week" se disser quantas vezes por semana.
- Não inventes exercícios nem notas que não foram ditos.
- "doubts": o que ficou ambíguo (ex.: não disse em que treino) — nesse caso usa o treino que estiver a ser montado (indicado no pedido).
- Português, como o profissional falou (pt-BR ou pt-PT).`;

export const REVIEW_SYSTEM = `És um revisor técnico para um profissional de educação física na app NEFESH Life Pro.
Recebes um plano de treino e, se houver, o objetivo/nível do aluno. Dás:
- "general": 2 a 5 observações técnicas curtas e úteis para o PROFISSIONAL (equilíbrio entre grupos musculares e entre empurrar/puxar, volume por grupo, ordem dos exercícios (compostos antes de isolados), descansos, progressão, aquecimento, risco de sobreposição em dias seguidos). Concretas, sem repetir o óbvio, sem elogios vazios.
- "notes": para cada exercício SEM nota, uma nota curta para o ALUNO (até ~15 palavras) com a dica técnica principal de execução/segurança. Não escrevas notas para exercícios que já têm.
Regras: não fazes diagnósticos, não falas de doenças nem de suplementos; linguagem profissional e respeitosa; a decisão é do profissional. Português do Brasil ou de Portugal, conforme o texto do plano.`;

type Plan = ReturnType<typeof cleanPlan>;

async function ask<T>(client: Anthropic, model: string, system: string, user: string, schema: unknown, effort: 'low' | 'medium'): Promise<T | null> {
  const response = await client.beta.messages.create({
    model,
    max_tokens: 12000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system,
    output_config: { effort, format: { type: 'json_schema', schema: schema as never } },
    messages: [{ role: 'user', content: user }],
  });
  if (response.stop_reason === 'refusal') return null;
  const text = response.content.find((b) => b.type === 'text');
  if (!text || text.type !== 'text') return null;
  return JSON.parse(text.text) as T;
}

type R = { status: number; body: Record<string, unknown> };

/** Ditado → plano completo. */
export async function dictate(client: Anthropic, model: string, store: CounterStore, uid: string, ip: string, b: Record<string, unknown>): Promise<R> {
  const text = String(b.text ?? '').trim().slice(0, 4000);
  if (text.length < 3) return { status: 400, body: { error: 'Diga ou escreva o que quer no treino.' } };
  const allowed = await check(store, DICTATE_LIMITS, uid, ip, new Date(), 'pd');
  if (!allowed.ok) return { status: 429, body: { error: 'Chegou ao limite de pedidos à IA por hoje. Continue à mão ou tente amanhã.' } };
  const plan = cleanPlan(b.plan);
  // os treinos vazios também contam (a divisão já escolhida)
  const raw = (b.plan as { workouts?: { name?: string; focus?: string }[] } | undefined)?.workouts ?? [];
  const shape = raw.slice(0, 10).map((w, i) => plan.workouts.find((x) => x.name === w.name) ?? { name: String(w.name ?? `Treino ${String.fromCharCode(65 + i)}`), focus: String(w.focus ?? ''), day: '', exercises: [] });
  const current = Math.max(0, Math.min(shape.length - 1, Number(b.current) || 0));
  const stage = b.stage === 'estrutura' ? 'estrutura' : b.stage === 'treino' && shape.length ? 'treino' : 'livre';
  const target = shape[current]?.name ?? 'Treino A';
  const step =
    stage === 'estrutura'
      ? `ETAPA 1 — ESTRUTURA. Só defines os treinos: quantos (Treino A, Treino B…), o foco de cada um (ex.: "Inferior", "Peito e tríceps"), "per_week" (quantos dias por semana) e o dia de cada treino se for dito. NÃO juntes exercícios nesta etapa; mantém os exercícios que já existam nos treinos que continuam. Se disser só os dias por semana sem a divisão, cria uma divisão adequada (ex.: 3 dias → ABC) com focos clássicos, tendo em conta o nível e o objetivo do aluno.`
      : stage === 'treino'
        ? `ETAPA 2 — EXERCÍCIOS do ${target}${shape[current]?.focus ? ` (foco: ${shape[current].focus})` : ''}. Tudo o que foi ditado é para o ${target}, mesmo que não diga o nome. Não mudes os outros treinos.`
        : `Treino que está a ser montado agora: ${target}`;
  const about = String(b.about ?? '').trim().slice(0, 600);
  const user = `${about ? `Sobre o aluno (perfil registado pelo profissional; usa-o para escolhas por omissão, sem contrariar o que foi ditado): ${about}\n\n` : ''}Plano atual:\n${JSON.stringify({ ...plan, workouts: shape })}\n\n${step}\n\nO que o profissional ditou:\n"""${text}"""`;
  const r = await ask<Plan & { summary: string; doubts: string }>(client, model, DICTATE_SYSTEM, user, PLAN_SCHEMA, 'medium');
  if (!r) return { status: 502, body: { error: 'A IA não conseguiu montar. Tente dizer de outra forma.' } };
  await count(store, DICTATE_LIMITS, uid, ip, new Date(), 'pd');
  const out = cleanPlan({ ...r, professional: plan.professional });
  // mantém treinos vazios que a IA devolveu (divisão escolhida, ainda por preencher)
  const all = r.workouts.slice(0, 10).map((w) => out.workouts.find((x) => x.name === w.name) ?? { name: String(w.name).slice(0, 60) || 'Treino', focus: String(w.focus ?? '').slice(0, 80), day: String(w.day ?? '').slice(0, 30), exercises: [] });
  // a IA não vê nem devolve os vídeos: ficam os que o profissional já tinha posto (pelo nome do exercício)
  const videos = new Map<string, string>();
  for (const w of shape) for (const e of w.exercises) if ((e as { video?: string }).video) videos.set(e.name.toLowerCase(), (e as { video?: string }).video!);
  for (const w of all) w.exercises = w.exercises.map((e) => (videos.get(e.name.toLowerCase()) ? { ...e, video: videos.get(e.name.toLowerCase()) } : e));
  let workouts = all;
  let per_week = out.per_week;
  let notes = out.notes;
  if (stage === 'treino') {
    // só o treino desta etapa muda; o resto fica exatamente como estava
    const mine = all.find((w) => w.name === target) ?? all[current];
    workouts = shape.map((w, k) => (k === current && mine ? { ...mine, name: w.name } : w));
    per_week = plan.per_week;
    notes = r.notes ? out.notes : plan.notes;
  } else if (stage === 'estrutura') {
    // sem exercícios novos: os treinos que já existiam guardam os seus
    workouts = all.map((w, k) => ({ ...w, exercises: (shape.find((x) => x.name === w.name) ?? shape[k])?.exercises ?? [] }));
  }
  return { status: 200, body: { plan: { ...out, per_week, notes, workouts }, summary: String(r.summary ?? '').slice(0, 300), doubts: String(r.doubts ?? '').slice(0, 300) } };
}

/** Revisão técnica: observações gerais + notas por exercício. */
export async function review(client: Anthropic, model: string, store: CounterStore, uid: string, ip: string, b: Record<string, unknown>): Promise<R> {
  const plan = cleanPlan(b.plan);
  if (!plan.workouts.length) return { status: 400, body: { error: 'Junte exercícios antes de pedir a revisão.' } };
  const allowed = await check(store, REVIEW_LIMITS, uid, ip, new Date(), 'pr');
  if (!allowed.ok) return { status: 429, body: { error: 'Chegou ao limite de revisões por hoje. Tente amanhã.' } };
  const about = String(b.about ?? '').trim().slice(0, 600);
  const user = `${about ? `Sobre o aluno: ${about}\n\n` : ''}Plano:\n${JSON.stringify(plan.workouts.map((w, i) => ({ i, name: w.name, focus: w.focus, exercises: w.exercises.map((e, k) => ({ k, ...e })) })))}\nObservações gerais do plano: ${plan.notes || '—'}; treinos por semana: ${plan.per_week}`;
  const r = await ask<{ general: string[]; notes: { workout: number; exercise: number; note: string }[] }>(client, model, REVIEW_SYSTEM, user, REVIEW_SCHEMA, 'medium');
  if (!r) return { status: 502, body: { error: 'A IA não conseguiu rever agora. Tente outra vez.' } };
  await count(store, REVIEW_LIMITS, uid, ip, new Date(), 'pr');
  const notes = (r.notes ?? [])
    .filter((n) => plan.workouts[n.workout]?.exercises[n.exercise] && String(n.note ?? '').trim())
    .map((n) => ({ workout: plan.workouts[n.workout].name, exercise: n.exercise, name: plan.workouts[n.workout].exercises[n.exercise].name, note: String(n.note).trim().slice(0, 240) }));
  return { status: 200, body: { general: (r.general ?? []).map((g) => String(g).trim().slice(0, 400)).filter(Boolean).slice(0, 6), notes } };
}

/* ───────── avaliação física (PDF ou foto) → medidas do perfil ───────── */

export const ASSESS_LIMITS: Limits = { device: 20, ip: 60, global: 800 };
const MAX_FILE_CHARS = 8_000_000;
const n = { type: 'number', description: '-1 se não aparecer' } as const;
const ASSESS_SCHEMA = {
  type: 'object',
  properties: {
    is_assessment: { type: 'boolean', description: 'true se o documento tem dados de uma avaliação física/antropométrica' },
    sexo: { type: 'string', enum: ['f', 'm', ''] },
    idade: n, altura_cm: n, peso_kg: n, gordura_pct: n, massa_magra_kg: n, fc_repouso: n,
    data: { type: 'string', description: 'data da avaliação AAAA-MM-DD; "" se não aparecer' },
    ...Object.fromEntries(MEASURE_KEYS.map((k) => [k, n])),
  },
  required: ['is_assessment', 'sexo', 'idade', 'altura_cm', 'peso_kg', 'gordura_pct', 'massa_magra_kg', 'fc_repouso', 'data', ...MEASURE_KEYS],
  additionalProperties: false,
} as const;

export const ASSESS_SYSTEM = `Transcreves avaliações físicas (antropometria, bioimpedância, fichas de academia; Portugal e Brasil) para o perfil do aluno.
- Perímetros em centímetros: pescoço, ombros, peito/tórax, cintura, abdómen, quadril (anca), braço direito/esquerdo (se só houver um, usa-o em braco_d; "braço relaxado" ou "contraído": prefere relaxado), antebraço, coxa direita/esquerda (se só houver uma, coxa_d; prefere coxa medial/média), panturrilha.
- % de gordura, massa magra (kg), FC em repouso, peso (kg), altura (cm; se estiver em metros multiplica por 100), idade, sexo, data.
- Se houver várias avaliações, usa a mais recente. Converte vírgulas decimais. Não inventes valores: -1 quando não aparecer. Não interpretes nem comentes.`;

export async function readAssessment(client: Anthropic, model: string, store: CounterStore, uid: string, ip: string, b: Record<string, unknown>): Promise<R> {
  const data = String(b.file ?? '');
  const media = String(b.media_type ?? '');
  if (!data || data.length > MAX_FILE_CHARS || !/^[A-Za-z0-9+/=]+$/.test(data)) return { status: 400, body: { error: 'Ficheiro inválido ou demasiado grande (máximo 6 MB).' } };
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (media === 'application/pdf') content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } });
  else if (['image/jpeg', 'image/png', 'image/webp'].includes(media)) content.push({ type: 'image', source: { type: 'base64', media_type: media as 'image/jpeg', data } });
  else return { status: 400, body: { error: 'Use um PDF ou uma fotografia.' } };
  const allowed = await check(store, ASSESS_LIMITS, uid, ip, new Date(), 'pa');
  if (!allowed.ok) return { status: 429, body: { error: 'Chegou ao limite de leituras de hoje. Tente amanhã.' } };
  content.push({ type: 'text', text: 'Transcreve os dados desta avaliação física.' });
  const response = await client.beta.messages.create({
    model,
    max_tokens: 4000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: ASSESS_SYSTEM,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: ASSESS_SCHEMA as never } },
    messages: [{ role: 'user', content }],
  });
  if (response.stop_reason === 'refusal') return { status: 422, body: { error: 'Não foi possível ler este documento.' } };
  const text = response.content.find((x) => x.type === 'text');
  if (!text || text.type !== 'text') return { status: 502, body: { error: 'resposta vazia' } };
  const r = JSON.parse(text.text) as Record<string, number | string | boolean>;
  await count(store, ASSESS_LIMITS, uid, ip, new Date(), 'pa');
  if (!r.is_assessment) return { status: 200, body: { found: false } };
  const v = (k: string) => (typeof r[k] === 'number' && (r[k] as number) >= 0 ? r[k] : null);
  // passa pelas mesmas regras do perfil (limites e arredondamentos)
  const profile = cleanProfile({
    sexo: r.sexo, idade: v('idade'), altura: v('altura_cm'), peso: v('peso_kg'), gordura: v('gordura_pct'), magra: v('massa_magra_kg'), fc: v('fc_repouso'), dataAval: r.data,
    medidas: Object.fromEntries(MEASURE_KEYS.map((k) => [k, v(k)])),
  });
  return { status: 200, body: { found: true, profile } };
}
