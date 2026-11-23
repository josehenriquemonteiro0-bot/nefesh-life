/**
 * Leituras por IA de documentos da pessoa:
 * - "rotulo": a tabela nutricional de uma embalagem (produto que não está na Open Food Facts);
 * - "analises": um boletim de análises clínicas (foto ou PDF) → resultados estruturados;
 * - "receita": uma receita médica ou prescrição de suplementos (foto ou PDF) → lista para os lembretes.
 * Os documentos não são guardados. A IA só transcreve: não interpreta nem diagnostica.
 */
import Anthropic from '@anthropic-ai/sdk';
import { check, count, type CounterStore, type Limits } from './limits';

export type DocKind = 'rotulo' | 'analises' | 'receita';
export const DOC_LIMITS: Record<DocKind, Limits> = {
  rotulo: { device: 20, ip: 60, global: 1500 },
  analises: { device: 6, ip: 20, global: 400 },
  receita: { device: 6, ip: 20, global: 400 },
};
const COUNTER: Record<DocKind, string> = { rotulo: 'n', analises: 'a', receita: 'rx' };
const MAX_FILE_CHARS = 8_000_000;

/** Análises que a app conhece (o mesmo que LABS em src/domain/care.ts). */
export const LAB_KEYS = ['glicemia', 'hba1c', 'colesterol', 'ldl', 'hdl', 'trigliceridos', 'vitd', 'ferritina', 'hemoglobina', 'b12', 'tsh', 'creatinina', 'acidourico', 'psa'] as const;

const LABEL_SCHEMA = {
  type: 'object',
  properties: {
    is_label: { type: 'boolean', description: 'true se a imagem mostra uma tabela nutricional legível' },
    name: { type: 'string', description: 'nome do produto, se aparecer; senão ""' },
    brand: { type: 'string', description: 'marca, se aparecer; senão ""' },
    kcal: { type: 'number', description: 'kcal por 100 g ou 100 ml' },
    protein_g: { type: 'number', description: 'proteína por 100 g' },
    carbs_g: { type: 'number', description: 'hidratos de carbono por 100 g' },
    sugar_g: { type: 'number', description: 'açúcares por 100 g' },
    fat_g: { type: 'number', description: 'lípidos/gordura por 100 g' },
    salt_g: { type: 'number', description: 'sal por 100 g (se só houver sódio, sal = sódio × 2,5)' },
    fiber_g: { type: 'number', description: 'fibra por 100 g; 0 se não houver' },
    serving_g: { type: 'number', description: 'porção indicada em gramas; 0 se não houver' },
  },
  required: ['is_label', 'name', 'brand', 'kcal', 'protein_g', 'carbs_g', 'sugar_g', 'fat_g', 'salt_g', 'fiber_g', 'serving_g'],
  additionalProperties: false,
} as const;

const LABS_SCHEMA = {
  type: 'object',
  properties: {
    is_labs: { type: 'boolean', description: 'true se o documento é um boletim de análises clínicas' },
    date: { type: 'string', description: 'data da colheita AAAA-MM-DD; "" se não aparecer' },
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string', enum: [...LAB_KEYS, ''], description: 'a análise conhecida equivalente; "" para as outras' },
          name: { type: 'string', description: 'nome da análise como no boletim' },
          value: { type: 'number' },
          unit: { type: 'string' },
          ref_low: { type: 'number', description: 'limite inferior da referência do laboratório; -1 se não houver' },
          ref_high: { type: 'number', description: 'limite superior da referência do laboratório; -1 se não houver' },
        },
        required: ['key', 'name', 'value', 'unit', 'ref_low', 'ref_high'],
        additionalProperties: false,
      },
    },
  },
  required: ['is_labs', 'date', 'results'],
  additionalProperties: false,
} as const;

const RX_SCHEMA = {
  type: 'object',
  properties: {
    is_prescription: { type: 'boolean', description: 'true se o documento é uma receita ou prescrição de medicamentos ou suplementos' },
    by: { type: 'string', description: 'quem prescreveu (nome e título, ex.: "Dra. Ana Lima"); "" se não aparecer' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'nome do medicamento ou suplemento como na receita (com a dosagem, ex.: "Vitamina D3 2000 UI")' },
          kind: { type: 'string', enum: ['medicamento', 'suplemento'] },
          dose: { type: 'string', description: 'quanto tomar de cada vez e como (ex.: "1 cápsula em jejum"); "" se não aparecer' },
          times: { type: 'array', items: { type: 'string', description: 'HH:MM' }, description: 'horas da toma' },
          duration: { type: 'string', description: 'duração do tratamento (ex.: "30 dias", "uso contínuo"); "" se não aparecer' },
        },
        required: ['name', 'kind', 'dose', 'times', 'duration'],
        additionalProperties: false,
      },
    },
  },
  required: ['is_prescription', 'by', 'items'],
  additionalProperties: false,
} as const;

