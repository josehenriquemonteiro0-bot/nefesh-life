import { describe, expect, it } from 'vitest';
import { bodyFat, cleanAssessment, foldsFor, results, series } from './proAssess';

describe('avaliação física: composição corporal', () => {
  it('Pollock 3 dobras + Siri (homem e mulher) e Pollock 7', () => {
    expect(foldsFor('jp3', 'm')).toEqual(['peitoral', 'abdominal', 'coxa']);
    expect(foldsFor('jp3', 'f')).toEqual(['triceps', 'suprailiaca', 'coxa']);
    // homem 30 anos, soma 60 mm → densidade ≈ 1,0578 → ≈ 17,9 %
    expect(bodyFat({ protocol: 'jp3', sexo: 'm', idade: 30, folds: { peitoral: 15, abdominal: 25, coxa: 20 }, gorduraMedida: null })).toBeCloseTo(17.9, 0);
    // mulher 30 anos, soma 60 mm → ≈ 24,1 %
    expect(bodyFat({ protocol: 'jp3', sexo: 'f', idade: 30, folds: { triceps: 20, suprailiaca: 15, coxa: 25 }, gorduraMedida: null })).toBeCloseTo(24.1, 0);
    const seven = { peitoral: 10, axilar: 12, triceps: 12, subescapular: 15, abdominal: 20, suprailiaca: 14, coxa: 17 };
    expect(bodyFat({ protocol: 'jp7', sexo: 'm', idade: 30, folds: seven, gorduraMedida: null })).toBeCloseTo(14.6, 0);
    expect(bodyFat({ protocol: 'jp3', sexo: 'm', idade: 30, folds: { peitoral: 15 }, gorduraMedida: null })).toBeNull();
    expect(bodyFat({ protocol: 'medido', sexo: '', idade: null, folds: {}, gorduraMedida: 22.5 })).toBe(22.5);
  });
  it('resultados: massa gorda e magra, IMC, cintura/quadril; série para o gráfico', () => {
    const a = cleanAssessment({ day: '2026-11-20', peso: '62,5', altura: 165, sexo: 'f', protocol: 'medido', gorduraMedida: 24, medidas: { cintura: 71.5, quadril: 98 } }, '2026-11-22');
    expect(results(a)).toMatchObject({ gordura: 24, gorda: 15, magra: 47.5, imc: 23, rcq: 0.73 });
    const b = cleanAssessment({ day: '2026-10-01', peso: 64, protocol: 'medido', gorduraMedida: 26 }, '2026-11-22');
    expect(series([a, b], 'peso')).toEqual([{ day: '2026-10-01', v: 64 }, { day: '2026-11-20', v: 62.5 }]);
    expect(series([a, b], 'cintura')).toEqual([{ day: '2026-11-20', v: 71.5 }]);
  });
});
