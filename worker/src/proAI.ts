/**
 * NEFESH Life Pro com IA:
 * - ditado: o profissional fala/escreve o treino ("no treino A quero agachamento búlgaro 4 de 10…")
 *   e a IA transforma-o no plano (treinos, exercícios, séries, repetições, carga, descanso, notas);
 * - revisão: no fim, observações técnicas e notas sugeridas por exercício, que o profissional aceita ou não.
 * A decisão é sempre do profissional: a IA só propõe.
 */
import Anthropic from '@anthropic-ai/sdk';
import { LIBRARY, normalizeBookends } from '../../src/domain/proLibrary';
import { check, count, type CounterStore, type Limits } from './limits';
import { cleanPlan } from './pro';
import { MEASURE_KEYS, cleanProfile } from '../../src/domain/proProfile';
import { cleanNutri } from '../../src/domain/proNutri';
import { INTEG, INTEG_KEYS, cleanExam, cleanInteg } from '../../src/domain/proInteg';

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
    weeks: { type: 'integer', description: 'duração do plano em semanas, se for dita (ex.: "por 8 semanas"); 0 se não' },
    notes: { type: 'string' },
    summary: { type: 'string', description: 'uma frase curta com o que foi mudado' },
    doubts: { type: 'string', description: 'o que não ficou claro no ditado (vazio se nada)' },
  },
  required: ['workouts', 'per_week', 'weeks', 'notes', 'summary', 'doubts'],
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
- Início do treino — tudo o que é para fazer ANTES dos exercícios principais (aquecer, alongar, mobilidade, ativação, "começa com…", "primeiro…") é início do treino, mesmo que não diga a palavra aquecimento: aeróbico de aquecimento ("10 minutos de bicicleta no início", "aquecer 5 min na esteira"), mobilidade, alongamento dinâmico ou ativação ("começa com 5 minutos de mobilidade", "ativação de glúteos antes"): vai para o INÍCIO do treino, pela ordem aeróbico → mobilidade → ativação, com notes a começar por "Aquecimento" (ex.: "Aquecimento", "Aquecimento · mobilidade"). Com duração: sets 1, reps "10 min", rest "". Só um aeróbico de aquecimento por treino: um novo substitui o anterior. Nomes: "Mobilidade articular geral", "Alongamento dinâmico", "Ativação de glúteos (mini band)", "Ativação de core", "Série de aquecimento (carga leve)".
- Fim do treino: alongamento final, volta à calma, relaxamento ou aeróbico no fim ("15 minutos de esteira no fim", "terminar com alongamento"): vai para o FIM do treino, com sets 1, reps com a duração e notes a começar por "Final" (ex.: "Final · volta à calma", "Final · cardio"). Nomes: "Alongamento final (volta à calma)", "Relaxamento e respiração".
- Usa, quando corresponder, o nome desta lista (corrige a transcrição e os nomes do Brasil: "extensora" → "Cadeira extensora", "búlgaro" → "Agachamento búlgaro", "esteira" → "Passadeira / esteira (caminhada)", "elíptico" ou "transport" → "Elíptica / elíptico (transport)", "pulley" → "Puxada à frente", "avanço" → "Afundo (passada)"): ${NAMES}. Se não houver correspondência, escreve o nome como o profissional disse, com maiúscula inicial.
- "4 de 10", "4 por 10", "4x10" = 4 séries de 10 repetições. Sem séries/repetições ditas: usa 3 séries e "12" (ou "8-10" nos exercícios compostos pesados). Descanso por omissão "60 s" (compostos "90 s"); "1 minuto" = "60 s". Carga só se for dita ("20 quilos" = "20 kg").
- As observações para o aluno vão em "notes" desse exercício, reescritas de forma curta e clara, dirigidas ao aluno (ex.: "Desça devagar, 3 s na descida").
- Observações gerais (aquecimento, frequência) vão em "notes" do plano; "per_week" se disser quantas vezes por semana.
- Não inventes exercícios nem notas que não foram ditos.
- "doubts": o que ficou ambíguo (ex.: não disse em que treino) — nesse caso usa o treino que estiver a ser montado (indicado no pedido).
- Português, como o profissional falou (pt-BR ou pt-PT).`;

export const REVIEW_SYSTEM = `És um revisor técnico para um profissional de educação física na app NEFESH Life Pro.
Recebes um plano de treino e, se houver, o objetivo/nível do aluno. Dás:
- "general": 2 a 5 observações técnicas curtas e úteis para o PROFISSIONAL (equilíbrio entre grupos musculares e entre empurrar/puxar, volume por grupo, ordem dos exercícios (compostos antes de isolados), descansos, progressão e periodização (duração, fases, semana de descarga), aquecimento, risco de sobreposição em dias seguidos). Concretas, sem repetir o óbvio, sem elogios vazios.
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
      ? `ETAPA 1 — ESTRUTURA. Só defines os treinos: quantos (Treino A, Treino B…), o foco de cada um (ex.: "Inferior", "Peito e tríceps"), "per_week" (quantos dias por semana), "weeks" (duração do plano, se for dita) e o dia de cada treino se for dito. NÃO juntes exercícios nesta etapa, com UMA exceção: o início ou o fim dito para todos os treinos (ex.: "todos começam com 10 minutos de bicicleta e mobilidade", "todos terminam com alongamento") entra em cada treino, com as regras do início e do fim do treino. Mantém os exercícios que já existam nos treinos que continuam. Se disser só os dias por semana sem a divisão, cria uma divisão adequada (ex.: 3 dias → ABC) com focos clássicos, tendo em conta o nível e o objetivo do aluno.`
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
    // sem exercícios novos (os treinos que já existiam guardam os seus), exceto o aquecimento dito para todos
    workouts = all.map((w, k) => {
      const kept = (shape.find((x) => x.name === w.name) ?? shape[k])?.exercises ?? [];
      const isIntro = (e: { notes: string }) => /^aquecimento/i.test(e.notes.trim());
      const isEnd = (e: { notes: string }) => /^(final|cardio final|volta [àa] calma)/i.test(e.notes.trim());
      const intro = w.exercises.filter(isIntro), outro = w.exercises.filter(isEnd);
      if (!intro.length && !outro.length) return { ...w, exercises: kept };
      const body = kept.filter((e) => !(intro.length && isIntro(e)) && !(outro.length && isEnd(e)));
      return { ...w, exercises: [...(intro.length ? intro : kept.filter(isIntro)), ...body.filter((e) => !isIntro(e) && !isEnd(e)), ...(outro.length ? outro : kept.filter(isEnd))].slice(0, 20) };
    });
  }
  // início e fim do treino arrumados como no modo manual (ordem, duração, notas, sem descanso)
  workouts = workouts.map((w) => normalizeBookends(w as never) as typeof w);
  // periodização: duração só muda na etapa da estrutura (ou no modo livre) se for dita; início e fases ficam
  const weeks = stage !== 'treino' && Number(r.weeks) > 0 ? Math.min(52, Math.round(Number(r.weeks))) : plan.weeks;
  const period = { ...(weeks ? { weeks } : {}), ...(plan.start ? { start: plan.start } : {}), ...(plan.phases ? { phases: plan.phases } : {}) };
  const { weeks: _w, start: _s, phases: _p, ...base } = out; // eslint-disable-line @typescript-eslint/no-unused-vars
  return { status: 200, body: { plan: { ...base, ...period, per_week, notes, workouts }, summary: String(r.summary ?? '').slice(0, 300), doubts: String(r.doubts ?? '').slice(0, 300) } };
}

