'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Category } from '@/lib/types/database'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'

const schema = z.object({
  nombre: z.string().min(1, 'Requerido'),
  monto: z.string().min(1, 'Requerido').refine(v => parseFloat(v) > 0, 'Debe ser mayor a 0'),
  category_id: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface FixedExpenseFormProps {
  categories: Category[]
  onSuccess: () => void
  onCancel?: () => void
}

export function FixedExpenseForm({ categories, onSuccess, onCancel }: FixedExpenseFormProps) {
  const [loading, setLoading] = useState(false)
  const expenseCategories = categories.filter(c => c.tipo === 'gasto')

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: FormData) {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from('fixed_expenses').insert({
      user_id: user.id,
      nombre: data.nombre,
      monto: parseFloat(data.monto),
      category_id: data.category_id || null,
    })

    if (error) {
      toast.error('Error al guardar gasto fijo')
    } else {
      toast.success('Gasto fijo agregado')
      onSuccess()
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Input
        label="Nombre"
        placeholder="Ej: Renta, Electricidad, Internet..."
        error={errors.nombre?.message}
        {...register('nombre')}
      />

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Monto quincenal (L)"
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          error={errors.monto?.message}
          {...register('monto')}
        />
        <Select
          label="Categoría (opcional)"
          placeholder="Sin categoría"
          options={expenseCategories.map(c => ({ value: c.id, label: c.nombre }))}
          {...register('category_id')}
        />
      </div>

      <div className="flex gap-3 pt-2">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">
            Cancelar
          </Button>
        )}
        <Button type="submit" loading={loading} className="flex-1">
          Agregar gasto fijo
        </Button>
      </div>
    </form>
  )
}
