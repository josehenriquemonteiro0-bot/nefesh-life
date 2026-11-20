import { describe, expect, it } from 'vitest';
import { labFlag, labSeries, preventionFor } from './care';
import { declaredWarnings, medAdherence, medWarnings, medsToday, reminderTimes } from './meds';

const NOW = new Date('2026-11-20T12:00:00');

describe('prevenção', () => {
  it('escolhe os check-ups pela idade e pelo sexo', () => {
    const ids = (ans: object) => preventionFor({ ans } as never, NOW).map((p) => p.id);
    const f52 = ids({ idade: 52, sexo: 'f' });
    expect(f52).toEqual(expect.arrayContaining(['checkup', 'colo', 'mama', 'intestino', 'tetano']));
    expect(f52).not.toContain('prostata');
    const m30 = ids({ idade: 30, sexo: 'm' });
    expect(m30).not.toContain('intestino');
    expect(m30).not.toContain('mama');
    expect(ids({ idade: 62, sexo: 'm' })).toEqual(expect.arrayContaining(['prostata', 'gripe']));
  });
  it('calcula a próxima data e o estado', () => {
    const S = { ans: { idade: 45, sexo: 'f' }, care: { prev: { checkup: '2025-10-01', dentista: '2026-06-01', tetano: '2026-12-01' } } } as never;
    const p = Object.fromEntries(preventionFor(S, NOW).map((x) => [x.id, x]));
    expect(p.checkup).toMatchObject({ next: '2026-10-01', status: 'atrasado' });
    expect(p.dentista).toMatchObject({ next: '2027-06-01', status: 'em-dia' });
    expect(p.mama.status).toBe('sem-data');
  });
});

describe('análises', () => {
  it('assinala valores fora da referência e mostra a evolução', () => {
    expect(labFlag({ id: '1', date: '2026-01-01', key: 'ldl', name: 'LDL', value: 140, unit: 'mg/dL' })).toBe('alto');
    expect(labFlag({ id: '1', date: '2026-01-01', key: 'hdl', name: 'HDL', value: 42, unit: 'mg/dL' }, 'f')).toBe('baixo');
    expect(labFlag({ id: '1', date: '2026-01-01', key: 'vitd', name: 'D', value: 25, unit: 'ng/mL', lo: 20, hi: 100 })).toBeNull(); // referência do laboratório
    const S = { care: { labs: [
      { id: 'b', date: '2026-10-01', key: 'ldl', name: 'Colesterol LDL', value: 128, unit: 'mg/dL' },
      { id: 'a', date: '2026-03-01', key: 'ldl', name: 'Colesterol LDL', value: 145, unit: 'mg/dL' },
    ] } } as never;
    expect(labSeries(S)[0]).toMatchObject({ key: 'ldl', change: -17 });
    expect(labSeries(S)[0].list.map((r) => r.value)).toEqual([145, 128]);
  });
});

describe('medicação', () => {
  it('avisa das interações com a Spirulina', () => {
    expect(medWarnings('Varfarina 5 mg')[0].text).toMatch(/vitamina K/);
    expect(medWarnings('Xarelto')[0].level).toBe('alto');
    expect(medWarnings('Metformina')[0].text).toMatch(/glicemia/);
    expect(medWarnings('Paracetamol')).toEqual([]);
    expect(declaredWarnings({ ans: { safe: ['antico'] }, care: { meds: [] } })[0]).toMatch(/anticoagulantes/);
    expect(declaredWarnings({ ans: { safe: ['antico'] }, care: { meds: [{ id: '1', name: 'Eliquis', kind: 'medicamento', times: ['08:00'], active: true }] } })).toEqual([]);
  });
  it('tomas de hoje, horas dos lembretes (sem nomes) e adesão', () => {
    const S = { care: { meds: [
      { id: 'a', name: 'Levotiroxina', kind: 'medicamento', times: ['07:30'], active: true },
      { id: 'b', name: 'Vitamina D', kind: 'suplemento', times: ['13:00', '07:30'], active: true },
      { id: 'c', name: 'Antigo', kind: 'medicamento', times: ['22:00'], active: false },
    ] }, logs: { '2026-11-20': { meds: { 'a@07:30': true } } } } as never;
    const t = medsToday(S, { meds: { 'a@07:30': true } }, NOW);
    expect(t.map((x) => `${x.time} ${x.med.name} ${x.taken ? '✓' : ''}${x.due ? ' due' : ''}`)).toEqual(['07:30 Levotiroxina ✓ due', '07:30 Vitamina D  due', '13:00 Vitamina D ']);
    expect(reminderTimes(S)).toEqual(['07:30', '13:00']);
    expect(medAdherence(S, ['2026-11-20'])).toBe(33);
  });
});