/** Revisão técnica: observações gerais + notas por exercício. */
export async function review(client: Anthropic, model: string, store: CounterStore, uid: string, ip: string, b: Record<string, unknown>): Promise<R> {
  const plan = cleanPlan(b.plan);
  if (!plan.workouts.length) return { status: 400, body: { error: 'Junte exercícios antes de pedir a revisão.' } };
  const allowed = await check(store, REVIEW_LIMITS, uid, ip, new Date(), 'pr');
  if (!allowed.ok) return { status: 429, body: { error: 'Chegou ao limite de revisões por hoje. Tente amanhã.' } };
  const about = String(b.about ?? '').trim().slice(0, 600);
  const user = `${about ? `Sobre o aluno: ${about}\n\n` : ''}Plano:\n${JSON.stringify(plan.workouts.map((w, i) => ({ i, name: w.name, focus: w.focus, exercises: w.exercises.map((e, k) => ({ k, ...e })) })))}\nObservações gerais do plano: ${plan.notes || '—'}; treinos por semana: ${plan.per_week}${plan.weeks ? `; duração: ${plan.weeks} semanas` : ''}${plan.phases?.length ? `; fases: ${plan.phases.map((f) => `${f.name} (${f.weeks} sem.)${f.notes ? `: ${f.notes}` : ''}`).join(' → ')}` : ''}`;
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

/* ───────── relatório de acompanhamento do próprio utilizador (nutricionista, médico, academia) ───────── */

export const REPORT_LIMITS: Limits = { device: 6, ip: 20, global: 600 };
const evalItem = {
  type: 'object',
  properties: {
    data: { type: 'string', description: 'data desta avaliação AAAA-MM-DD; "" se não aparecer' },
    altura_cm: n, peso_kg: n, gordura_pct: n, massa_magra_kg: n, fc_repouso: n,
    ...Object.fromEntries(MEASURE_KEYS.map((k) => [k, n])),
    outros: {
      type: 'array',
      description: 'todos os outros valores numéricos medidos nesta data que não cabem nos campos acima (ex.: dobras cutâneas, relação cintura/quadril, densidade corporal, massa gorda, massa residual, circunferência muscular do braço, gordura visceral, água corporal, massa óssea, idade metabólica, somatório de dobras)',
      items: {
        type: 'object',
        properties: {
          nome: { type: 'string', description: 'nome curto como no documento, ex.: "Dobra tricipital"' },
          valor: { type: 'number' },
          unidade: { type: 'string', description: 'ex.: mm, kg, %, g/mL; "" se não tiver' },
        },
        required: ['nome', 'valor', 'unidade'],
        additionalProperties: false,
      },
    },
  },
  required: ['data', 'altura_cm', 'peso_kg', 'gordura_pct', 'massa_magra_kg', 'fc_repouso', ...MEASURE_KEYS, 'outros'],
  additionalProperties: false,
} as const;
const REPORT_SCHEMA = {
  type: 'object',
  properties: {
    is_report: { type: 'boolean', description: 'true se o documento tem medidas corporais ou metas de um acompanhamento de saúde' },
    sexo: { type: 'string', enum: ['f', 'm', ''] },
    idade: n,
    profissional: { type: 'string', description: 'quem fez o acompanhamento (nome e/ou clínica e profissão); "" se não aparecer' },
    avaliacoes: { type: 'array', items: evalItem, description: 'uma por data/coluna, da mais antiga para a mais recente' },
    kcal_dia: { ...n, description: 'meta de calorias por dia prescrita; -1 se não houver' },
    proteina_g: { ...n, description: 'meta de proteína em g por dia prescrita; -1 se não houver' },
  },
  required: ['is_report', 'sexo', 'idade', 'profissional', 'avaliacoes', 'kcal_dia', 'proteina_g'],
  additionalProperties: false,
} as const;

export const REPORT_SYSTEM = `Transcreves relatórios de acompanhamento de saúde que a própria pessoa anexa (nutricionista, médico, academia, bioimpedância; Portugal e Brasil).
- Cada avaliação com data própria (ex.: colunas de um quadro de evolução) é um item de "avaliacoes", da mais antiga para a mais recente (no máximo 12).
- Perímetros em centímetros: pescoço, ombros, peito/tórax, cintura, abdómen, quadril (anca), braço direito/esquerdo (se só houver um, braco_d; prefere relaxado), antebraço, coxa direita/esquerda (se só houver uma, coxa_d), panturrilha.
- % de gordura, massa magra ou "massa livre de gordura" (kg), FC em repouso, peso (kg), altura (cm; em metros multiplica por 100).
- Bioimpedância (InBody, Tanita, Omron…): % de gordura (PGC) = gordura_pct; massa livre de gordura = massa_magra_kg. Massa muscular esquelética (SMM), massa de gordura, água corporal total, proteína, minerais, nível de gordura visceral, taxa metabólica basal (kcal), ângulo de fase, idade metabólica, pontuação InBody e a análise segmentar (massa magra de cada braço, perna e tronco) vão em "outros".
- Tudo o resto que for um número medido nessa data (dobras cutâneas, RCQ, densidade, massa gorda, massa residual, gordura visceral, água corporal…) vai em "outros", com o nome e a unidade do documento. Não repitas lá o que já tem campo próprio, nem o IMC (a app calcula-o), nem classificações em texto.
- Metas diárias (calorias, proteína) só se o profissional as prescreveu.
- Converte vírgulas decimais. Não inventes valores: -1 quando não aparecer. Não interpretes nem comentes. Ignora análises de sangue e outros dados que não estão no esquema.`;

export async function readHealthReport(client: Anthropic, model: string, store: CounterStore, key: string, ip: string, b: Record<string, unknown>): Promise<R> {
  const data = String(b.file ?? '');
  const media = String(b.media_type ?? '');
  if (!data || data.length > MAX_FILE_CHARS || !/^[A-Za-z0-9+/=]+$/.test(data)) return { status: 400, body: { error: 'Ficheiro inválido ou demasiado grande (máximo 6 MB).' } };
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (media === 'application/pdf') content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } });
  else if (['image/jpeg', 'image/png', 'image/webp'].includes(media)) content.push({ type: 'image', source: { type: 'base64', media_type: media as 'image/jpeg', data } });
  else return { status: 400, body: { error: 'Use um PDF ou uma fotografia.' } };
  const allowed = await check(store, REPORT_LIMITS, key, ip, new Date(), 'ur');
  if (!allowed.ok) return { status: 429, body: { error: 'Chegou ao limite de leituras de hoje. Tente amanhã.' } };
  content.push({ type: 'text', text: 'Transcreve as medidas e metas deste relatório.' });
  const response = await client.beta.messages.create({
    model,
    max_tokens: 8000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: REPORT_SYSTEM,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: REPORT_SCHEMA as never } },
    messages: [{ role: 'user', content }],
  });
  if (response.stop_reason === 'refusal') return { status: 422, body: { error: 'Não foi possível ler este documento.' } };
  const text = response.content.find((x) => x.type === 'text');
  if (!text || text.type !== 'text') return { status: 502, body: { error: 'resposta vazia' } };
  await count(store, REPORT_LIMITS, key, ip, new Date(), 'ur');
  return { status: 200, body: cleanReport(JSON.parse(text.text)) };
}

