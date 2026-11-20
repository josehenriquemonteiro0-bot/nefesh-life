/**
 * Leitura do plano alimentar do nutricionista: transforma um PDF, uma fotografia ou o
 * texto de uma folha de cálculo ou documento em refeições estruturadas.
 */
import Anthropic from '@anthropic-ai/sdk';
import { check, count, type CounterStore, type Limits } from './limits';

/** Limites próprios para a leitura de planos (é mais cara do que uma foto). */
export const PLAN_LIMITS: Limits = { device: 5, ip: 15, global: 50 };
const MAX_FILE_CHARS = 8_000_000; // ~6 MB em base64
const MAX_TEXT_CHARS = 120_000;

const ITEM = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'alimento, em português de Portugal' },
    quantity: { type: 'string', description: 'quantidade como está no plano (ex.: "40 g", "1 chávena", "2 fatias")' },
    grams: { type: 'number', description: 'peso estimado em gramas (0 se não se aplicar)' },
    kcal: { type: 'number' },
    protein_g: { type: 'number' },
    carbs_g: { type: 'number' },
    fat_g: { type: 'number' },
  },
  required: ['name', 'quantity', 'grams', 'kcal', 'protein_g', 'carbs_g', 'fat_g'],
  additionalProperties: false,
} as const;

export const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    is_plan: { type: 'boolean', description: 'true se o ficheiro é um plano alimentar' },
    meals: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          meal: { type: 'string', enum: ['pa', 'almoco', 'lanche', 'jantar', 'ceia', 'outro'] },
          label: { type: 'string', description: 'nome da refeição como está no plano (ex.: "Meio da manhã")' },
          time: { type: 'string', description: 'hora indicada no plano, ou vazio' },
          options: {
            type: 'array',
            description: 'alternativas da refeição (Opção 1, Opção 2...); uma só se o plano não der alternativas',
            items: {
              type: 'object',
              properties: { name: { type: 'string' }, items: { type: 'array', items: ITEM } },
              required: ['name', 'items'],
              additionalProperties: false,
            },
          },
        },
        required: ['meal', 'label', 'time', 'options'],
        additionalProperties: false,
      },
    },
    daily_kcal: { type: 'number', description: 'calorias diárias indicadas no plano; 0 se não estiverem indicadas' },
    daily_protein_g: { type: 'number', description: 'proteína diária indicada no plano; 0 se não estiver indicada' },
    professional: { type: 'string', description: 'nome do profissional, se aparecer; senão vazio' },
    notes: { type: 'string', description: 'recomendações gerais do plano (água, suplementos, cuidados), resumidas em 1 a 3 frases' },
  },
  required: ['is_plan', 'meals', 'daily_kcal', 'daily_protein_g', 'professional', 'notes'],
  additionalProperties: false,
} as const;

const SYSTEM = `És o assistente da app NEFESH Life. Recebes o plano alimentar que um nutricionista fez para a pessoa e transcreve-lo para refeições estruturadas, sem mudar nada do que o profissional escreveu.

Regras:
- Respeita fielmente alimentos, quantidades e alternativas do plano. Não acrescentes, não removas e não "melhores" nada.
- Mapeia cada refeição para: pa (pequeno-almoço), almoco, lanche (inclui meio da manhã e merendas), jantar, ceia, ou outro.
- Se o plano der alternativas (Opção 1, Opção 2, "ou"), cria uma opção para cada.
- Estima gramas, calorias e macronutrientes de cada alimento com valores médios de tabelas de composição; se o plano já indicar calorias, usa-as.
- Se o plano indicar a meta diária de calorias ou proteína, copia-a; senão usa 0.
- Escreve em português de Portugal.
- Se o ficheiro não for um plano alimentar, responde com is_plan false e meals vazio.`;

export const WORKOUT_SCHEMA = {
  type: 'object',
  properties: {
    is_workout: { type: 'boolean', description: 'true se o ficheiro é um plano de treino' },
    workouts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'nome do treino como está no plano (ex.: "Treino A")' },
          focus: { type: 'string', description: 'grupos musculares ou foco (ex.: "Peito e tríceps"); vazio se não houver' },
          day: { type: 'string', description: 'dia da semana indicado, ou vazio' },
          exercises: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'nome do exercício, como está no plano' },
                sets: { type: 'number', description: 'número de séries (0 se não indicado)' },
                reps: { type: 'string', description: 'repetições ou tempo por série (ex.: "10-12", "30 s"); vazio se não indicado' },
                load: { type: 'string', description: 'carga indicada (ex.: "20 kg"); vazio se não indicada' },
                rest: { type: 'string', description: 'descanso entre séries (ex.: "60 s"); vazio se não indicado' },
                notes: { type: 'string', description: 'observações do exercício (técnica, cadência, bi-set); vazio se não houver' },
              },
              required: ['name', 'sets', 'reps', 'load', 'rest', 'notes'],
              additionalProperties: false,
            },
          },
        },
        required: ['name', 'focus', 'day', 'exercises'],
        additionalProperties: false,
      },
    },
    per_week: { type: 'number', description: 'treinos por semana indicados no plano; 0 se não indicado' },
    professional: { type: 'string', description: 'nome do profissional, se aparecer; senão vazio' },
    notes: { type: 'string', description: 'orientações gerais do plano (aquecimento, cardio, cuidados), em 1 a 3 frases' },
  },
  required: ['is_workout', 'workouts', 'per_week', 'professional', 'notes'],
  additionalProperties: false,
} as const;

