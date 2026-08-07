'use client'

import { useEffect } from 'react'

/** Registra el service worker para que la app se pueda instalar como PWA. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])
  return null
}
