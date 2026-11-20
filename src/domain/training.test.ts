import { describe, expect, it } from 'vitest';
import { blankState } from './sample';
import { keyDaysAgo } from './dates';
import { EXERCISES, exerciseById, levelOf, weekPlan, weekProgress, weekdayIndex } from './training';

describe('guia de atividade física', () => {
  it('define o nível pela frequência de treino', () => {
    expect(levelOf({ ativ: '0' })).toBe('iniciante');
    expect(levelOf({ ativ: '3-4' })).toBe('intermedio');
    expect(levelOf({ ativ: '5+' })).toBe('avancado');
  });
  it('cumpre a OMS: pelo menos 150 min moderados e 2 dias de força por semana', () => {
    for (const goal of ['peso', 'desporto', 'energia', 'foco', 'imunidade', 'nutricao'] as const) {
      for (const ativ of ['0', '3-4', '5+']) {
        const plan = weekPlan({ goal, ativ });
        expect(plan).toHaveLength(7);
        expect(plan.reduce((t, s) => t + s.mvpa, 0), `${goal}/${ativ}`).toBeGreaterThanOrEqual(150);
        expect(plan.filter((s) => s.kind === 'forca').length).toBeGreaterThanOrEqual(2);
        for (const s of plan) s.exercises.forEach((id) => expect(exerciseById(id), id).toBeTruthy());
      }
    }
  });
  it('adapta-se ao objetivo para o corpo, sempre dentro da OMS', () => {
    for (const corpo of ['perder-suave', 'perder-moderado', 'manter', 'ganhar-suave', 'ganhar-moderado'] as const) {
      for (const ativ of ['0', '3-4', '5+']) {
        const plan = weekPlan({ goal: 'energia', ativ, corpo });
        expect(plan.reduce((t, s) => t + s.mvpa, 0), `${corpo}/${ativ}`).toBeGreaterThanOrEqual(150);
        const strength = plan.filter((s) => s.kind === 'forca').length;
        expect(strength).toBe(corpo.startsWith('ganhar') ? 3 : 2);
      }
    }
  });
  it('não dá cardio intervalado a iniciantes', () => {
    expect(weekPlan({ goal: 'peso', ativ: '0' }).some((s) => s.kind === 'intervalos')).toBe(false);
  });
  it('conta os minutos e os dias de força da semana', () => {
    const now = new Date(2026, 10, 20, 10); // sexta-feira
    expect(weekdayIndex(now)).toBe(4);
    const S = blankState(now);
    S.logs[keyDaysAgo(0, now)] = { workouts: [{ sessionId: 'forcaA', title: 'Força', minutes: 22, mvpa: 18, strength: true }] };
    S.logs[keyDaysAgo(2, now)] = { workouts: [{ sessionId: 'caminhada', title: 'Caminhada', minutes: 30, mvpa: 30, strength: false }] };
    S.logs[keyDaysAgo(6, now)] = { workouts: [{ sessionId: 'caminhada', title: 'Caminhada', minutes: 40, mvpa: 40, strength: false }] }; // semana anterior
    const w = weekProgress(S, now);
    expect(w.mvpa).toBe(48);
    expect(w.strengthDays).toBe(1);
    expect(w.doneDays).toEqual([false, false, true, false, true, false, false]);
  });
  it('todos os exercícios têm instruções e doses por nível', () => {
    for (const e of EXERCISES) {
      expect(e.how.length).toBeGreaterThanOrEqual(2);
      expect(Object.keys(e.dose)).toEqual(['iniciante', 'intermedio', 'avancado']);
    }
  });
});