/** Passa a resposta da IA pelas regras do perfil (limites, arredondamentos) e ordena por data. */
export function cleanReport(r: Record<string, unknown>) {
  if (!r.is_report) return { found: false };
  const v = (o: Record<string, unknown>, k: string) => (typeof o[k] === 'number' && (o[k] as number) >= 0 ? o[k] : null);
  const evals = (Array.isArray(r.avaliacoes) ? r.avaliacoes : []).slice(0, 12).map((x) => {
    const o = x as Record<string, unknown>;
    const p = cleanProfile({
      altura: v(o, 'altura_cm'), peso: v(o, 'peso_kg'), gordura: v(o, 'gordura_pct'), magra: v(o, 'massa_magra_kg'), fc: v(o, 'fc_repouso'), dataAval: o.data,
      medidas: Object.fromEntries(MEASURE_KEYS.map((k) => [k, v(o, k)])),
    });
    return { date: p.dataAval, altura: p.altura, peso: p.peso, gordura: p.gordura, magra: p.magra, fc: p.fc, medidas: p.medidas, extra: cleanExtra(o.outros) };
  }).filter((e) => e.peso || e.gordura || e.magra || Object.keys(e.medidas ?? {}).length || e.extra.length)
    .sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
  const top = cleanProfile({ sexo: r.sexo, idade: v(r, 'idade') });
  const kcal = typeof r.kcal_dia === 'number' && r.kcal_dia >= 800 && r.kcal_dia <= 6000 ? Math.round(r.kcal_dia) : null;
  const protein = typeof r.proteina_g === 'number' && r.proteina_g >= 20 && r.proteina_g <= 400 ? Math.round(r.proteina_g) : null;
  return { found: evals.length > 0 || !!kcal, sexo: top.sexo, idade: top.idade, by: String(r.profissional ?? '').replace(/\s+/g, ' ').trim().slice(0, 80), evals, kcal, protein };
}

