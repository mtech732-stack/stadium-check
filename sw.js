/* عامل الخدمة: يخزّن ملفّات التطبيق ليعمل دون إنترنت.
   عند تعديل أيّ ملفّ ارفع رقم CACHE ليأخذ الجوّال النسخة الجديدة. */

const CACHE = 'stadium-check-v21';

const SHELL = [
  './',
  './index.html',
  './css/app.css?v=20',
  './css/print.css?v=20',
  './js/data.js?v=20',
  './js/form-store.js?v=20',
  './js/app.js?v=20',
  './js/print.js?v=20',
  './js/archive.js?v=20',
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
  const url = new URL(ev.request.url);
  if (url.origin !== self.location.origin) return;
  /* ملفّ رقم النسخة لا يُخزَّن أبداً، وإلّا لم يُكتشف التحديث */
  if (url.pathname.endsWith('/version.json')) return;

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
