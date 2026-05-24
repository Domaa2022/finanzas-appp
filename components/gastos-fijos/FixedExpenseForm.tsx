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
  frecuencia: z.enum(['quincenal', 'mensual']),
  dia_pago: z.string().optional(),
}).refine(
  d => d.frecuencia !== 'mensual' || (!!d.dia_pago && +d.dia_pago >= 1 && +d.dia_pago <= 31),
  { message: 'Día de pago entre 1 y 31', path: ['dia_pago'] },
)

type FormData = z.infer<typeof schema>

interface FixedExpenseFormProps {
  categories: Category[]
  onSuccess: () => void
  onCancel?: () => void
}

export function FixedExpenseForm({ categories, onSuccess, onCancel }: FixedExpenseFormProps) {
  const [loading, setLoading] = useState(false)
  const expenseCategories = categories.filter(c => c.tipo === 'gasto')

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { frecuencia: 'quincenal' },
  })

  const frecuencia = watch('frecuencia')
  const esMensual = frecuencia === 'mensual'

  async function onSubmit(data: FormData) {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { error } = await supabase.from('fixed_expenses').insert({
      user_id: user.id,
      nombre: data.nombre,
      monto: parseFloat(data.monto),
      category_id: data.category_id || null,
      frecuencia: data.frecuencia,
      dia_pago: data.frecuencia === 'mensual' ? parseInt(data.dia_pago!, 10) : null,
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
        placeholder="Ej: Renta, Electricidad, Tarjeta..."
        error={errors.nombre?.message}
        {...register('nombre')}
      />

      <Select
        label="Tipo"
        options={[
          { value: 'quincenal', label: 'Quincenal — lo pago completo cada quincena' },
          { value: 'mensual', label: 'Mensual — voy apartando entre quincenas' },
        ]}
        {...register('frecuencia')}
      />

      <div className="grid grid-cols-2 gap-4">
        <Input
          label={esMensual ? 'Monto mensual (L)' : 'Monto quincenal (L)'}
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          error={errors.monto?.message}
          {...register('monto')}
        />
        {esMensual ? (
          <Input
            label="Día de pago"
            type="number"
            min="1"
            max="31"
            placeholder="Ej: 10"
            error={errors.dia_pago?.message}
            {...register('dia_pago')}
          />
        ) : (
          <Select
            label="Categoría (opcional)"
            placeholder="Sin categoría"
            options={expenseCategories.map(c => ({ value: c.id, label: c.nombre }))}
            {...register('category_id')}
          />
        )}
      </div>

      {esMensual && (
        <>
          <Select
            label="Categoría (opcional)"
            placeholder="Sin categoría"
            options={expenseCategories.map(c => ({ value: c.id, label: c.nombre }))}
            {...register('category_id')}
          />
          <p className="text-xs text-gray-500 dark:text-slate-400 -mt-1">
            Se apartará la mitad del monto en cada quincena para tenerlo listo el día de pago.
          </p>
        </>
      )}

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