/** Outros dados do relatório (dobras, RCQ, densidade…): nome e unidade como no documento, sem repetir nomes. */
export function cleanExtra(v: unknown): { label: string; v: number; u: string }[] {
  const out: { label: string; v: number; u: string }[] = [];
  const seen = new Set<string>();
  for (const x of Array.isArray(v) ? v : []) {
    const o = (x ?? {}) as Record<string, unknown>;
    const label = String(o.nome ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
    const val = Number(o.valor);
    const key = label.toLowerCase();
    if (!label || !Number.isFinite(val) || val < 0 || val > 10000 || seen.has(key) || /^(imc|[ií]ndice de massa corporal)/i.test(label)) continue;
    seen.add(key);
    out.push({ label, v: Math.round(val * 1000) / 1000, u: String(o.unidade ?? '').trim().slice(0, 10) });
    if (out.length >= 30) break;
  }
  return out;
}

/* ───────── nutricionistas: ditado do plano alimentar e revisão ───────── */

const NUTRI_ITEM = {
  type: 'object',
  properties: {
    food: { type: 'string', description: 'nome do alimento como numa tabela de composição (ex.: "Arroz, integral, cozido", "Frango, peito, sem pele, grelhado", "Ovo, de galinha, inteiro, cozido")' },
    grams: { type: 'number', description: 'quantidade em gramas (ou ml)' },
    measure: { type: 'string', description: 'medida caseira dita (ex.: "4 colheres de sopa", "1 filé médio"); "" se não disse' },
    kcal: { type: 'number' }, p: { type: 'number' }, c: { type: 'number' }, f: { type: 'number' }, fib: { type: 'number' },
  },
  required: ['food', 'grams', 'measure', 'kcal', 'p', 'c', 'f', 'fib'],
  additionalProperties: false,
} as const;
const NUTRI_DICTATE_SCHEMA = {
  type: 'object',
  properties: {
    meals: {
      type: 'array',
      description: 'TODAS as refeições do dia depois do ditado (as que já existiam e não foram mudadas ficam iguais)',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string', enum: ['pa', 'lanche_m', 'almoco', 'lanche', 'jantar', 'ceia'] },
          label: { type: 'string' },
          time: { type: 'string', description: 'HH:MM' },
          notes: { type: 'string' },
          options: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, items: { type: 'array', items: NUTRI_ITEM } }, required: ['name', 'items'], additionalProperties: false } },
        },
        required: ['key', 'label', 'time', 'notes', 'options'],
        additionalProperties: false,
      },
    },
    removed: { type: 'array', items: { type: 'string', enum: ['pa', 'lanche_m', 'almoco', 'lanche', 'jantar', 'ceia'] }, description: 'refeições que o(a) nutricionista mandou tirar' },
    summary: { type: 'string', description: 'uma frase com o que mudou' },
    doubts: { type: 'string', description: 'o que não percebeu ou falta (ex.: quantidade em falta), "" se nada' },
  },
  required: ['meals', 'removed', 'summary', 'doubts'],
  additionalProperties: false,
} as const;

