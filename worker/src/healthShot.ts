/**
 * Prova de atividade por captura de ecrã: a IA lê uma captura do app Saúde / Fitness
 * (ou da app de um relógio) e devolve a data e os valores. Só contam valores de hoje
 * (ou o sono da noite passada); capturas repetidas são recusadas antes de chegar aqui.
 */
import Anthropic from '@anthropic-ai/sdk';

const SCHEMA = {
  type: 'object',
  properties: {
    is_health_screenshot: { type: 'boolean', description: 'true se é uma captura de ecrã de uma app de saúde ou atividade (Apple Saúde, Fitness, Apple Watch, Garmin Connect, Samsung Health, Google Fit, Mi Fitness, Fitbit, Strava…)' },
    day: { type: 'string', enum: ['hoje', 'ontem', 'outro', 'desconhecido'], description: 'a que dia se referem os valores, comparando com a data de hoje indicada' },
    steps: { type: ['number', 'null'], description: 'passos do dia, se aparecem' },
    exercise_minutes: { type: ['number', 'null'], description: 'minutos de exercício (anel verde, treinos, minutos ativos), se aparecem' },
    sleep_hours: { type: ['number', 'null'], description: 'horas de sono da noite (ex.: 7 h 30 min = 7.5), se aparecem' },
    looks_edited: { type: 'boolean', description: 'true se há sinais de edição ou montagem (números desalinhados, tipos de letra diferentes)' },
    note: { type: 'string', description: 'frase curta para a pessoa, em português de Portugal' },
  },
  required: ['is_health_screenshot', 'day', 'steps', 'exercise_minutes', 'sleep_hours', 'looks_edited', 'note'],
  additionalProperties: false,
} as const;

export interface HealthShot {
  is_health_screenshot: boolean;
  day: 'hoje' | 'ontem' | 'outro' | 'desconhecido';
  steps: number | null;
  exercise_minutes: number | null;
  sleep_hours: number | null;
  looks_edited: boolean;
  note: string;
}

export async function readHealthShot(client: Anthropic, model: string, image: string, mediaType: 'image/jpeg' | 'image/png' | 'image/webp', today: string): Promise<HealthShot> {
  const r = await client.beta.messages.create({
    model,
    max_tokens: 1500,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: `Lês capturas de ecrã de apps de saúde e atividade para a app NEFESH Life. Hoje é ${today}. Indica a que dia se referem os valores ("Hoje"/"Today" é hoje; "Ontem"/"Yesterday" é ontem; uma data concreta compara-a com hoje). Lê só valores que estejam visíveis, sem adivinhar. Assinala sinais de edição.`,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
    messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: mediaType, data: image } }, { type: 'text', text: 'Lê esta captura.' }] }],
  });
  const t = r.content.find((x) => x.type === 'text');
  if (r.stop_reason === 'refusal' || !t || t.type !== 'text') return { is_health_screenshot: false, day: 'desconhecido', steps: null, exercise_minutes: null, sleep_hours: null, looks_edited: false, note: 'Não foi possível ler a captura.' };
  return JSON.parse(t.text) as HealthShot;
}

/** Valores aceites para guardar como dados de saúde verificados (ou null se a captura não serve). */
export function acceptShot(s: HealthShot): { steps?: number; exMin?: number; sleepH?: number } | null {
  if (!s.is_health_screenshot || s.looks_edited) return null;
  const out: { steps?: number; exMin?: number; sleepH?: number } = {};
  if (s.day === 'hoje') {
    if (s.steps !== null && s.steps >= 0 && s.steps <= 100000) out.steps = Math.round(s.steps);
    if (s.exercise_minutes !== null && s.exercise_minutes >= 0 && s.exercise_minutes <= 600) out.exMin = Math.round(s.exercise_minutes);
  }
  // o sono da noite passada aparece como "hoje" ou "ontem", conforme a app
  if ((s.day === 'hoje' || s.day === 'ontem') && s.sleep_hours !== null && s.sleep_hours > 0 && s.sleep_hours <= 16) out.sleepH = Math.round(s.sleep_hours * 4) / 4;
  return Object.keys(out).length ? out : null;
}
