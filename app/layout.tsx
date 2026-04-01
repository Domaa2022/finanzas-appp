import type { Metadata } from 'next'
import { Toaster } from 'sonner'
import { ThemeProvider } from '@/components/providers/ThemeProvider'
import './globals.css'

export const metadata: Metadata = {
  title: 'Mis Finanzas',
  description: 'Aplicación de finanzas personales',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
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
      </body>
    </html>
  )
}
