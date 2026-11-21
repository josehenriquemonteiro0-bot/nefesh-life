/**
 * Treinos ao ar livre com GPS: distância, tempo em movimento, ritmo, parciais por km,
 * calorias e recordes. Os pontos com pouca precisão ou saltos impossíveis são ignorados.
 * O percurso fica só no telemóvel (base de ficheiros local); a comunidade só vê os números.
 *
 * Na app atual (PWA) o GPS só funciona com o ecrã ligado; a app nativa regista um
 * fornecedor de GPS em segundo plano em geo.ts (ver docs/APP_NATIVA.md).
 */
export type RunKind = 'corrida' | 'caminhada' | 'bicicleta';
export const RUN_KINDS: [RunKind, string, string][] = [
  ['corrida', 'Corrida', '🏃'],
  ['caminhada', 'Caminhada', '🚶'],
  ['bicicleta', 'Bicicleta', '🚴'],
];

/** Ponto: latitude, longitude, instante (ms), precisão (m), altitude (m, opcional). */
export interface GeoPoint { lat: number; lon: number; t: number; acc: number; alt?: number | null }

export interface RunSummary {
  id: string;
  date: string;
  kind: RunKind;
  /** metros */
  dist: number;
  /** segundos totais e em movimento */
  secs: number;
  moving: number;
  /** segundos acumulados em cada km completo */
  splits: number[];
  kcal: number;
  /** subida acumulada (m), quando o GPS dá altitude */
  climb?: number;
  /** sessão do plano de corrida, se foi uma */
  plan?: string;
  /** o percurso está guardado no telemóvel */
  route?: boolean;
}