const WORKOUT_SYSTEM = `És o assistente da app NEFESH Life. Recebes o plano de treino que um personal trainer fez para a pessoa (muitas vezes exportado de apps como MyFit) e transcreve-lo para treinos estruturados, sem mudar nada do que o profissional escreveu.

Regras:
- Respeita fielmente treinos (A, B, C...), exercícios, séries, repetições, cargas, descansos e observações. Não acrescentes, não removas e não "melhores" nada.
- Mantém os nomes dos exercícios como estão no plano.
- Se um campo não estiver indicado, deixa-o vazio (ou 0 nas séries).
- Bi-sets, tri-sets e drop-sets: regista cada exercício e explica a ligação nas observações.
- Se os treinos não tiverem nome próprio (por exemplo, todas as páginas com o mesmo título, como o objetivo da rotina), chama-lhes "Treino A", "Treino B", "Treino C"... pela ordem em que aparecem, e indica no foco os grupos musculares principais (ex.: "Costas e bíceps").
- Formato de apps como o MyFit:
  - "Séries: 3x12" → sets 3, reps "12".
  - "Séries: 3x12/10/8" (tantos números como séries) → pirâmide: sets 3, reps "12/10/8" (uma contagem por série, pela ordem).
  - "Séries: 3x12/15" (menos números do que séries) → intervalo: sets 3, reps "12-15".
  - "Séries: 1x" ou "Séries: 3x" sem repetições → só as séries.
  - "Carga" com tempo (ex.: "10 min", "60seg") é duração, não peso: põe-na em reps (ex.: "10 min") e deixa load vazio. Copia o tempo tal como está, mesmo que pareça estranho.
  - "Carga: 0kg" significa que a carga não foi definida: deixa load vazio.
  - "Carga: 8/6 kg" (cargas por série) e textos como "Diminuindo carga" ficam em load tal como estão.
  - "Intervalo" é o descanso entre séries.
  - "Instruções:" vão para as observações do exercício a que pertencem.
  - O cabeçalho (rotina, objetivo como "Definição muscular", nível como "Intermediário") vai para as orientações gerais; o nome da pessoa não é o profissional.
- Escreve em português de Portugal.
- Se o ficheiro não for um plano de treino, responde com is_workout false e workouts vazio.`;

export interface PlanBody {
  device?: string;
  /** PDF ou imagem em base64 */
  file?: string;
  media_type?: string;
  /** texto extraído de Excel, CSV ou Word */
  text?: string;
  name?: string;
}

type Json = (body: unknown, status: number) => Response;

export async function handlePlan(body: PlanBody, store: CounterStore, client: Anthropic, model: string, device: string, ip: string, json: Json, kind: 'nutri' | 'treino' = 'nutri'): Promise<Response> {
  const allowed = await check(store, PLAN_LIMITS, device, ip, new Date(), 'p');
  if (!allowed.ok) return json({ error: 'Já leu planos suficientes hoje. Tente amanhã.', remaining: 0 }, 429);

  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  const name = String(body.name ?? 'plano').slice(0, 120);
  if (body.file) {
    const data = String(body.file);
    if (data.length > MAX_FILE_CHARS || !/^[A-Za-z0-9+/=]+$/.test(data)) return json({ error: 'Ficheiro inválido ou demasiado grande (máximo 6 MB).' }, 400);
    if (body.media_type === 'application/pdf') {
      content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } });
    } else if (['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(String(body.media_type))) {
      content.push({ type: 'image', source: { type: 'base64', media_type: body.media_type as 'image/jpeg', data } });
    } else {
      return json({ error: 'Formato não suportado. Use PDF, fotografia, Excel, CSV ou Word.' }, 400);
    }
  } else if (body.text) {
    const text = String(body.text).slice(0, MAX_TEXT_CHARS);
    content.push({ type: 'text', text: `Conteúdo do ficheiro "${name}":\n\n${text}` });
  } else {
    return json({ error: 'Falta o ficheiro do plano.' }, 400);
  }
  content.push({ type: 'text', text: kind === 'treino' ? 'Transcreve este plano de treino.' : 'Transcreve este plano alimentar.' });

  const response = await client.beta.messages.create({
    model,
    max_tokens: 12000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: kind === 'treino' ? WORKOUT_SYSTEM : SYSTEM,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: kind === 'treino' ? WORKOUT_SCHEMA : PLAN_SCHEMA } },
    messages: [{ role: 'user', content }],
  });
  if (response.stop_reason === 'refusal') return json({ error: 'Não foi possível ler este ficheiro.' }, 422);
  if (response.stop_reason === 'max_tokens') return json({ error: 'O plano é demasiado longo para ler de uma vez.' }, 502);
  const text = response.content.find((b) => b.type === 'text');
  if (!text || text.type !== 'text') return json({ error: 'resposta vazia' }, 502);
  const result = JSON.parse(text.text);
  const remaining = await count(store, PLAN_LIMITS, device, ip, new Date(), 'p');
  return json({ ...result, remaining, usage: { input: response.usage.input_tokens, output: response.usage.output_tokens } }, 200);
}
