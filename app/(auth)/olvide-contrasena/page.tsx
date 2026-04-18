'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { PiggyBank, ArrowLeft, MailCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export default function OlvideContrasenaPage() {
  const [loading, setLoading] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [email, setEmail] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/restablecer-contrasena`,
    })
    if (error) {
      const msg = error.message.toLowerCase().includes('rate limit')
        ? 'Demasiados intentos. Espera unos minutos antes de volver a intentar.'
        : error.message
      toast.error(msg)
      setLoading(false)
      return
    }
    setEnviado(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 mb-4">
            <PiggyBank className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Mis Finanzas</h1>
          <p className="text-sm text-gray-500 mt-1">Recuperar contraseña</p>
        </div>

        {enviado ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 flex flex-col items-center gap-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
              <MailCheck className="h-7 w-7 text-emerald-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">Correo enviado</p>
              <p className="text-sm text-gray-500 mt-1">
                Revisa tu bandeja de entrada en <span className="font-medium">{email}</span> y sigue el enlace para restablecer tu contraseña.
              </p>
            </div>
            <Link href="/login" className="text-sm text-emerald-600 font-medium hover:underline">
              Volver al inicio de sesión
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 flex flex-col gap-4">
            <p className="text-sm text-gray-500">
              Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.
            </p>
            <Input
              label="Correo electrónico"
              type="email"
              placeholder="tu@correo.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
            <Button type="submit" loading={loading} className="w-full mt-2">
              Enviar enlace
            </Button>
          </form>
        )}

        <p className="text-center text-sm text-gray-500 mt-6">
          <Link href="/login" className="inline-flex items-center gap-1 text-emerald-600 font-medium hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver al inicio de sesión
          </Link>
        </p>
      </div>
    </div>
  )
}
