'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { CooperativaCuenta } from '@/lib/types/database'
import { useCuentas } from '@/lib/cuentas/useCuentas'
import { todayISO } from '@/lib/utils/dates'
import { formatHNL } from '@/lib/utils/currency'
import { nombreCuenta } from '@/lib/cooperativa/interes'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'

const schema = z.object({
  tipo: z.enum(['deposito', 'retiro', 'ajuste']),
  monto: z.string().min(1, 'Requerido').refine(v => parseFloat(v) > 0, 'Debe ser mayor a 0'),
  fecha: z.string().min(1, 'Requerido'),
  cuenta_bancaria_id: z.string().optional(),
  descripcion: z.string().optional(),
}).refine(
  // Depósitos y retiros mueven plata real: hay que saber de qué cuenta sale o
  // a cuál entra. El ajuste es solo una corrección contable.
  d => d.tipo === 'ajuste' || !!d.cuenta_bancaria_id,
  { path: ['cuenta_bancaria_id'], message: 'Selecciona la cuenta' },
)

type FormData = z.infer<typeof schema>

interface Props {
  cuenta: CooperativaCuenta
  onSuccess: () => void
  onCancel: () => void
}

export function MovimientoForm({ cuenta, onSuccess, onCancel }: Props) {
  const [loading, setLoading] = useState(false)
  const { cuentas, principal } = useCuentas()
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { tipo: 'deposito', monto: '', fecha: todayISO(), descripcion: '', cuenta_bancaria_id: '' },
  })

  const tipo = watch('tipo')
  const cuentaBancariaId = watch('cuenta_bancaria_id')
  const esAjuste = tipo === 'ajuste'

  useEffect(() => {
    if (!cuentaBancariaId && principal) setValue('cuenta_bancaria_id', principal.id)
  }, [principal, cuentaBancariaId, setValue])

  async function onSubmit(data: FormData) {
    const monto = parseFloat(data.monto)
    const signo = data.tipo === 'retiro' ? -1 : 1
    const montoFinal = monto * signo

    if (data.tipo === 'retiro' && monto > cuenta.saldo + 0.001) {
      toast.error(`Saldo insuficiente (${formatHNL(cuenta.saldo)})`)
      return
    }
    if (data.tipo === 'ajuste') {
      // ajuste interpretado como nuevo saldo objetivo
      // se traduce en un movimiento que lleve el saldo al valor indicado
      // (positivo o negativo)
    }

    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    let finalMonto = montoFinal
    let finalDescripcion = data.descripcion || null

    if (data.tipo === 'ajuste') {
      finalMonto = monto - cuenta.saldo
      finalDescripcion = data.descripcion || `Ajuste de saldo a ${formatHNL(monto)}`
      if (Math.abs(finalMonto) < 0.005) {
        toast.info('El saldo ya es ese, no se hizo nada')
        setLoading(false)
        return
      }
    }

    // Vía RPC para que valide la contrapartida bancaria y el dinero salga (o
    // entre) de verdad en la cuenta elegida.
    const { error } = await supabase.rpc('cooperativa_registrar_movimiento', {
      p_user_id: user.id,
      p_cuenta_id: cuenta.id,
      p_tipo: data.tipo,
      p_monto: finalMonto,
      p_fecha: data.fecha,
      p_descripcion: finalDescripcion,
      p_cuenta_bancaria_id: data.tipo === 'ajuste' ? null : (data.cuenta_bancaria_id || null),
    })

    if (error) {
      toast.error(error.message || 'Error al registrar el movimiento')
    } else {
      toast.success('Movimiento registrado')
      onSuccess()
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="rounded-xl bg-gray-50 dark:bg-slate-700/50 px-4 py-3 text-sm flex justify-between">
        <span className="text-gray-500 dark:text-slate-400">Saldo actual · {nombreCuenta(cuenta.tipo)}</span>
        <span className="font-semibold text-gray-900 dark:text-slate-100">{formatHNL(cuenta.saldo)}</span>
      </div>

      <Select
        label="Tipo"
        options={[
          { value: 'deposito', label: 'Depósito' },
          { value: 'retiro', label: 'Retiro' },
          { value: 'ajuste', label: 'Ajustar saldo' },
        ]}
        error={errors.tipo?.message}
        {...register('tipo')}
      />

      <div className="grid grid-cols-2 gap-4">
        <Input
          label={tipo === 'ajuste' ? 'Nuevo saldo (L)' : 'Monto (L)'}
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

      {!esAjuste && (
        <div>
          <Select
            label={tipo === 'retiro' ? 'Cuenta donde entra el dinero' : 'Cuenta de la que sale el dinero'}
            placeholder="Seleccionar..."
            options={cuentas.map(c => ({ value: c.id, label: c.nombre }))}
            error={errors.cuenta_bancaria_id?.message}
            {...register('cuenta_bancaria_id')}
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
            {tipo === 'retiro'
              ? 'El saldo de esa cuenta subirá por este monto.'
              : 'El saldo de esa cuenta bajará por este monto.'}
          </p>
        </div>
      )}

      <Input
        label="Descripción (opcional)"
        placeholder={esAjuste ? 'Saldo real al consultar la cooperativa' : 'Ej: depósito en ventanilla'}
        {...register('descripcion')}
      />

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">
          Cancelar
        </Button>
        <Button type="submit" loading={loading} className="flex-1">
          Registrar
        </Button>
      </div>
    </form>
  )
}
