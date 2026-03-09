'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Category } from '@/lib/types/database'
import { todayISO } from '@/lib/utils/dates'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'

const schema = z.object({
  monto: z.string().min(1, 'Requerido').refine(v => parseFloat(v) > 0, 'Debe ser mayor a 0'),
  category_id: z.string().min(1, 'Selecciona una categoría'),
  descripcion: z.string().min(1, 'Requerido'),
  fecha: z.string().min(1, 'Requerido'),
  notas: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface ExpenseFormProps {
  categories: Category[]
  onSuccess: () => void
  onCancel?: () => void
}

export function ExpenseForm({ categories, onSuccess, onCancel }: ExpenseFormProps) {
  const [loading, setLoading] = useState(false)
  const expenseCategories = categories.filter(c => c.tipo === 'gasto')

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { fecha: todayISO() },
  })

  async function onSubmit(data: FormData) {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from('expenses').insert({
      user_id: user.id,
      monto: parseFloat(data.monto),
      category_id: data.category_id,
      descripcion: data.descripcion,
      fecha: data.fecha,
      notas: data.notas || null,
    })

    if (error) {
      toast.error('Error al guardar gasto')
    } else {
      toast.success('Gasto registrado')
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
        <Select
          label="Categoría"
          placeholder="Seleccionar..."
          options={expenseCategories.map(c => ({ value: c.id, label: c.nombre }))}
          error={errors.category_id?.message}
          {...register('category_id')}
        />
      </div>

      <Input
        label="Descripción"
        placeholder="Ej: Almuerzo, gasolina..."
        error={errors.descripcion?.message}
        {...register('descripcion')}
      />

      <Input
        label="Fecha"
        type="date"
        error={errors.fecha?.message}
        {...register('fecha')}
      />

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
          Registrar gasto
        </Button>
      </div>
    </form>
  )
}
