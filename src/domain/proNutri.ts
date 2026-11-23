/**
 * NEFESH Life Pro para nutricionistas (e médicos): plano alimentar prescrito ao paciente.
 * Sem dependências: a app e o servidor usam este ficheiro.
 *
 * - Um plano tem 1 a 3 tipos de dia (ex.: "Dias de treino" às seg/qua/sex e "Outros dias").
 * - Cada dia tem refeições com hora; cada refeição tem opções (A, B…) com alimentos em gramas e medida caseira.
 * - Os valores (kcal, proteína, hidratos, gordura, fibra) são calculados a partir da base de alimentos
 *   (TACO) ou escritos pelo nutricionista; ficam guardados em cada alimento do plano.
 */

export type NMealKey = 'pa' | 'lanche_m' | 'almoco' | 'lanche' | 'jantar' | 'ceia';
export const NMEALS: [NMealKey, string, string][] = [
  ['pa', 'Pequeno-almoço', '07:30'],
  ['lanche_m', 'Lanche da manhã', '10:30'],
  ['almoco', 'Almoço', '13:00'],
  ['lanche', 'Lanche da tarde', '16:30'],
  ['jantar', 'Jantar', '20:00'],
  ['ceia', 'Ceia', '22:30'],
];
export const NMEAL_LABEL = Object.fromEntries(NMEALS.map(([k, l]) => [k, l])) as Record<NMealKey, string>;

export interface NItem { food: string; grams: number; measure: string; kcal: number; p: number; c: number; f: number; fib: number }
export interface NOption { name: string; items: NItem[] }
export interface NMeal { key: NMealKey; label: string; time: string; options: NOption[]; notes: string }
export interface NDay { name: string; /** dias da semana (0 = domingo); vazio = os restantes */ weekdays: number[]; meals: NMeal[] }
export interface NTargets { kcal: number; protein: number; carbs: number; fat: number; fiber: number; /** litros de água por dia */ water: number }
export interface NutriRx {
  days: NDay[];
  targets: NTargets;
  notes: string;
  /** Spirulina indicada pelo nutricionista (g por dia), se ajustar a dose */
  spirulina?: number;
}

export interface Macros { kcal: number; p: number; c: number; f: number; fib: number }
const ZERO: Macros = { kcal: 0, p: 0, c: 0, f: 0, fib: 0 };
const r1 = (n: number) => Math.round(n * 10) / 10;

/** Um alimento da base (valores por 100 g) na quantidade indicada. */
export function itemFrom(food: { name: string; kcal: number; p: number; c: number; f: number; fib: number }, grams: number, measure = ''): NItem {
  const k = grams / 100;
  return { food: food.name, grams, measure, kcal: Math.round(food.kcal * k), p: r1(food.p * k), c: r1(food.c * k), f: r1(food.f * k), fib: r1(food.fib * k) };
}
/** Muda a quantidade de um alimento já no plano (proporcional). */
export function scaleItem(it: NItem, grams: number): NItem {
  if (!it.grams) return { ...it, grams };
  const k = grams / it.grams;
  return { ...it, grams, kcal: Math.round(it.kcal * k), p: r1(it.p * k), c: r1(it.c * k), f: r1(it.f * k), fib: r1(it.fib * k) };
}

export function sumItems(items: NItem[]): Macros {
  return items.reduce((t, x) => ({ kcal: t.kcal + x.kcal, p: r1(t.p + x.p), c: r1(t.c + x.c), f: r1(t.f + x.f), fib: r1(t.fib + x.fib) }), { ...ZERO });
}
/** Total de uma refeição (pela 1.ª opção). */
export const mealTotals = (m: NMeal): Macros => sumItems(m.options[0]?.items ?? []);
/** Total de um dia (1.ª opção de cada refeição). */
export function dayTotals(d: NDay): Macros {
  return d.meals.reduce((t, m) => { const x = mealTotals(m); return { kcal: t.kcal + x.kcal, p: r1(t.p + x.p), c: r1(t.c + x.c), f: r1(t.f + x.f), fib: r1(t.fib + x.fib) }; }, { ...ZERO });
}

/** Diferença entre o dia e as metas, em %, para avisos (só metas definidas). */
export function vsTargets(t: Macros, g: NTargets) {
  const pct = (v: number, goal: number) => (goal > 0 ? Math.round((v / goal) * 100) : null);
  return { kcal: pct(t.kcal, g.kcal), protein: pct(t.p, g.protein), carbs: pct(t.c, g.carbs), fat: pct(t.f, g.fat), fiber: pct(t.fib, g.fiber) };
}

