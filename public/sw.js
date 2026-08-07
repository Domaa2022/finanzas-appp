// Service worker mínimo: habilita la instalación del PWA y da un offline básico.
// Estrategia "network-first" solo para navegaciones y recursos del propio sitio;
// todo lo demás (Supabase, HMR, POST) pasa directo sin tocarse.

const CACHE = 'mf-cache-v1'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Solo GET del mismo origen. Nada de API, websockets de HMR ni terceros.
  if (request.method !== 'GET' || url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/_next/webpack-hmr')) return

  event.respondWith(
    fetch(request)
      .then((res) => {
        // Guardar una copia para poder servirla sin conexión.
        const copy = res.clone()
        caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {})
        return res
      })
      .catch(() => caches.match(request))
  )
})
