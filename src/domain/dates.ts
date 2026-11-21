const pad = (n: number) => String(n).padStart(2, '0');

/** Chave de dia local no formato AAAA-MM-DD. */
export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Converte uma chave de dia para uma data local (meia-noite local, não UTC). */
export const parseKey = (k: string) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const todayKey = (now = new Date()) => dayKey(now);

export const daysAgo = (i: number, now = new Date()) => {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() - i);
  return d;
};

export const keyDaysAgo = (i: number, now = new Date()) => dayKey(daysAgo(i, now));

/** Número de dias entre a chave e hoje (positivo se no passado). */
export const daysSince = (k: string, now = new Date()) =>
  Math.round((parseKey(todayKey(now)).getTime() - parseKey(k).getTime()) / 864e5);

export const fmtNum = (n: number | string) => String(n).replace('.', ',');
/** Decimais com vírgula num texto (ex.: respostas da IA): "7.6 h" → "7,6 h". */
export const commaDecimals = (t: string) => t.replace(/(\d)\.(\d)/g, '$1,$2');

export const shortDate = (k: string) =>
  parseKey(k).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' });

export const longToday = (now = new Date()) =>
  now.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });

export const greeting = (now = new Date()) => {
  const h = now.getHours();
  return h < 12 ? 'Bom dia' : h < 20 ? 'Boa tarde' : 'Boa noite';
};

/** Soma n dias a uma chave de dia (AAAA-MM-DD). */
export const addDaysKey = (k: string, n: number) => {
  const d = parseKey(k);
  d.setDate(d.getDate() + n);
  return dayKey(d);
};