const SYSTEM = {
  receita:
    'Transcreves receitas médicas e prescrições de suplementos ou manipulados (Portugal e Brasil) que a própria pessoa anexa, para ela criar lembretes. Um item por produto. ' +
    'Horas da toma pela posologia: 1x/dia ou "de manhã" ou "em jejum" = 08:00; "ao almoço" = 13:00; "ao jantar" ou "à noite" = 20:00; "ao deitar" = 22:00; 12/12h = 08:00 e 20:00; 8/8h = 07:00, 15:00 e 23:00; 6/6h = 06:00, 12:00, 18:00 e 24:00 escrito 00:00; 2x/dia = 08:00 e 20:00; 3x/dia = 08:00, 13:00 e 20:00. ' +
    'Se for semanal, "se necessário" ou sem posologia, usa 08:00 e escreve a regra na dose. Manipulados com várias substâncias numa cápsula são um só item (nome = "Fórmula manipulada" + principais ativos). ' +
    'Não inventes nem mudes doses; não interpretes, não comentes e não acrescentes nada que não esteja escrito.',
  rotulo: 'Transcreves a tabela nutricional de uma embalagem de alimento, por 100 g (ou 100 ml), exatamente como está escrita. Converte vírgulas decimais em ponto. Não inventes valores: se a imagem não mostrar uma tabela nutricional legível, is_label = false.',
  analises:
    'Transcreves boletins de análises clínicas (Portugal e Brasil). Para cada resultado com valor numérico: nome, valor, unidade e a referência do laboratório. Usa key só quando a análise é claramente a mesma (ex.: "Glicose" = glicemia; "Colesterol LDL" = ldl; "25-OH Vitamina D" = vitd; "TSH" = tsh). Mantém as unidades do boletim. Não interpretes nem comentes resultados. Ignora valores não numéricos (ex.: "negativo").',
};

export async function handleDocRead(
  kind: DocKind,
  body: Record<string, unknown>,
  store: CounterStore,
  client: Anthropic,
  model: string,
  device: string,
  ip: string,
  json: (b: unknown, s: number) => Response,
) {
  const data = String(body.file ?? '');
  const media = String(body.media_type ?? '');
  if (!data || data.length > MAX_FILE_CHARS || !/^[A-Za-z0-9+/=]+$/.test(data)) return json({ error: 'Ficheiro inválido ou demasiado grande (máximo 6 MB).' }, 400);
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (media === 'application/pdf' && kind !== 'rotulo') content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } });
  else if (['image/jpeg', 'image/png', 'image/webp'].includes(media)) content.push({ type: 'image', source: { type: 'base64', media_type: media as 'image/jpeg', data } });
  else return json({ error: kind !== 'rotulo' ? 'Use uma fotografia ou um PDF.' : 'Use uma fotografia.' }, 400);
  const allowed = await check(store, DOC_LIMITS[kind], device, ip, new Date(), COUNTER[kind]);
  if (!allowed.ok) return json({ error: 'Chegou ao limite de leituras de hoje. Tente amanhã.' }, 429);
  content.push({ type: 'text', text: { rotulo: 'Transcreve esta tabela nutricional.', analises: 'Transcreve estes resultados de análises.', receita: 'Transcreve esta receita para lembretes.' }[kind] });
  const response = await client.beta.messages.create({
    model,
    max_tokens: kind === 'rotulo' ? 1500 : 8000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: SYSTEM[kind],
    output_config: { effort: 'low', format: { type: 'json_schema', schema: { rotulo: LABEL_SCHEMA, analises: LABS_SCHEMA, receita: RX_SCHEMA }[kind] as never } },
    messages: [{ role: 'user', content }],
  });
  if (response.stop_reason === 'refusal') return json({ error: 'Não foi possível ler este documento.' }, 422);
  const text = response.content.find((b) => b.type === 'text');
  if (!text || text.type !== 'text') return json({ error: 'resposta vazia' }, 502);
  const raw = JSON.parse(text.text);
  await count(store, DOC_LIMITS[kind], device, ip, new Date(), COUNTER[kind]);
  return json(kind === 'receita' ? cleanPrescription(raw) : raw, 200);
}

/** Limpa a receita lida: nomes e doses curtos, horas válidas (HH:MM), no máximo 15 produtos. */
export function cleanPrescription(r: Record<string, unknown>) {
  const str = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
  if (!r.is_prescription) return { found: false, by: '', items: [] };
  const items = (Array.isArray(r.items) ? r.items : []).slice(0, 15).map((x) => {
    const o = x as Record<string, unknown>;
    const times = [...new Set((Array.isArray(o.times) ? o.times : []).map((t) => String(t).trim().replace(/^24:/, '00:')).map((t) => (/^\d:\d\d$/.test(t) ? `0${t}` : t)).filter((t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t)))].sort().slice(0, 6);
    const dose = [str(o.dose, 60), str(o.duration, 30)].filter(Boolean).join(' · ');
    return { name: str(o.name, 60), kind: o.kind === 'medicamento' ? 'medicamento' : 'suplemento', dose: dose.slice(0, 80), times: times.length ? times : ['08:00'] };
  }).filter((x) => x.name.length >= 2);
  return { found: items.length > 0, by: str(r.by, 40), items };
}
