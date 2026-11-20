/**
 * Verificação dos pontos: o servidor calcula os pontos, não a app.
 *
 * Cada hábito é VERIFICADO ✅ (o servidor tem uma prova) ou DECLARADO ☑️ (a pessoa marcou).
 * - Verificados contam por inteiro; declarados contam até 50 pontos por dia no total.
 * - Spirulina verificada: dentro do stock dos frascos registados e, nos dias de verificação
 *   (cerca de 1 em cada 7, ao acaso), com uma foto da Spirulina analisada pela IA.
 * - Refeições verificadas: fotos do prato analisadas pela IA (5 pontos cada, até 15).
 * - Passos, sono e exercício verificados: vindos do app Saúde (atalho ou app nativa).
 * - Água e check-in: sempre declarados.
 */
import type { DB } from './social';

export type Habit = 's' | 'a' | 'c' | 'm' | 't' | 'p' | 'n';
export const FULL: Record<Habit, number> = { s: 20, a: 15, c: 10, m: 15, t: 15, p: 10, n: 10 };
export const DECLARED_CAP = 50;
export const DAY_CAP = 100;
/** stock de boas-vindas: o primeiro frasco, que muitas pessoas já têm antes de usar a app */
export const WELCOME_UNITS = 120;
export const UNITS_PER_BOTTLE = 120;

export interface Proofs {
  /** fotos de refeições válidas nesse dia */
  meals: number;
  /** foto da Spirulina aceite nesse dia */
  spirulinaPhoto: boolean;
  /** dados do app Saúde nesse dia */
  steps?: number;
  sleepH?: number;
  exMin?: number;
}

export interface DayScore {
  points: number;
  verified: number;
  declared: number;
  /** letras dos hábitos verificados */
  v: string;
}

/** Partes declaradas pela app, limitadas ao máximo de cada hábito. */
export function cleanParts(raw: unknown): Record<Habit, number> {
  const out = { s: 0, a: 0, c: 0, m: 0, t: 0, p: 0, n: 0 } as Record<Habit, number>;
  if (!raw || typeof raw !== 'object') return out;
  for (const k of Object.keys(out) as Habit[]) out[k] = Math.max(0, Math.min(FULL[k], Math.round(Number((raw as Record<string, unknown>)[k]) || 0)));
  return out;
}

/**
 * Pontos de um dia.
 * @param spirulinaOk a toma está dentro do stock e, se for dia de verificação, tem foto
 */
export function scoreDay(parts: Record<Habit, number>, proofs: Proofs, spirulinaOk: boolean, streak = 0): DayScore {
  const ver = { s: 0, a: 0, c: 0, m: 0, t: 0, p: 0, n: 0 } as Record<Habit, number>;
  const dec = { ...parts };
  // Spirulina
  if (parts.s && spirulinaOk) {
    ver.s = parts.s;
    dec.s = 0;
  }
  // refeições: 5 pontos por foto analisada
  const vm = Math.min(FULL.m, proofs.meals * 5);
  ver.m = vm;
  dec.m = Math.max(0, parts.m - vm);
  // dados do app Saúde
  if (proofs.steps !== undefined) {
    ver.p = proofs.steps >= 8000 ? 10 : proofs.steps >= 5000 ? 5 : 0;
    dec.p = 0;
  }
  if (proofs.sleepH !== undefined) {
    ver.n = proofs.sleepH >= 7 ? 10 : 0;
    dec.n = 0;
  }
  if (proofs.exMin !== undefined && proofs.exMin >= 20) {
    ver.t = 15;
    dec.t = 0;
  }
  const spirulina = ver.s + dec.s;
  const sum = (o: Record<Habit, number>, skipS: boolean) => (Object.keys(o) as Habit[]).filter((k) => !skipS || k !== 's').reduce((t, k) => t + o[k], 0);
  let verified = sum(ver, true);
  let declared = Math.min(DECLARED_CAP, sum(dec, true) + dec.s);
  // a Spirulina é a chave do dia: sem nenhuma toma, os outros hábitos valem metade
  if (!spirulina) {
    verified = Math.round(verified / 2);
    declared = Math.round(declared / 2);
  }
  verified += ver.s;
  const mult = streak >= 30 ? 1.1 : streak >= 7 ? 1.05 : 1;
  const points = Math.min(DAY_CAP, Math.round((verified + declared) * mult));
  return { points, verified, declared, v: (Object.keys(ver) as Habit[]).filter((k) => ver[k] > 0).join('') };
}

/** Dia de verificação da Spirulina: cerca de 1 em cada 7, igual para a app e o servidor, imprevisível sem o id. */
export async function isCheckDay(uid: string, date: string) {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`verificacao:${uid}:${date}`)));
  return h[0] % 7 === 0;
}

/**
 * Que dias de Spirulina cabem no stock: percorre os dias por ordem e gasta a dose diária
 * do stock registado (frascos + o de boas-vindas). Devolve as datas fora do stock.
 */
export function overStock(sDates: string[], dose: number, bottleUnits: { date: string; units: number }[]) {
  const out = new Set<string>();
  let left = WELCOME_UNITS;
  const bottles = [...bottleUnits].sort((a, b) => a.date.localeCompare(b.date));
  let bi = 0;
  for (const d of [...sDates].sort()) {
    while (bi < bottles.length && bottles[bi].date <= d) left += bottles[bi++].units;
    if (left >= dose) left -= dose;
    else out.add(d);
  }
  return out;
}

