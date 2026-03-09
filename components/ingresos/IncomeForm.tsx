'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { todayISO } from '@/lib/utils/dates'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'

const schema = z.object({
  monto: z.string().min(1, 'Requerido').refine(v => parseFloat(v) > 0, 'Debe ser mayor a 0'),
  fuente: z.string().min(1, 'Requerido'),
  frecuencia: z.enum(['diario', 'semanal', 'quincenal', 'mensual']),
  fecha: z.string().min(1, 'Requerido'),
  notas: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface IncomeFormProps {
  onSuccess: () => void
  onCancel?: () => void
}

export function IncomeForm({ onSuccess, onCancel }: IncomeFormProps) {
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      fecha: todayISO(),
      fuente: 'Quincena',
      frecuencia: 'quincenal',
    },
  })

  async function onSubmit(data: FormData) {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from('income_entries').insert({
      user_id: user.id,
      monto: parseFloat(data.monto),
      fuente: data.fuente,
      frecuencia: data.frecuencia,
      fecha: data.fecha,
      ahorro_tipo: 'ninguno',
      ahorro_valor: 0,
      notas: data.notas || null,
    })

    if (error) {
      toast.error('Error al guardar ingreso')
      setLoading(false)
      return
    }

    toast.success('Ingreso registrado')
    onSuccess()
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Input
        label="Monto recibido (L)"
        type="number"
        step="0.01"
        min="0"
        placeholder="0.00"
        error={errors.monto?.message}
        {...register('monto')}
      />

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Fuente"
          placeholder="Ej: Salario, Jornal..."
          error={errors.fuente?.message}
          {...register('fuente')}
        />
        <Select
          label="Frecuencia"
          options={[
            { value: 'diario', label: 'Diario' },
            { value: 'semanal', label: 'Semanal' },
            { value: 'quincenal', label: 'Quincenal' },
            { value: 'mensual', label: 'Mensual' },
          ]}
          {...register('frecuencia')}
        />
      </div>

      <Input
        label="Fecha de recepción"
        type="date"
        error={errors.fecha?.message}
        {...register('fecha')}
      />

      <Input
        label="Notas (opcional)"
        placeholder="Comentarios..."
        {...register('notas')}
      />

      <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
        El sobrante del mes se puede enviar a tus metas de ahorro desde el panel principal cuando quieras.
      </p>

      <div className="flex gap-3 pt-2">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">
            Cancelar
          </Button>
        )}
        <Button type="submit" loading={loading} className="flex-1">
          Registrar ingreso
        </Button>
      </div>
    </form>
  )
}
