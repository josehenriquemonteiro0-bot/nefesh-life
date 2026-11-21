/**
 * Fornecedor de GPS. Na app atual usa o GPS do navegador (só com o ecrã ligado).
 * A app nativa regista aqui o seu fornecedor com GPS em segundo plano, antes de a app
 * arrancar: window.NefeshNative = { geo: { background: true, start(onPoint, onError) { … } } }
 * (ver docs/APP_NATIVA.md, secção "GPS e treinos"). O resto da app não muda.
 */
import type { GeoPoint } from './gps';

export interface GeoProvider {
  /** true quando continua a registar com o ecrã bloqueado (app nativa) */
  background: boolean;
  /** começa a enviar pontos; devolve a função para parar */
  start(onPoint: (p: GeoPoint) => void, onError: (msg: string) => void): () => void;
}

const webGeo: GeoProvider = {
  background: false,
  start(onPoint, onError) {
    if (!('geolocation' in navigator)) {
      onError('Este telemóvel ou navegador não dá acesso ao GPS.');
      return () => {};
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => onPoint({ lat: pos.coords.latitude, lon: pos.coords.longitude, t: pos.timestamp || Date.now(), acc: pos.coords.accuracy, alt: pos.coords.altitude }),
      (err) =>
        onError(
          err.code === err.PERMISSION_DENIED
            ? 'A localização está bloqueada para a app. Autorize-a nas definições do telemóvel (Localização → NEFESH / navegador) e tente outra vez.'
            : err.code === err.TIMEOUT
              ? 'Ainda sem sinal de GPS. Vá para um sítio aberto, longe de prédios altos.'
              : 'Não foi possível obter a localização.',
        ),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  },
};

type NativeBridge = { geo?: GeoProvider };
export const geoProvider = (): GeoProvider => (window as unknown as { NefeshNative?: NativeBridge }).NefeshNative?.geo ?? webGeo;