/* ---------- provas guardadas pelo servidor ---------- */

export async function addProof(db: DB, uid: string, date: string, kind: string, value = 1, now = new Date()) {
  await db.prepare('INSERT INTO proofs (uid, date, kind, value, created) VALUES (?, ?, ?, ?, ?)').bind(uid, date, kind, value, now.toISOString()).run();
}

/** Recusa fotos repetidas. Devolve true se a foto é nova (e regista-a). */
export async function newPhoto(db: DB, uid: string, base64: string, now = new Date()) {
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(base64)))].map((x) => x.toString(16).padStart(2, '0')).join('');
  const seen = await db.prepare('SELECT uid FROM photo_hashes WHERE hash = ?').bind(hash).first<{ uid: string }>();
  if (seen) {
    await addProof(db, uid, now.toISOString().slice(0, 10), 'foto-repetida', 1, now);
    return false;
  }
  await db.prepare('INSERT INTO photo_hashes (hash, uid, created) VALUES (?, ?, ?)').bind(hash, uid, now.toISOString()).run();
  return true;
}

export async function proofsFor(db: DB, uid: string, from: string, to: string) {
  const { results } = await db
    .prepare('SELECT date, kind, COUNT(*) AS n FROM proofs WHERE uid = ? AND date >= ? AND date <= ? GROUP BY date, kind')
    .bind(uid, from, to)
    .all<{ date: string; kind: string; n: number }>();
  const map = new Map<string, Proofs & { repeated: number }>();
  for (const r of results) {
    const p = map.get(r.date) ?? { meals: 0, spirulinaPhoto: false, repeated: 0 };
    if (r.kind === 'refeicao') p.meals = Math.min(3, r.n);
    if (r.kind === 'spirulina') p.spirulinaPhoto = true;
    if (r.kind === 'foto-repetida') p.repeated += r.n;
    map.set(r.date, p);
  }
  return map;
}

/** Frascos registados (com unidades) para o cálculo do stock. */
export async function bottlesOf(db: DB, uid: string) {
  const { results } = await db.prepare('SELECT created, units FROM bottles WHERE uid = ?').bind(uid).all<{ created: string; units: number }>();
  return results.map((r) => ({ date: r.created.slice(0, 10), units: r.units }));
}

/**
 * Regista um frasco. Com um código único (bottle_codes), o código só serve uma vez e o frasco fica verificado.
 * Sem código único (QR do lote), conta como declarado: no máximo um frasco a cada 15 dias.
 */
export async function registerBottle(db: DB, uid: string, codeRaw: unknown, productRaw: unknown, now = new Date()) {
  let code = String(codeRaw ?? '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 40);
  // aceita o código escrito sem hífenes (ex.: NEFABCD2345)
  if (/^NEF[A-Z0-9]{8}$/.test(code)) code = `NEF-${code.slice(3, 7)}-${code.slice(7)}`;
  const product = ['caps', 'po', 'nibs'].includes(String(productRaw)) ? String(productRaw) : 'caps';
  const at = now.toISOString();
  if (code) {
    const unique = await db.prepare('SELECT product, used_by FROM bottle_codes WHERE code = ?').bind(code).first<{ product: string; used_by: string | null }>();
    if (unique) {
      if (unique.used_by) return { status: 409, body: { error: unique.used_by === uid ? 'Este frasco já está registado.' : 'Este código de frasco já foi usado.' } };
      await db.batch([
        db.prepare('UPDATE bottle_codes SET used_by = ?, used_at = ? WHERE code = ?').bind(uid, at, code),
        db.prepare('INSERT INTO bottles (uid, code, product, units, verified, created) VALUES (?, ?, ?, ?, 1, ?)').bind(uid, code, unique.product, UNITS_PER_BOTTLE, at),
      ]);
      return { status: 200, body: { ok: true, verified: true, product: unique.product } };
    }
  }
  if (/^NEF-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)) return { status: 404, body: { error: 'Código de frasco não encontrado. Confirme as letras e os números.' } };
  const since = new Date(now.getTime() - 15 * 86400000).toISOString();
  const recent = await db.prepare('SELECT COUNT(*) AS n FROM bottles WHERE uid = ? AND verified = 0 AND created > ?').bind(uid, since).first<{ n: number }>();
  if ((recent?.n ?? 0) >= 1) return { status: 200, body: { ok: true, verified: false, note: 'Frasco guardado. Frascos sem código único contam no máximo um a cada 15 dias.' } };
  await db.prepare('INSERT INTO bottles (uid, code, product, units, verified, created) VALUES (?, ?, ?, ?, 0, ?)').bind(uid, code || null, product, UNITS_PER_BOTTLE, at).run();
  return { status: 200, body: { ok: true, verified: false } };
}

/** Sinais de fraude da semana. Devolve o motivo, ou null. */
export function anomaly(days: { declared: number; verified: number }[], repeatedPhotos: number) {
  if (repeatedPhotos >= 3) return 'fotos repetidas';
  const maxed = days.filter((d) => d.declared >= DECLARED_CAP - 5 && d.verified === 0).length;
  if (maxed >= 6 && days.every((d) => d.verified === 0)) return 'só pontos declarados no máximo durante a semana';
  return null;
}