const R = 6371000;
const rad = (d: number) => (d * Math.PI) / 180;
/** Distância entre dois pontos (m). */
export function haversine(a: Pick<GeoPoint, 'lat' | 'lon'>, b: Pick<GeoPoint, 'lat' | 'lon'>) {
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Velocidade máxima plausível (m/s) e limite de "parado" por atividade. */
const MAX_SPEED: Record<RunKind, number> = { corrida: 8, caminhada: 3.5, bicicleta: 22 };
const STILL = 0.5;
export const MIN_ACC = 30;

/**
 * Acumulador do treino: recebe pontos, filtra os maus e conta distância, tempo em
 * movimento (pausa automática quando está parado mais de 10 s) e parciais por km.
 */
export class RunTrack {
  points: GeoPoint[] = [];
  dist = 0;
  moving = 0;
  climb = 0;
  splits: number[] = [];
  private stillSince: number | null = null;
  private lastAlt: number | null = null;
  constructor(public kind: RunKind) {}

  /** Junta um ponto; devolve false se foi ignorado. gap = o registo esteve parado (ecrã bloqueado ou pausa). */
  add(p: GeoPoint, gap = false): boolean {
    if (p.acc > MIN_ACC) return false;
    const prev = this.points[this.points.length - 1];
    if (!prev) {
      this.points.push(p);
      return true;
    }
    const dt = (p.t - prev.t) / 1000;
    if (dt <= 0) return false;
    const d = haversine(prev, p);
    if (d / dt > MAX_SPEED[this.kind]) return false; // salto impossível
    if (d < Math.max(2, p.acc / 3) && !gap) {
      // ruído parado: conta o tempo até 10 s, depois pausa automática
      this.stillSince ??= prev.t;
      if ((p.t - this.stillSince) / 1000 <= 10) this.moving += dt;
      return false;
    }
    this.stillSince = null;
    if (!gap) this.moving += d / dt < STILL ? 0 : dt;
    const before = this.dist;
    this.dist += d;
    // parcial: instante (em tempo de movimento) em que passou cada km
    for (let km = Math.floor(before / 1000) + 1; km * 1000 <= this.dist; km++) {
      const frac = (km * 1000 - before) / d;
      this.splits.push(Math.round(this.moving - (gap ? 0 : dt) * (1 - frac)));
    }
    if (typeof p.alt === 'number') {
      if (this.lastAlt !== null && p.alt - this.lastAlt > 2) this.climb += p.alt - this.lastAlt;
      if (this.lastAlt === null || Math.abs(p.alt - this.lastAlt) > 2) this.lastAlt = p.alt;
    }
    this.points.push(p);
    return true;
  }

  /** Ritmo atual (s/km) nos últimos ~30 s de pontos. */
  currentPace(now: number) {
    const recent = this.points.filter((p) => now - p.t <= 30000);
    if (recent.length < 2) return null;
    let d = 0;
    for (let i = 1; i < recent.length; i++) d += haversine(recent[i - 1], recent[i]);
    const s = (recent[recent.length - 1].t - recent[0].t) / 1000;
    return d > 15 && s > 0 ? (s / d) * 1000 : null;
  }
}

/** Ritmo em "m:ss /km". */
export const fmtPace = (secPerKm: number | null) => (secPerKm && Number.isFinite(secPerKm) && secPerKm < 3600 ? `${Math.floor(secPerKm / 60)}:${String(Math.round(secPerKm % 60)).padStart(2, '0')}` : '–:––');
export const fmtTime = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = Math.floor(s % 60);
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`;
};
export const fmtKm = (m: number) => (m / 1000).toFixed(2).replace('.', ',');

/** Calorias estimadas (MET × peso × horas): MET pela velocidade média. */
export function runKcal(kind: RunKind, dist: number, moving: number, kg = 70) {
  if (moving <= 0) return 0;
  const kmh = dist / 1000 / (moving / 3600);
  const met = kind === 'corrida' ? Math.max(6, kmh * 1.0) : kind === 'caminhada' ? (kmh < 4 ? 2.8 : kmh < 5.5 ? 3.5 : 4.8) : kmh < 16 ? 4 : kmh < 20 ? 6.8 : kmh < 23 ? 8 : 10;
  return Math.round(Math.min(met, 20) * kg * (moving / 3600));
}

/** Minutos que contam para a meta da OMS: corrida e bicicleta rápida contam a dobrar (vigorosa). */
export function runMvpa(kind: RunKind, dist: number, moving: number) {
  const min = Math.round(moving / 60);
  const kmh = moving > 0 ? dist / 1000 / (moving / 3600) : 0;
  const vigorous = kind === 'corrida' ? kmh >= 7 : kind === 'bicicleta' ? kmh >= 19 : kmh >= 6.5;
  return vigorous ? min * 2 : min;
}

/** Recordes: maior distância, melhor km e melhor 5 km e 10 km (pelas parciais), por atividade. */
export function records(runs: RunSummary[] | undefined, kind: RunKind) {
  const list = (runs ?? []).filter((r) => r.kind === kind);
  if (!list.length) return null;
  const best = (km: number) => {
    let b: { secs: number; id: string } | null = null;
    for (const r of list) if (r.splits.length >= km) { const s = r.splits[km - 1]; if (!b || s < b.secs) b = { secs: s, id: r.id }; }
    return b;
  };
  let km1 = null as { secs: number; id: string } | null;
  for (const r of list)
    for (let i = 0; i < r.splits.length; i++) {
      const d = r.splits[i] - (i ? r.splits[i - 1] : 0);
      if (!km1 || d < km1.secs) km1 = { secs: d, id: r.id };
    }
  const longest = list.reduce((a, b) => (b.dist > a.dist ? b : a));
  return { longest: { dist: longest.dist, id: longest.id }, km1, k5: best(5), k10: best(10) };
}

/** Recordes batidos por este treino (comparado com os anteriores). */
export function newRecords(prev: RunSummary[] | undefined, run: RunSummary) {
  const before = records(prev, run.kind);
  const after = records([...(prev ?? []), run], run.kind);
  if (!after || !(prev ?? []).some((r) => r.kind === run.kind)) return [];
  const out: string[] = [];
  if (after.longest.id === run.id && run.dist > (before?.longest.dist ?? 0) && run.dist >= 1000) out.push(`Maior distância: ${fmtKm(run.dist)} km`);
  if (after.km1?.id === run.id && after.km1.secs < (before?.km1?.secs ?? Infinity)) out.push(`Km mais rápido: ${fmtPace(after.km1.secs)}`);
  if (after.k5?.id === run.id && after.k5.secs < (before?.k5?.secs ?? Infinity)) out.push(`Melhor 5 km: ${fmtTime(after.k5.secs)}`);
  if (after.k10?.id === run.id && after.k10.secs < (before?.k10?.secs ?? Infinity)) out.push(`Melhor 10 km: ${fmtTime(after.k10.secs)}`);
  return out;
}

/** Percurso compacto para guardar: um ponto a cada ~10 m, 5 casas decimais. */
export function compactRoute(points: GeoPoint[]) {
  const out: [number, number, number, number | null][] = [];
  let last: GeoPoint | null = null;
  for (const p of points) {
    if (last && haversine(last, p) < 10 && p !== points[points.length - 1]) continue;
    out.push([Math.round(p.lat * 1e5) / 1e5, Math.round(p.lon * 1e5) / 1e5, p.t, typeof p.alt === 'number' ? Math.round(p.alt) : null]);
    last = p;
  }
  return out;
}

/** GPX para abrir noutras apps (Strava, Garmin, relógios). */
export function toGpx(run: RunSummary, route: [number, number, number, number | null][]) {
  const type = run.kind === 'bicicleta' ? 'cycling' : run.kind === 'caminhada' ? 'walking' : 'running';
  const pts = route
    .map(([lat, lon, t, alt]) => `<trkpt lat="${lat}" lon="${lon}">${alt !== null ? `<ele>${alt}</ele>` : ''}<time>${new Date(t).toISOString()}</time></trkpt>`)
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="NEFESH Life" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>NEFESH ${run.kind} ${run.date}</name><type>${type}</type><trkseg>${pts}</trkseg></trk></gpx>`;
}

/** Traçado em SVG (sem mapa por baixo): pontos projetados numa caixa w × h. */
export function routePath(route: [number, number, ...unknown[]][], w: number, h: number, pad = 8) {
  if (route.length < 2) return '';
  const lat0 = route[0][0];
  const kx = Math.cos(rad(lat0));
  const xs = route.map((p) => p[1] * kx), ys = route.map((p) => -p[0]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const s = Math.min((w - 2 * pad) / (maxX - minX || 1e-9), (h - 2 * pad) / (maxY - minY || 1e-9));
  const ox = (w - (maxX - minX) * s) / 2, oy = (h - (maxY - minY) * s) / 2;
  return xs.map((x, i) => `${i ? 'L' : 'M'}${((x - minX) * s + ox).toFixed(1)},${((ys[i] - minY) * s + oy).toFixed(1)}`).join('');
}
