'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Category, FixedExpense } from '@/lib/types/database'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'

const GRUPOS = [
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
  { value: 'variable', label: 'Sin fecha fija' },
]

const COLORES = [
  '#EF4444', '#F97316', '#EAB308', '#22C55E',
  '#06B6D4', '#3B82F6', '#8B5CF6', '#EC4899',
  '#6B7280',
]

const schema = z.object({
  nombre: z.string().min(1, 'Requerido'),
  monto: z.string().min(1, 'Requerido').refine(v => parseFloat(v) > 0, 'Debe ser mayor a 0'),
  frecuencia: z.enum(['semanal', 'mensual', 'trimestral', 'anual', 'variable']),
  proximo_pago: z.string().optional(),
  category_id: z.string().min(1, 'Requerido'),
  grupo: z.enum(['entretenimiento', 'software', 'educacion', 'productividad', 'gaming', 'otro']),
  notas: z.string().optional(),
}).refine(
  // Sin fecha no hay forma de cobrarla sola ni de repartir el apartado.
  d => d.frecuencia === 'variable' || !!d.proximo_pago,
  { path: ['proximo_pago'], message: 'Requerido salvo en «sin fecha fija»' },
)

type FormData = z.infer<typeof schema>

interface Props {
  categorias: Category[]
  initial?: FixedExpense
  onSuccess: () => void
  onCancel?: () => void
}

export function SubscriptionForm({ categorias, initial, onSuccess, onCancel }: Props) {
  const [loading, setLoading] = useState(false)
  const [color, setColor] = useState(initial?.color || COLORES[4])

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      nombre: initial?.nombre || '',
      monto: initial?.monto?.toString() || '',
      frecuencia: (initial?.frecuencia as FormData['frecuencia']) || 'mensual',
      proximo_pago: initial?.proximo_pago || '',
      category_id: initial?.category_id || categorias[0]?.id || '',
      grupo: initial?.grupo || 'otro',
      notas: initial?.notas || '',
    },
  })

  const frecuencia = watch('frecuencia')
  const esVariable = frecuencia === 'variable'

  async function onSubmit(data: FormData) {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      toast.error('Sesión expirada, volvé a iniciar sesión')
      setLoading(false)
      return
    }

    const payload = {
      nombre: data.nombre,
      monto: parseFloat(data.monto),
      frecuencia: data.frecuencia,
      // Las variables no tienen fecha: se aparta hasta llenar y se pagan a mano.
      proximo_pago: esVariable ? null : data.proximo_pago || null,
      dia_pago: !esVariable && data.proximo_pago
        ? new Date(data.proximo_pago + 'T00:00:00').getDate()
        : null,
      category_id: data.category_id,
      grupo: data.grupo,
      notas: data.notas || null,
      color,
    }

    const { error } = initial
      ? await supabase.from('fixed_expenses').update(payload).eq('id', initial.id)
      : await supabase.from('fixed_expenses').insert({ ...payload, user_id: user.id, activo: true })

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
          label="Categoría de gasto"
          options={categorias.map(c => ({ value: c.id, label: c.nombre }))}
          error={errors.category_id?.message}
          {...register('category_id')}
        />
        <Input
          label="Próximo cobro"
          type="date"
          disabled={esVariable}
          error={errors.proximo_pago?.message}
          {...register('proximo_pago')}
        />
      </div>

      {esVariable && (
        <p className="-mt-2 text-xs text-gray-500 dark:text-slate-400">
          Sin fecha fija: se aparta la mitad del monto cada quincena hasta completar
          {' '}{formatMonto(watch('monto'))} y ahí se detiene. La pagás vos cuando llegue el cobro.
        </p>
      )}

      <Select
        label="Grupo"
        options={GRUPOS}
        {...register('grupo')}
      />

      {/* Color picker */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700 dark:text-slate-300">Color</label>
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

function formatMonto(v: string | undefined): string {
  const n = parseFloat(v || '')
  return isNaN(n) ? 'el monto' : `L ${n.toFixed(2)}`
}
