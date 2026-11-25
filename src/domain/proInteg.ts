/**
 * NEFESH Life Pro · ficha integrativa (naturopatia e outras práticas complementares).
 *
 * Não é a ficha de um personal (treino, medidas) nem a de um nutricionista (plano alimentar):
 * é a anamnese integrativa — o motivo da consulta, a história de saúde, os sistemas do corpo
 * (digestão, sono, energia, emoções, ciclo hormonal, pele, dores, imunidade), o estilo de vida
 * e o ambiente (casa, quarto, trabalho) — e os exames que o paciente traz, lidos pela IA.
 * O documento do exame nunca fica guardado: só os valores que o terapeuta confirma.
 * Sem dependências: a app e o servidor usam este ficheiro.
 */

export const INTEG_GROUPS = [
  ['motivo', 'Motivo da consulta'],
  ['saude', 'História de saúde'],
  ['sistemas', 'Como está o corpo'],
  ['vida', 'Estilo de vida'],
  ['ambiente', 'Ambiente'],
  ['terapeuta', 'Do terapeuta'],
] as const;
export type IntegGroup = (typeof INTEG_GROUPS)[number][0];

/** [chave, grupo, rótulo, exemplo] */
export const INTEG = [
  ['queixa', 'motivo', 'Queixa principal e o que espera', 'ex.: cansaço há 6 meses, quer ter mais energia e dormir melhor'],
  ['historia', 'motivo', 'Quando começou e o que já tentou', 'ex.: piorou depois de uma mudança de emprego; já fez dieta sem glúten'],
  ['doencas', 'saude', 'Doenças, diagnósticos e cirurgias', 'ex.: hipotiroidismo, retirou a vesícula em 2020'],
  ['medicacao', 'saude', 'Medicação, suplementos e fitoterápicos', 'ex.: levotiroxina 50 mcg, magnésio, chá de camomila'],
  ['alergias', 'saude', 'Alergias e intolerâncias', 'ex.: dipirona, lactose'],
  ['medico', 'saude', 'Acompanhamento médico atual', 'ex.: endocrinologista, última consulta em março'],
  ['familia', 'saude', 'Histórico familiar', 'ex.: mãe com diabetes, pai com hipertensão'],
  ['digestao', 'sistemas', 'Digestão e intestino', 'ex.: inchaço depois das refeições, intestino 1× a cada 2 dias, azia'],
  ['sono', 'sistemas', 'Sono', 'ex.: demora a adormecer, acorda às 3h, não acorda descansada'],
  ['energia', 'sistemas', 'Energia e disposição', 'ex.: quebra de energia depois do almoço'],
  ['emocional', 'sistemas', 'Stress, humor e emoções', 'ex.: ansiedade no trabalho, irritabilidade'],
  ['hormonal', 'sistemas', 'Ciclo menstrual, gravidez, menopausa', 'ex.: ciclo irregular, TPM forte, calores'],
  ['pele', 'sistemas', 'Pele, cabelo e unhas', 'ex.: acne no queixo, queda de cabelo'],
  ['dores', 'sistemas', 'Dores e tensões', 'ex.: dor de cabeça 2× por semana, tensão no pescoço'],
  ['imunidade', 'sistemas', 'Imunidade', 'ex.: gripes frequentes, herpes labial, rinite'],
  ['alimentacao', 'vida', 'Alimentação, horários e água', 'ex.: não toma café da manhã, muito pão, 1 L de água por dia'],
  ['habitos', 'vida', 'Café, álcool e tabaco', 'ex.: 4 cafés por dia, vinho ao fim de semana'],
  ['movimento', 'vida', 'Atividade física e sol', 'ex.: caminha 2× por semana, pouco sol'],
  ['rotina', 'vida', 'Rotina e horários', 'ex.: acorda 6h30, deita meia-noite, trabalha sentada 9 h'],
  ['ambiente', 'ambiente', 'Casa, quarto e trabalho', 'ex.: humidade e bolor no quarto, telemóvel na cabeceira, Wi-Fi ligado à noite, produtos de limpeza fortes'],
  ['observacoes', 'terapeuta', 'Observações do terapeuta', 'ex.: língua saburrosa; avaliação de geobiologia marcada'],
] as const;
export type IntegKey = (typeof INTEG)[number][0];
export const INTEG_KEYS = INTEG.map((x) => x[0]) as IntegKey[];
export const INTEG_LABEL = Object.fromEntries(INTEG.map((x) => [x[0], x[2]])) as Record<IntegKey, string>;