export const NUTRI_DICTATE_SYSTEM = `Transcreves o ditado de um(a) nutricionista para o plano alimentar de um paciente na app NEFESH Life Pro (Portugal e Brasil).
- Recebes as refeições atuais do dia e o ditado. Devolves TODAS as refeições do dia, já com as mudanças ditadas; o que não foi mencionado fica igual.
- Refeições: pa = pequeno-almoço/café da manhã, lanche_m = lanche da manhã/colação, almoco, lanche = lanche da tarde, jantar, ceia. Horas HH:MM (usa as ditas; senão mantém).
- "Opção B", "ou então", "alternativa" = outra opção da mesma refeição.
- Cada alimento com o nome como numa tabela de composição (TACO), em gramas; converte medidas caseiras (1 colher de sopa de arroz ≈ 25 g, 1 concha de feijão ≈ 100 g, 1 filé médio de frango ≈ 120 g, 1 ovo ≈ 50 g, 1 fatia de pão ≈ 25 g, 1 banana ≈ 90 g, 1 copo ≈ 200 ml) e guarda a medida dita em measure.
- kcal, p (proteína), c (hidratos), f (gordura), fib (fibra) para a quantidade, pelos valores habituais da TACO. Não inventes alimentos que não foram ditos.
- Se faltar a quantidade, usa uma porção habitual e diz em doubts.`;

const NUTRI_REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    general: { type: 'array', items: { type: 'string' }, description: 'até 6 observações gerais (metas, distribuição, adequação às condições da ficha)' },
    notes: { type: 'array', items: { type: 'object', properties: { meal: { type: 'string', description: 'nome da refeição' }, note: { type: 'string' } }, required: ['meal', 'note'], additionalProperties: false } },
  },
  required: ['general', 'notes'],
  additionalProperties: false,
} as const;

export const NUTRI_REVIEW_SYSTEM = `És um revisor técnico para um(a) nutricionista na app NEFESH Life Pro. Recebes a ficha do paciente (anamnese), as metas e o plano de um dia com os totais.
- Aponta só o que é útil e concreto: metas não atingidas (proteína, fibra, energia), distribuição da proteína pelas refeições, alimentos que colidem com alergias/intolerâncias ou com o que o paciente não come, cuidados com as condições declaradas (ex.: pré-diabetes: hidratos simples, fibra; hipertensão: sódio; insulina: intervalos longos), variedade, hidratação.
- São sugestões para o(a) nutricionista decidir: tom profissional e curto, sem diagnósticos, sem alterar o plano. Frases com no máximo 30 palavras. Se estiver tudo bem, diz-o numa frase.`;

const mealsText = (meals: unknown) => (Array.isArray(meals) ? meals : []).map((m) => {
  const x = (m ?? {}) as Record<string, unknown>;
  const opts = (Array.isArray(x.options) ? x.options : []) as { name?: string; items?: { food?: string; grams?: number; measure?: string; kcal?: number; p?: number }[] }[];
  return `- ${x.label} (${x.key}, ${x.time}): ${opts.map((o) => `${o.name}: ${(o.items ?? []).map((i) => `${i.food} ${i.grams} g${i.measure ? ` (${i.measure})` : ''}${i.kcal !== undefined ? ` [${i.kcal} kcal, P ${i.p}]` : ''}`).join('; ') || 'vazia'}`).join(' | ')}${x.notes ? ` · nota: ${x.notes}` : ''}`;
}).join('\n');

