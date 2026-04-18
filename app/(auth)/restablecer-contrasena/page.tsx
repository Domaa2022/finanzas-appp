'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { PiggyBank, CheckCircle2, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

function RestablecerForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [listo, setListo] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const [errorEnlace, setErrorEnlace] = useState(false)
  const [form, setForm] = useState({ password: '', confirm: '' })

  useEffect(() => {
    const code = searchParams.get('code')
    if (!code) {
      setErrorEnlace(true)
      return
    }
    const supabase = createClient()
    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) {
        setErrorEnlace(true)
      } else {
        setSessionReady(true)
      }
    })
  }, [searchParams])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.password.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres')
      return
    }
    if (form.password !== form.confirm) {
      toast.error('Las contraseñas no coinciden')
      return
    }
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: form.password })
    if (error) {
      toast.error('No se pudo actualizar la contraseña')
      setLoading(false)
      return
    }
    setListo(true)
    setLoading(false)
    setTimeout(() => router.push('/dashboard'), 2000)
  }

  if (listo) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 flex flex-col items-center gap-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
          <CheckCircle2 className="h-7 w-7 text-emerald-600" />
        </div>
        <div>
          <p className="font-semibold text-gray-900">¡Contraseña actualizada!</p>
          <p className="text-sm text-gray-500 mt-1">Redirigiendo a tu panel...</p>
        </div>
      </div>
    )
  }

  if (errorEnlace) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 flex flex-col items-center gap-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
          <AlertCircle className="h-7 w-7 text-red-500" />
        </div>
        <div>
          <p className="font-semibold text-gray-900">Enlace inválido o expirado</p>
          <p className="text-sm text-gray-500 mt-1">Solicita un nuevo enlace de recuperación.</p>
        </div>
        <a href="/olvide-contrasena" className="text-sm text-emerald-600 font-medium hover:underline">
          Solicitar nuevo enlace
        </a>
      </div>
    )
  }

  if (!sessionReady) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
        <p className="text-sm text-gray-500">Verificando enlace...</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 flex flex-col gap-4">
      <Input
        label="Nueva contraseña"
        type="password"
        placeholder="Mínimo 6 caracteres"
        value={form.password}
        onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
        required
      />
      <Input
        label="Confirmar contraseña"
        type="password"
        placeholder="Repite la contraseña"
        value={form.confirm}
        onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
        required
      />
      <Button type="submit" loading={loading} className="w-full mt-2">
        Guardar nueva contraseña
      </Button>
    </form>
  )
}

export default function RestablecerContrasenaPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 mb-4">
            <PiggyBank className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Mis Finanzas</h1>
          <p className="text-sm text-gray-500 mt-1">Nueva contraseña</p>
        </div>
        <Suspense fallback={
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
            <p className="text-sm text-gray-500">Cargando...</p>
          </div>
        }>
          <RestablecerForm />
        </Suspense>
      </div>
    </div>
  )
}
