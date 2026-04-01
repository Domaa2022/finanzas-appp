'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Camera, User, Lock, Sliders, Loader2, Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/lib/types/database'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

// ── Schemas ──────────────────────────────────────────────────────────────────

const perfilSchema = z.object({
  nombre: z.string().min(1, 'Requerido').max(60, 'Máximo 60 caracteres'),
  default_savings_pct: z
    .string()
    .refine(v => {
      const n = parseFloat(v)
      return !isNaN(n) && n >= 0 && n <= 100
    }, 'Debe ser entre 0 y 100'),
})

const passSchema = z
  .object({
    nueva: z.string().min(6, 'Mínimo 6 caracteres'),
    confirmar: z.string().min(6, 'Requerido'),
  })
  .refine(d => d.nueva === d.confirmar, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmar'],
  })

type PerfilForm = z.infer<typeof perfilSchema>
type PassForm = z.infer<typeof passSchema>

// ── Avatar upload ─────────────────────────────────────────────────────────────

const MAX_SIZE_MB = 2

function AvatarSection({
  profile,
  userId,
  onUpdated,
}: {
  profile: Profile
  userId: string
  onUpdated: (url: string) => void
}) {
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(profile.avatar_url)
  const inputRef = useRef<HTMLInputElement>(null)

  const initials = profile.nombre
    .split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase()

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`La imagen no debe superar ${MAX_SIZE_MB} MB`)
      return
    }
    if (!file.type.startsWith('image/')) {
      toast.error('Solo se permiten imágenes')
      return
    }

    const localUrl = URL.createObjectURL(file)
    setPreview(localUrl)
    setUploading(true)

    const supabase = createClient()
    const ext = file.name.split('.').pop()
    const path = `${userId}/avatar.${ext}`

    const { error: upErr } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type })

    if (upErr) {
      toast.error('Error al subir la imagen')
      setPreview(profile.avatar_url)
      setUploading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
    const urlFinal = `${publicUrl}?t=${Date.now()}`

    const { error: dbErr } = await supabase
      .from('profiles')
      .update({ avatar_url: urlFinal })
      .eq('id', userId)

    if (dbErr) {
      toast.error('Error al guardar la foto')
    } else {
      toast.success('Foto de perfil actualizada')
      onUpdated(urlFinal)
    }
    setUploading(false)
  }

  async function handleRemove() {
    if (!preview) return
    if (!confirm('¿Quitar la foto de perfil?')) return
    const supabase = createClient()
    await supabase.from('profiles').update({ avatar_url: null }).eq('id', userId)
    setPreview(null)
    onUpdated('')
    toast.success('Foto de perfil eliminada')
  }

  return (
    <Card>
      <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2">
        <Camera className="h-4 w-4 text-emerald-600" />
        Foto de perfil
      </h2>

      <div className="flex items-center gap-6">
        <div className="relative shrink-0">
          <div className="h-24 w-24 rounded-full overflow-hidden ring-4 ring-gray-100 dark:ring-slate-700 bg-emerald-100 flex items-center justify-center">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Avatar" className="h-full w-full object-cover" />
            ) : (
              <span className="text-2xl font-bold text-emerald-700">{initials}</span>
            )}
          </div>
          {uploading && (
            <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
              <Loader2 className="h-6 w-6 text-white animate-spin" />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Button
            variant="secondary"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            <Camera className="h-4 w-4" />
            {preview ? 'Cambiar foto' : 'Subir foto'}
          </Button>
          {preview && (
            <button
              onClick={handleRemove}
              className="text-sm text-red-500 hover:text-red-600 transition-colors text-left"
            >
              Quitar foto
            </button>
          )}
          <p className="text-xs text-gray-400 dark:text-slate-500">JPG, PNG o GIF · Máx. {MAX_SIZE_MB} MB</p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
    </Card>
  )
}

// ── Perfil Form ───────────────────────────────────────────────────────────────

function PerfilSection({ profile, userId }: { profile: Profile; userId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors, isDirty } } = useForm<PerfilForm>({
    resolver: zodResolver(perfilSchema),
    defaultValues: {
      nombre: profile.nombre,
      default_savings_pct: profile.default_savings_pct?.toString() || '10',
    },
  })

  async function onSubmit(data: PerfilForm) {
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('profiles')
      .update({
        nombre: data.nombre,
        default_savings_pct: parseFloat(data.default_savings_pct),
      })
      .eq('id', userId)

    if (error) {
      toast.error('Error al actualizar perfil')
    } else {
      toast.success('Perfil actualizado')
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <Card>
      <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2">
        <User className="h-4 w-4 text-emerald-600" />
        Información personal
      </h2>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Input
          label="Nombre"
          placeholder="Tu nombre"
          error={errors.nombre?.message}
          {...register('nombre')}
        />

        <Input
          label="Correo electrónico"
          type="email"
          value={profile.email}
          readOnly
          disabled
          helpText="El correo no se puede cambiar desde aquí"
        />

        <div className="flex gap-3 pt-1">
          <Button type="submit" loading={loading} disabled={!isDirty}>
            Guardar cambios
          </Button>
        </div>
      </form>
    </Card>
  )
}

