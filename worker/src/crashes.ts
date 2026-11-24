/**
 * Avisos automáticos de falhas da app (web e iPhone).
 *
 * A app envia um relatório anónimo quando algo corre mal: a mensagem do erro, as primeiras linhas do
 * percurso no código, o ecrã, a versão e a plataforma. Sem nome, e-mail, conta, aparelho nem dados de saúde.
 * As falhas iguais juntam-se numa só linha (com contagem); apagam-se ao fim de 90 dias.
 * A equipa vê-as na página da equipa e recebe um resumo diário por e-mail (se o envio estiver configurado).
 */
import type { DB } from './social';

export const KEEP_DAYS = 90;
/** Limpa números longos, e-mails e endereços que possam ter entrado numa mensagem de erro. */
export const scrub = (s: unknown, max: number) =>
  String(s ?? '')
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[e-mail]')
    .replace(/\b\d{6,}\b/g, '[n]')
    .replace(/([?&][\w-]+=)[^&\s]+/g, '$1…')
    .slice(0, max);

const sha = async (s: string) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].slice(0, 10).map((b) => b.toString(16).padStart(2, '0')).join('');

export interface CrashBody { message?: unknown; stack?: unknown; where?: unknown; version?: unknown; platform?: unknown; kind?: unknown }

export async function saveCrash(db: DB, b: CrashBody, now = new Date()) {
  const message = scrub(b.message, 300).trim();
  if (!message) return { status: 400, body: { error: 'sem mensagem' } };
  const stack = scrub(b.stack, 1500);
  const where = scrub(b.where, 60);
  const version = scrub(b.version, 40);
  const platform = ['ios', 'web', 'android'].includes(String(b.platform)) ? String(b.platform) : 'web';
  const kind = ['erro', 'promessa', 'ecra'].includes(String(b.kind)) ? String(b.kind) : 'erro';
  // a mesma falha = a mesma mensagem e a mesma primeira linha do percurso
  const sig = await sha(`${message}|${stack.split('\n').find((l) => l.trim()) ?? ''}`);
  const at = now.toISOString();
  await db
    .prepare(
      `INSERT INTO crashes (sig, message, stack, place, version, platform, kind, first, last, count, emailed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0)
       ON CONFLICT(sig) DO UPDATE SET last = excluded.last, count = count + 1, version = excluded.version, place = excluded.place, emailed = 0`,
    )
    .bind(sig, message, stack, where, version, platform, kind, at, at)
    .run();
  return { status: 200, body: { ok: true } };
}

export interface CrashRow { sig: string; message: string; stack: string; place: string; version: string; platform: string; kind: string; first: string; last: string; count: number; emailed: number }

export async function listCrashes(db: DB, limit = 100) {
  const { results } = await db.prepare('SELECT * FROM crashes ORDER BY last DESC LIMIT ?').bind(limit).all<CrashRow>();
  return results;
}

export async function purgeCrashes(db: DB, now = new Date()) {
  await db.prepare('DELETE FROM crashes WHERE last < ?').bind(new Date(now.getTime() - KEEP_DAYS * 86400000).toISOString()).run();
}

/** Texto do resumo diário: falhas novas ou que voltaram a acontecer desde o último e-mail. */
export function digest(rows: CrashRow[], adminUrl: string) {
  const lines = rows.map((r) => `• ${r.count}× ${r.message}\n  ${r.platform} · ${r.place || '—'} · versão ${r.version || '—'} · última: ${r.last.slice(0, 16).replace('T', ' ')} UTC`);
  return {
    subject: `NEFESH Life: ${rows.length} ${rows.length === 1 ? 'falha nova' : 'falhas novas'} na app`,
    text: `Olá,\n\nNas últimas horas a app registou estas falhas (relatórios anónimos, sem dados pessoais):\n\n${lines.join('\n\n')}\n\nDetalhe completo na página da equipa: ${adminUrl}\n\nNEFESH Life`,
  };
}

interface Mailer { send(m: unknown): Promise<void> }

/**
 * Envia o resumo (uma vez por dia, de manhã em Lisboa) se houver falhas por avisar.
 * Precisa do envio de e-mail da Cloudflare configurado (binding MAILER); sem ele, as falhas ficam só na página da equipa.
 */
export async function emailDigest(db: DB, mailer: Mailer | undefined, from: string, to: string, adminUrl: string, now = new Date()) {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Lisbon', hour: '2-digit', hourCycle: 'h23' }).format(now));
  if (!mailer || hour !== 8) return null;
  const { results } = await db.prepare('SELECT * FROM crashes WHERE emailed = 0 ORDER BY count DESC LIMIT 30').all<CrashRow>();
  if (!results.length) return null;
  const d = digest(results, adminUrl);
  const raw = [`From: NEFESH Life <${from}>`, `To: ${to}`, `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(d.subject)))}?=`, 'MIME-Version: 1.0', 'Content-Type: text/plain; charset=utf-8', 'Content-Transfer-Encoding: 8bit', '', d.text].join('\r\n');
  // módulo do runtime da Cloudflare (só existe no servidor)
  const { EmailMessage } = (await import(/* @vite-ignore */ 'cloudflare:email' as string)) as { EmailMessage: new (from: string, to: string, raw: string) => unknown };
  await mailer.send(new EmailMessage(from, to, raw));
  await db.prepare('UPDATE crashes SET emailed = 1 WHERE emailed = 0').run();
  return results.length;
}
