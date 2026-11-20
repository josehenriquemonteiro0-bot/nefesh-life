// Service worker NEFESH Life: app shell em cache para funcionar offline.
const CACHE = 'nefesh-life-v3';
// serviço que guarda as mensagens das notificações
const API = new URL(self.location).searchParams.get('api') || 'https://nefesh-foto.josehenriquemonteiro0.workers.dev';
// caminhos relativos ao âmbito do service worker (funciona na raiz ou numa subpasta)
const BASE = new URL('./', self.location).pathname;
const SHELL = ['', 'index.html', 'manifest.webmanifest', 'brand/logo-header.png', 'brand/mark.png', 'brand/wordmark.png', 'icons/icon-192.png'].map((p) => BASE + p);

self.addEventListener('install', (e) => {
  // guarda também o JS e o CSS referidos no index.html (nomes com hash gerados no build)
  e.waitUntil(
    (async () => {
      const c = await caches.open(CACHE);
      await c.addAll(SHELL);
      const html = await (await fetch(BASE + 'index.html', { cache: 'no-store' })).text();
      const assets = [...html.matchAll(/(?:src|href)="([^"]+\/assets\/[^"]+)"/g)].map((m) => m[1]);
      await c.addAll(assets);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // navegação: rede primeiro, cache como recurso offline
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match(BASE + 'index.html')));
    return;
  }
  const sameOrigin = url.origin === self.location.origin;
  const fonts = url.hostname.endsWith('fonts.googleapis.com') || url.hostname.endsWith('fonts.gstatic.com');
  if (!sameOrigin && !fonts) return;
  // recursos: cache primeiro, atualizando em segundo plano
  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req)
        .then((res) => {
          if (res.ok || res.type === 'opaque') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || net;
    }),
  );
});

// notificação recebida com a app fechada: pergunta ao serviço qual é a mensagem e mostra-a
self.addEventListener('push', (e) => {
  e.waitUntil(
    (async () => {
      let m = { title: 'NEFESH Life 🌿', body: 'Está na hora do seu ritual de Spirulina.', tag: 'nefesh' };
      try {
        const sub = await self.registration.pushManager.getSubscription();
        const r = await fetch(API + '/push/mensagem', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub && sub.endpoint }) });
        if (r.ok) m = Object.assign(m, await r.json());
      } catch (err) {
        /* sem rede: mostra a mensagem geral */
      }
      await self.registration.showNotification(m.title, { body: m.body, tag: m.tag, icon: BASE + 'icons/icon-192.png', badge: BASE + 'icons/icon-192.png', data: { url: m.url || BASE } });
    })(),
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((list) => (list[0] ? list[0].focus() : self.clients.openWindow((e.notification.data && e.notification.data.url) || BASE))),
  );
});
