// ওয়ান টু ওয়ান লাইব্রেরি - Service Worker
// ভার্সন বদলালে সব ডিভাইসে অটো আপডেট হবে
const CACHE_NAME = 'one-to-one-lib-v6';

const ASSETS = [
  './', './index.html', './style.css',
  './firebase-config.js', './auth.js', './app.js',
  './home.js', './ebook.js', './booklist.js',
  './personal.js', './dashboard.js', './manifest.json',
  './icon-192.png', './icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(ASSETS))
  );
  // পুরনো SW কে সরিয়ে নতুনটা সাথে সাথে চালু করো
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => {
          console.log('পুরনো cache মুছছি:', k);
          return caches.delete(k);
        })
      )
    )
  );
  // সব open tab এ নতুন SW চালু করো
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Firebase requests সবসময় network থেকে নাও
  if (e.request.url.includes('firebase') ||
      e.request.url.includes('googleapis') ||
      e.request.url.includes('firestore')) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }
  // বাকি সব: network first, তারপর cache
  e.respondWith(
    fetch(e.request)
      .then(response => {
        // নতুন response cache এ রাখো
        const clone = response.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        return response;
      })
      .catch(() => caches.match(e.request))
  );
});
