'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Pin } from 'lucide-react'
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
  const [fijarActual, setFijarActual] = useState(false)

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

    // Si se fija como quincena actual, desmarcar las demás primero
    if (fijarActual) {
      await supabase
        .from('income_entries')
        .update({ es_quincena_actual: false })
        .eq('user_id', user.id)
    }

    const { error } = await supabase.from('income_entries').insert({
      user_id: user.id,
      monto: parseFloat(data.monto),
      fuente: data.fuente,
      frecuencia: data.frecuencia,
      fecha: data.fecha,
      ahorro_tipo: 'ninguno',
      ahorro_valor: 0,
      notas: data.notas || null,
      es_quincena_actual: fijarActual,
    })

    if (error) {
      toast.error('Error al guardar ingreso')
      setLoading(false)
      return
    }

    toast.success(fijarActual ? 'Ingreso registrado y fijado como quincena actual' : 'Ingreso registrado')
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

      {/* Toggle: fijar como quincena actual */}
      <button
        type="button"
        onClick={() => setFijarActual(v => !v)}
        className={`flex items-center gap-2.5 w-full rounded-lg border px-3 py-2.5 text-sm transition-colors text-left ${
          fijarActual
            ? 'border-violet-300 bg-violet-50 dark:bg-violet-900/20 dark:border-violet-700 text-violet-700 dark:text-violet-300'
            : 'border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 text-gray-500 dark:text-slate-400 hover:border-violet-200 dark:hover:border-violet-700 hover:text-violet-600 dark:hover:text-violet-400'
        }`}
      >
        <Pin className={`h-4 w-4 shrink-0 ${fijarActual ? 'text-violet-500' : ''}`} />
        <div className="flex flex-col gap-0">
          <span className="font-medium leading-tight">Fijar como quincena actual</span>
          <span className="text-xs opacity-70 leading-tight">
            {fijarActual
              ? 'Este ingreso será la quincena principal del panel'
              : 'El panel usará este ingreso como referencia de quincena'}
          </span>
        </div>
        <div className={`ml-auto h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
          fijarActual ? 'border-violet-500 bg-violet-500' : 'border-gray-300 dark:border-slate-500'
        }`}>
          {fijarActual && <div className="h-2 w-2 rounded-full bg-white" />}
        </div>
      </button>

      <p className="text-xs text-gray-400 dark:text-slate-500 bg-gray-50 dark:bg-slate-700 rounded-lg px-3 py-2">
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
