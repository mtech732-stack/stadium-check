/* عامل الخدمة: يخزّن ملفّات التطبيق ليعمل دون إنترنت.
   عند تعديل أيّ ملفّ ارفع رقم CACHE ليأخذ الجوّال النسخة الجديدة. */

const CACHE = 'stadium-check-v15';

const SHELL = [
  './',
  './index.html',
  './css/app.css?v=14',
  './css/print.css?v=14',
  './js/data.js?v=14',
  './js/form-store.js?v=14',
  './js/app.js?v=14',
  './js/print.js?v=14',
  './js/archive.js?v=14',
  './review.html',
  './js/review.js?v=14',
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
