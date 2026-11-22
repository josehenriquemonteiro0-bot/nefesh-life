import { describe, expect, it } from 'vitest';
import { bodyOf, measuredFat } from './body';
import { bodySeries, saveEvals } from './bodyLog';
import type { AppState } from './types';

const base = () => ({ ans: { sexo: 'm', idade: 35, altura: 178, peso: 90, cintura: 100, pescoco: 40, ativ: '3-4' }, bodyLog: [{ date: '2026-01-10', peso: 90 }] }) as unknown as AppState;

describe('ajuste dos dados do corpo', () => {
  it('relatório com várias datas: tudo no histórico, a mais recente no perfil', () => {
    const S = base();
    saveEvals(S, [
      { date: '2026-03-05', peso: 86, gordura: 27, medidas: { cintura: 90 } },
      { date: '2026-10-08', altura: 179, peso: 81, gordura: 20, magra: 64.8, medidas: { cintura: 82, quadril: 95, braco_d: 34.8, pescoco: null } },
    ], 'relatorio', 'Nutricionista Exemplo');
    const s = bodySeries(S);
    expect(s.map((e) => e.date)).toEqual(['2026-01-10', '2026-03-05', '2026-10-08']);
    expect(s[2]).toMatchObject({ peso: 81, cintura: 82, anca: 95, gordura: 20, magra: 64.8, medidas: { braco_d: 34.8 }, fonte: 'relatorio', por: 'Nutricionista Exemplo' });
    expect(S.ans).toMatchObject({ peso: 81, altura: 179, cintura: 82, anca: 95, pescoco: 40, gorduraMedida: 20, magraMedida: 64.8, medidaData: '2026-10-08', medidaPor: 'Nutricionista Exemplo' });
  });
  it('outros dados do relatório (dobras…) ficam no histórico e têm gráfico', async () => {
    const { extraKeys, change } = await import('./bodyLog');
    const S = base();
    saveEvals(S, [
      { date: '2026-03-05', extra: [{ label: 'Dobra tricipital', v: 15, u: 'mm' }] },
      { date: '2026-10-08', peso: 81, extra: [{ label: 'Dobra tricipital', v: 4.5, u: 'mm' }, { label: 'Densidade corporal', v: 1.051, u: 'g/mL' }, { label: 'Vazio', v: undefined, u: '' }] },
    ], 'relatorio');
    const s = bodySeries(S);
    expect(s[2].extra).toEqual({ 'Dobra tricipital': { v: 4.5, u: 'mm' }, 'Densidade corporal': { v: 1.051, u: 'g/mL' } });
    expect(extraKeys(s).map((k) => k[0])).toEqual(['x:Dobra tricipital', 'x:Densidade corporal']);
    expect(change(s, 'x:Dobra tricipital')!.sinceStart).toBe(-10.5);
  });
  it('avaliação antiga não apaga o peso mais recente', () => {
    const S = base();
    S.bodyLog = [{ date: '2026-11-01', peso: 92 }];
    S.ans!.peso = 92;
    saveEvals(S, [{ date: '2026-05-01', peso: 85, gordura: 18 }], 'manual');
    expect(S.ans!.peso).toBe(92);
    expect(S.ans!.gorduraMedida).toBe(18);
  });
  it('a gordura medida substitui a estimada e explica o IMC alto por massa muscular', () => {
    const a = { sexo: 'm', idade: 30, altura: 178, peso: 92, ativ: '5+', gorduraMedida: 14, magraMedida: 79, medidaData: new Date().toISOString().slice(0, 10) } as never;
    const b = bodyOf(a)!;
    expect(b.bmiLevel).toBe('excesso');
    expect(b.fat).toBe(14);
    expect(b.fatMethod).toBe('avaliacao');
    expect(b.muscleNote).toMatch(/massa muscular/);
    expect(b.bmr).toBe(Math.round(370 + 21.6 * 79));
  });
  it('sem medição ou com medição com mais de 1 ano: volta à estimativa', () => {
    const a = { sexo: 'm', idade: 30, altura: 178, peso: 92, gorduraMedida: 14, medidaData: '2024-01-01' } as never;
    expect(measuredFat(a, new Date('2026-11-22'))).toBeNull();
    expect(bodyOf({ sexo: 'm', idade: 30, altura: 178, peso: 92 } as never)!.muscleNote).toBeUndefined();
  });
  it('gordura medida elevada: sem a nota da massa muscular', () => {
    const b = bodyOf({ sexo: 'm', idade: 30, altura: 178, peso: 92, gorduraMedida: 29, medidaData: new Date().toISOString().slice(0, 10) } as never)!;
    expect(b.fatMethod).toBe('avaliacao');
    expect(b.muscleNote).toBeUndefined();
  });
});

describe('as medidas aparecem na evolução, nos relatórios e na IA', () => {
  const S = () => {
    const s = base();
    saveEvals(s, [
      { date: '2026-03-05', peso: 86, gordura: 27, medidas: { cintura: 90, braco_d: 33 }, extra: [{ label: 'Dobra tricipital', v: 15, u: 'mm' }] },
      { date: '2026-10-08', peso: 81, gordura: 20, medidas: { cintura: 82, braco_d: 34.8 }, extra: [{ label: 'Dobra tricipital', v: 4.5, u: 'mm' }, { label: 'Densidade corporal', v: 1.051, u: 'g/mL' }] },
    ], 'relatorio', 'Nutricionista Exemplo');
    return s;
  };
  it('evolução: primeira e última medição de cada medida', async () => {
    const { bodyEvolution } = await import('./bodyLog');
    const rows = bodyEvolution(bodySeries(S()));
    const by = Object.fromEntries(rows.map((r) => [r.label, r]));
    expect(by['% gordura']).toMatchObject({ first: 27, last: 20, diff: -7 });
    expect(by['Braço dir.']).toMatchObject({ first: 33, last: 34.8, diff: 1.8, unit: 'cm' });
    expect(by['Dobra tricipital']).toMatchObject({ first: 15, last: 4.5, diff: -10.5 });
    expect(by['Densidade corporal']).toMatchObject({ last: 1.051, diff: null });
  });
  it('contexto da IA e relatório em texto', async () => {
    const { bodyContext } = await import('./bodyLog');
    const t = bodyContext(S());
    expect(t).toContain('% gordura 27 → 20%');
    expect(t).toContain('Dobra tricipital 15 → 4,5 mm');
    expect(t).toContain('Nutricionista Exemplo');
  });
  it('relatório para o personal: as medidas só vão com a segunda autorização', async () => {
    const { shareSummary } = await import('./proShare');
    const s = { ...S(), logs: {}, evals: [], proShare: { on: true } } as unknown as AppState;
    expect(shareSummary(s).body).toBeUndefined();
    const withBody = shareSummary({ ...s, proShare: { on: true, body: true } });
    expect(withBody.body!.find((r) => r.label === 'Dobra tricipital')).toMatchObject({ first: 15, last: 4.5 });
  });
});
