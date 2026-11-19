/**
 * Dados de saúde (passos e sono).
 *
 * Na PWA a pessoa regista os valores à mão (copiados do app Saúde do iPhone ou
 * do Google Fit), no registo do dia: `DayLog.steps` e `DayLog.sleepH`.
 *
 * Na app nativa (Capacitor), `nativeHealth` passa a ler o Apple Saúde / Health
 * Connect e preenche os mesmos campos automaticamente, com autorização da pessoa.
 */
export interface NativeHealth {
  readonly source: string;
  /** passos e horas de sono do dia `i` dias atrás (0 = hoje) */
  read(i: number): Promise<{ steps?: number; sleepH?: number }>;
}

/** Não existe acesso a dados de saúde num browser: só a app nativa o preenche. */
export let nativeHealth: NativeHealth | null = null;
export const setNativeHealth = (h: NativeHealth | null) => {
  nativeHealth = h;
};

export const STEPS_HABIT = 6000;
export const SLEEP_HABIT = 7;
