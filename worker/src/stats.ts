/**
 * Estatísticas anónimas da NEFESH Life.
 *
 * POST /evento  guarda um resumo por telemóvel e por dia (identificador cifrado, apaga-se em 120 dias).
 * GET  /stats   página com os totais dos últimos 30 dias (protegida pelo segredo STATS_KEY, se existir).
 */
import { dayKey } from './limits';
import { SERVER_FEATURES } from './features';

export interface StatsStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
  list(opts: { prefix: string; cursor?: string; limit?: number }): Promise<{ keys: { name: string }[]; list_complete: boolean; cursor?: string }>;
}

const TTL = 60 * 60 * 24 * 120;
const SALT = 'nefesh-life-estatisticas';

/** Só os campos esperados, com tipos e limites: nada de texto livre. */
export function cleanPing(b: Record<string, unknown>) {
  const int = (v: unknown, max = 7) => Math.max(0, Math.min(max, Math.round(Number(v) || 0)));
  const pick = <T extends string>(v: unknown, ok: readonly T[], def: T): T => (ok.includes(v as T) ? (v as T) : def);
  return {
    plan: b.plan === true,
    stage: pick(b.stage, ['0', '1-7', '8-30', '31+', 'sem plano'] as const, 'sem plano'),
    spirulina: int(b.spirulina),
    water: int(b.water),
    checkin: int(b.checkin),
    diary: int(b.diary),
    steps: int(b.steps),
    workouts: int(b.workouts),
    nutriPlan: b.nutriPlan === true,
    trainPlan: b.trainPlan === true,
    format: pick(b.format, ['caps', 'po', 'nibs'] as const, 'caps'),
    installed: b.installed === true,
    platform: pick(b.platform, ['ios', 'android', 'outro'] as const, 'outro'),
    evals: int(b.evals, 100),
    premium: b.premium === true,
    // aderência à Spirulina: antes da app (resposta do quiz) e nos últimos 14 dias
    prior: pick(b.prior, ['nunca', 'as-vezes', 'regular', 'sem resposta'] as const, 'sem resposta'),
    adh14: int(b.adh14, 100),
    // dados para investigação e desenvolvimento: só chegam de quem autorizou na app
    rd: cleanRd(b.rd),
    // usos de funcionalidades Premium (só chaves conhecidas)
    premiumUses: Object.fromEntries(
      Object.entries((b.premiumUses && typeof b.premiumUses === 'object' ? b.premiumUses : {}) as Record<string, unknown>)
        .filter(([k]) => Object.prototype.hasOwnProperty.call(SERVER_FEATURES, k) && SERVER_FEATURES[k].tier === 'premium')
        .map(([k, v]) => [k, int(v, 999)]),
    ) as Record<string, number>,
  };
}
export type CleanPing = ReturnType<typeof cleanPing>;

const GOALS = ['energia', 'desporto', 'imunidade', 'foco', 'nutricao', 'peso'] as const;
/** Médias e objetivo para I&D (sem texto livre; só números arredondados). */
export function cleanRd(v: unknown) {
  if (!v || typeof v !== 'object') return null;
  const r = v as Record<string, unknown>;
  const num = (x: unknown, min: number, max: number) => (x === null || x === undefined || Number.isNaN(Number(x)) ? null : Math.max(min, Math.min(max, Math.round(Number(x) * 10) / 10)));
  return {
    goal: (GOALS as readonly string[]).includes(String(r.goal)) ? (r.goal as (typeof GOALS)[number]) : null,
    eStart: num(r.eStart, 1, 5),
    eNow: num(r.eNow, 1, 5),
    sStart: num(r.sStart, 0, 14),
    sNow: num(r.sNow, 0, 14),
    idxStart: num(r.idxStart, 0, 100),
    idxNow: num(r.idxNow, 0, 100),
  };
}

export async function hashDevice(device: string) {
  const data = new TextEncoder().encode(`${SALT}:${device}`);
  const h = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(h)].slice(0, 8).map((x) => x.toString(16).padStart(2, '0')).join('');
}

