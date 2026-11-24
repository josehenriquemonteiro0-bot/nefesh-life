import { describe, expect, it } from 'vitest';
import { CHAVES, chaveDoDia, chavesPorTema, temasDasChaves } from './chavesDoDia';
import { addDaysKey } from './dates';

describe('Chaves do Dia', () => {
  it('tem as 46 chaves, todas com texto e referência', () => {
    expect(CHAVES).toHaveLength(46);
    for (const c of CHAVES) {
      expect(c.texto.length).toBeGreaterThan(5);
      expect(c.referencia.length).toBeGreaterThan(2);
    }
  });
  it('nunca expõe a origem interna', () => {
    for (const c of CHAVES) expect(Object.keys(c)).not.toContain('origem_interna');
  });
  it('não repete nenhuma chave dentro de um ciclo completo', () => {
    const n = CHAVES.length;
    for (const ciclo of [0, 1, 7]) {
      const inicio = addDaysKey('2026-01-01', ciclo * n);
      const ids = Array.from({ length: n }, (_, i) => chaveDoDia(addDaysKey(inicio, i)).id);
      expect(new Set(ids).size).toBe(n);
    }
  });
  it('a ordem muda de um ciclo para o outro', () => {
    const n = CHAVES.length;
    const ordem = (c: number) => Array.from({ length: n }, (_, i) => chaveDoDia(addDaysKey('2026-01-01', c * n + i)).id).join();
    expect(ordem(0)).not.toBe(ordem(1));
  });
  it('é igual para o mesmo dia', () => {
    expect(chaveDoDia('2026-11-21').id).toBe(chaveDoDia('2026-11-21').id);
  });
  it('filtra por tema', () => {
    expect(temasDasChaves()).toContain('fé');
    expect(chavesPorTema('foco').every((c) => c.temas.includes('foco'))).toBe(true);
  });
});

describe('chave do dia pessoal', () => {
  it('cada pessoa tem a sua: no mesmo dia, pessoas diferentes recebem quase sempre chaves diferentes', () => {
    const hoje = '2026-11-24';
    const sementes = Array.from({ length: 40 }, (_, i) => `pessoa-${i}`);
    const chaves = new Set(sementes.map((s) => chaveDoDia(hoje, CHAVES, s).id));
    expect(chaves.size).toBeGreaterThan(20);
  });
  it('a mesma pessoa vê a mesma chave o dia todo e não repete até ver todas', () => {
    expect(chaveDoDia('2026-11-24', CHAVES, 'ana').id).toBe(chaveDoDia('2026-11-24', CHAVES, 'ana').id);
    for (const ciclo of [0, 1, 2]) {
      const ids = Array.from({ length: CHAVES.length }, (_, i) => chaveDoDia(addDaysKey('2026-01-01', ciclo * CHAVES.length + i), CHAVES, 'ana').id);
      expect(new Set(ids).size).toBe(CHAVES.length);
    }
  });
  it('sem semente, é igual para todos (como antes)', () => {
    expect(chaveDoDia('2026-11-24', CHAVES, '').id).toBe(chaveDoDia('2026-11-24').id);
  });
});
