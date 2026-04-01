'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LogOut, Sun, Moon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'
import { useTheme } from '@/components/providers/ThemeProvider'

interface HeaderProps {
  userName?: string
  avatarUrl?: string | null
}

export function Header({ userName, avatarUrl }: HeaderProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const { theme, toggleTheme } = useTheme()

  const initials = (userName || 'U')
    .split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase()

  async function handleLogout() {
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <header className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-3">
      <h1 className="text-base font-semibold text-gray-500 dark:text-slate-400 md:hidden">Mis Finanzas</h1>

      <div className="flex items-center gap-2 ml-auto">
        {/* Toggle dark mode */}
        <button
          onClick={toggleTheme}
          className="rounded-lg p-2 text-gray-400 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-600 dark:hover:text-slate-200 transition-colors"
          title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        {/* Avatar + nombre → link a configuración */}
        <Link
          href="/configuracion"
          className="flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
        >
          <div className="h-8 w-8 rounded-full overflow-hidden ring-2 ring-gray-100 dark:ring-slate-700 bg-emerald-100 flex items-center justify-center shrink-0">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
            ) : (
              <span className="text-xs font-bold text-emerald-700">{initials}</span>
            )}
          </div>
          <span className="font-medium hidden sm:inline">{userName || 'Usuario'}</span>
        </Link>

        <button
          onClick={handleLogout}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-700 dark:hover:text-slate-200 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Salir
        </button>
      </div>
    </header>
  )
}
