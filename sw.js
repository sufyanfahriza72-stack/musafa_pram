const CACHE_NAME = 'musafa-mobile-v4';
const STATIC_ASSETS = [
  '/',
  '/index.html'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('message', (event) => {
  const data = event && event.data;
  if (!data) return;

  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (data.type === 'SHOW_WA_NOTIFICATION') {
    const title = data.title || 'MUSAFA Mobile';
    const options = {
      body: data.body || 'Ada pengingat agenda atau tugas baru.',
      icon: data.icon || 'https://lh3.googleusercontent.com/d/1v9XLw_NjWKP9zdtIgREkPYmgakhKMq_n',
      badge: data.icon || 'https://lh3.googleusercontent.com/d/1v9XLw_NjWKP9zdtIgREkPYmgakhKMq_n',
      tag: data.tag || ('musafa-notif-' + Date.now()),
      renotify: true,
      requireInteraction: true,
      vibrate: [350, 150, 350, 150, 500],
      data: { url: data.url || '/' }
    };

    event.waitUntil(
      self.registration.showNotification(title, options).catch(() => {})
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification && event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('/index.html') || caches.match('/'))
    );
  }
});