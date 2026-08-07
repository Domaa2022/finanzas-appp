'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

type Provider = 'google'

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
    
  )
}

export function SocialAuthButtons() {
  const [loading, setLoading] = useState<Provider | null>(null)

  async function handleOAuth(provider: Provider) {
    setLoading(provider)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) {
      toast.error(error.message)
      setLoading(null)
    }
    // En éxito el navegador redirige al provider; no hace falta resetear loading.
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => handleOAuth('google')}
        disabled={loading !== null}
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-60 transition-colors"
      >
        <GoogleIcon />
        {loading === 'google' ? 'Conectando...' : 'Continuar con Google'}
      </button>
    </div>
  )
}

export function AuthDivider({ text = 'o' }: { text?: string }) {
  return (
    <div className="relative flex items-center">
      <div className="flex-1 border-t border-gray-200 dark:border-slate-700" />
      <span className="px-3 text-xs text-gray-400 dark:text-slate-500 uppercase">{text}</span>
      <div className="flex-1 border-t border-gray-200 dark:border-slate-700" />
    </div>
  )
}
