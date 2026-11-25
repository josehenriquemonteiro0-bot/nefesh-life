import { describe, expect, it } from 'vitest';
import { COACH_SYSTEM, cleanActions, cleanMessages, coachLimits, handleCoach } from './coach';

const kv = () => { const m = new Map<string, string>(); return { get: async (k: string) => m.get(k) ?? null, put: async (k: string, v: string) => void m.set(k, v) }; };
const json = (b: unknown, s: number) => new Response(JSON.stringify(b), { status: s });

function fakeClient(out: unknown, calls: unknown[] = []) {
  return { beta: { messages: { create: async (req: unknown) => { calls.push(req); return { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(out) }] }; } } } } as never;
}

describe('AI Coach', () => {
  it('as regras de segurança estão no prompt e a tabela de alimentos também', () => {
    expect(COACH_SYSTEM).toMatch(/Não fazes diagnósticos/);
    expect(COACH_SYSTEM).toMatch(/Não contradizes nem alteras orientações de profissionais/);
    expect(COACH_SYSTEM).toMatch(/estimativas/);
    expect(COACH_SYSTEM).toMatch(/Não prometes curas/);
    expect(COACH_SYSTEM).toMatch(/ovo/i);
    expect(COACH_SYSTEM).not.toMatch(/espirulina[^"]/i);
  });

  it('limpa a conversa: alterna, termina na pessoa e limita o tamanho', () => {
    expect(cleanMessages([{ role: 'assistant', text: 'olá' }])).toEqual([]);
    const m = cleanMessages([{ role: 'assistant', text: 'olá' }, { role: 'user', text: 'a' }, { role: 'user', text: 'b' }, { role: 'system', text: 'x' }]);
    expect(m).toEqual([{ role: 'user', text: 'a\nb' }]);
    expect(cleanMessages([{ role: 'user', text: 'x'.repeat(5000) }])[0].text).toHaveLength(1200);
  });

  it('valida as ações: tipos, intervalos e alimentos da tabela', () => {
    const a = cleanActions([
      { type: 'energia', value: 9, meal: '', intensity: '', title: '', replace: false, items: [] },
      { type: 'plano_refeicao', value: 1, option: 7, status: 'alterado', note: 'sem arroz', meal: '', intensity: '', title: '', replace: false, items: [] },
      { type: 'refeicao', value: 1, meal: 'pa', intensity: '', title: '', items: [{ food_id: 'inventado', name: 'Bolo da avó', grams: 80, kcal100: 380, p100: 5, c100: 50, f100: 18 }] },
      { type: 'hackear', value: 1 },
      { type: 'sono', value: 0, meal: '', intensity: '', title: '', items: [] },
    ]);
    expect(a.map((x) => x.type)).toEqual(['energia', 'plano_refeicao', 'refeicao']);
    expect(a[1]).toMatchObject({ value: 1, option: 7, status: 'alterado', note: 'sem arroz' });
    expect(a[0].value).toBe(5);
    expect(a[2].items[0].food_id).toBe('');
  });

  it('responde, devolve as ações e conta o limite diário', async () => {
    const store = kv();
    const calls: { system: { text: string }[] }[] = [];
    const client = fakeClient({ reply: 'Registei.', actions: [{ type: 'agua', value: 2, meal: '', intensity: '', title: '', items: [] }], suggest_professional: false }, calls);
    const limits = coachLimits({ TEST_MODE: 'false' });
    expect(limits.device).toBe(5);
    let r = await handleCoach({ messages: [{ role: 'user', text: 'bebi 2 copos' }], context: 'Objetivo: energia' }, store, limits, client, 'm', 'dev-12345678', '1.1.1.1', json);
    const b = await r.json();
    expect(b).toMatchObject({ reply: 'Registei.', remaining: 4, limit: 5 });
    expect(b.actions[0]).toMatchObject({ type: 'agua', value: 2 });
    expect(calls[0].system[1].text).toContain('Objetivo: energia');
    for (let i = 0; i < 4; i++) await handleCoach({ messages: [{ role: 'user', text: 'oi' }] }, store, limits, client, 'm', 'dev-12345678', '1.1.1.1', json);
    r = await handleCoach({ messages: [{ role: 'user', text: 'oi' }] }, store, limits, client, 'm', 'dev-12345678', '1.1.1.1', json);
    expect(r.status).toBe(429);
    // na fase de teste o limite é largo
    expect(coachLimits({ TEST_MODE: 'true' }).device).toBe(40);
  });
});

describe('ações em formato compacto (só os campos usados)', () => {
  it('aceita registos só com os campos que se aplicam e preenche o resto por omissão', () => {
    const a = cleanActions([
      { type: 'agua', value: 2 },
      { type: 'refeicao', meal: 'almoco', items: [{ name: 'Arroz', grams: 150, food_id: 'arroz_branco' }, { name: 'Molho caseiro', grams: 30, kcal100: 120, p100: 2, c100: 8, f100: 9 }] },
      { type: 'lembrete', note: 'Exame de sangue', date: '2026-11-27', time: '08:00' },
    ]);
    expect(a).toHaveLength(3);
    expect(a[0]).toMatchObject({ type: 'agua', value: 2, meal: '', note: '', replace: false, exercises: [], items: [] });
    expect(a[1].items[0]).toMatchObject({ food_id: 'arroz_branco', grams: 150 });
    expect(a[1].items[1]).toMatchObject({ food_id: '', kcal100: 120 });
    expect(a[2]).toMatchObject({ date: '2026-11-27', time: '08:00', note: 'Exame de sangue' });
  });
});
