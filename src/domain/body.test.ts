import { describe, expect, it } from 'vitest';
import { ageOf, bmiCategory, bmiOf, bodyOf, mifflin, navyFat } from './body';

describe('composição corporal', () => {
  it('calcula o IMC e a categoria da OMS', () => {
    expect(bmiOf(70, 175)).toBeCloseTo(22.86, 2);
    expect(bmiCategory(24.9)[0]).toBe('normal');
    expect(bmiCategory(27)[0]).toBe('excesso');
    expect(bmiCategory(31)[0]).toBe('obesidade');
    expect(bmiCategory(17)[0]).toBe('baixo');
  });
  it('usa a fórmula da Marinha dos EUA com medidas', () => {
    // homem 178 cm, cintura 86, pescoço 38 → cerca de 17%
    expect(navyFat('m', 178, 86, 38)!).toBeCloseTo(17.2, 0);
    // mulher 165 cm, cintura 72, anca 98, pescoço 33 → cerca de 27%
    expect(navyFat('f', 165, 72, 33, 98)!).toBeGreaterThan(24);
    expect(navyFat('f', 165, 72, 33, 98)!).toBeLessThan(30);
    expect(navyFat('f', 165, 72, 33)).toBeNull();
  });
  it('calcula o metabolismo basal (Mifflin-St Jeor)', () => {
    expect(mifflin('m', 80, 180, 30)).toBe(1780);
    expect(mifflin('f', 60, 165, 30)).toBeCloseTo(1320.25, 2);
  });
  it('junta tudo, com estimativa pelo IMC quando faltam medidas', () => {
    const b = bodyOf({ sexo: 'm', idade: 30, peso: 80, altura: 180, ativ: '3-4', goal: 'energia' })!;
    expect(b.bmi).toBe(24.7);
    expect(b.fatMethod).toBe('imc');
    expect(b.bmr).toBe(1780);
    expect(b.tdee).toBe(2759);
    expect(b.target).toBe(2760);
    expect(b.protein).toBe(112);
    expect(b.corpo).toBe("manter");
    expect(bodyOf({ peso: 70 })).toBeNull();
  });
  it('cria um défice para quem quer perder peso, sem descer abaixo do basal', () => {
    const b = bodyOf({ sexo: 'f', idade: 40, peso: 85, altura: 162, ativ: '0', goal: 'peso', cintura: 98, pescoco: 35, anca: 112 })!;
    expect(b.fatMethod).toBe('medidas');
    expect(b.target).toBeGreaterThanOrEqual(b.bmr - 10);
    expect(b.target).toBeLessThan(b.tdee);
    expect(b.whtr).toBe(0.6);
  });
  it('aceita idades antigas em intervalo', () => {
    expect(ageOf({ idade: '30-44' })).toBe(37);
    expect(ageOf({ idade: 52 })).toBe(52);
  });
});

describe('objetivo para o corpo', () => {
  const base = { sexo: 'm' as const, idade: 35, peso: 80, altura: 180, ativ: '3-4', goal: 'energia' as const };
  it('perder gordura: défice de 10% (suave) ou 20% (moderado), no máximo 500 kcal', () => {
    const m = bodyOf({ ...base, corpo: 'manter' })!;
    const s = bodyOf({ ...base, corpo: 'perder-suave' })!;
    const d = bodyOf({ ...base, corpo: 'perder-moderado' })!;
    expect(m.tdee - s.target).toBeGreaterThanOrEqual(250);
    expect(m.tdee - s.target).toBeLessThanOrEqual(290);
    expect(m.tdee - d.target).toBeLessThanOrEqual(505);
    expect(d.target).toBeGreaterThanOrEqual(d.bmr - 10);
    expect(s.protein).toBe(144);
  });
  it('ganhar massa: excedente de +200 ou +300 kcal e 2 g/kg de proteína', () => {
    const m = bodyOf({ ...base, corpo: 'manter' })!;
    expect(bodyOf({ ...base, corpo: 'ganhar-suave' })!.target - m.target).toBe(200);
    expect(bodyOf({ ...base, corpo: 'ganhar-moderado' })!.target - m.target).toBe(300);
    expect(bodyOf({ ...base, corpo: 'ganhar-suave' })!.protein).toBe(160);
  });
  it('trava o défice para menores, IMC baixo e gravidez', () => {
    expect(bodyOf({ ...base, idade: 16, corpo: 'perder-moderado' })!.safety).toMatch(/18 anos/);
    expect(bodyOf({ ...base, peso: 55, corpo: 'perder-suave' })!.safety).toMatch(/18,5/);
    const g = bodyOf({ ...base, sexo: 'f', safe: ['gravidez'], corpo: 'perder-suave' })!;
    expect(g.safety).toMatch(/gravidez/);
    expect(g.target).toBe(Math.round(g.tdee / 10) * 10);
  });
  it('avaliações antigas deduzem o objetivo', () => {
    expect(bodyOf({ ...base, goal: 'peso', peso: 95 })!.corpo).toBe('perder-moderado');
    expect(bodyOf({ ...base, goal: 'peso' })!.corpo).toBe('perder-suave');
    expect(bodyOf({ ...base })!.corpo).toBe('manter');
  });
});
