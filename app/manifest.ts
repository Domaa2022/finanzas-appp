import type { MetadataRoute } from 'next'

// Manifest del PWA. Next lo sirve en /manifest.webmanifest y agrega el <link>
// automáticamente. Cambiar name/short_name cuando la app tenga nombre nuevo.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Mis Finanzas',
    short_name: 'Mis Finanzas',
    description: 'Tu dinero, bajo control.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    lang: 'es',
    background_color: '#F5F8FC',
    theme_color: '#4f46e5',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
