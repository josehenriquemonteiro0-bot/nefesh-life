import { describe, expect, it } from 'vitest';
import { PROGRAM, diaryCalc, diaryReading, diaryStats, flagAdvice, fmtTime, markRitual, programDay, saveDiary, sleepPatterns, sleepReminders, startProgram } from './sleep';
import { breathPhase, techniqueOf } from './mind';
import { MEDITATIONS, meditationById } from './meditations';
import { localReminders } from './localReminders';
import { keyDaysAgo } from './dates';
import type { AppState, DayLog } from './types';

const NOW = new Date('2027-03-15T09:00:00');

describe('diário do sono', () => {
  it('calcula tempo na cama, sono e eficiência atravessando a meia-noite', () => {
    const c = diaryCalc({ bed: '23:30', up: '07:30', lat: 30, waso: 30 })!;
    expect(c.inBed).toBe(480);
    expect(c.asleep).toBe(420);
    expect(c.hours).toBe(7);
    expect(c.eff).toBe(88);
  });
  it('aceita deitar depois da meia-noite e recusa noites impossíveis', () => {
    expect(diaryCalc({ bed: '01:00', up: '08:00' })!.inBed).toBe(420);
    expect(diaryCalc({ bed: '07:00', up: '07:30' })).toBeNull();
    expect(diaryCalc({ bed: '23:00' })).toBeNull();
    expect(diaryCalc({ bed: '25:00', up: '07:00' })).toBeNull();
  });
  it('guarda o diário e preenche as horas de sono, mas não por cima do relógio', () => {
    const l: DayLog = {};
    saveDiary(l, { bed: '23:00', up: '07:00', lat: 20, wakes: 2, waso: 40, q: 4 });
    expect(l.sleepD).toEqual({ bed: '23:00', up: '07:00', lat: 20, wakes: 2, waso: 40, q: 4 });
    expect(l.sleepH).toBe(7);
    const w: DayLog = { sleepH: 6.5, src: { sleepH: 'device' } };
    saveDiary(w, { bed: '23:00', up: '07:00' });
    expect(w.sleepH).toBe(6.5);
  });
  it('limpa valores inválidos', () => {
    const l: DayLog = {};
    saveDiary(l, { bed: 'x', up: '07:00', lat: -5, wakes: 99, q: 9 });
    expect(l.sleepD).toEqual({ up: '07:00', wakes: 20 });
  });
  it('resume as noites e lê-as em linguagem simples', () => {
    const logs: Record<string, DayLog> = {};
    for (let i = 0; i < 7; i++) logs[keyDaysAgo(i, NOW)] = { sleepD: { bed: '23:00', up: i % 2 ? '07:00' : '09:00', lat: 45, q: 3 } };
    const st = diaryStats({ logs }, 14, NOW);
    expect(st.nights).toBe(7);
    expect(st.lat).toBe(45);
    expect(st.bedAvg).toBe('23:00');
    expect(st.upSd).toBeGreaterThan(30);
    const r = diaryReading(st);
    expect(r.some((t) => t.includes('45 minutos'))).toBe(true);
    expect(r.some((t) => t.includes('hora de levantar varia'))).toBe(true);
  });
  it('média das horas de deitar à volta da meia-noite', () => {
    const logs: Record<string, DayLog> = { [keyDaysAgo(0, NOW)]: { sleepD: { bed: '23:30', up: '07:00' } }, [keyDaysAgo(1, NOW)]: { sleepD: { bed: '00:30', up: '07:00' } } };
    expect(diaryStats({ logs }, 14, NOW).bedAvg).toBe('00:00');
  });
});

describe('ritual e lembretes', () => {
  it('marca o ritual e guarda o que a pessoa escreveu', () => {
    const l: DayLog = {};
    markRitual(l, { worries: '  reunião  ', tomorrow: '' });
    expect(l.ritual).toBe(true);
    expect(l.nightDump).toEqual({ worries: 'reunião' });
  });
  it('lembretes do sono a partir das horas escolhidas', () => {
    const r = sleepReminders({ sleep: { bed: '23:30', wake: '07:15', ritualRemind: true, coffeeRemind: true, lightRemind: true } });
    expect(r.map((x) => x.time)).toEqual(['22:30', '15:30', '07:15']);
    expect(sleepReminders({ sleep: { ritualRemind: true } })[0].time).toBe('22:00');
    expect(sleepReminders({})).toEqual([]);
    expect(fmtTime(-30)).toBe('23:30');
  });
  it('entram nos lembretes do telemóvel', () => {
    const S = { reminder: '', logs: {}, sleep: { bed: '23:00', ritualRemind: true } } as unknown as AppState;
    expect(localReminders(S, NOW).some((r) => r.daily === '22:00' && r.title.includes('desligar'))).toBe(true);
  });
});