/** O tipo de dia que vale numa data. */
export function dayFor(rx: NutriRx, date: Date): NDay {
  const wd = date.getDay();
  return rx.days.find((d) => d.weekdays.includes(wd)) ?? rx.days.find((d) => !d.weekdays.length) ?? rx.days[0];
}

/** Metas sugeridas a partir do perfil (Mifflin-St Jeor × atividade, ajustadas ao objetivo). */
export function suggestTargets(p: { sexo?: string; idade?: number | null; altura?: number | null; peso?: number | null; objetivo?: string; dias?: number | null }): NTargets | null {
  if (!p.peso || !p.altura) return null;
  const age = p.idade || 35;
  const bmr = 10 * p.peso + 6.25 * p.altura - 5 * age + (p.sexo === 'm' ? 5 : -161);
  const act = (p.dias ?? 3) >= 5 ? 1.65 : (p.dias ?? 3) >= 3 ? 1.5 : 1.35;
  const obj = (p.objetivo ?? '').toLowerCase();
  const lose = /emagre|perder|défice|defice|gordura/.test(obj);
  const gain = /hipertrof|massa|ganhar|força|forca/.test(obj);
  const kcal = Math.round((bmr * act * (lose ? 0.82 : gain ? 1.1 : 1)) / 10) * 10;
  const protein = Math.round(p.peso * (lose || gain ? 1.8 : 1.4));
  const fat = Math.round((kcal * 0.28) / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { kcal, protein, carbs, fat, fiber: p.sexo === 'm' ? 30 : 25, water: r1((p.peso * 35) / 1000) };
}

export const emptyMeal = (key: NMealKey): NMeal => ({ key, label: NMEAL_LABEL[key], time: NMEALS.find((m) => m[0] === key)![2], options: [{ name: 'Opção A', items: [] }], notes: '' });
export const emptyRx = (): NutriRx => ({
  days: [{ name: 'Todos os dias', weekdays: [], meals: (['pa', 'almoco', 'lanche', 'jantar'] as NMealKey[]).map(emptyMeal) }],
  targets: { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, water: 0 },
  notes: '',
});

/* ───────── limpeza (servidor) ───────── */

const str = (v: unknown, max: number) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const n = (v: unknown, max: number, dec = 1) => { const x = Number(v); return Number.isFinite(x) && x >= 0 ? Math.min(max, Math.round(x * 10 ** dec) / 10 ** dec) : 0; };
const time = (v: unknown, def: string) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(String(v)) ? String(v) : def);

export function cleanNutri(x: unknown): NutriRx | null {
  const o = (x ?? null) as Record<string, unknown> | null;
  if (!o || typeof o !== 'object') return null;
  const days = (Array.isArray(o.days) ? o.days : []).slice(0, 3).map((d, i) => {
    const y = (d ?? {}) as Record<string, unknown>;
    const meals = (Array.isArray(y.meals) ? y.meals : []).slice(0, 8).map((m) => {
      const z = (m ?? {}) as Record<string, unknown>;
      const key = (NMEALS.some((k) => k[0] === z.key) ? z.key : 'almoco') as NMealKey;
      const options = (Array.isArray(z.options) ? z.options : []).slice(0, 4).map((op, j) => {
        const w = (op ?? {}) as Record<string, unknown>;
        const items = (Array.isArray(w.items) ? w.items : []).slice(0, 15).map((it) => {
          const q = (it ?? {}) as Record<string, unknown>;
          return { food: str(q.food, 90), grams: n(q.grams, 2000, 0), measure: str(q.measure, 40), kcal: n(q.kcal, 3000, 0), p: n(q.p, 300), c: n(q.c, 500), f: n(q.f, 300), fib: n(q.fib, 100) };
        }).filter((it) => it.food);
        return { name: str(w.name, 30) || `Opção ${'ABCD'[j]}`, items };
      });
      return { key, label: str(z.label, 40) || NMEAL_LABEL[key], time: time(z.time, NMEALS.find((k) => k[0] === key)![2]), options: options.length ? options : [{ name: 'Opção A', items: [] }], notes: str(z.notes, 200) };
    });
    const weekdays = (Array.isArray(y.weekdays) ? y.weekdays : []).map(Number).filter((w) => Number.isInteger(w) && w >= 0 && w <= 6);
    return { name: str(y.name, 40) || (i ? `Dia ${i + 1}` : 'Todos os dias'), weekdays: [...new Set(weekdays)].sort(), meals };
  }).filter((d) => d.meals.length);
  if (!days.length) return null;
  const t = (o.targets ?? {}) as Record<string, unknown>;
  const sp = n(o.spirulina, 15);
  return {
    days,
    targets: { kcal: n(t.kcal, 6000, 0), protein: n(t.protein, 400, 0), carbs: n(t.carbs, 900, 0), fat: n(t.fat, 400, 0), fiber: n(t.fiber, 100, 0), water: n(t.water, 8) },
    notes: str(o.notes, 600),
    ...(sp ? { spirulina: sp } : {}),
  };
}
/** Há pelo menos um alimento no plano? */
export const nutriFilled = (rx: NutriRx | null | undefined) => !!rx?.days.some((d) => d.meals.some((m) => m.options.some((o) => o.items.length)));

