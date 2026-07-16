const CACHE_NAME = 'one-to-one-lib-v10';
const ASSETS = ['./', './index.html', './style.css',
  './firebase-config.js', './auth.js', './notifications.js', './app.js',
  './home.js', './ebook.js', './bookshop.js',
  './personal.js', './dashboard.js', './manifest.json'];
self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(n=>n!==CACHE_NAME).map(n=>caches.delete(n)))));
  self.clients.claim();
});
self.addEventListener('fetch',e=>{
  if(e.request.url.includes('firebase')||e.request.url.includes('googleapis')){
    e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));return;
  }
  e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(CACHE_NAME).then(ca=>ca.put(e.request,c));return r;}).catch(()=>caches.match(e.request)));
});
