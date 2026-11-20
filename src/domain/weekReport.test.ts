import { describe, expect, it } from 'vitest';
import { blankState } from './sample';
import { reportSummary, reportWeek, weeklyReport } from './weekReport';
import type { AppState } from './types';

// sexta-feira 20/11/2026 → semana do relatório: 9 a 15 de novembro
const FRI = new Date('2026-11-20T12:00:00');
const SUN_NIGHT = new Date('2026-11-22T20:00:00');

const person = (): AppState => ({ ...blankState(FRI), ans: { goal: 'energia', peso: 70, altura: 170, idade: 35, sexo: 'f' }, planStart: '2026-11-01', followLabel: true });

describe('relatório semanal', () => {
  it('a semana é a última completa; ao domingo à noite, a atual', () => {
    expect(reportWeek(FRI)).toEqual(['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15']);
    expect(reportWeek(SUN_NIGHT)[0]).toBe('2026-11-16');
    expect(reportWeek(new Date('2026-11-22T10:00:00'))[0]).toBe('2026-11-09');
  });

  it('dados em falta não contam como falha', () => {
    const S = person();
    const days = reportWeek(FRI);
    days.forEach((k) => (S.logs[k] = { doses: [true, true] }));
    const r = weeklyReport(S, FRI);
    expect(r.scores.spirulina).toBe(100);
    expect(r.scores.sono).toBeNull();
    expect(r.scores.movimento).toBeNull();
    expect(r.scores.nutricao).toBeNull();
    expect(r.index).toBe(100); // só a Spirulina tem registos
    expect(r.priority).toBeNull();
  });

  it('calcula as áreas e escolhe uma só prioridade (a mais fraca)', () => {
    const S = person();
    const days = reportWeek(FRI);
    days.forEach((k, i) => {
      S.logs[k] = { doses: i < 6 ? [true, true] : [], sleepH: 4.5, water: 12, e: 3, workouts: i % 2 ? [{ sessionId: 'x', title: 'Corrida', minutes: 40, mvpa: 40, strength: i === 1 }] : [] };
    });
    const r = weeklyReport(S, FRI);
    expect(r.facts.spirulinaDays).toBe(6);
    expect(r.facts.mvpa).toBe(120);
    expect(r.scores.sono).toBeLessThan(r.scores.spirulina!);
    expect(r.priority?.area).toBe('sono');
    expect(r.priority?.text).toMatch(/Dormir 7 horas: a média foi 4,5 h/);
    expect(r.index).toBeGreaterThan(0);
    const sum = reportSummary(S, r);
    expect(sum).toMatch(/Spirulina \d+\/100: ritual em 6 de 7 dias/);
    expect(sum).not.toMatch(/espirulina/i);
  });

  it('sem nenhum registo, não há índice', () => {
    expect(weeklyReport(person(), FRI).index).toBeNull();
  });
});

describe('nutrição no relatório', () => {
  it('registar só o almoço não é contado como comer pouco', () => {
    const S = person();
    const days = reportWeek(FRI);
    days.forEach((k) => (S.logs[k] = { meals: { almoco: [{ id: 'x', name: 'Frango', grams: 150, kcal: 250, p: 30, c: 0, f: 8 }] } }));
    const r = weeklyReport(S, FRI);
    expect(r.facts.kcalAvg).toBeNull();
    expect(r.scores.nutricao).toBeGreaterThanOrEqual(80);
  });
});
