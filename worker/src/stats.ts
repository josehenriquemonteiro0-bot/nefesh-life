/**
 * Estatísticas anónimas da NEFESH Life.
 *
 * POST /evento  guarda um resumo por telemóvel e por dia (identificador cifrado, apaga-se em 120 dias).
 * GET  /stats   página com os totais dos últimos 30 dias (protegida pelo segredo STATS_KEY, se existir).
 */
import { dayKey } from './limits';

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
  };
}
export type CleanPing = ReturnType<typeof cleanPing>;

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
  const keys = (await listAll(store, 'a:')).filter((k) => k.slice(2, 12) >= since);
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
  return {
    perDay,
    accounts,
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

export function statsPage(s: Awaited<ReturnType<typeof summarize>>) {
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
<h2>Fase do ritual</h2><table>${kv(s.stage)}</table>
<h2>Sistema</h2><table>${kv(s.platform)}</table>
<h2>Formato da Spirulina</h2><table>${kv(s.format)}</table>
<h2>Por dia</h2><table><tr><th>Dia</th><th>Ativos</th><th>Novos</th><th>Fotos</th><th>Planos lidos</th><th>Dicas</th></tr>${table}</table>
</body></html>`;
}
