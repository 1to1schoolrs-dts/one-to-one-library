const CACHE_NAME = 'one-to-one-lib-v7';
const ASSETS = [
  './', './index.html', './style.css',
  './firebase-config.js', './auth.js', './app.js',
  './home.js', './ebook.js', './bookshop.js',
  './personal.js', './dashboard.js', './manifest.json',
  './icon-192.png', './icon-512.png'
];
self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch',e=>{
  if(e.request.url.includes('firebase')||e.request.url.includes('googleapis')||e.request.url.includes('firestore')){
    e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));
    return;
  }
  e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(CACHE_NAME).then(ca=>ca.put(e.request,c));return r;}).catch(()=>caches.match(e.request)));
});
