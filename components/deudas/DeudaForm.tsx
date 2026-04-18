'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Deuda } from '@/lib/types/database'
import { todayISO } from '@/lib/utils/dates'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'

const schema = z.object({
  tipo: z.enum(['deuda', 'prestamo']),
  nombre_persona: z.string().min(1, 'Requerido'),
  descripcion: z.string().min(1, 'Requerido'),
  monto_total: z.string().min(1, 'Requerido').refine(v => parseFloat(v) > 0, 'Debe ser mayor a 0'),
  fecha_inicio: z.string().min(1, 'Requerido'),
  fecha_vencimiento: z.string().optional(),
  notas: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface DeudaFormProps {
  initial?: Deuda
  onSuccess: () => void
  onCancel?: () => void
}

export function DeudaForm({ initial, onSuccess, onCancel }: DeudaFormProps) {
  const [loading, setLoading] = useState(false)
  const isEdit = !!initial

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      tipo: initial?.tipo ?? 'deuda',
      nombre_persona: initial?.nombre_persona ?? '',
      descripcion: initial?.descripcion ?? '',
      monto_total: initial?.monto_total?.toString() ?? '',
      fecha_inicio: initial?.fecha_inicio ?? todayISO(),
      fecha_vencimiento: initial?.fecha_vencimiento ?? '',
      notas: initial?.notas ?? '',
    },
  })

  async function onSubmit(data: FormData) {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const payload = {
      user_id: user.id,
      tipo: data.tipo,
      nombre_persona: data.nombre_persona,
      descripcion: data.descripcion,
      monto_total: parseFloat(data.monto_total),
      fecha_inicio: data.fecha_inicio,
      fecha_vencimiento: data.fecha_vencimiento || null,
      notas: data.notas || null,
    }

    const { error } = isEdit
      ? await supabase.from('deudas').update(payload).eq('id', initial!.id)
      : await supabase.from('deudas').insert(payload)

    if (error) {
      toast.error(isEdit ? 'Error al actualizar' : 'Error al registrar')
    } else {
      toast.success(isEdit ? 'Actualizado correctamente' : 'Registrado correctamente')
      onSuccess()
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Select
        label="Tipo"
        options={[
          { value: 'deuda', label: 'Deuda (yo le debo a alguien)' },
          { value: 'prestamo', label: 'Préstamo (alguien me debe a mí)' },
        ]}
        error={errors.tipo?.message}
        {...register('tipo')}
      />

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Nombre de la persona"
          placeholder="Ej: Juan Pérez"
          error={errors.nombre_persona?.message}
          {...register('nombre_persona')}
        />
        <Input
          label="Monto total (L)"
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          error={errors.monto_total?.message}
          {...register('monto_total')}
        />
      </div>

      <Input
        label="Descripción"
        placeholder="Ej: Préstamo para teléfono"
        error={errors.descripcion?.message}
        {...register('descripcion')}
      />

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Fecha de inicio"
          type="date"
          error={errors.fecha_inicio?.message}
          {...register('fecha_inicio')}
        />
        <Input
          label="Fecha límite (opcional)"
          type="date"
          {...register('fecha_vencimiento')}
        />
      </div>

      <Input
        label="Notas (opcional)"
        placeholder="Comentarios adicionales..."
        {...register('notas')}
      />

      <div className="flex gap-3 pt-2">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">
            Cancelar
          </Button>
        )}
        <Button type="submit" loading={loading} className="flex-1">
          {isEdit ? 'Guardar cambios' : 'Registrar'}
        </Button>
      </div>
    </form>
  )
}