export async function dictateNutri(client: Anthropic, model: string, store: CounterStore, uid: string, ip: string, b: Record<string, unknown>): Promise<R> {
  const text = String(b.text ?? '').trim().slice(0, 4000);
  if (text.length < 3) return { status: 400, body: { error: 'Diga ou escreva o que quer no plano.' } };
  const allowed = await check(store, DICTATE_LIMITS, uid, ip, new Date(), 'nd');
  if (!allowed.ok) return { status: 429, body: { error: 'Chegou ao limite de ditados de hoje. Tente amanhã.' } };
  const focus = String(b.focus ?? '').slice(0, 40);
  const user = `${b.about ? `Paciente: ${String(b.about).slice(0, 600)}\n` : ''}Dia: ${String(b.day ?? 'Todos os dias').slice(0, 40)}\n${focus ? `Refeição a montar agora: ${focus} (devolve só esta refeição, com o mesmo key e hora)\n` : ''}${b.mode === 'acrescentar' ? 'Modo ACRESCENTAR: devolve só os alimentos ditados agora (vão ser juntados aos que já estão); não repitas os que já existem. Opção A = os alimentos principais; só cria Opção B se o ditado falar em alternativa.\n' : b.mode === 'sugerir' ? 'Modo SUGERIR: propõe UMA alternativa equivalente a esta refeição (energia e proteína parecidas), com alimentos simples e comuns, respeitando alergias, intolerâncias, condições e o que o paciente não come. Devolve-a como a única opção, com o nome "Sugestão".\n' : ''}Refeições atuais:\n${mealsText(b.meals) || '(nenhuma)'}\n\nDitado do(a) nutricionista:\n${text}`;
  const r = await ask<{ meals: unknown[]; removed?: string[]; summary: string; doubts: string }>(client, model, NUTRI_DICTATE_SYSTEM, user, NUTRI_DICTATE_SCHEMA, 'low');
  if (!r) return { status: 502, body: { error: 'A IA não conseguiu perceber agora. Tente outra vez.' } };
  await count(store, DICTATE_LIMITS, uid, ip, new Date(), 'nd');
  const rx = cleanNutri({ days: [{ name: 'Dia', weekdays: [], meals: r.meals }] });
  return { status: 200, body: { meals: rx?.days[0].meals ?? [], removed: (Array.isArray(r.removed) ? r.removed : []).filter((k) => ['pa', 'lanche_m', 'almoco', 'lanche', 'jantar', 'ceia'].includes(k)), summary: String(r.summary ?? '').slice(0, 300), doubts: String(r.doubts ?? '').slice(0, 300) } };
}

export async function reviewNutri(client: Anthropic, model: string, store: CounterStore, uid: string, ip: string, b: Record<string, unknown>): Promise<R> {
  const allowed = await check(store, REVIEW_LIMITS, uid, ip, new Date(), 'nr');
  if (!allowed.ok) return { status: 429, body: { error: 'Chegou ao limite de revisões de hoje. Tente amanhã.' } };
  const t = (b.targets ?? {}) as Record<string, number>;
  const tot = (b.totals ?? {}) as Record<string, number>;
  const user = `Ficha do paciente: ${String(b.about ?? 'sem ficha').slice(0, 1500)}\nMetas: ${t.kcal || '—'} kcal, proteína ${t.protein || '—'} g, hidratos ${t.carbs || '—'} g, gordura ${t.fat || '—'} g, fibra ${t.fiber || '—'} g, água ${t.water || '—'} L\nTotais do dia (opção A): ${tot.kcal} kcal, P ${tot.p} g, H ${tot.c} g, G ${tot.f} g, fibra ${tot.fib} g\nDia: ${String(b.day ?? '').slice(0, 40)}\nRefeições:\n${mealsText(b.meals)}`;
  const r = await ask<{ general: string[]; notes: { meal: string; note: string }[] }>(client, model, NUTRI_REVIEW_SYSTEM, user, NUTRI_REVIEW_SCHEMA, 'medium');
  if (!r) return { status: 502, body: { error: 'A IA não conseguiu rever agora. Tente outra vez.' } };
  await count(store, REVIEW_LIMITS, uid, ip, new Date(), 'nr');
  return { status: 200, body: { general: (r.general ?? []).map((g) => String(g).trim().slice(0, 300)).filter(Boolean).slice(0, 6), notes: (r.notes ?? []).map((n) => ({ meal: String(n.meal ?? '').slice(0, 40), note: String(n.note ?? '').trim().slice(0, 240) })).filter((n) => n.note).slice(0, 10) } };
}

/* ───────── terapias integrativas: exames do paciente e anamnese organizada pela IA ───────── */

