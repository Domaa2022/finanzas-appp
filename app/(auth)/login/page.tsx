'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { PiggyBank, TrendingUp, TrendingDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { SocialAuthButtons, AuthDivider } from '@/components/auth/SocialAuthButtons'

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ email: '', password: '' })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword(form)
    if (error) {
      toast.error('Credenciales incorrectas')
      setLoading(false)
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.05fr_1fr]">

      {/* ── Panel de marca (solo desktop) ── */}
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-gradient-to-br from-indigo-700 via-indigo-600 to-indigo-500 p-12 text-white">
        {/* Resplandores suaves, mismo lenguaje que el hero del dashboard */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 bottom-0 h-72 w-72 rounded-full bg-white/5 blur-3xl" />

        {/* Marca */}
        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
            <PiggyBank className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight">Mis Finanzas</span>
        </div>

        {/* Mensaje + vistazo del producto */}
        <div className="relative">
          <h2 className="max-w-md text-4xl font-bold leading-[1.1] tracking-tight text-balance">
            Tu dinero, bajo control.
          </h2>
          <p className="mt-4 max-w-sm text-indigo-100">
            Ingresos, gastos, ahorros y tarjetas — todo en un solo lugar, quincena a quincena.
          </p>

          {/* Mini card de "Disponible" que insinúa la app real */}
          <div className="mt-9 w-full max-w-xs rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur-md shadow-lg">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-100">Disponible</p>
            <p className="mt-1 font-mono-nums text-3xl font-bold">L 12,480.00</p>
            <div className="mt-4 flex items-center gap-4 text-xs text-indigo-100">
              <span className="flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-300" />
                <span className="font-mono-nums">+L 18,000</span>
              </span>
              <span className="flex items-center gap-1.5">
                <TrendingDown className="h-3.5 w-3.5 text-rose-300" />
                <span className="font-mono-nums">−L 5,520</span>
              </span>
            </div>
          </div>
        </div>

        <p className="relative text-xs text-indigo-200/80">Tu dinero, bajo control.</p>
      </div>

      {/* ── Panel del formulario ── */}
      <div className="flex items-center justify-center bg-[#F5F8FC] px-6 py-10 dark:bg-[#0F1420] sm:px-10">
        <div className="w-full max-w-sm">

          {/* Marca compacta (solo móvil) */}
          <div className="mb-8 flex flex-col items-center lg:hidden">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600">
              <PiggyBank className="h-7 w-7 text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Mis Finanzas</h1>
          </div>

          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-slate-100">
              Bienvenido de vuelta
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
              Iniciá sesión para seguir con tus finanzas.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <SocialAuthButtons />
            <AuthDivider />

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Input
                label="Correo electrónico"
                type="email"
                placeholder="tu@correo.com"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                required
              />
              <Input
                label="Contraseña"
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                required
              />
              <div className="-mt-1 flex justify-end">
                <Link href="/olvide-contrasena" className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
              <Button type="submit" loading={loading} className="mt-1 w-full">
                Iniciar sesión
              </Button>
            </form>
          </div>

          <p className="mt-8 text-center text-sm text-gray-500 dark:text-slate-400">
            ¿No tenés cuenta?{' '}
            <Link href="/registro" className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
              Registrate
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
