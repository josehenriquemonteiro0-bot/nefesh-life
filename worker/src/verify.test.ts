import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import * as v from './verify';
import * as so from './social';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite');
function memoryDB(): so.DB {
  const db = new DatabaseSync(':memory:');
  db.exec(so.SCHEMA);
  const stmt = (sql: string, args: unknown[] = []): so.Stmt => ({
    bind: (...x: unknown[]) => stmt(sql, x),
    first: async <T,>() => ((db.prepare(sql).get(...(args as never[])) as T) ?? null),
    all: async <T,>() => ({ results: db.prepare(sql).all(...(args as never[])) as T[] }),
    run: async () => db.prepare(sql).run(...(args as never[])),
  });
  return { prepare: (sql) => stmt(sql), batch: async (s) => { for (const x of s) await x.run(); return []; } };
}
const all = { s: 20, a: 15, c: 10, m: 15, t: 15, p: 10, n: 10 };
const none = { meals: 0, spirulinaPhoto: false };

describe('pontos verificados', () => {
  it('tudo declarado: Spirulina verificada pelo stock e o resto até 50', () => {
    expect(v.scoreDay(all, none, true)).toMatchObject({ points: 70, verified: 20, declared: 50, v: 's' });
    // Spirulina fora do stock passa a declarada: tudo cabe nos 50
    expect(v.scoreDay(all, none, false)).toMatchObject({ points: 50, declared: 50, v: '' });
  });

  it('com provas chega aos 95: fotos das refeições e dados do relógio', () => {
    const r = v.scoreDay(all, { meals: 3, spirulinaPhoto: true, steps: 9000, sleepH: 7.5, exMin: 40 }, true);
    expect(r).toMatchObject({ points: 95, v: 'smtpn' });
  });

  it('sem Spirulina, os outros valem metade', () => {
    expect(v.scoreDay({ ...all, s: 0 }, none, true).points).toBe(25);
  });

  it('pontos neutros (cupões): iguais com ou sem Spirulina, sem multiplicador', () => {
    const com = v.scoreDay(all, none, true, 40);
    const sem = v.scoreDay({ ...all, s: 0 }, none, true, 40);
    expect(com.neutral).toBe(50);
    expect(sem.neutral).toBe(50);
    expect(com.points).toBeGreaterThan(sem.points);
    expect(v.scoreDay(all, { meals: 3, spirulinaPhoto: true, steps: 9000, sleepH: 7.5, exMin: 40 }, true).neutral).toBe(75);
  });

  it('stock: as tomas para além dos frascos registados deixam de contar', () => {
    const dates = Array.from({ length: 40 }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`).slice(0, 31);
    const over = v.overStock(dates, 4, []); // 120 unidades de boas-vindas = 30 dias com 4 por dia
    expect(over.size).toBe(1);
    expect(v.overStock(dates, 4, [{ date: '2026-10-20', units: 120 }]).size).toBe(0);
  });

  it('frascos: código único só uma vez; sem código, no máximo 1 a cada 15 dias', async () => {
    const db = memoryDB();
    await db.prepare("INSERT INTO bottle_codes (code, product, created) VALUES ('NEF-ABC123', 'caps', 'x')").run();
    expect((await v.registerBottle(db, 'ana', 'nef-abc123', 'caps')).body).toMatchObject({ verified: true });
    expect((await v.registerBottle(db, 'rui', 'NEF-ABC123', 'caps')).status).toBe(409);
    await v.registerBottle(db, 'ana', 'LOTE-1', 'caps');
    expect((await v.registerBottle(db, 'ana', 'LOTE-1', 'caps')).body.note).toMatch(/15 dias/);
    expect((await v.bottlesOf(db, 'ana')).length).toBe(2);
  });

  it('fotos repetidas não contam e levantam alerta', async () => {
    const db = memoryDB();
    expect(await v.newPhoto(db, 'ana', 'AAAA')).toBe(true);
    expect(await v.newPhoto(db, 'rui', 'AAAA')).toBe(false);
    expect(v.anomaly([], 3)).toBe('fotos repetidas');
    expect(v.anomaly(Array(7).fill({ declared: 50, verified: 0 }), 0)).toMatch(/declarados/);
    expect(v.anomaly(Array(7).fill({ declared: 50, verified: 10 }), 0)).toBeNull();
  });

  it('o servidor calcula os pontos da semana, ignorando o que a app diz', async () => {
    const db = memoryDB();
    await so.upsertProfile(db, 'ana', { nick: 'Ana' });
    const WED = new Date('2026-11-18T12:00:00Z');
    // a app tenta enviar 100 pontos por dia: o servidor recalcula a partir dos hábitos
    const r = await so.sync(db, 'ana', { days: { '2026-11-17': { p: 100, f: 'sacmtpn', parts: all } }, dose: 4 }, WED);
    expect(r.body.points).toBeLessThanOrEqual(70);
    // com dados do app Saúde no mesmo dia, sobe
    const r2 = await so.sync(db, 'ana', { days: { '2026-11-17': { p: 100, f: 'sacmtpn', parts: all } }, dose: 4 }, WED, { '2026-11-17': { steps: 9000, sleepH: 8, exMin: 30 } });
    expect(r2.body.points).toBeGreaterThan(r.body.points as number);
  });
});

describe('códigos de frasco por WhatsApp ou e-mail', async () => {
  const admin = await import('./admin');
  it('gera códigos únicos, a mensagem com o link e aceita o código sem hífenes', async () => {
    const db = memoryDB();
    const { codes } = await admin.generateCodes(db, 'po', 2);
    expect(codes[0]).toMatch(/^NEF-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    const msg = admin.customerMessage('Ana', 'po', codes);
    expect(msg).toContain(`?frasco=${codes[1]}`);
    expect(msg).toContain('Spirulina em pó');
    const r = await v.registerBottle(db, 'ana', codes[0].replace(/-/g, '').toLowerCase(), 'caps');
    expect(r.body).toMatchObject({ verified: true, product: 'po' });
    expect((await v.registerBottle(db, 'ana', 'NEF-ZZZZ-ZZZZ', 'caps')).status).toBe(404);
    expect(admin.adminResult('k', 'po', codes, 'Ana', '+351 912 345 678', '')).toContain('wa.me/351912345678');
  });
});

describe('captura do app Saúde', async () => {
  const { acceptShot } = await import('./healthShot');
  const base = { is_health_screenshot: true, steps: 9123.4, exercise_minutes: 35, sleep_hours: 7.4, looks_edited: false, note: '' };
  it('aceita valores de hoje e o sono da noite passada', () => {
    expect(acceptShot({ ...base, day: 'hoje' })).toEqual({ steps: 9123, exMin: 35, sleepH: 7.5 });
    expect(acceptShot({ ...base, day: 'ontem' })).toEqual({ sleepH: 7.5 });
  });
  it('recusa capturas antigas, editadas ou que não são de uma app de saúde', () => {
    expect(acceptShot({ ...base, day: 'outro' })).toBeNull();
    expect(acceptShot({ ...base, day: 'hoje', looks_edited: true })).toBeNull();
    expect(acceptShot({ ...base, day: 'hoje', is_health_screenshot: false })).toBeNull();
  });
});
