/* عامل الخدمة: يخزّن ملفّات التطبيق ليعمل دون إنترنت.
   عند تعديل أيّ ملفّ ارفع رقم CACHE ليأخذ الجوّال النسخة الجديدة. */

const CACHE = 'stadium-check-v9';

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
  './assets/kfa-logo.png',
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

/* الشبكة أولاً: المتّصل يأخذ الأحدث دائماً، والمنقطع يرجع إلى النسخة المخزّنة.
   الكاش أولاً كان يعرض نسخة قديمة عند كلّ تحديث حتى الفتحة التالية. */
self.addEventListener('fetch', ev => {
  if (ev.request.method !== 'GET') return;
  if (new URL(ev.request.url).origin !== self.location.origin) return;

  ev.respondWith(
    fetch(ev.request)
      .then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(ev.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(ev.request).then(hit =>
        hit || caches.match('./index.html')
      ))
  );
});
