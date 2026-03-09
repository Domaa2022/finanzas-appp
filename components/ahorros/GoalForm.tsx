'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'

const schema = z.object({
  nombre: z.string().min(1, 'Requerido'),
  monto_objetivo: z.string().min(1, 'Requerido').refine(v => parseFloat(v) > 0, 'Debe ser mayor a 0'),
  fecha_limite: z.string().optional(),
  prioridad: z.string(),
})

type FormData = z.infer<typeof schema>

interface GoalFormProps {
  onSuccess: () => void
  onCancel?: () => void
}

export function GoalForm({ onSuccess, onCancel }: GoalFormProps) {
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { prioridad: '3' },
  })

  async function onSubmit(data: FormData) {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from('savings_goals').insert({
      user_id: user.id,
      nombre: data.nombre,
      monto_objetivo: parseFloat(data.monto_objetivo),
      fecha_limite: data.fecha_limite || null,
      prioridad: parseInt(data.prioridad),
    })

    if (error) {
      toast.error('Error al crear meta')
    } else {
      toast.success('Meta de ahorro creada')
      onSuccess()
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Input
        label="Nombre de la meta"
        placeholder="Ej: Fondo de emergencia, Vacaciones..."
        error={errors.nombre?.message}
        {...register('nombre')}
      />

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Monto objetivo (L)"
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          error={errors.monto_objetivo?.message}
          {...register('monto_objetivo')}
        />
        <Select
          label="Prioridad"
          options={[
            { value: '5', label: '5 - Muy alta' },
            { value: '4', label: '4 - Alta' },
            { value: '3', label: '3 - Media' },
            { value: '2', label: '2 - Baja' },
            { value: '1', label: '1 - Muy baja' },
          ]}
          {...register('prioridad')}
        />
      </div>

      <Input
        label="Fecha límite (opcional)"
        type="date"
        {...register('fecha_limite')}
      />

      <div className="flex gap-3 pt-2">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">
            Cancelar
          </Button>
        )}
        <Button type="submit" loading={loading} className="flex-1">
          Crear meta
        </Button>
      </div>
    </form>
  )
}
