'use client'

import { useRouter } from 'next/navigation'
import { LogOut, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'

interface HeaderProps {
  userName?: string
}

export function Header({ userName }: HeaderProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleLogout() {
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <header className="flex items-center justify-between border-b border-gray-100 bg-white px-6 py-4">
      <h1 className="text-base font-semibold text-gray-500 md:hidden">Mis Finanzas</h1>
      <div className="flex items-center gap-3 ml-auto">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <User className="h-4 w-4" />
          <span>{userName || 'Usuario'}</span>
        </div>
        <button
          onClick={handleLogout}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Salir
        </button>
      </div>
    </header>
  )
}
