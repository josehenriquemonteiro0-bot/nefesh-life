/**
 * Apple Health (HealthKit) na app nativa do iPhone: passos, sono e minutos de exercício,
 * lidos diretamente do telemóvel (sem atalho e sem conta). Entram como dados medidos ('device').
 */
import { Health, type HealthSample } from '@capgo/capacitor-health';
import { dayKey } from '../domain/dates';
import type { HealthDay } from '../domain/healthSync';
import { isNative } from '../domain/platform';

const READ = ['steps', 'sleep', 'exerciseTime', 'restingHeartRate', 'heartRateVariability', 'weight'] as const;

export async function nativeHealthAvailable(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    return (await Health.isAvailable()).available;
  } catch {
    return false;
  }
}

/** Abre o pedido de autorização do iPhone (a pessoa escolhe o que partilha). */
export async function connectNativeHealth(): Promise<string | null> {
  try {
    await Health.requestAuthorization({ read: [...READ] });
    return null;
  } catch (e) {
    return `Não foi possível ligar ao Apple Health (${(e as Error).message || 'erro'}).`;
  }
}

/** Horas dormidas por noite: soma dos períodos a dormir, contados no dia em que a pessoa acordou. */
export function sleepByNight(samples: Pick<HealthSample, 'startDate' | 'endDate' | 'sleepState'>[]): Record<string, number> {
  const asleep = new Set(['asleep', 'rem', 'deep', 'light']);
  const min: Record<string, number> = {};
  // vários relógios podem registar a mesma noite: junta os intervalos para não contar duas vezes
  const iv = samples
    .filter((s) => s.sleepState && asleep.has(s.sleepState))
    .map((s) => [Date.parse(s.startDate), Date.parse(s.endDate)] as [number, number])
    .filter(([a, b]) => b > a)
    .sort((x, y) => x[0] - y[0]);
  const merged: [number, number][] = [];
  for (const [a, b] of iv) {
    const lastIv = merged[merged.length - 1];
    if (lastIv && a <= lastIv[1]) lastIv[1] = Math.max(lastIv[1], b);
    else merged.push([a, b]);
  }
  for (const [a, b] of merged) {
    const k = dayKey(new Date(b));
    min[k] = (min[k] ?? 0) + (b - a) / 60000;
  }
  return Object.fromEntries(Object.entries(min).map(([k, m]) => [k, Math.round((m / 60) * 10) / 10]));
}

/** Lê os últimos n dias do Apple Health, no formato que a app já usa (applyHealthDays). */
export async function readNativeHealth(days = 14, now = new Date()): Promise<Record<string, HealthDay>> {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));
  const range = { startDate: start.toISOString(), endDate: now.toISOString() };
  const at = now.toISOString();
  const out: Record<string, HealthDay> = {};
  const day = (k: string) => (out[k] = out[k] ?? { at });
  const sum = async (dataType: 'steps' | 'exerciseTime') => {
    try {
      return (await Health.queryAggregated({ dataType, ...range, bucket: 'day', aggregation: 'sum' })).samples;
    } catch {
      return [];
    }
  };
  for (const s of await sum('steps')) if (s.value > 0) day(dayKey(new Date(s.startDate))).steps = Math.round(s.value);
  for (const s of await sum('exerciseTime')) if (s.value > 0) day(dayKey(new Date(s.startDate))).exMin = Math.round(s.value);
  try {
    // sono: desde as 18h da véspera do primeiro dia
    const from = new Date(start.getTime() - 6 * 3600e3).toISOString();
    const { samples } = await Health.readSamples({ dataType: 'sleep', startDate: from, endDate: range.endDate, limit: 2000, ascending: true });
    for (const [k, h] of Object.entries(sleepByNight(samples))) if (h >= 1 && h <= 16) day(k).sleepH = h;
  } catch {
    /* sem sono autorizado */
  }
  return out;
}
