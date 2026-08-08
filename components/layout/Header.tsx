'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LogOut, Sun, Moon, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'
import { useTheme } from '@/components/providers/ThemeProvider'
import { NotificationsBell } from '@/components/layout/NotificationsBell'

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
    <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-gray-100 dark:border-slate-800 bg-white/85 dark:bg-slate-900/85 backdrop-blur px-4 md:px-6 py-3">
      <h1 className="text-base font-semibold text-gray-500 dark:text-slate-400 md:hidden">Mis Finanzas</h1>

      <div className="hidden md:flex items-center gap-2 rounded-full border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 max-w-xs w-full text-sm text-gray-400 dark:text-slate-500">
        <Search className="h-4 w-4 shrink-0 text-indigo-400" />
        <span className="truncate">Buscar transacción, categoría...</span>
      </div>

      <div className="flex items-center gap-2 ml-auto">
        {/* Toggle dark mode */}
        <button
          onClick={toggleTheme}
          className="rounded-xl p-2 border border-gray-200 dark:border-slate-700 text-gray-400 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-600 dark:hover:text-slate-200 transition-colors"
          title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        {/* Notificaciones */}
        <NotificationsBell />

        {/* Avatar + nombre → link a configuración */}
        <Link
          href="/configuracion"
          className="flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
        >
          <div className="h-8 w-8 rounded-full overflow-hidden ring-2 ring-gray-100 dark:ring-slate-700 bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center shrink-0">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
            ) : (
              <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">{initials}</span>
            )}
          </div>
          <span className="hidden sm:block leading-tight">
            <span className="block font-medium">{userName || 'Usuario'}</span>
            <span className="block text-[11px] font-bold text-indigo-600 dark:text-indigo-400">Plan Pro</span>
          </span>
        </Link>

        <button
          onClick={handleLogout}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-700 dark:hover:text-slate-200 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden lg:inline">Salir</span>
        </button>
      </div>
    </header>
  )
}
