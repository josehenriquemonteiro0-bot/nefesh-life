import { describe, expect, it } from 'vitest';
import { MAX_LOCAL, localReminders, stableId } from './localReminders';
import type { AppState } from './types';

const base = (extra: Partial<AppState> = {}) => ({ logs: {}, reminder: '08:30', ...extra }) as unknown as AppState;

describe('lembretes no telemóvel (app nativa)', () => {
  it('Spirulina e medicação todos os dias, sem nomes de medicamentos', () => {
    const S = base({ care: { meds: [
      { id: 'a', name: 'Varfarina', kind: 'medicamento', times: ['20:00'], active: true },
      { id: 'b', name: 'Vitamina D', kind: 'suplemento', times: ['08:00', '20:00'], active: true },
      { id: 'c', name: 'Parado', kind: 'suplemento', times: ['12:00'], active: false },
    ] } } as Partial<AppState>);
    const r = localReminders(S, new Date(2026, 10, 23, 10, 0));
    expect(r.map((x) => x.daily)).toEqual(['08:30', '08:00', '20:00']);
    expect(JSON.stringify(r)).not.toMatch(/Varfarina|Vitamina/);
    expect(new Set(r.map((x) => x.id)).size).toBe(r.length);
  });
  it('lembretes do assistente: só os futuros, dentro de 30 dias, por ordem', () => {
    const now = new Date(2026, 10, 23, 10, 0);
    const S = base({ reminder: '', reminders: [
      { id: 'x1', date: '2026-11-23', time: '09:00', text: 'já passou' },
      { id: 'x2', date: '2026-11-25', time: '18:00', text: 'consulta' },
      { id: 'x3', date: '2026-11-23', time: '15:00', text: 'beber água' },
      { id: 'x4', date: '2027-03-01', time: '10:00', text: 'longe demais' },
    ] } as Partial<AppState>);
    expect(localReminders(S, now).map((x) => x.body)).toEqual(['beber água', 'consulta']);
  });
  it('não passa do limite do iPhone e os números são estáveis', () => {
    const reminders = Array.from({ length: 90 }, (_, i) => ({ id: `r${i}`, date: '2026-11-24', time: `${String(i % 24).padStart(2, '0')}:00`, text: `t${i}` }));
    expect(localReminders(base({ reminders } as Partial<AppState>), new Date(2026, 10, 23, 10)).length).toBe(MAX_LOCAL);
    expect(stableId('spirulina')).toBe(stableId('spirulina'));
    expect(stableId('spirulina')).toBeGreaterThan(0);
    expect(stableId('spirulina')).toBeLessThan(2 ** 31);
  });
});
