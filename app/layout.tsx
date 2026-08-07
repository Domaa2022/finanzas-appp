import type { Metadata, Viewport } from 'next'
import { Toaster } from 'sonner'
import { ThemeProvider } from '@/components/providers/ThemeProvider'
import { ServiceWorkerRegister } from '@/components/pwa/ServiceWorkerRegister'
import { publicSans, plexMono } from './fonts'
import './globals.css'

export const metadata: Metadata = {
  title: 'Mis Finanzas',
  description: 'Tu dinero, bajo control.',
  applicationName: 'Mis Finanzas',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Mis Finanzas' },
  icons: { apple: '/apple-touch-icon.png' },
}

export const viewport: Viewport = {
  themeColor: '#4f46e5',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning className={`${publicSans.variable} ${plexMono.variable}`}>
      <head>
        {/* Apply theme before first paint to avoid flash */}
        <script dangerouslySetInnerHTML={{
          __html: `try{const t=localStorage.getItem('theme')||(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');if(t==='dark')document.documentElement.setAttribute('data-theme','dark')}catch(e){}`
        }} />
      </head>
      <body className="antialiased">
        <ThemeProvider>
          {children}
          <Toaster position="top-right" richColors />
        </ThemeProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}
