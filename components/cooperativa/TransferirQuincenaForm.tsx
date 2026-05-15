'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { CooperativaCuenta, IncomeEntry } from '@/lib/types/database'
import { todayISO, formatDate } from '@/lib/utils/dates'
import { formatHNL } from '@/lib/utils/currency'
import { nombreCuenta } from '@/lib/cooperativa/interes'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'

const schema = z.object({
  cuenta_id: z.string().min(1, 'Requerido'),
  income_id: z.string().min(1, 'Requerido'),
  monto: z.string().min(1, 'Requerido').refine(v => parseFloat(v) > 0, 'Debe ser mayor a 0'),
  fecha: z.string().min(1, 'Requerido'),
  notas: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface Props {
  cuentas: CooperativaCuenta[]
  incomes: IncomeEntry[]
  cuentaPreseleccionada?: string
  onSuccess: () => void
  onCancel: () => void
}

export function TransferirQuincenaForm({ cuentas, incomes, cuentaPreseleccionada, onSuccess, onCancel }: Props) {
  const [loading, setLoading] = useState(false)
  const quincenaActual = incomes.find(i => i.es_quincena_actual) ?? incomes[0]

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      cuenta_id: cuentaPreseleccionada ?? cuentas[0]?.id ?? '',
      income_id: quincenaActual?.id ?? '',
      monto: '',
      fecha: todayISO(),
      notas: '',
    },
  })

  async function onSubmit(data: FormData) {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { error } = await supabase.rpc('cooperativa_transferir_quincena', {
      p_user_id: user.id,
      p_cuenta_id: data.cuenta_id,
      p_income_id: data.income_id,
      p_monto: parseFloat(data.monto),
      p_fecha: data.fecha,
      p_notas: data.notas || null,
    })

    if (error) {
      toast.error(error.message || 'Error al transferir')
    } else {
      toast.success('Transferencia registrada')
      onSuccess()
    }
    setLoading(false)
  }

  if (incomes.length === 0) {
    return (
      <div className="text-sm text-gray-500 dark:text-slate-400 py-2">
        No tienes quincenas registradas todavía. Registra un ingreso primero.
        <div className="mt-4">
          <Button type="button" variant="secondary" onClick={onCancel} className="w-full">Cerrar</Button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Select
        label="Quincena origen"
        options={incomes.map(i => ({
          value: i.id,
          label: `${i.fuente} · ${formatDate(i.fecha)} · ${formatHNL(i.monto)}${i.es_quincena_actual ? ' (actual)' : ''}`,
        }))}
        error={errors.income_id?.message}
        {...register('income_id')}
      />

      <Select
        label="Cuenta destino"
        options={cuentas.map(c => ({
          value: c.id,
          label: `${nombreCuenta(c.tipo)} · ${formatHNL(c.saldo)}`,
        }))}
        error={errors.cuenta_id?.message}
        {...register('cuenta_id')}
      />

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

      <Input
        label="Notas (opcional)"
        placeholder="Ej: aporte mensual"
        {...register('notas')}
      />

      <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/40 px-3 py-2 text-xs text-blue-700 dark:text-blue-300">
        Esta transferencia se descuenta del sobrante de la quincena seleccionada y se suma al saldo de la cuenta destino.
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">
          Cancelar
        </Button>
        <Button type="submit" loading={loading} className="flex-1">
          Transferir
        </Button>
      </div>
    </form>
  )
}
