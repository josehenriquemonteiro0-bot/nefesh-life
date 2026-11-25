/**
 * Avaliação real da IA da ficha integrativa (só quando é pedida, no GitHub):
 * 1) notas de consulta ditadas, desarrumadas → campos certos, alertas (interações) e perguntas;
 * 2) um boletim de análises em PDF → valores, unidades, referências e marcações certas.
 * Escreve eval/relatorio-integ.md e falha se alguma verificação falhar.
 */
import Anthropic from '@anthropic-ai/sdk';
import { writeFileSync } from 'node:fs';
import { organizeInteg, readExam } from '../src/proAI';

const model = process.env.MODEL || 'claude-opus-5-5';
const client = new Anthropic({ timeout: 180_000, maxRetries: 1 });
const kv = () => { const m = new Map<string, string>(); return { get: async (k: string) => m.get(k) ?? null, put: async (k: string, v: string) => void m.set(k, v) }; };
const out: string[] = [`# Ficha integrativa · avaliação da IA (${model})`, ''];
let fails = 0;
const ok = (cond: boolean, what: string) => { out.push(`- ${cond ? '✅' : '❌'} ${what}`); if (!cond) fails++; };

/** PDF mínimo com texto (Helvetica, WinAnsi), sem bibliotecas. */
function pdf(lines: string[]): string {
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const stream = `BT /F1 10 Tf 40 800 Td 14 TL ${lines.map((l) => `(${esc(l)}) '`).join(' ')} ET`;
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  ];
  let body = '%PDF-1.4\n';
  const offs: number[] = [];
  objs.forEach((o, i) => { offs.push(Buffer.byteLength(body, 'latin1')); body += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const x = Buffer.byteLength(body, 'latin1');
  body += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`;
  return Buffer.from(body, 'latin1').toString('base64');
}

async function anamnese() {
  out.push('## 1. Notas da consulta → ficha', '');
  const text = 'paciente paula 42 anos é... ela tá cansada faz uns seis meses, piorou depois que mudou de emprego. acorda todo dia 3 da manhã e não volta a dormir. intestino preso, vai a cada dois três dias, muito inchaço depois do almoço. toma levotiroxina 50 por causa do hipotireoidismo e começou por conta própria a tomar hipericão porque tava ansiosa, também toma anticoncepcional. faz endócrino uma vez por ano. toma uns quatro cafés por dia, quase não bebe água. o quarto tem mofo na parede e ela dorme com o celular do lado da cama. a mãe é diabética. ah e perdeu 7 quilos nos últimos dois meses sem fazer dieta.';
  const r = await organizeInteg(client, model, kv(), 'eval', 'ip', { text, integ: {}, sexo: '', idade: null });
  const b = r.body as { integ: Record<string, string>; sexo: string; idade: number | null; alerts: string[]; ask: string[]; summary: string };
  out.push('```json', JSON.stringify(b, null, 2), '```', '');
  ok(r.status === 200, 'resposta 200');
  const i = b.integ ?? {};
  ok(b.sexo === 'f' && b.idade === 42, 'sexo e idade');
  ok(/levotiroxina/i.test(i.medicacao ?? '') && /hiperic/i.test(i.medicacao ?? '') && /anticoncep/i.test(i.medicacao ?? ''), 'medicação: levotiroxina, hipericão e anticoncecional');
  ok(/hipotire|hipotiro/i.test(i.doencas ?? ''), 'doenças: hipotireoidismo');
  ok(/3/.test(i.sono ?? ''), 'sono: acorda às 3h');
  ok(/preso|inchaço|2|dois/i.test(i.digestao ?? ''), 'digestão e intestino');
  ok(/mofo|bolor/i.test(i.ambiente ?? '') && /celular|telem/i.test(i.ambiente ?? ''), 'ambiente: mofo e celular');
  ok(/diab/i.test(i.familia ?? ''), 'histórico familiar');
  ok(/caf/i.test(i.habitos ?? '') || /caf/i.test(i.alimentacao ?? ''), 'café');
  const al = (b.alerts ?? []).join(' ');
  ok(/hiperic/i.test(al) && /(anticoncep|levotirox|intera)/i.test(al), 'alerta: interação do hipericão');
  ok(/(peso|quilo|kg)/i.test(al), 'alerta: perda de peso sem explicação');
  ok(!/(suspend|pare de tomar|parar de tomar|interromp)/i.test(JSON.stringify(b)), 'não manda parar medicação');
  ok(!/\bhistoria\b/.test(Object.keys(i).join(' ')) || (i.historia ?? '').length > 0, 'campos vazios não aparecem');
}

async function exame() {
  out.push('', '## 2. Boletim de análises em PDF → valores', '');
  const file = pdf([
    'LABORATORIO CENTRAL DE ANALISES CLINICAS - Cuiaba MT',
    'Paciente: Paula S.   Sexo: Feminino   Idade: 42 anos',
    'Data da coleta: 02/10/2026',
    '',
    'EXAME                     RESULTADO     UNIDADE     VALORES DE REFERENCIA',
    'Hemoglobina               11.2 *        g/dL        12.0 a 15.5',
    'Ferritina                 9.0 *         ng/mL       15 a 150',
    'Vitamina D (25-OH)        18.5 *        ng/mL       30 a 100',
    'Vitamina B12              420           pg/mL       200 a 900',
    'TSH                       3.9           uUI/mL      0.4 a 4.0',
    'T4 livre                  1.1           ng/dL       0.8 a 1.8',
    'Glicose em jejum          102 *         mg/dL       70 a 99',
    'Insulina                  14            uUI/mL      2.6 a 24.9',
    'PCR ultrassensivel        0.6           mg/dL       inferior a 0.5',
    'Magnesio                  1.9           mg/dL       1.6 a 2.6',
    '',
    '* valores fora da faixa de referencia',
  ]);
  const r = await readExam(client, model, kv(), 'eval', 'ip', { file, media_type: 'application/pdf' });
  const e = (r.body as { exam?: { date: string; lab: string; items: { name: string; value: string; unit: string; ref: string; flag: string }[] } }).exam;
  out.push('```json', JSON.stringify(r.body, null, 2), '```', '');
  ok(r.status === 200 && !!e, 'exame lido');
  if (!e) return;
  const get = (re: RegExp) => e.items.find((x) => re.test(x.name));
  ok(e.date === '2026-10-02', 'data da coleta');
  ok(e.items.length >= 10, `todos os valores (${e.items.length} de 10)`);
  ok(get(/ferritina/i)?.value.replace(',', '.').startsWith('9') === true && get(/ferritina/i)?.flag === 'baixo', 'ferritina 9 · baixo');
  ok(get(/vitamina d/i)?.flag === 'baixo' && /18,5/.test(get(/vitamina d/i)?.value ?? ''), 'vitamina D 18,5 · baixo (vírgula)');
  ok(get(/glic/i)?.flag === 'alto', 'glicose 102 · alto');
  ok(get(/tsh/i)?.flag === 'normal', 'TSH 3,9 · normal');
  ok(get(/pcr/i)?.flag === 'alto', 'PCR 0,6 · alto (sem asterisco, pela referência)');
  ok(get(/b12/i)?.flag === 'normal' && get(/b12/i)?.unit === 'pg/mL', 'B12 · unidade e normal');
}

async function anamnesePT() {
  out.push('', '## 3. Notas em português de Portugal, grávida com suplementos', '');
  const text = 'Joana, 31 anos, grávida de 14 semanas. Vem por enjoos e obstipação. Toma ácido fólico e começou por conta própria chá de sene e óleo de onagra que a amiga recomendou. Médica de família acompanha a gravidez. Dorme bem. Muita azia à noite.';
  const r = await organizeInteg(client, model, kv(), 'eval', 'ip', { text, integ: { queixa: 'Enjoos' }, sexo: '', idade: null });
  const b = r.body as { integ: Record<string, string>; alerts: string[]; ask: string[] };
  out.push('```json', JSON.stringify(b, null, 2), '```', '');
  const i = b.integ ?? {};
  ok(/grávida|gravidez/i.test(i.hormonal ?? '') || /grávida|gravidez/i.test(i.doencas ?? ''), 'gravidez registada');
  ok(/sene/i.test(i.medicacao ?? '') && /onagra/i.test(i.medicacao ?? '') && /f[óo]lico/i.test(i.medicacao ?? ''), 'medicação e suplementos');
  ok(/enjo/i.test(i.queixa ?? ''), 'mantém a queixa que já estava');
  const al = (b.alerts ?? []).join(' ');
  ok(/(gravidez|grávida)/i.test(al) && /(sene|onagra|fitoter|suplement|chá)/i.test(al), 'alerta: fitoterápicos na gravidez');
  ok(!/(suspend|pare de tomar|parar de tomar|interromp)/i.test(JSON.stringify(b)), 'não manda parar nada');
}

async function exameAnterior() {
  out.push('', '## 4. Boletim com coluna de resultado anterior', '');
  const file = pdf([
    'LABORATORIO VIDA - Cuiaba MT          Coleta: 15/11/2026',
    '',
    'EXAME              RESULTADO   RESULTADO ANTERIOR (10/05/2026)   REFERENCIA',
    'Ferritina          22 ng/mL    9 ng/mL                           15 a 150',
    'Vitamina D         34 ng/mL    18 ng/mL                          30 a 100',
    'Colesterol total   212 mg/dL   230 mg/dL                         inferior a 190',
  ]);
  const r = await readExam(client, model, kv(), 'eval', 'ip', { file, media_type: 'application/pdf' });
  const e = (r.body as { exam?: { date: string; items: { name: string; value: string; flag: string }[] } }).exam;
  out.push('```json', JSON.stringify(r.body, null, 2), '```', '');
  ok(!!e, 'exame lido');
  if (!e) return;
  const get = (re: RegExp) => e.items.find((x) => re.test(x.name));
  ok(e.date === '2026-11-15', 'data da coleta atual');
  ok(get(/ferritina/i)?.value.startsWith('22') === true && get(/ferritina/i)?.flag === 'normal', 'ferritina: o valor atual (22), normal');
  ok(get(/vitamina d/i)?.value.startsWith('34') === true, 'vitamina D: o valor atual (34)');
  ok(get(/colesterol/i)?.flag === 'alto', 'colesterol 212 · alto');
}

const t0 = Date.now();
try { await anamnese(); } catch (err) { ok(false, `anamnese falhou: ${(err as Error).message}`); }
try { await exame(); } catch (err) { ok(false, `exame falhou: ${(err as Error).message}`); }
try { await anamnesePT(); } catch (err) { ok(false, `anamnese PT falhou: ${(err as Error).message}`); }
try { await exameAnterior(); } catch (err) { ok(false, `exame anterior falhou: ${(err as Error).message}`); }
out.push('', `${fails ? `❌ ${fails} falha(s)` : '✅ tudo certo'} · ${Math.round((Date.now() - t0) / 1000)} s`);
writeFileSync(new URL('./relatorio-integ.md', import.meta.url), out.join('\n'));
console.log(out.join('\n'));
if (fails) process.exit(1);
