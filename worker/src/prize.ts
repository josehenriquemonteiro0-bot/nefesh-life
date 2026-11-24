/**
 * Ranking semanal global e cupão NEFESH15 (especificação v2, secção 10; decisões da NEFESH):
 * - desde 24/11/2026 a app NÃO mostra o cupão nem o prémio: o ranking é só interação. A equipa
 *   envia o cupão por e-mail, como presente, a partir da página da equipa;
 * - um só ranking global (sem regiões), semana de segunda a domingo no fuso de Lisboa;
 * - conta só os pontos neutros (`pn`, verify.ts): a Spirulina e as compras não entram, o cupão é um bónus
 *   da comunidade e não exige comprar nada;
 * - pode ganhar: 15+ dias na comunidade, check-in em 5+ dos 7 dias, sem revisão aberta,
 *   e no máximo 1 cupão a cada 4 semanas;
 * - os 3 primeiros recebem um código único de uso único NEFESH15-XXXX, válido 14 dias;
 * - desempate: mais dias com check-in, depois quem chegou primeiro à pontuação.
 * A equipa regista o código na loja online e envia-o por e-mail (página da equipa).
 */
import type { DB } from './social';

/** coupons: false desde 24/11/2026: o ranking é só interação, não há cupões nem prémios (nem pelo back-office). */
export const PRIZE = { coupons: false, winners: 3, minDays: 15, minCheckins: 5, validDays: 14, cooldownWeeks: 4, prefix: 'NEFESH15', percent: 15 };

