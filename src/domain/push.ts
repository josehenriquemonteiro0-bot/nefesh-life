/**
 * Notificações com a app fechada (Web Push): lembrete da toma, mensagens de amigos e fim da liga.
 * No iPhone funcionam com a app adicionada ao ecrã principal (iOS 16.4 ou mais recente).
 */
import { getAuth } from './account';
import { todayKey } from './dates';
import { PHOTO_API, deviceId } from './photo';

export const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent);
export const isInstalled = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

const post = (path: string, body: Record<string, unknown>) =>
  fetch(`${PHOTO_API}/push/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

function keyBytes(b64: string) {
  const s = atob(b64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

async function currentSub() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

/** Pede autorização e inscreve este telemóvel. Devolve uma mensagem de erro, ou null se correu bem. */
export async function enablePush(remind: string): Promise<string | null> {
  if (!pushSupported()) {
    return isIOS() && !isInstalled()
      ? 'No iPhone, as notificações só funcionam com a app no ecrã principal: no Safari, toque em Partilhar → Adicionar ao ecrã principal e abra a app a partir daí.'
      : 'Este navegador não permite notificações.';
  }
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return 'As notificações foram bloqueadas. Pode autorizá-las nas definições do telemóvel.';
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const { key } = (await (await post('chave', {})).json()) as { key: string };
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) });
    }
    await register(sub, remind);
    return null;
  } catch {
    return 'Não foi possível ativar as notificações. Tente outra vez com internet.';
  }
}

async function register(sub: PushSubscription, remind: string | null) {
  await post('inscrever', {
    endpoint: sub.endpoint,
    remind,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    device: deviceId(),
    token: getAuth()?.token,
  });
}

/** Atualiza a hora do lembrete e a ligação à conta (ex.: depois de entrar). */
export async function updatePush(remind: string | null) {
  try {
    const sub = await currentSub();
    if (sub) await register(sub, remind);
  } catch {
    /* sem rede */
  }
}

/** Avisa que o ritual de hoje está feito (não há lembrete hoje). */
export async function pushRitualDone() {
  try {
    const sub = await currentSub();
    if (sub) await post('feito', { endpoint: sub.endpoint, date: todayKey() });
  } catch {
    /* sem rede */
  }
}

export async function disablePush() {
  try {
    const sub = await currentSub();
    if (sub) {
      await post('sair', { endpoint: sub.endpoint });
      await sub.unsubscribe();
    }
  } catch {
    /* sem rede */
  }
}