// ── Preferencias ──────────────────────────────────────────────────────────────

function PreferenciasSection({ profile, userId }: { profile: Profile; userId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [valor, setValor] = useState(profile.default_savings_pct?.toString() || '10')

  async function handleSave() {
    const n = parseFloat(valor)
    if (isNaN(n) || n < 0 || n > 100) {
      toast.error('Debe ser un número entre 0 y 100')
      return
    }
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('profiles')
      .update({ default_savings_pct: n })
      .eq('id', userId)

    if (error) {
      toast.error('Error al guardar preferencias')
    } else {
      toast.success('Preferencias guardadas')
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <Card>
      <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2">
        <Sliders className="h-4 w-4 text-emerald-600" />
        Preferencias financieras
      </h2>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700 dark:text-slate-300">
            Porcentaje de ahorro por defecto
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={50}
              step={1}
              value={parseFloat(valor) || 0}
              onChange={e => setValor(e.target.value)}
              className="flex-1 accent-emerald-600"
            />
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={valor}
                onChange={e => setValor(e.target.value)}
                className="w-16 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <span className="text-sm text-gray-500 dark:text-slate-400">%</span>
            </div>
          </div>
          <p className="text-xs text-gray-400 dark:text-slate-500">
            Este porcentaje se usará por defecto al registrar ingresos nuevos
          </p>
        </div>

        <Button onClick={handleSave} loading={loading} className="w-fit">
          Guardar preferencias
        </Button>
      </div>
    </Card>
  )
}

// ── Cambiar Contraseña ────────────────────────────────────────────────────────

function SeguridadSection() {
  const [loading, setLoading] = useState(false)
  const [showNueva, setShowNueva] = useState(false)
  const [showConfirmar, setShowConfirmar] = useState(false)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<PassForm>({
    resolver: zodResolver(passSchema),
  })

  async function onSubmit(data: PassForm) {
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: data.nueva })

    if (error) {
      toast.error(error.message || 'Error al cambiar contraseña')
    } else {
      toast.success('Contraseña actualizada correctamente')
      reset()
    }
    setLoading(false)
  }

  const inputBase = 'w-full rounded-lg border px-3 py-2 pr-10 text-sm placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors'
  const inputNormal = 'border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100'
  const inputError = 'border-red-400 dark:border-red-500 bg-red-50 dark:bg-red-950/30 text-gray-900 dark:text-slate-100'

  return (
    <Card>
      <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2">
        <Lock className="h-4 w-4 text-emerald-600" />
        Seguridad
      </h2>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700 dark:text-slate-300">Nueva contraseña</label>
          <div className="relative">
            <input
              type={showNueva ? 'text' : 'password'}
              placeholder="Mínimo 6 caracteres"
              className={`${inputBase} ${errors.nueva ? inputError : inputNormal}`}
              {...register('nueva')}
            />
            <button
              type="button"
              onClick={() => setShowNueva(v => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300"
            >
              {showNueva ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.nueva && <p className="text-xs text-red-600 dark:text-red-400">{errors.nueva.message}</p>}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700 dark:text-slate-300">Confirmar contraseña</label>
          <div className="relative">
            <input
              type={showConfirmar ? 'text' : 'password'}
              placeholder="Repite la contraseña"
              className={`${inputBase} ${errors.confirmar ? inputError : inputNormal}`}
              {...register('confirmar')}
            />
            <button
              type="button"
              onClick={() => setShowConfirmar(v => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300"
            >
              {showConfirmar ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.confirmar && <p className="text-xs text-red-600 dark:text-red-400">{errors.confirmar.message}</p>}
        </div>

        <Button type="submit" loading={loading} className="w-fit">
          Cambiar contraseña
        </Button>
      </form>
    </Card>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

interface Props {
  profile: Profile
  userId: string
}

export default function ConfiguracionClientPage({ profile, userId }: Props) {
  const router = useRouter()
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url)

  const handleAvatarUpdated = useCallback((url: string) => {
    setAvatarUrl(url || null)
    router.refresh()
  }, [router])

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Configuración</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">Administra tu perfil y preferencias</p>
      </div>

      <AvatarSection
        profile={{ ...profile, avatar_url: avatarUrl }}
        userId={userId}
        onUpdated={handleAvatarUpdated}
      />

      <PerfilSection profile={profile} userId={userId} />

      <PreferenciasSection profile={profile} userId={userId} />

      <SeguridadSection />
    </div>
  )
}