export const EXAM_LIMITS: Limits = { device: 40, ip: 120, global: 2000 };
const EXAM_SCHEMA = {
  type: 'object',
  properties: {
    is_exam: { type: 'boolean', description: 'true se o documento tem resultados de exames (análises clínicas, painel hormonal, mineralograma, laudo de imagem…)' },
    date: { type: 'string', description: 'data da colheita ou do exame AAAA-MM-DD; "" se não aparecer' },
    lab: { type: 'string', description: 'laboratório ou clínica; "" se não aparecer' },
    title: { type: 'string', description: 'nome curto do exame, ex.: "Hemograma e bioquímica", "Painel hormonal", "Mineralograma", "Ecografia abdominal"' },
    items: {
      type: 'array',
      description: 'TODOS os resultados com valor, pela ordem do documento',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'nome como no documento, ex.: "Ferritina", "Vitamina D (25-OH)", "TSH"' },
          value: { type: 'string', description: 'o valor como aparece, com vírgula decimal (ex.: "18,5", "< 0,5", "Negativo")' },
          unit: { type: 'string', description: 'ex.: ng/mL, mg/dL, %; "" se não tiver' },
          ref: { type: 'string', description: 'valores de referência do laboratório, curtos (ex.: "30 a 100"); "" se não tiver' },
          flag: { type: 'string', enum: ['baixo', 'normal', 'alto', ''], description: 'comparando com a referência do PRÓPRIO documento; "" se não houver referência ou não for comparável' },
        },
        required: ['name', 'value', 'unit', 'ref', 'flag'],
        additionalProperties: false,
      },
    },
    note: { type: 'string', description: 'só para laudos descritivos (imagem, endoscopia…): a conclusão/impressão diagnóstica transcrita, curta; "" nos outros' },
  },
  required: ['is_exam', 'date', 'lab', 'title', 'items', 'note'],
  additionalProperties: false,
} as const;

export const EXAM_SYSTEM = `Transcreves exames que um paciente leva a um terapeuta de práticas integrativas (Portugal e Brasil): análises clínicas (hemograma, bioquímica, perfil lipídico, glicemia, insulina, tiroide, vitaminas, ferro/ferritina, minerais, hormonas, PCR), painéis hormonais, mineralograma (cabelo), exames de fezes ou urina, e laudos de imagem.
- Transcreve TODOS os resultados que têm valor, pela ordem do documento, com o nome, o valor, a unidade e a referência como no documento. Converte pontos decimais para vírgula. No hemograma, inclui a série vermelha, a branca e as plaquetas (valores absolutos; percentagens só se não houver absolutos).
- flag: compara o valor com a referência do PRÓPRIO laboratório (por sexo/idade/fase, se o documento indicar qual se aplica). Se o documento marcar o valor (asterisco, negrito, H/L, ↑/↓), segue essa marcação. Sem referência: "".
- Laudos descritivos (ecografia, ressonância, endoscopia): transcreve a conclusão em "note"; items só com medidas numéricas, se houver.
- Se houver vários exames de datas diferentes, usa o mais recente e diz isso no title.
- Não inventes valores, não interpretes, não sugeres diagnósticos nem tratamentos.`;

export async function readExam(client: Anthropic, model: string, store: CounterStore, uid: string, ip: string, b: Record<string, unknown>): Promise<R> {
  const data = String(b.file ?? '');
  const media = String(b.media_type ?? '');
  if (!data || data.length > MAX_FILE_CHARS || !/^[A-Za-z0-9+/=]+$/.test(data)) return { status: 400, body: { error: 'Ficheiro inválido ou demasiado grande (máximo 6 MB).' } };
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (media === 'application/pdf') content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } });
  else if (['image/jpeg', 'image/png', 'image/webp'].includes(media)) content.push({ type: 'image', source: { type: 'base64', media_type: media as 'image/jpeg', data } });
  else return { status: 400, body: { error: 'Use um PDF ou uma fotografia.' } };
  const allowed = await check(store, EXAM_LIMITS, uid, ip, new Date(), 'ie');
  if (!allowed.ok) return { status: 429, body: { error: 'Chegou ao limite de leituras de hoje. Tente amanhã.' } };
  content.push({ type: 'text', text: 'Transcreve os resultados deste exame.' });
  const response = await client.beta.messages.create({
    model,
    max_tokens: 12000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: EXAM_SYSTEM,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: EXAM_SCHEMA as never } },
    messages: [{ role: 'user', content }],
  });
  if (response.stop_reason === 'refusal') return { status: 422, body: { error: 'Não foi possível ler este documento.' } };
  const text = response.content.find((x) => x.type === 'text');
  if (!text || text.type !== 'text') return { status: 502, body: { error: 'resposta vazia' } };
  await count(store, EXAM_LIMITS, uid, ip, new Date(), 'ie');
  const r = JSON.parse(text.text) as Record<string, unknown>;
  const exam = r.is_exam ? cleanExam(r) : null;
  return { status: 200, body: exam ? { found: true, exam } : { found: false } };
}

