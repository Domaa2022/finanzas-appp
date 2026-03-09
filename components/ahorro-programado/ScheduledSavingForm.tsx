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
  tipo: z.enum(['porcentaje', 'fijo']),
  valor: z.string().min(1, 'Requerido').refine(v => parseFloat(v) > 0, 'Debe ser mayor a 0'),
  frecuencia: z.enum(['diario', 'semanal', 'quincenal', 'mensual']),
})

type FormData = z.infer<typeof schema>

interface ScheduledSavingFormProps {
  onSuccess: () => void
  onCancel?: () => void
}

export function ScheduledSavingForm({ onSuccess, onCancel }: ScheduledSavingFormProps) {
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { tipo: 'porcentaje', valor: '10', frecuencia: 'quincenal' },
  })

  const tipo = watch('tipo')

  async function onSubmit(data: FormData) {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from('scheduled_savings').insert({
      user_id: user.id,
      nombre: data.nombre,
      tipo: data.tipo,
      valor: parseFloat(data.valor),
      frecuencia: data.frecuencia,
    })

    if (error) {
      toast.error('Error al guardar ahorro programado')
    } else {
      toast.success('Ahorro programado creado')
      onSuccess()
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Input
        label="Nombre"
        placeholder="Ej: Ahorro quincenal, Fondo de emergencia..."
        error={errors.nombre?.message}
        {...register('nombre')}
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

      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Tipo"
          options={[
            { value: 'porcentaje', label: 'Porcentaje (%)' },
            { value: 'fijo', label: 'Monto fijo (L)' },
          ]}
          {...register('tipo')}
        />
        <Input
          label={tipo === 'porcentaje' ? 'Porcentaje del ingreso' : 'Monto (L)'}
          type="number"
          step={tipo === 'porcentaje' ? '1' : '0.01'}
          min="0"
          max={tipo === 'porcentaje' ? '100' : undefined}
          placeholder={tipo === 'porcentaje' ? '10' : '0.00'}
          error={errors.valor?.message}
          {...register('valor')}
        />
      </div>

      <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
        Este monto se distribuirá entre tus metas de ahorro activas según su prioridad cuando apliques el ahorro programado.
      </p>

      <div className="flex gap-3 pt-2">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">
            Cancelar
          </Button>
        )}
        <Button type="submit" loading={loading} className="flex-1">
          Crear ahorro programado
        </Button>
      </div>
    </form>
  )
}