/* ───────── para o diário do paciente ───────── */

const PLAN_MEAL: Record<NMealKey, 'pa' | 'almoco' | 'lanche' | 'jantar' | 'ceia' | 'outro'> = { pa: 'pa', lanche_m: 'outro', almoco: 'almoco', lanche: 'lanche', jantar: 'jantar', ceia: 'ceia' };

/** O plano do dia no formato do diário (o mesmo do plano lido de PDF): refeições, opções, "segui/alterei". */
export function toDailyPlan(rx: NutriRx, date: Date, professional: string) {
  const day = dayFor(rx, date);
  const tot = dayTotals(day);
  return {
    is_plan: true,
    day: day.name,
    meals: day.meals.map((m) => ({
      meal: PLAN_MEAL[m.key],
      label: m.label,
      time: m.time,
      options: m.options.filter((o) => o.items.length).map((o) => ({
        name: o.name,
        items: o.items.map((it) => ({ name: it.food, quantity: it.measure ? `${it.measure} (${it.grams} g)` : `${it.grams} g`, grams: it.grams, kcal: it.kcal, protein_g: it.p, carbs_g: it.c, fat_g: it.f })),
      })),
    })).filter((m) => m.options.length),
    daily_kcal: rx.targets.kcal || tot.kcal,
    daily_protein_g: rx.targets.protein || Math.round(tot.p),
    professional,
    notes: [rx.notes, ...day.meals.filter((m) => m.notes).map((m) => `${m.label}: ${m.notes}`)].filter(Boolean).join(' · '),
  };
}

/* ───────── registo diário do paciente (para o nutricionista) ───────── */

export interface NutriDayLog {
  /** refeições do plano: estado e alterações */
  meals: { label: string; status: 'seguido' | 'alterado' | 'saltado' | ''; changes: string[] }[];
  /** adesão do dia (0–100) */
  pct: number;
  kcal?: number; prot?: number; water?: boolean; hunger?: number; fastH?: number; weight?: number;
}

export function cleanDayLog(x: unknown): NutriDayLog {
  const o = (x ?? {}) as Record<string, unknown>;
  const meals = (Array.isArray(o.meals) ? o.meals : []).slice(0, 8).map((m) => {
    const y = (m ?? {}) as Record<string, unknown>;
    const st: NutriDayLog['meals'][number]['status'] = ['seguido', 'alterado', 'saltado'].includes(String(y.status)) ? (String(y.status) as 'seguido') : '';
    return { label: str(y.label, 40), status: st, changes: (Array.isArray(y.changes) ? y.changes : []).slice(0, 6).map((c) => str(c, 80)).filter(Boolean) };
  });
  const opt = (k: string, max: number, dec = 1) => (typeof o[k] === 'number' && (o[k] as number) > 0 ? { [k]: n(o[k], max, dec) } : {});
  return { meals, pct: n(o.pct, 100, 0), ...opt('kcal', 10000, 0), ...opt('prot', 500, 0), ...(typeof o.water === 'boolean' ? { water: o.water } : {}), ...opt('hunger', 5, 0), ...opt('fastH', 48), ...opt('weight', 300) };
}

export interface NutriAlert { kind: 'enviar' | 'adesao' | 'parado' | 'fome' | 'peso' | 'checkin' | 'retorno'; text: string }

