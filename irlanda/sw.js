/* Service worker — o app inteiro fica no aparelho e abre sem rede.
   A versão vem de VERSION (o build troca a linha abaixo). */
const VERSION = '1.1.1';
const CACHE = 'irl-' + VERSION;
const SHELL = [
  './', './index.html', './i18n.js', './app.js', './claude.js', './data.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/apple-touch-icon.png',
  './maps/nat.svg', './maps/con.svg', './maps/wc.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.all(SHELL.map(async (u) => { try { await c.add(new Request(u, { cache: 'reload' })); } catch (err) { /* um arquivo faltando não impede a instalação */ } }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('irl-') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => { if (e.data === 'skipWaiting') self.skipWaiting(); });

function isFont(url) { return url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com'; }

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname === 'api.anthropic.com') return; // nunca cacheia a API

  if (isFont(url)) {
    // fontes: cache primeiro, atualiza em segundo plano
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      const hit = await c.match(req);
      const net = fetch(req).then((r) => { if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone()); return r; }).catch(() => null);
      return hit || (await net) || new Response('', { status: 504 });
    })());
    return;
  }

  if (url.origin === self.location.origin) {
    // arquivos do app: a cópia local responde na hora (rede ruim não trava a abertura) e a rede atualiza em segundo plano.
    // Versão nova de verdade chega pelo sw.js novo (VERSION diferente → cache novo → aviso "recarregar").
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      const hit = await c.match(req, { ignoreSearch: true });
      const net = fetch(req).then((r) => { if (r && r.ok) c.put(req, r.clone()); return r; }).catch(() => null);
      if (hit) { e.waitUntil(net); return hit; }
      const r = await net;
      if (r) return r;
      if (req.mode === 'navigate') { const idx = await c.match('./index.html'); if (idx) return idx; }
      return new Response('Sem rede e sem cópia local.', { status: 504, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    })());
  }
});
