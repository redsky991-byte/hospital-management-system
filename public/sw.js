const CACHE_NAME = 'medcare-hms-v1';
const STATIC_ASSETS = [
  '/', '/index.html', '/dashboard.html', '/patients.html',
  '/appointments.html', '/billing.html', '/users.html',
  '/audit.html', '/settings.html', '/about.html',
  '/css/style.css',
  '/js/api.js', '/js/auth.js', '/js/dashboard.js',
  '/js/patients.js', '/js/appointments.js', '/js/billing.js',
  '/js/users.js', '/js/audit.js', '/js/settings.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/api/')) {
    event.respondWith(fetch(event.request).catch(() => new Response(JSON.stringify({ error: 'Offline' }), { headers: { 'Content-Type': 'application/json' } })));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    if (response && response.status === 200) {
      const clone = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
    }
    return response;
  })));
});