describe('programa de 14 dias', () => {
  it('tem 14 dias, cada um com porquê e tarefas, sem restrição do sono', () => {
    expect(PROGRAM.map((p) => p.day)).toEqual(Array.from({ length: 14 }, (_, i) => i + 1));
    for (const p of PROGRAM) {
      expect(p.why.length).toBeGreaterThan(40);
      expect(p.todo.length).toBeGreaterThan(0);
      if (p.practice?.kind === 'meditacao') expect(meditationById(p.practice.id!)).toBeTruthy();
      if (p.practice?.kind === 'respiracao') expect(techniqueOf(p.practice.id!).id).toBe(p.practice.id);
    }
    expect(JSON.stringify(PROGRAM).toLowerCase()).not.toContain('restrição do sono');
  });
  it('conta o dia do programa', () => {
    const S = { sleep: { prog: startProgram(new Date('2027-03-10T20:00:00')) } };
    expect(programDay(S, NOW)).toMatchObject({ day: 6, finished: false });
    expect(programDay({ sleep: { prog: { start: '2027-02-01', done: [] } } }, NOW)).toMatchObject({ day: 14, finished: true, over: true });
    expect(programDay({}, NOW)).toBeNull();
  });
});

describe('padrões do sono', () => {
  it('compara as noites depois de dias com e sem ritual', () => {
    const logs: Record<string, DayLog> = {};
    for (let i = 0; i < 20; i++) {
      const ritual = i % 2 === 0;
      logs[keyDaysAgo(i + 1, NOW)] = ritual ? { ritual: true } : { stress: 2 };
      logs[keyDaysAgo(i, NOW)] = { ...(logs[keyDaysAgo(i, NOW)] ?? {}), sleepH: ritual ? 7.5 : 6.5 };
    }
    const p = sleepPatterns({ logs }, NOW);
    const r = p.find((x) => x.id === 'ritual')!;
    expect(r.text).toContain('1 h a mais');
  });
  it('não fala sem dados suficientes', () => {
    expect(sleepPatterns({ logs: {} }, NOW)).toEqual([]);
  });
});

describe('sinais de alerta', () => {
  it('encaminha cada sinal, sem diagnosticar', () => {
    expect(flagAdvice({ apnea: true, chronic: true, sleepy: false })!.join(' ')).toMatch(/apneia.*médico|TCC-I/);
    expect(flagAdvice({ apnea: false })).toEqual([]);
    expect(flagAdvice(undefined)).toBeNull();
    expect(flagAdvice({ mood: true })![0]).toContain('CVV 188');
  });
});

describe('técnicas e sessões novas', () => {
  it('o suspiro cíclico tem duas inspirações seguidas (o círculo continua cheio)', () => {
    const s = techniqueOf('suspiro');
    expect(breathPhase(s, 0)).toMatchObject({ name: 'Inspire', big: true });
    expect(breathPhase(s, 3.2)).toMatchObject({ name: 'Inspire mais um pouco', big: true });
    expect(breathPhase(s, 5)).toMatchObject({ name: 'Expire longo', big: false });
  });
  it('as narinas alternadas e a expiração prolongada', () => {
    expect(breathPhase(techniqueOf('narinas'), 5)).toMatchObject({ name: 'Expire pela direita', big: false });
    expect(breathPhase(techniqueOf('expira'), 1)).toMatchObject({ name: 'Inspire', big: true });
  });
  it('as sessões da noite existem e estão na coleção Dormir', () => {
    for (const id of ['pmr', 'nidra', 'baralhar', 'acordado']) expect(meditationById(id)?.collection).toBe('dormir');
    expect(MEDITATIONS.filter((m) => m.free).map((m) => m.id)).toEqual(expect.arrayContaining(['pmr', 'acordado']));
  });
});