export async function savePing(store: StatsStore, device: string, body: Record<string, unknown>, now = new Date()) {
  if (device === 'sem-id') return false;
  const id = await hashDevice(device);
  const day = dayKey(now);
  // primeira vez que este telemóvel aparece
  const seen = await store.get(`a1:${id}`);
  if (!seen) await store.put(`a1:${id}`, day, { expirationTtl: TTL });
  await store.put(`a:${day}:${id}`, JSON.stringify({ ...cleanPing(body), first: seen ?? day }), { expirationTtl: TTL });
  return true;
}

async function listAll(store: StatsStore, prefix: string) {
  const names: string[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < 20; i++) {
    const r = await store.list({ prefix, cursor, limit: 1000 });
    names.push(...r.keys.map((k) => k.name));
    if (r.list_complete || !r.cursor) break;
    cursor = r.cursor;
  }
  return names;
}

export interface DayStats {
  day: string;
  active: number;
  fresh: number;
  photos: number;
  plans: number;
  tips: number;
}

export async function summarize(store: StatsStore, days = 30, now = new Date()) {
  const dayList = Array.from({ length: days }, (_, i) => dayKey(new Date(now.getTime() - i * 86400000)));
  const since = dayList[dayList.length - 1];
  const allKeys = await listAll(store, 'a:');
  const keys = allKeys.filter((k) => k.slice(2, 12) >= since);
  const values = await Promise.all(keys.map(async (k) => ({ k, v: JSON.parse((await store.get(k)) ?? 'null') as (CleanPing & { first: string }) | null })));
  const perDay: DayStats[] = await Promise.all(
    dayList.map(async (day) => {
      const rows = values.filter((x) => x.k.slice(2, 12) === day && x.v);
      const n = async (k: string) => Number((await store.get(k)) ?? 0) || 0;
      return { day, active: rows.length, fresh: rows.filter((r) => r.v!.first === day).length, photos: await n(`g:${day}`), plans: await n(`pg:${day}`), tips: await n(`tg:${day}`) };
    }),
  );
  // o resumo mais recente de cada telemóvel
  const latest = new Map<string, CleanPing & { first: string }>();
  for (const { k, v } of values.sort((a, b) => a.k.localeCompare(b.k))) if (v) latest.set(k.slice(13), v);
  const devs = [...latest.values()];
  const ids7 = new Set(values.filter((x) => x.k.slice(2, 12) >= dayList[6]).map((x) => x.k.slice(13)));
  const share = (f: (p: CleanPing) => boolean) => (devs.length ? Math.round((devs.filter(f).length / devs.length) * 100) : 0);
  const count = <K extends keyof CleanPing>(k: K) => devs.reduce<Record<string, number>>((m, p) => ({ ...m, [String(p[k])]: (m[String(p[k])] ?? 0) + 1 }), {});
  const accounts = (await listAll(store, 'u:')).length;
  // interesse em funcionalidades Premium: usos somados nos 30 dias
  const premiumUses: Record<string, number> = {};
  for (const { v } of values) for (const [k, n] of Object.entries(v?.premiumUses ?? {})) premiumUses[k] = (premiumUses[k] ?? 0) + n;
  // aderência média nos últimos 14 dias, por uso de Spirulina antes da app
  const PRIOR: Record<string, string> = { nunca: 'Nunca tinham tomado', 'as-vezes': 'Tomavam às vezes', regular: 'Já tomavam com regularidade', 'sem resposta': 'Sem resposta' };
  const adherenceByPrior: Record<string, { n: number; avg: number }> = {};
  for (const p of devs.filter((d) => d.plan && d.adh14 !== undefined)) {
    const k = PRIOR[p.prior ?? 'sem resposta'] ?? 'Sem resposta';
    const g = (adherenceByPrior[k] ??= { n: 0, avg: 0 });
    g.avg = (g.avg * g.n + (p.adh14 ?? 0)) / (g.n + 1);
    g.n++;
  }
  // retenção D7 e D30 (todos os telemóveis, pelos dias em que a app foi aberta; até 120 dias)
  const seen = new Map<string, string[]>();
  for (const k of allKeys) {
    const day = k.slice(2, 12);
    const id = k.slice(13);
    seen.set(id, [...(seen.get(id) ?? []), day]);
  }
  const addD = (d: string, n: number) => dayKey(new Date(Date.parse(`${d}T12:00:00Z`) + n * 86400000));
  const today = dayList[0];
  const retention = (n: number) => {
    const cohort = [...seen.values()].map((ds) => ds.sort()).filter((ds) => addD(ds[0], n) <= today);
    const kept = cohort.filter((ds) => ds.some((d) => d >= addD(ds[0], n)));
    return { cohort: cohort.length, pct: cohort.length ? Math.round((kept.length / cohort.length) * 100) : null };
  };
  // painel de I&D: só de quem autorizou (o resumo mais recente de cada telemóvel)
  const rdDevs = devs.filter((d) => d.rd);
  type G = { n: number; adh: number; dE: number[]; dS: number[]; dI: number[] };
  const group = (key: (d: CleanPing) => string | null) => {
    const out: Record<string, G> = {};
    for (const d of rdDevs) {
      const k = key(d);
      if (!k) continue;
      const g = (out[k] ??= { n: 0, adh: 0, dE: [], dS: [], dI: [] });
      g.adh = (g.adh * g.n + d.adh14) / (g.n + 1);
      g.n++;
      if (d.rd!.eStart !== null && d.rd!.eNow !== null) g.dE.push(d.rd!.eNow - d.rd!.eStart);
      if (d.rd!.sStart !== null && d.rd!.sNow !== null) g.dS.push(d.rd!.sNow - d.rd!.sStart);
      if (d.rd!.idxStart !== null && d.rd!.idxNow !== null) g.dI.push(d.rd!.idxNow - d.rd!.idxStart);
    }
    const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);
    return Object.fromEntries(Object.entries(out).map(([k, g]) => [k, { n: g.n, adh: Math.round(g.adh), energy: avg(g.dE), sleep: avg(g.dS), index: avg(g.dI) }]));
  };
  const rd = { devices: rdDevs.length, byGoal: group((d) => d.rd!.goal), byProduct: group((d) => d.format) };
  return {
    perDay,
    accounts,
    adherenceByPrior,
    retention: { d7: retention(7), d30: retention(30) },
    rd,
    premiumUses,
    devices30: devs.length,
    devices7: ids7.size,
    features: {
      'Fizeram a avaliação': share((p) => p.plan),
      'Tomaram Spirulina (na semana)': share((p) => p.spirulina > 0),
      'Spirulina 5+ dias na semana': share((p) => p.spirulina >= 5),
      'Registaram água': share((p) => p.water > 0),
      'Fizeram check-in': share((p) => p.checkin > 0),
      'Usaram o diário': share((p) => p.diary > 0),
      'Registaram passos': share((p) => p.steps > 0),
      'Registaram treinos': share((p) => p.workouts > 0),
      'Carregaram plano do nutricionista': share((p) => p.nutriPlan),
      'Carregaram plano do personal': share((p) => p.trainPlan),
      'Reavaliaram pelo menos 1 vez': share((p) => p.evals >= 2),
      'Instalaram no ecrã principal': share((p) => p.installed),
    },
    stage: count('stage'),
    platform: count('platform'),
    format: count('format'),
  };
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

