'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Subscription } from '@/lib/types/database'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'

const CATEGORIAS = [
  { value: 'entretenimiento', label: 'Entretenimiento' },
  { value: 'software', label: 'Software' },
  { value: 'educacion', label: 'Educación' },
  { value: 'productividad', label: 'Productividad' },
  { value: 'gaming', label: 'Gaming' },
  { value: 'otro', label: 'Otro' },
]

const FRECUENCIAS = [
  { value: 'mensual', label: 'Mensual' },
  { value: 'anual', label: 'Anual' },
  { value: 'trimestral', label: 'Trimestral' },
  { value: 'semanal', label: 'Semanal' },
]

const COLORES = [
  '#EF4444', '#F97316', '#EAB308', '#22C55E',
  '#06B6D4', '#3B82F6', '#8B5CF6', '#EC4899',
  '#6B7280',
]

const schema = z.object({
  nombre: z.string().min(1, 'Requerido'),
  monto: z.string().min(1, 'Requerido').refine(v => parseFloat(v) > 0, 'Debe ser mayor a 0'),
  frecuencia: z.enum(['semanal', 'mensual', 'trimestral', 'anual']),
  fecha_renovacion: z.string().optional(),
  categoria: z.enum(['entretenimiento', 'software', 'educacion', 'productividad', 'gaming', 'otro']),
  notas: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface Props {
  initial?: Subscription
  onSuccess: () => void
  onCancel?: () => void
}

export function SubscriptionForm({ initial, onSuccess, onCancel }: Props) {
  const [loading, setLoading] = useState(false)
  const [color, setColor] = useState(initial?.color || COLORES[4])

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      nombre: initial?.nombre || '',
      monto: initial?.monto?.toString() || '',
      frecuencia: initial?.frecuencia || 'mensual',
      fecha_renovacion: initial?.fecha_renovacion || '',
      categoria: initial?.categoria || 'otro',
      notas: initial?.notas || '',
    },
  })

  async function onSubmit(data: FormData) {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const payload = {
      nombre: data.nombre,
      monto: parseFloat(data.monto),
      frecuencia: data.frecuencia,
      fecha_renovacion: data.fecha_renovacion || null,
      categoria: data.categoria,
      notas: data.notas || null,
      color,
    }

    let error
    if (initial) {
      ;({ error } = await supabase.from('subscriptions').update(payload).eq('id', initial.id))
    } else {
      ;({ error } = await supabase.from('subscriptions').insert({ ...payload, user_id: user.id }))
    }

    if (error) {
      toast.error('Error al guardar suscripción')
    } else {
      toast.success(initial ? 'Suscripción actualizada' : 'Suscripción agregada')
      onSuccess()
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Input
        label="Nombre de la app"
        placeholder="Ej: Netflix, Spotify, Adobe..."
        error={errors.nombre?.message}
        {...register('nombre')}
      />

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Monto (L)"
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          error={errors.monto?.message}
          {...register('monto')}
        />
        <Select
          label="Frecuencia"
          options={FRECUENCIAS}
          {...register('frecuencia')}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Categoría"
          options={CATEGORIAS}
          {...register('categoria')}
        />
        <Input
          label="Próximo cobro"
          type="date"
          error={errors.fecha_renovacion?.message}
          {...register('fecha_renovacion')}
        />
      </div>

      {/* Color picker */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700">Color</label>
        <div className="flex gap-2 flex-wrap">
          {COLORES.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className="h-7 w-7 rounded-full transition-all"
              style={{
                backgroundColor: c,
                outline: color === c ? `3px solid ${c}` : 'none',
                outlineOffset: '2px',
              }}
            />
          ))}
        </div>
      </div>

      <Input
        label="Notas (opcional)"
        placeholder="Ej: Cuenta familiar, prueba gratis hasta..."
        {...register('notas')}
      />

      <div className="flex gap-3 pt-2">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">
            Cancelar
          </Button>
        )}
        <Button type="submit" loading={loading} className="flex-1">
          {initial ? 'Actualizar' : 'Agregar suscripción'}
        </Button>
      </div>
    </form>
  )
}