const addDays = (key: string, n: number) => {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const parse = (s: unknown): Record<string, { p: number; f: string; pn?: number }> => {
  try {
    return typeof s === 'string' ? JSON.parse(s) : {};
  } catch {
    return {};
  }
};
/** Dias da semana com check-in feito. */
export const checkinDays = (days: string | null | undefined, week: string) =>
  Object.entries(parse(days)).filter(([k, d]) => k >= week && k <= addDays(week, 6) && d.f?.includes('c')).length;

/** Pontos do ranking dos cupões na semana: soma dos pontos neutros (dias antigos sem `pn` contam `p`). */
export const prizePoints = (days: string | null | undefined, week: string) =>
  Object.entries(parse(days)).filter(([k]) => k >= week && k <= addDays(week, 6)).reduce((t, [, d]) => t + (d.pn ?? d.p ?? 0), 0);

export function newCouponCode() {
  const abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  return `${PRIZE.prefix}-${[...crypto.getRandomValues(new Uint8Array(4))].map((x) => abc[x % abc.length]).join('')}`;
}

interface Row {
  id: string;
  nick: string;
  avatar: string | null;
  points: number;
  days: string;
  updated: string;
  created: string;
}

/** Elegibilidade de uma pessoa para o prémio da semana (data de referência: domingo). */
export function eligibility(r: Pick<Row, 'days' | 'created'>, week: string, flags: { review: boolean; recentCoupon: boolean }) {
  const sunday = addDays(week, 6);
  const daysIn = Math.floor((Date.parse(`${sunday}T23:00:00Z`) - Date.parse(r.created)) / 86400000) + 1;
  const checkins = checkinDays(r.days, week);
  const reasons: string[] = [];
  if (daysIn < PRIZE.minDays) reasons.push(`precisa de ${PRIZE.minDays} dias na comunidade (tem ${Math.max(0, daysIn)})`);
  if (checkins < PRIZE.minCheckins) reasons.push(`check-in em ${PRIZE.minCheckins} dos 7 dias (tem ${checkins})`);
  if (flags.recentCoupon) reasons.push(`já ganhou um cupão nas últimas ${PRIZE.cooldownWeeks} semanas`);
  if (flags.review) reasons.push('pontos em revisão pela equipa');
  return { ok: reasons.length === 0, daysIn: Math.max(0, daysIn), checkins, reasons };
}

async function rowsOf(db: DB, week: string) {
  const { results } = await db
    .prepare('SELECT w.id, p.nick, p.avatar, w.points, w.days, w.updated, p.created FROM weeks w JOIN profiles p ON p.id = w.id WHERE w.week = ? AND w.points > 0')
    .bind(week)
    .all<Row>();
  const { results: rev } = await db.prepare("SELECT uid FROM reviews WHERE status = 'aberto'").all<{ uid: string }>();
  const { results: recent } = await db.prepare('SELECT uid FROM coupons WHERE week >= ? AND week < ?').bind(addDays(week, -7 * (PRIZE.cooldownWeeks - 1)), week).all<{ uid: string }>();
  const review = new Set(rev.map((r) => r.uid));
  const had = new Set(recent.map((r) => r.uid));
  return results
    .map((r) => ({ ...r, league: r.points, points: prizePoints(r.days, week), el: eligibility(r, week, { review: review.has(r.id), recentCoupon: had.has(r.id) }) }))
    .filter((r) => r.points > 0)
    .sort((a, b) => b.points - a.points || b.el.checkins - a.el.checkins || a.updated.localeCompare(b.updated));
}

/** Fecha a semana: grava os 3 vencedores e gera os cupões (uma vez por semana). */
export async function closeWeek(db: DB, week: string, now = new Date(), coupons = PRIZE.coupons) {
  if (await db.prepare('SELECT 1 FROM prize_weeks WHERE week = ?').bind(week).first()) return null;
  // sem cupões: só os 3 primeiros da semana, para lhes dar os parabéns (sem condições de prémio)
  const ranked = coupons ? (await rowsOf(db, week)).filter((r) => r.el.ok).slice(0, PRIZE.winners) : (await rowsOf(db, week)).slice(0, PRIZE.winners);
  const at = now.toISOString();
  const expires = addDays(at.slice(0, 10), PRIZE.validDays);
  const winners: { uid: string; nick: string; rank: number; points: number; code: string }[] = [];
  for (const [i, r] of ranked.entries()) {
    if (!coupons) {
      winners.push({ uid: r.id, nick: r.nick, rank: i + 1, points: r.points, code: '' });
      continue;
    }
    let code = newCouponCode();
    while (await db.prepare('SELECT 1 FROM coupons WHERE code = ?').bind(code).first()) code = newCouponCode();
    await db
      .prepare("INSERT INTO coupons (code, uid, week, rank, points, status, created, expires) VALUES (?, ?, ?, ?, ?, 'atribuido', ?, ?)")
      .bind(code, r.id, week, i + 1, r.points, at, expires)
      .run();
    winners.push({ uid: r.id, nick: r.nick, rank: i + 1, points: r.points, code });
  }
  await db.prepare('INSERT INTO prize_weeks (week, winners, closed) VALUES (?, ?, ?)').bind(week, winners.length, at).run();
  return winners;
}

/** Ranking da semana atual (top 10), a minha posição, se posso ganhar e os meus cupões. */
export async function prizeState(db: DB, uid: string, week: string, today: string) {
  const ranked = await rowsOf(db, week);
  const top = ranked.slice(0, 10).map((r, i) => ({ rank: i + 1, nick: r.nick, avatar: r.avatar, points: r.points, me: r.id === uid, eligible: r.el.ok }));
  const i = ranked.findIndex((r) => r.id === uid);
  const meRow = i >= 0 ? ranked[i] : null;
  // posição entre quem pode ganhar (é a que conta para o prémio)
  const prizeRank = meRow?.el.ok ? ranked.filter((r) => r.el.ok).findIndex((r) => r.id === uid) + 1 : null;
  const prof = await db.prepare('SELECT created FROM profiles WHERE id = ?').bind(uid).first<{ created: string }>();
  const review = !!(await db.prepare("SELECT 1 FROM reviews WHERE uid = ? AND status = 'aberto'").bind(uid).first());
  const recent = !!(await db.prepare('SELECT 1 FROM coupons WHERE uid = ? AND week >= ? AND week < ?').bind(uid, addDays(week, -7 * (PRIZE.cooldownWeeks - 1)), week).first());
  const el = meRow?.el ?? (prof ? eligibility({ days: '{}', created: prof.created }, week, { review, recentCoupon: recent }) : null);
  const { results: coupons } = await db
    .prepare('SELECT code, week, rank, status, expires, seen FROM coupons WHERE uid = ? ORDER BY created DESC LIMIT 10')
    .bind(uid)
    .all<{ code: string; week: string; rank: number; status: string; expires: string; seen: number | null }>();
  return {
    prize: {
      percent: PRIZE.percent,
      winners: PRIZE.winners,
      top,
      me: { rank: i >= 0 ? i + 1 : null, prizeRank, points: meRow?.points ?? 0, eligible: el?.ok ?? false, daysIn: el?.daysIn ?? 0, checkins: el?.checkins ?? 0, reasons: el?.reasons ?? [] },
      rules: { minDays: PRIZE.minDays, minCheckins: PRIZE.minCheckins, validDays: PRIZE.validDays, cooldownWeeks: PRIZE.cooldownWeeks },
      coupons: coupons.map((c) => ({ ...c, seen: !!c.seen, expired: c.expires < today })),
    },
  };
}

export async function couponSeen(db: DB, uid: string) {
  await db.prepare('UPDATE coupons SET seen = 1 WHERE uid = ?').bind(uid).run();
  return { status: 200, body: { ok: true } };
}

/* ---------- e-mail para entregar o prémio ---------- */

/** Guarda o e-mail da conta (já verificado pelo servidor) para a equipa enviar o cupão. */
export async function saveContact(db: DB, uid: string, email: string, now = new Date()) {
  await db.prepare('INSERT INTO contacts (uid, email, updated) VALUES (?, ?, ?) ON CONFLICT(uid) DO UPDATE SET email = excluded.email, updated = excluded.updated').bind(uid, email, now.toISOString()).run();
}

/* ---------- página da equipa ---------- */

export async function couponList(db: DB) {
  const { results } = await db
    .prepare(
      `SELECT c.code, c.week, c.rank, c.points, c.status, c.expires, c.sent_at, c.used_at, p.nick, k.email
       FROM coupons c LEFT JOIN profiles p ON p.id = c.uid LEFT JOIN contacts k ON k.uid = c.uid ORDER BY c.created DESC LIMIT 60`,
    )
    .all<{ code: string; week: string; rank: number; points: number; status: string; expires: string; sent_at: string | null; used_at: string | null; nick: string | null; email: string | null }>();
  return results;
}

export async function setCouponStatus(db: DB, code: string, status: 'enviado' | 'usado' | 'atribuido', now = new Date()) {
  const at = now.toISOString();
  if (status === 'enviado') await db.prepare("UPDATE coupons SET status = 'enviado', sent_at = ? WHERE code = ?").bind(at, code).run();
  else if (status === 'usado') await db.prepare("UPDATE coupons SET status = 'usado', used_at = ? WHERE code = ?").bind(at, code).run();
  else await db.prepare("UPDATE coupons SET status = 'atribuido', sent_at = NULL, used_at = NULL WHERE code = ?").bind(code).run();
}

/** Mensagem do e-mail para o vencedor. */
export function prizeEmail(nick: string, rank: number, code: string, expires: string, shopUrl = 'https://www.nefeshglobal.shop') {
  const d = expires.split('-').reverse().join('/');
  return {
    subject: `Parabéns pelo ranking da semana: um presente da NEFESH 🏆`,
    body: `Olá ${nick || ''}!

Parabéns: ficou em ${rank}.º lugar no ranking semanal da NEFESH Life. Como agradecimento pela sua consistência, a NEFESH oferece-lhe um presente 🌿

O seu cupão de ${PRIZE.percent}% de desconto, de utilização única:
${code}

Use-o na loja online ${shopUrl} até ${d}. Não é acumulável com outras promoções.

Obrigado por fazer parte da comunidade NEFESH.
Viva a sua melhor versão.`,
  };
}
