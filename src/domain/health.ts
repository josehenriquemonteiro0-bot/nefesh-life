/**
 * Fonte de dados de saúde (passos e sono).
 *
 * No browser não existe acesso ao Apple Saúde nem ao Google Health Connect,
 * por isso esta implementação é uma simulação determinística. Na app nativa
 * (Capacitor), basta substituir `healthProvider` por uma implementação que
 * leia os dados reais através de um plugin HealthKit / Health Connect.
 */
export interface HealthProvider {
  readonly simulated: boolean;
  readonly source: string;
  /** Passos do dia `i` dias atrás (0 = hoje). */
  steps(i: number): number;
  /** Horas de sono na noite que terminou `i` dias atrás. */
  sleep(i: number): number;
}

export const simulatedHealth: HealthProvider = {
  simulated: true,
  source: 'Apple Saúde · simulação',
  steps(i) {
    const t = Math.max(0, (29 - i) / 29);
    let v = Math.round(4300 + t * 4200 + Math.sin(i * 2.3) * 1500);
    if (i === 0) {
      const n = new Date();
      const hr = n.getHours() + n.getMinutes() / 60;
      v = Math.round(v * Math.min(1, Math.max(0.06, (hr - 7) / 14)));
    }
    return Math.max(600, v);
  },
  sleep(i) {
    return Math.round((6.5 + Math.sin(i * 1.1) * 0.6 + ((29 - Math.min(i, 29)) / 29) * 0.6) * 10) / 10;
  },
};

export let healthProvider: HealthProvider = simulatedHealth;
export const setHealthProvider = (p: HealthProvider) => {
  healthProvider = p;
};
