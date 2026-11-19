/**
 * Lembrete diário da toma.
 *
 * Numa PWA, o navegador só garante a notificação enquanto a app está aberta
 * ou em segundo plano recente. Para lembretes fiáveis com a app fechada é
 * preciso a app nativa (Capacitor Local Notifications) ou Web Push com servidor.
 */
export const notificationsSupported = () => typeof window !== 'undefined' && 'Notification' in window;

export async function enableNotifications(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  return (await Notification.requestPermission()) === 'granted';
}

async function show(title: string, body: string) {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(title, { body, icon: `${import.meta.env.BASE_URL}icons/icon-192.png`, badge: `${import.meta.env.BASE_URL}icons/icon-192.png`, tag: 'nefesh-dose' });
    else new Notification(title, { body, icon: `${import.meta.env.BASE_URL}icons/icon-192.png` });
  } catch {
    /* sem suporte */
  }
}

/** Agenda a próxima notificação para a hora HH:MM. Devolve uma função para cancelar. */
export function scheduleReminder(time: string, isDone: () => boolean): () => void {
  if (!notificationsSupported() || Notification.permission !== 'granted') return () => {};
  let timer = 0;
  const arm = () => {
    const [h, m] = time.split(':').map(Number);
    const now = new Date();
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
    if (at <= now) at.setDate(at.getDate() + 1);
    timer = window.setTimeout(() => {
      if (!isDone()) show('Hora do seu ritual NEFESH', 'Está na hora da sua Spirulina de hoje.');
      arm();
    }, at.getTime() - now.getTime());
  };
  arm();
  return () => window.clearTimeout(timer);
}
