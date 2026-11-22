const CACHE_NAME = 'minas-mais-executa-v3';

function scopedUrl(path) {
  return new URL(path, self.registration.scope).href;
}

self.addEventListener('install', (event) => {
  const appShell = [
    scopedUrl('./'),
    scopedUrl('./offline.html'),
    scopedUrl('./manifest.webmanifest'),
    scopedUrl('./pwa-icon-192.png'),
    scopedUrl('./pwa-icon-512.png'),
  ];
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(appShell)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('push', (event) => {
  const payload = event.data ? event.data.json() : {};
  const notification = {
    body: payload.body || 'Você recebeu uma nova tarefa.',
    icon: new URL('pwa-icon-192.png', self.registration.scope).href,
    badge: new URL('pwa-icon-192.png', self.registration.scope).href,
    tag: payload.tag || 'minas-mais-tarefa',
    renotify: true,
    requireInteraction: payload.requireInteraction !== false,
    silent: false,
    vibrate: payload.vibrate || [300, 100, 300, 100, 500],
    data: payload.data || {},
  };
  event.waitUntil(
    self.registration.showNotification(payload.title || 'Nova tarefa prioritária', notification),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const rawTarget = event.notification.data?.url || 'tasks';
  const target = rawTarget.startsWith('/tasks') ? `.${rawTarget}` : rawTarget;
  const targetUrl = new URL(target, self.registration.scope).href;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const existing = windows.find((client) => 'focus' in client);
      if (existing) {
        existing.navigate(targetUrl);
        return existing.focus();
      }
      return clients.openWindow(targetUrl);
    }),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(async () => (await caches.match(event.request)) || caches.match(scopedUrl('./offline.html'))),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fresh = fetch(event.request)
        .then((response) => {
          if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
          return response;
        })
        .catch(() => cached);
      return cached || fresh;
    }),
  );
});