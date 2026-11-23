/**
 * Lembretes nativos do iPhone (Capacitor Local Notifications): agendados no próprio telemóvel.
 * Só corre na app nativa; na versão web as notificações continuam a vir do servidor (Web Push).
 */
import { LocalNotifications } from '@capacitor/local-notifications';
import type { LocalReminder } from '../domain/localReminders';
import { isNative } from '../domain/platform';

/** Pede autorização para notificações. Devolve null se ficou autorizado, ou a mensagem para a pessoa. */
export async function enableNativeNotifications(): Promise<string | null> {
  if (!isNative()) return 'Só na app do iPhone.';
  try {
    let p = await LocalNotifications.checkPermissions();
    if (p.display !== 'granted') p = await LocalNotifications.requestPermissions();
    return p.display === 'granted' ? null : 'As notificações foram bloqueadas. Pode autorizá-las em Definições → NEFESH Life → Notificações.';
  } catch {
    return 'Não foi possível ativar as notificações.';
  }
}

let last = '';
/** Deixa agendado exatamente o que a lista diz (cancela o que sobrou de antes). */
export async function syncNativeReminders(items: LocalReminder[]) {
  if (!isNative()) return;
  const mark = JSON.stringify(items);
  if (mark === last) return;
  try {
    if ((await LocalNotifications.checkPermissions()).display !== 'granted') return;
    const pending = (await LocalNotifications.getPending()).notifications;
    if (pending.length) await LocalNotifications.cancel({ notifications: pending.map((n) => ({ id: n.id })) });
    if (items.length) {
      await LocalNotifications.schedule({
        notifications: items.map((r) => {
          const [hour, minute] = (r.daily ?? '00:00').split(':').map(Number);
          return {
            id: r.id,
            title: r.title,
            body: r.body,
            schedule: r.daily ? { on: { hour, minute }, repeats: true, allowWhileIdle: true } : { at: r.at, allowWhileIdle: true },
          };
        }),
      });
    }
    last = mark;
  } catch {
    /* tenta outra vez na próxima alteração */
  }
}
