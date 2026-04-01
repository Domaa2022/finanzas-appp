'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Info } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { SavingsGoal } from '@/lib/types/database'
import { todayISO } from '@/lib/utils/dates'

const schema = z.object({
  monto: z.string().min(1, 'Requerido').refine(v => parseFloat(v) > 0, 'Debe ser mayor a 0'),
  goal_id: z.string(),
  fecha: z.string().min(1, 'Requerido'),
  notas: z.string().optional(),
  fuente: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface Props {
  goals: SavingsGoal[]
  onSuccess: () => void
  onCancel?: () => void
}

export function ManualSavingForm({ goals, onSuccess, onCancel }: Props) {
  const [loading, setLoading] = useState(false)
  // false = dinero de ingresos ya registrados, true = bono/externo
  const [esExterno, setEsExterno] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      goal_id: '',
      fecha: todayISO(),
      fuente: 'Bono',
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
    if (!user) { setLoading(false); return }

    let error: { message: string } | null = null

    if (esExterno) {
      // Dinero externo: registra también como ingreso para que el balance cuadre
      const { error: err } = await supabase.rpc('add_external_saving', {
        p_user_id: user.id,
        p_goal_id: data.goal_id || null,
        p_amount: parseFloat(data.monto),
        p_fecha: data.fecha,
        p_fuente: data.fuente || 'Bono',
        p_notas: data.notas || null,
      })
      error = err
    } else {
      // Dinero de ingresos ya registrados
      const { error: err } = await supabase.rpc('add_manual_saving', {
        p_user_id: user.id,
        p_goal_id: data.goal_id || null,
        p_amount: parseFloat(data.monto),
        p_fecha: data.fecha,
        p_notas: data.notas || null,
      })
      error = err
    }

    if (error) {
      toast.error('Error al registrar ahorro')
    } else {
      toast.success(esExterno ? 'Bono registrado y enviado a ahorros' : 'Ahorro registrado')
      onSuccess()
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">

      {/* Toggle: ¿de dónde viene el dinero? */}
      <div className="flex rounded-xl border border-gray-200 dark:border-slate-600 overflow-hidden text-sm font-medium">
        <button
          type="button"
          onClick={() => setEsExterno(false)}
          className={`flex-1 py-2.5 transition-colors ${
            !esExterno
              ? 'bg-emerald-600 text-white'
              : 'bg-white dark:bg-slate-700 text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-600'
          }`}
        >
          De mis ingresos
        </button>
        <button
          type="button"
          onClick={() => setEsExterno(true)}
          className={`flex-1 py-2.5 transition-colors border-l border-gray-200 dark:border-slate-600 ${
            esExterno
              ? 'bg-emerald-600 text-white'
              : 'bg-white dark:bg-slate-700 text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-600'
          }`}
        >
          Bono / externo
        </button>
      </div>

      {/* Explicación contextual */}
      <div className={`rounded-lg px-3 py-2.5 text-xs flex items-start gap-2 ${
        esExterno
          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800/40'
          : 'bg-gray-50 dark:bg-slate-700 text-gray-500 dark:text-slate-400'
      }`}>
        <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        {esExterno
          ? 'El bono se registrará también como ingreso para que tu balance no quede negativo.'
          : 'Usa esta opción para mover dinero de tu quincena o saldo disponible hacia una meta.'}
      </div>

      {/* Fuente del bono (solo si es externo) */}
      {esExterno && (
        <Input
          label="¿Qué tipo de ingreso es?"
          placeholder="Ej: Bono, Comisión, Regalo..."
          {...register('fuente')}
        />
      )}

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
        placeholder="Ej: Bono de trabajo, ahorro de la quincena..."
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
