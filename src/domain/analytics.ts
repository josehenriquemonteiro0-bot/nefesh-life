/**
 * Estatísticas anónimas de utilização.
 *
 * Sem cookies e sem dados pessoais ou de saúde: uma vez por dia, a app envia
 * ao Worker que partes foram usadas nos últimos 7 dias (sim/não e contagens).
 * O Worker guarda só um resumo por telemóvel e por dia, com um identificador
 * cifrado, e apaga-o ao fim de 4 meses. A pessoa pode desligar no Perfil.
 */
import { keyDaysAgo, todayKey } from './dates';
import { PHOTO_API, deviceId } from './photo';
import { took } from './stats';
import type { AppState } from './types';

const SENT_KEY = 'nefesh-life-ping';

export interface Ping {
  v: 1;
  device: string;
  /** a pessoa já fez a avaliação */
  plan: boolean;
  /** dias desde o início do ritual (agrupados) */
  stage: '0' | '1-7' | '8-30' | '31+' | 'sem plano';
  spirulina: number;
  water: number;
  checkin: number;
  diary: number;
  steps: number;
  workouts: number;
  nutriPlan: boolean;
  trainPlan: boolean;
  format: 'caps' | 'po' | 'nibs';
  /** app instalada no ecrã principal */
  installed: boolean;
  platform: 'ios' | 'android' | 'outro';
  evals: number;
}

export function buildPing(S: AppState, device: string, now = new Date(), env: { installed: boolean; platform: Ping['platform'] } = { installed: false, platform: 'outro' }): Ping {
  const keys = Array.from({ length: 7 }, (_, i) => keyDaysAgo(i, now));
  const n = (f: (k: string) => boolean) => keys.filter(f).length;
  const start = S.planStart ? Math.floor((now.getTime() - new Date(S.planStart).getTime()) / 86400000) : null;
  return {
    v: 1,
    device,
    plan: !!S.ans,
    stage: start === null ? 'sem plano' : start < 1 ? '0' : start <= 7 ? '1-7' : start <= 30 ? '8-30' : '31+',
    spirulina: S.ans ? n((k) => took(S, S.logs[k], now)) : 0,
    water: n((k) => (S.logs[k]?.water ?? 0) > 0),
    checkin: n((k) => !!S.logs[k]?.e),
    diary: n((k) => Object.values(S.logs[k]?.meals ?? {}).some((m) => m && m.length)),
    steps: n((k) => S.logs[k]?.steps !== undefined),
    workouts: n((k) => (S.logs[k]?.workouts ?? []).length > 0),
    nutriPlan: !!S.nutriPlan,
    trainPlan: !!S.trainPlan,
    format: S.format ?? 'caps',
    installed: env.installed,
    platform: env.platform,
    evals: S.evals.length,
  };
}

function environment(): { installed: boolean; platform: Ping['platform'] } {
  const ua = navigator.userAgent;
  const platform = /iPhone|iPad|iPod/.test(ua) ? 'ios' : /Android/.test(ua) ? 'android' : 'outro';
  const installed = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
  return { installed: !!installed, platform };
}

/** Envia o resumo do dia, no máximo uma vez por dia. Falhas são ignoradas. */
export async function sendDailyPing(S: AppState) {
  try {
    if (S.stats === false || S.sample) return;
    // uma vez por dia, e de novo no dia em que a pessoa conclui a primeira avaliação
    const mark = `${todayKey()}:${S.ans ? 1 : 0}`;
    if (localStorage.getItem(SENT_KEY) === mark) return;
    localStorage.setItem(SENT_KEY, mark);
    await fetch(`${PHOTO_API}/evento`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildPing(S, deviceId(), new Date(), environment())),
      keepalive: true,
    });
  } catch {
    /* sem rede: tenta amanhã */
  }
}
