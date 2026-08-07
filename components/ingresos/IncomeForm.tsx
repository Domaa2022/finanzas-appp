'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Pin } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useCuentas } from '@/lib/cuentas/useCuentas'
import { useModulos } from '@/lib/useModulos'
import { terminoPeriodo } from '@/lib/periodo'
import { todayISO } from '@/lib/utils/dates'
import { formatHNL } from '@/lib/utils/currency'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'

const schema = z.object({
  monto: z.string().min(1, 'Requerido').refine(v => parseFloat(v) > 0, 'Debe ser mayor a 0'),
  fuente: z.string().min(1, 'Requerido'),
  frecuencia: z.enum(['diario', 'semanal', 'quincenal', 'mensual']),
  fecha: z.string().min(1, 'Requerido'),
  cuenta_id: z.string().min(1, 'Selecciona una cuenta'),
  notas: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface IncomeFormProps {
  onSuccess: () => void
  onCancel?: () => void
}

/** Resultado de procesar_quincena (migración 031). */
interface ResumenQuincena {
  gastos_fijos: { count: number; total: number }
  apartado: { count: number; total: number }
  ahorros: { count: number; total: number }
}

/** Convierte el resumen de la RPC en las líneas de toast que se muestran. */
function resumenQuincena(r: ResumenQuincena): string[] {
  const lineas: string[] = []
  if (r.gastos_fijos?.count > 0) {
    lineas.push(`${r.gastos_fijos.count} gastos fijos aplicados (${formatHNL(r.gastos_fijos.total)})`)
  }
  if (r.apartado?.count > 0) {
    lineas.push(`${formatHNL(r.apartado.total)} apartados para ${r.apartado.count} pagos próximos`)
  }
  if (r.ahorros?.count > 0) {
    lineas.push(`${formatHNL(r.ahorros.total)} en ahorros programados`)
  }
  return lineas
}

export function IncomeForm({ onSuccess, onCancel }: IncomeFormProps) {
  const [loading, setLoading] = useState(false)
  const [fijarActual, setFijarActual] = useState(false)
  const { cuentas, principal } = useCuentas()
  const { activo, cobro } = useModulos()
  const usaQuincena = activo('quincena')
  const term = terminoPeriodo(cobro)

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      fecha: todayISO(),
      fuente: 'Quincena',
      frecuencia: 'quincenal',
      cuenta_id: '',
    },
  })

  // Preseleccionar la cuenta principal cuando cargan las cuentas.
  const cuentaId = watch('cuenta_id')
  useEffect(() => {
    if (!cuentaId && principal) setValue('cuenta_id', principal.id)
  }, [principal, cuentaId, setValue])

  async function onSubmit(data: FormData) {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Si se fija como quincena actual:
    //  1. Cierra el período que deja de ser actual → su sobrante va al Fondo General
    //  2. Desmarca las demás quincenas
    if (fijarActual) {
      // Período actual previo: el fijado, o el más reciente si no hay fijado
      const { data: actual } = await supabase
        .from('income_entries')
        .select('id')
        .eq('user_id', user.id)
        .order('es_quincena_actual', { ascending: false })
        .order('fecha', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (actual) {
        // No bloquea el registro del ingreso: si el cierre falla solo avisa.
        const { data: enviado, error: cierreError } = await supabase.rpc('enviar_sobrante_al_fondo', {
          p_user_id: user.id,
          p_income_id: actual.id,
        })
        if (cierreError) {
          toast.warning('No se pudo enviar el sobrante del período anterior al Fondo General')
        } else if (enviado && enviado > 0) {
          toast.success(`Sobrante de ${formatHNL(enviado)} enviado al Fondo General`)
        }
      }

      await supabase
        .from('income_entries')
        .update({ es_quincena_actual: false })
        .eq('user_id', user.id)
    }

    const { data: nuevoIngreso, error } = await supabase
      .from('income_entries')
      .insert({
        user_id: user.id,
        monto: parseFloat(data.monto),
        fuente: data.fuente,
        frecuencia: data.frecuencia,
        fecha: data.fecha,
        cuenta_id: data.cuenta_id,
        ahorro_tipo: 'ninguno',
        ahorro_valor: 0,
        notas: data.notas || null,
        es_quincena_actual: fijarActual,
      })
      .select('id')
      .single()

    if (error) {
      toast.error('Error al guardar ingreso')
      setLoading(false)
      return
    }

    toast.success(fijarActual ? 'Ingreso registrado y fijado como quincena actual' : 'Ingreso registrado')

    // Al fijar la quincena se aplican solos los gastos fijos quincenales, el
    // apartado de los mensuales/suscripciones y los ahorros programados.
    // No bloquea el registro: si falla, el ingreso ya quedó guardado.
    if (fijarActual && nuevoIngreso) {
      const { data: resumen, error: procesarError } = await supabase.rpc('procesar_quincena', {
        p_user_id: user.id,
        p_income_id: nuevoIngreso.id,
      })

      if (procesarError) {
        toast.warning('No se pudieron aplicar los movimientos automáticos de la quincena')
      } else if (resumen) {
        for (const linea of resumenQuincena(resumen)) toast.success(linea)
      }
    }

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

      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Cuenta destino"
          placeholder="Seleccionar..."
          options={cuentas.map(c => ({ value: c.id, label: c.nombre }))}
          error={errors.cuenta_id?.message}
          {...register('cuenta_id')}
        />
        <Input
          label="Fecha de recepción"
          type="date"
          error={errors.fecha?.message}
          {...register('fecha')}
        />
      </div>

      <Input
        label="Notas (opcional)"
        placeholder="Comentarios..."
        {...register('notas')}
      />

      {/* Toggle: fijar como quincena actual — solo si el módulo Quincena está activo */}
      {usaQuincena && (
        <>
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
              <span className="font-medium leading-tight">Fijar como {term.singular} actual</span>
              <span className="text-xs opacity-70 leading-tight">
                {fijarActual
                  ? `Este ingreso será ${term.singular === 'mes' ? 'el mes' : `la ${term.singular}`} principal del panel`
                  : `El panel usará este ingreso como referencia de ${term.singular}`}
              </span>
            </div>
            <div className={`ml-auto h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
              fijarActual ? 'border-violet-500 bg-violet-500' : 'border-gray-300 dark:border-slate-500'
            }`}>
              {fijarActual && <div className="h-2 w-2 rounded-full bg-white" />}
            </div>
          </button>

          <p className="text-xs text-gray-400 dark:text-slate-500 bg-gray-50 dark:bg-slate-700 rounded-lg px-3 py-2">
            Al fijar este ingreso como {term.singular} actual, el sobrante del período anterior se enviará automáticamente a tu Fondo General.
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
          Registrar ingreso
        </Button>
      </div>
    </form>
  )
}