export type ExamFlag = '' | 'baixo' | 'normal' | 'alto';
export interface ExamItem { name: string; value: string; unit: string; ref: string; flag: ExamFlag }
/** note: conclusão de um laudo descritivo (ecografia, ressonância…), transcrita */
export interface Exam { id: string; date: string; lab: string; title: string; items: ExamItem[]; note?: string }

export const MAX_EXAMS = 12;
export const MAX_EXAM_ITEMS = 80;

const txt = (v: unknown, max: number) => String(v ?? '').replace(/[\u0000-\u0008\u000b-\u001f]/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);
const one = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

export function cleanInteg(x: unknown): Partial<Record<IntegKey, string>> {
  const o = (x ?? {}) as Record<string, unknown>;
  return Object.fromEntries(INTEG_KEYS.map((k) => [k, txt(o[k], 600)]).filter(([, v]) => v)) as Partial<Record<IntegKey, string>>;
}

const FLAGS: ExamFlag[] = ['', 'baixo', 'normal', 'alto'];
export function cleanExamItems(v: unknown): ExamItem[] {
  const seen = new Set<string>();
  const out: ExamItem[] = [];
  for (const x of Array.isArray(v) ? v : []) {
    const o = (x ?? {}) as Record<string, unknown>;
    const name = one(o.name, 60);
    const value = one(o.value, 30);
    if (!name || !value) continue;
    const key = `${name.toLowerCase()}|${value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, value, unit: one(o.unit, 20), ref: one(o.ref, 60), flag: FLAGS.includes(o.flag as ExamFlag) ? (o.flag as ExamFlag) : '' });
    if (out.length >= MAX_EXAM_ITEMS) break;
  }
  return out;
}

/** título curto, cortado numa palavra inteira */
const shortTitle = (v: unknown) => { const t = one(v, 200); if (t.length <= 60) return t; const cut = t.slice(0, 58).replace(/[\s,;(·-]+\S*$/, ''); return `${cut}…`; };

export function cleanExam(x: unknown): Exam | null {
  const o = (x ?? {}) as Record<string, unknown>;
  const items = cleanExamItems(o.items);
  const note = txt(o.note, 600);
  if (!items.length && !note) return null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(o.date ?? '')) ? String(o.date) : '';
  const id = /^[a-z0-9]{4,16}$/.test(String(o.id ?? '')) ? String(o.id) : Math.random().toString(36).slice(2, 10);
  return { id, date, lab: one(o.lab, 60), title: shortTitle(o.title), items, ...(note ? { note } : {}) };
}

/** Exames limpos, do mais recente para o mais antigo (sem data no fim). */
export function cleanExams(v: unknown): Exam[] {
  return (Array.isArray(v) ? v : []).map(cleanExam).filter((e): e is Exam => !!e)
    .sort((a, b) => (b.date || '0000').localeCompare(a.date || '0000'))
    .slice(0, MAX_EXAMS);
}

/** Valores fora da referência do laboratório (o que o documento marcou), do exame mais recente de cada análise. */
export function examOut(exams: Exam[] | undefined): (ExamItem & { date: string })[] {
  const seen = new Set<string>();
  const out: (ExamItem & { date: string })[] = [];
  for (const e of exams ?? []) for (const i of e.items) {
    const k = i.name.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    if (i.flag === 'baixo' || i.flag === 'alto') out.push({ ...i, date: e.date });
  }
  return out;
}

/** Texto da ficha para a IA (montar o plano, organizar a anamnese). */
export function integText(p: { sexo?: string; idade?: number | null; integ?: Partial<Record<IntegKey, string>>; exames?: Exam[] } | null | undefined): string {
  if (!p) return '';
  const a: string[] = [];
  const who = [p.sexo === 'f' ? 'Mulher' : p.sexo === 'm' ? 'Homem' : '', p.idade ? `${p.idade} anos` : ''].filter(Boolean).join(', ');
  if (who) a.push(who);
  for (const k of INTEG_KEYS) if (p.integ?.[k]) a.push(`${INTEG_LABEL[k]}: ${p.integ[k]}`);
  const out = examOut(p.exames);
  if (out.length) a.push(`Exames fora da referência: ${out.map((i) => `${i.name} ${i.value}${i.unit ? ` ${i.unit}` : ''} (${i.flag}${i.date ? `, ${i.date.split('-').reverse().join('/')}` : ''})`).join('; ')}`);
  return a.join('\n');
}
