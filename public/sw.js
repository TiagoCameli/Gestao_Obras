/* eslint-env serviceworker */
// EMT Construtora — Service Worker (PR23 Marco 5)
//
// Estratégias:
//   - Navegações (HTML): network-first com fallback pra cache (app-shell offline)
//   - Estáticos (CSS, JS, fontes, ícones): stale-while-revalidate
//   - API Supabase: SEM cache (network-only) — dados são sensíveis e mutáveis;
//     a camada offline da app vai usar IndexedDB direto (PR25)
//
// Versão única no nome do cache — bump quando mudar a estratégia.

const VERSION = 'emt-v1';
const APP_SHELL_CACHE = `${VERSION}-shell`;
const STATIC_CACHE = `${VERSION}-static`;

const SHELL_URLS = [
  '/',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting())
      .catch((err) => console.error('[SW] precache falhou:', err))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Só GET interessa
  if (req.method !== 'GET') return;

  // Supabase REST / Auth / Storage — network-only (não cacheia dados)
  if (url.hostname.endsWith('.supabase.co') || url.hostname.endsWith('.supabase.in')) {
    return; // deixa o browser tratar normalmente
  }

  // Navegação de página (HTML) — network-first com fallback shell
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((resp) => {
          // Cacheia versão atualizada da raiz
          if (resp.ok) {
            const clone = resp.clone();
            caches.open(APP_SHELL_CACHE).then((c) => c.put('/', clone));
          }
          return resp;
        })
        .catch(async () => {
          const shell = await caches.match('/');
          return shell ?? new Response('Offline e sem cache disponível', { status: 503 });
        })
    );
    return;
  }

  // Estáticos mesmo origin — stale-while-revalidate
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        const network = fetch(req).then((resp) => {
          if (resp.ok) cache.put(req, resp.clone());
          return resp;
        }).catch(() => cached);
        return cached || network;
      })
    );
  }
});

// Mensagem do app pra forçar skip-waiting (após update)
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