/** "Precisa de atenção" para nutrição, a partir dos registos diários (mais recentes primeiro). */
export function nutriAttention(logs: { day: string; data: NutriDayLog }[], o: { linked: boolean; hasPlan: boolean; planSince?: string; hasDraft?: boolean; checkinLow?: string | null; nextVisit?: string | null }, now = new Date()): NutriAlert[] {
  const out: NutriAlert[] = [];
  const dd = (k: string) => Math.floor((now.getTime() - new Date(`${k}T12:00:00`).getTime()) / 864e5);
  const dm = (k: string) => `${k.slice(8, 10)}/${k.slice(5, 7)}`;
  if (o.linked && !o.hasPlan) out.push({ kind: 'enviar', text: o.hasDraft ? 'Já usou o código, mas o plano ainda não foi enviado (está guardado)' : 'Já usou o código e está à espera do plano' });
  if (o.linked && o.hasPlan) {
    const last = logs[0];
    const since = last ? dd(last.day) : o.planSince ? dd(o.planSince.slice(0, 10)) : 0;
    if (since >= 5) out.push({ kind: 'parado', text: last ? `Sem registos há ${since} dias` : `Ainda não registou nenhuma refeição (plano enviado há ${since} dias)` });
    const week = logs.filter((l) => dd(l.day) < 7 && l.data.meals.some((m) => m.status));
    if (week.length >= 3) {
      const avg = Math.round(week.reduce((t, l) => t + l.data.pct, 0) / week.length);
      if (avg < 50) out.push({ kind: 'adesao', text: `Adesão ao plano de ${avg}% nos últimos 7 dias` });
    }
    const hungry = logs.filter((l) => dd(l.day) < 7 && (l.data.hunger ?? 0) >= 4);
    if (hungry.length >= 3) out.push({ kind: 'fome', text: `Fome alta em ${hungry.length} dias desta semana` });
    const w = logs.filter((l) => l.data.weight).map((l) => ({ day: l.day, w: l.data.weight! }));
    if (w.length >= 2) {
      const newest = w[0];
      const old = w.find((x) => dd(x.day) >= 21);
      const weekAgo = w.find((x) => dd(x.day) >= 7);
      if (weekAgo && newest.w - weekAgo.w >= 1.5) out.push({ kind: 'peso', text: `Peso subiu ${String(r1(newest.w - weekAgo.w)).replace('.', ',')} kg numa semana (${dm(weekAgo.day)} → ${dm(newest.day)})` });
      else if (old && Math.abs(newest.w - old.w) < 0.3) out.push({ kind: 'peso', text: `Peso estável há 3 semanas (${String(newest.w).replace('.', ',')} kg)` });
    }
  }
  if (o.checkinLow) out.push({ kind: 'checkin', text: o.checkinLow });
  if (o.nextVisit) {
    const d = -dd(o.nextVisit);
    if (d >= 0 && d <= 2) out.push({ kind: 'retorno', text: d === 0 ? 'Consulta de retorno hoje' : `Consulta de retorno em ${d} ${d === 1 ? 'dia' : 'dias'} (${dm(o.nextVisit)})` });
  }
  return out;
}

/* ───────── anamnese ───────── */

export const ANAMNESE = [
  ['patologias', 'Doenças e condições', 'ex.: diabetes tipo 2, hipertensão, refluxo'],
  ['medicacao', 'Medicação e suplementos', 'ex.: metformina 850 mg, vitamina D'],
  ['alergias', 'Alergias e intolerâncias', 'ex.: lactose, glúten, marisco'],
  ['preferencias', 'Preferências e estilo', 'ex.: vegetariana, come fora ao almoço'],
  ['aversoes', 'Não gosta / não come', 'ex.: peixe, coentros'],
  ['rotina', 'Rotina e horários', 'ex.: acorda 6h30, trabalha por turnos, treina às 19h'],
  ['intestino', 'Intestino', 'ex.: obstipação, 1×/dia'],
  ['agua', 'Água e bebidas', 'ex.: 1 L/dia, 3 cafés'],
  ['alcool', 'Álcool e tabaco', 'ex.: vinho ao fim de semana'],
  ['sono', 'Sono e stress', 'ex.: dorme 6 h, stress alto'],
  ['historico', 'Dietas e tentativas anteriores', 'ex.: low carb em 2024, perdeu 6 kg e recuperou'],
] as const;
export type AnamKey = (typeof ANAMNESE)[number][0];
export function cleanAnamnese(x: unknown): Partial<Record<AnamKey, string>> {
  const o = (x ?? {}) as Record<string, unknown>;
  return Object.fromEntries(ANAMNESE.map(([k]) => [k, str(o[k], 300)]).filter(([, v]) => v)) as Partial<Record<AnamKey, string>>;
}
