'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Deuda } from '@/lib/types/database'
import { useCuentas } from '@/lib/cuentas/useCuentas'
import { todayISO } from '@/lib/utils/dates'
import { formatHNL } from '@/lib/utils/currency'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'

const schema = z.object({
  monto: z.string().min(1, 'Requerido').refine(v => parseFloat(v) > 0, 'Debe ser mayor a 0'),
  fecha: z.string().min(1, 'Requerido'),
  cuenta_id: z.string().min(1, 'Selecciona una cuenta'),
  notas: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface RegistrarPagoModalProps {
  deuda: Deuda
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function RegistrarPagoModal({ deuda, open, onClose, onSuccess }: RegistrarPagoModalProps) {
  const [loading, setLoading] = useState(false)
  const pendiente = deuda.monto_total - deuda.monto_pagado
  const { cuentas, principal } = useCuentas()
  const esDeuda = deuda.tipo === 'deuda'

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { fecha: todayISO(), monto: '', cuenta_id: '', notas: '' },
  })

  const cuentaId = watch('cuenta_id')
  useEffect(() => {
    if (!cuentaId && principal) setValue('cuenta_id', principal.id)
  }, [principal, cuentaId, setValue])

  async function onSubmit(data: FormData) {
    const monto = parseFloat(data.monto)
    if (monto > pendiente + 0.01) {
      toast.error(`El monto supera el pendiente (${formatHNL(pendiente)})`)
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from('deuda_pagos').insert({
      user_id: user.id,
      deuda_id: deuda.id,
      monto,
      fecha: data.fecha,
      cuenta_id: data.cuenta_id,
      notas: data.notas || null,
    })

    if (error) {
      toast.error('Error al registrar el pago')
    } else {
      toast.success('Pago registrado')
      reset()
      onSuccess()
    }
    setLoading(false)
  }

  const titulo = deuda.tipo === 'deuda'
    ? `Registrar abono — ${deuda.nombre_persona}`
    : `Registrar cobro — ${deuda.nombre_persona}`

  return (
    <Modal open={open} onClose={onClose} title={titulo} size="sm">
      <div className="mb-4 rounded-xl bg-gray-50 dark:bg-slate-700/50 px-4 py-3 text-sm">
        <div className="flex justify-between text-gray-500 dark:text-slate-400">
          <span>Total</span>
          <span className="font-medium text-gray-800 dark:text-slate-200">{formatHNL(deuda.monto_total)}</span>
        </div>
        <div className="flex justify-between text-gray-500 dark:text-slate-400 mt-1">
          <span>Ya pagado</span>
          <span className="font-medium text-emerald-600 dark:text-emerald-400">{formatHNL(deuda.monto_pagado)}</span>
        </div>
        <div className="flex justify-between font-semibold mt-1 pt-1 border-t border-gray-200 dark:border-slate-600">
          <span className="text-gray-700 dark:text-slate-300">Pendiente</span>
          <span className="text-red-600 dark:text-red-400">{formatHNL(pendiente)}</span>
        </div>
      </div>

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
          <Input
            label="Fecha"
            type="date"
            error={errors.fecha?.message}
            {...register('fecha')}
          />
        </div>

        <div>
          <Select
            label={esDeuda ? 'Pagar desde' : 'Recibir en'}
            placeholder="Seleccionar cuenta..."
            options={cuentas.map(c => ({ value: c.id, label: c.nombre }))}
            error={errors.cuenta_id?.message}
            {...register('cuenta_id')}
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
            {esDeuda
              ? 'El monto sale de esta cuenta y baja tu disponible.'
              : 'El monto entra a esta cuenta y sube tu disponible.'}
          </p>
        </div>

        <Input
          label="Notas (opcional)"
          placeholder="Ej: transferencia, efectivo..."
          {...register('notas')}
        />

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          <Button type="submit" loading={loading} className="flex-1">
            Registrar
          </Button>
        </div>
      </form>
    </Modal>
  )
}