const INTEG_FIELD = { type: 'string', description: 'o texto COMPLETO deste campo depois das notas (o que já lá estava + o novo, sem repetir); "" se as notas não trazem nada para ele' } as const;
const INTEG_SCHEMA = {
  type: 'object',
  properties: {
    sexo: { type: 'string', enum: ['f', 'm', ''] },
    idade: n,
    ...Object.fromEntries(INTEG_KEYS.map((k) => [k, INTEG_FIELD])),
    alerts: { type: 'array', items: { type: 'string' }, description: 'sinais que pedem avaliação médica e cuidados com medicação/fitoterápicos/suplementos; [] se nada' },
    ask: { type: 'array', items: { type: 'string' }, description: 'até 6 perguntas importantes que ainda faltam fazer ao paciente' },
    summary: { type: 'string', description: 'uma frase com o que foi registado' },
  },
  required: ['sexo', 'idade', ...INTEG_KEYS, 'alerts', 'ask', 'summary'],
  additionalProperties: false,
} as const;

export const INTEG_SYSTEM = `Ajudas um terapeuta de práticas integrativas (naturopatia, geobiologia e outras práticas complementares) a preencher a anamnese de um paciente na app NEFESH Life Pro.
Recebes a ficha atual (campos) e as notas da consulta, ditadas por voz ou escritas (podem ter erros de transcrição, abreviaturas e frases soltas).
- Distribui cada informação pelo campo certo, escrita de forma clara e curta, sem perder detalhes (doses, frequências, há quanto tempo, horários). Campos:
${INTEG.map(([k, , l]) => `  ${k}: ${l}`).join('\n')}
- Num campo que já tem texto, devolve o texto completo: mantém o que lá estava e junta o novo (se as notas corrigirem algo, corrige). Campo sem nada novo: "".
- Usa as palavras do paciente e do terapeuta; não acrescentes interpretações, diagnósticos nem tratamentos. Escreve na mesma variante do português das notas (Brasil ou Portugal).
- alerts (para o terapeuta, curtos): sinais que pedem avaliação médica antes ou em paralelo — perda de peso sem explicação, sangue nas fezes, na urina ou no vómito, dor no peito, falta de ar, febre que não passa, alterações neurológicas súbitas, dor forte ou que piora, ideias de morte ou de se magoar, gravidez ou amamentação com fitoterápicos/suplementos; e possíveis interações entre a medicação e fitoterápicos ou suplementos citados (ex.: hipericão com antidepressivos ou anticoncecionais; ginkgo, alho ou ómega 3 em dose alta com anticoagulantes; alcaçuz com hipertensão). Nunca sugeres parar ou mudar medicação. [] se nada.
- ask: perguntas que faltam para uma anamnese integrativa segura e útil (ex.: medicação, alergias, acompanhamento médico, intestino, sono, ciclo), só as mais importantes, no máximo 6.`;

export async function organizeInteg(client: Anthropic, model: string, store: CounterStore, uid: string, ip: string, b: Record<string, unknown>): Promise<R> {
  const text = String(b.text ?? '').trim().slice(0, 8000);
  if (text.length < 3) return { status: 400, body: { error: 'Fale ou escreva as notas da consulta.' } };
  const allowed = await check(store, DICTATE_LIMITS, uid, ip, new Date(), 'ia');
  if (!allowed.ok) return { status: 429, body: { error: 'Chegou ao limite de hoje. Tente amanhã.' } };
  const cur = cleanInteg(b.integ);
  const p = cleanProfile({ sexo: b.sexo, idade: b.idade });
  const user = `Ficha atual:\nsexo: ${p.sexo || '—'} · idade: ${p.idade ?? '—'}\n${INTEG_KEYS.map((k) => `${k}: ${cur[k] ?? ''}`).join('\n')}${b.exams ? `\n\nExames: ${String(b.exams).slice(0, 1500)}` : ''}\n\nNotas da consulta:\n${text}`;
  const r = await ask<Record<string, unknown>>(client, model, INTEG_SYSTEM, user, INTEG_SCHEMA, 'medium');
  if (!r) return { status: 502, body: { error: 'A IA não conseguiu organizar agora. Tente outra vez.' } };
  await count(store, DICTATE_LIMITS, uid, ip, new Date(), 'ia');
  const got = cleanInteg(r);
  const who = cleanProfile({ sexo: r.sexo, idade: typeof r.idade === 'number' && r.idade >= 0 ? r.idade : null });
  const list = (v: unknown, k: number) => (Array.isArray(v) ? v : []).map((x) => String(x ?? '').replace(/\s+/g, ' ').trim().slice(0, 240)).filter(Boolean).slice(0, k);
  return { status: 200, body: { integ: got, sexo: who.sexo, idade: who.idade, alerts: list(r.alerts, 8), ask: list(r.ask, 6), summary: String(r.summary ?? '').slice(0, 300) } };
}
