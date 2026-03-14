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
import { SavingsGoal } from '@/lib/types/database'
import { todayISO } from '@/lib/utils/dates'

const schema = z.object({
  monto: z.string().min(1, 'Requerido').refine(v => parseFloat(v) > 0, 'Debe ser mayor a 0'),
  goal_id: z.string(),   // '' = Fondo General
  fecha: z.string().min(1, 'Requerido'),
  notas: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface Props {
  goals: SavingsGoal[]   // Metas activas regulares
  onSuccess: () => void
  onCancel?: () => void
}

export function ManualSavingForm({ goals, onSuccess, onCancel }: Props) {
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      goal_id: '',
      fecha: todayISO(),
    },
  })

  const goalOptions = [
    { value: '', label: 'Fondo General' },
    ...goals
      .filter(g => !g.es_general && g.estado === 'activa')
      .map(g => ({ value: g.id, label: g.nombre })),
  ]

  async function onSubmit(data: FormData) {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.rpc('add_manual_saving', {
      p_user_id: user.id,
      p_goal_id: data.goal_id || null,
      p_amount: parseFloat(data.monto),
      p_fecha: data.fecha,
      p_notas: data.notas || null,
    })

    if (error) {
      toast.error('Error al registrar ahorro')
    } else {
      toast.success('Ahorro registrado')
      onSuccess()
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
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
        <Input
          label="Fecha"
          type="date"
          error={errors.fecha?.message}
          {...register('fecha')}
        />
      </div>

      <Select
        label="Destino"
        options={goalOptions}
        {...register('goal_id')}
      />

      <Input
        label="Notas (opcional)"
        placeholder="Ej: Bono de trabajo, regalo recibido..."
        {...register('notas')}
      />

      <div className="flex gap-3 pt-1">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">
            Cancelar
          </Button>
        )}
        <Button type="submit" loading={loading} className="flex-1">
          Guardar ahorro
        </Button>
      </div>
    </form>
  )
}