type Community = { members: number; invites: number; inviters: number; resets: number; resetPeople: number; resetDone: number; challenges: number; circles: number } | null;

const GOAL_NAME: Record<string, string> = { energia: 'Energia', desporto: 'Treino', imunidade: 'Defesas', foco: 'Foco', nutricao: 'Alimentação vegetal', peso: 'Saciedade e peso' };
const sign = (v: number | null) => (v === null ? '—' : `${v > 0 ? '+' : ''}${String(v).replace('.', ',')}`);
function rdTable(title: string, g: Record<string, { n: number; adh: number; energy: number | null; sleep: number | null; index: number | null }>, names: Record<string, string>) {
  const rows = Object.entries(g).sort((a, b) => b[1].n - a[1].n);
  if (!rows.length) return `<h3>${title}</h3><p class="m">Ainda sem dados.</p>`;
  return `<h3>${title}</h3><table><tr><th></th><th>Pessoas</th><th>Aderência</th><th>Energia</th><th>Sono</th><th>Índice</th></tr>${rows
    // grupos com menos de 3 pessoas: só a contagem (não se mostram médias que identifiquem alguém)
    .map(([k, v]) => (v.n < 3 ? `<tr><td>${esc(names[k] ?? k)}</td><td>${v.n}</td><td colspan="4" class="m">poucas pessoas para mostrar médias</td></tr>` : `<tr><td>${esc(names[k] ?? k)}</td><td>${v.n}</td><td>${v.adh}%</td><td>${sign(v.energy)}</td><td>${sign(v.sleep)}</td><td>${sign(v.index)}</td></tr>`))
    .join('')}</table><p class="m">Grupos com menos de 5 pessoas não devem ser usados para conclusões.</p>`;
}

