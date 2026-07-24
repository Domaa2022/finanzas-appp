'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { SaldoCuenta } from '@/lib/types/database'
import { formatHNL } from '@/lib/utils/currency'
import { todayISO } from '@/lib/utils/dates'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'

const schema = z.object({
  cuenta_origen_id: z.string().min(1, 'Selecciona la cuenta de origen'),
  cuenta_destino_id: z.string().min(1, 'Selecciona la cuenta de destino'),
  monto: z.string().min(1, 'Requerido').refine(v => parseFloat(v) > 0, 'Debe ser mayor a 0'),
  fecha: z.string().min(1, 'Requerido'),
  notas: z.string().optional(),
}).refine(d => d.cuenta_origen_id !== d.cuenta_destino_id, {
  path: ['cuenta_destino_id'],
  message: 'Debe ser distinta a la de origen',
})

type FormData = z.infer<typeof schema>

interface Props {
  /** Solo cuentas reales (origen='cuenta'); la cooperativa no se transfiere aquí. */
  cuentas: SaldoCuenta[]
  onSuccess: () => void
  onCancel?: () => void
}

export function TransferForm({ cuentas, onSuccess, onCancel }: Props) {
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      cuenta_origen_id: cuentas.find(c => c.es_principal)?.id ?? cuentas[0]?.id ?? '',
      cuenta_destino_id: '',
      fecha: todayISO(),
    },
  })

  const origenId = watch('cuenta_origen_id')
  const saldoOrigen = cuentas.find(c => c.id === origenId)?.saldo ?? 0

  async function onSubmit(data: FormData) {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { toast.error('Sesión expirada'); setLoading(false); return }

    const { error } = await supabase.rpc('registrar_transferencia', {
      p_user_id: user.id,
      p_origen_id: data.cuenta_origen_id,
      p_destino_id: data.cuenta_destino_id,
      p_monto: parseFloat(data.monto),
      p_fecha: data.fecha,
      p_tipo: 'traspaso',
      p_notas: data.notas || null,
    })

    if (error) {
      toast.error(error.message || 'No se pudo registrar la transferencia')
    } else {
      toast.success('Transferencia registrada')
      onSuccess()
    }
    setLoading(false)
  }

  const opciones = cuentas.map(c => ({ value: c.id, label: c.nombre }))

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div>
        <Select
          label="Desde"
          placeholder="Cuenta de origen..."
          options={opciones}
          error={errors.cuenta_origen_id?.message}
          {...register('cuenta_origen_id')}
        />
        {origenId && (
          <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
            Saldo actual: <span className="font-medium">{formatHNL(saldoOrigen)}</span>
          </p>
        )}
      </div>

      <Select
        label="Hacia"
        placeholder="Cuenta de destino..."
        options={opciones}
        error={errors.cuenta_destino_id?.message}
        {...register('cuenta_destino_id')}
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
        placeholder="Ej: Traslado a ahorro..."
        {...register('notas')}
      />

      <div className="flex gap-3 pt-2">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">
            Cancelar
          </Button>
        )}
        <Button type="submit" loading={loading} className="flex-1">
          Transferir
        </Button>
      </div>
    </form>
  )
}
