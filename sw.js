/* عامل الخدمة: يخزّن ملفّات التطبيق ليعمل دون إنترنت.
   عند تعديل أيّ ملفّ ارفع رقم CACHE ليأخذ الجوّال النسخة الجديدة. */

const CACHE = 'stadium-check-v5';

const SHELL = [
  './',
  './index.html',
  './css/app.css',
  './css/print.css',
  './js/data.js',
  './js/form-store.js',
  './js/app.js',
  './editor.html',
  './js/editor.js',
  './css/editor.css',
  './js/print.js',
  './js/archive.js',
  './review.html',
  './js/review.js',
  './manifest.webmanifest',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', ev => {
  ev.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', ev => {
  ev.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* الكاش أولاً: التطبيق يعمل كاملاً دون شبكة، ويحدّث نسخته في الخلفية عند توفّرها. */
self.addEventListener('fetch', ev => {
  if (ev.request.method !== 'GET') return;
  ev.respondWith(
    caches.match(ev.request).then(hit => {
      const net = fetch(ev.request).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(ev.request, copy));
        }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