export function statsPage(s: Awaited<ReturnType<typeof summarize>>, community: Community = null) {
  const max = Math.max(1, ...s.perDay.map((d) => d.active));
  const days = [...s.perDay].reverse();
  const bars = days
    .map((d) => `<div class="b" title="${d.day}: ${d.active} ativos, ${d.fresh} novos"><i style="height:${(d.active / max) * 100}%"></i><em style="height:${(d.fresh / max) * 100}%"></em></div>`)
    .join('');
  const kv = (o: Record<string, number>) => Object.entries(o).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v}</td></tr>`).join('');
  const feat = Object.entries(s.features).map(([k, v]) => `<tr><td>${esc(k)}</td><td><span class="bar"><i style="width:${v}%"></i></span> ${v}%</td></tr>`).join('');
  const table = s.perDay
    .filter((d) => d.active || d.photos || d.plans || d.tips)
    .map((d) => `<tr><td>${d.day}</td><td>${d.active}</td><td>${d.fresh}</td><td>${d.photos}</td><td>${d.plans}</td><td>${d.tips}</td></tr>`)
    .join('');
  return `<!doctype html><html lang="pt-PT"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NEFESH Life · Estatísticas</title>
<style>
body{margin:0;background:#0b1410;color:#e8ede9;font:15px/1.45 system-ui,sans-serif;padding:16px;max-width:820px;margin:auto}
h1{font-size:22px;margin:8px 0 4px}h2{font-size:16px;margin:24px 0 8px;color:#00FE8A}
.k{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px}.k div{background:#14201a;border-radius:12px;padding:12px}.k b{display:block;font-size:26px}
.chart{display:flex;gap:3px;align-items:flex-end;height:120px;background:#14201a;border-radius:12px;padding:10px}.b{flex:1;height:100%;position:relative}
.b i,.b em{position:absolute;bottom:0;left:0;right:0;border-radius:3px}.b i{background:#2b6b4c}.b em{background:#00FE8A}
table{width:100%;border-collapse:collapse}td,th{padding:6px 4px;border-bottom:1px solid #23302a;text-align:left}th{color:#97a69f;font-weight:500}
.bar{display:inline-block;width:120px;height:8px;background:#23302a;border-radius:4px;vertical-align:middle}.bar i{display:block;height:100%;background:#00FE8A;border-radius:4px}
.m{color:#97a69f;font-size:13px}
</style></head><body>
<h1>NEFESH Life · Estatísticas</h1><p class="m">Últimos 30 dias. Contagens anónimas: sem nomes, e-mails ou dados de saúde.</p>
<div class="k"><div><b>${s.devices7}</b>ativos nos últimos 7 dias</div><div><b>${s.devices30}</b>ativos nos últimos 30 dias</div><div><b>${s.perDay.reduce((t, d) => t + d.fresh, 0)}</b>novos em 30 dias</div><div><b>${s.perDay.reduce((t, d) => t + d.photos, 0)}</b>fotos analisadas</div><div><b>${s.accounts}</b>contas criadas</div></div>
<h2>Utilizadores ativos por dia</h2><div class="chart">${bars}</div><p class="m">verde claro: novos · verde escuro: total ativos · da esquerda (há 30 dias) para a direita (hoje)</p>
<h2>O que as pessoas usam</h2><p class="m">Percentagem dos telemóveis ativos em 30 dias, pelo resumo mais recente de cada um.</p><table>${feat}</table>
<h2>Interesse em funcionalidades Premium (usos em 30 dias)</h2><table>${Object.keys(s.premiumUses).length ? kv(s.premiumUses) : '<tr><td class="m">Ainda sem usos registados.</td></tr>'}</table>
<h2>Aderência à Spirulina: antes e com a app</h2><p class="m">Aderência média nos últimos 14 dias (% de dias com a toma feita), agrupada pela resposta do quiz "Já tomou Spirulina antes?".</p><table><tr><th>Antes da app</th><th>Pessoas</th><th>Aderência com a app</th></tr>${Object.entries(s.adherenceByPrior).map(([k, g]) => `<tr><td>${esc(k)}</td><td>${g.n}</td><td>${Math.round(g.avg)}%</td></tr>`).join('') || '<tr><td class="m" colspan="3">Ainda sem dados.</td></tr>'}</table>
${community ? `<h2>Comunidade</h2><table>
<tr><td>Pessoas na comunidade</td><td>${community.members}</td></tr>
<tr><td>Entraram por convite</td><td>${community.invites}</td></tr>
<tr><td>Pessoas que convidaram alguém</td><td>${community.inviters}</td></tr>
<tr><td>Convites por quem convida (média)</td><td>${community.inviters ? (community.invites / community.inviters).toFixed(1).replace('.', ',') : '—'}</td></tr>
<tr><td>21 Day Reset: começados</td><td>${community.resets}</td></tr>
<tr><td>21 Day Reset: participantes</td><td>${community.resetPeople}</td></tr>
<tr><td>21 Day Reset: concluídos</td><td>${community.resetDone}</td></tr>
<tr><td>Outros desafios criados</td><td>${community.challenges}</td></tr>
<tr><td>Circles</td><td>${community.circles}</td></tr>
</table>` : ''}
<h2>Retenção</h2><table><tr><th></th><th>Pessoas</th><th>Voltaram</th></tr>
<tr><td>D7 (abriram a app 7+ dias depois do 1.º dia)</td><td>${s.retention.d7.cohort}</td><td>${s.retention.d7.pct ?? '—'}${s.retention.d7.pct !== null ? '%' : ''}</td></tr>
<tr><td>D30 (30+ dias depois)</td><td>${s.retention.d30.cohort}</td><td>${s.retention.d30.pct ?? '—'}${s.retention.d30.pct !== null ? '%' : ''}</td></tr></table>
<h2>Investigação e desenvolvimento (só de quem autorizou)</h2>
<p class="m">${s.rd.devices} ${s.rd.devices === 1 ? 'pessoa autorizou' : 'pessoas autorizaram'} o uso dos dados agregados para desenvolver novas fórmulas. Variação = valor atual menos o do início (energia e sono no check-in, 1–5; Índice NEFESH 0–100). Aderência: % de dias com a toma nos últimos 14.</p>
${rdTable('Por objetivo', s.rd.byGoal, GOAL_NAME)}
${rdTable('Por produto', s.rd.byProduct, { caps: 'Cápsulas', po: 'Pó', nibs: 'Palhinha (Nibs)' })}
<h2>Fase do ritual</h2><table>${kv(s.stage)}</table>
<h2>Sistema</h2><table>${kv(s.platform)}</table>
<h2>Formato da Spirulina</h2><table>${kv(s.format)}</table>
<h2>Por dia</h2><table><tr><th>Dia</th><th>Ativos</th><th>Novos</th><th>Fotos</th><th>Planos lidos</th><th>Dicas</th></tr>${table}</table>
</body></html>`;
}
