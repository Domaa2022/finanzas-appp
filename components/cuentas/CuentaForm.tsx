'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Cuenta, TipoCuenta } from '@/lib/types/database'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'

// Cooperativa se administra en su propia pantalla.
const TIPOS: { value: TipoCuenta; label: string }[] = [
  { value: 'corriente', label: 'Cuenta corriente / de uso diario' },
  { value: 'ahorro', label: 'Cuenta de ahorro' },
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'tarjeta', label: 'Tarjeta de crédito' },
]

const COLORES = [
  '#EF4444', '#F97316', '#EAB308', '#22C55E',
  '#06B6D4', '#3B82F6', '#8B5CF6', '#EC4899', '#6B7280',
]

const schema = z.object({
  nombre: z.string().min(1, 'Requerido'),
  tipo: z.enum(['corriente', 'ahorro', 'efectivo', 'tarjeta']),
  banco: z.string().optional(),
  saldo_inicial: z.string().optional(),
  cupo: z.string().optional(),
  dia_corte: z.string().optional(),
  dia_pago: z.string().optional(),
  es_disponible: z.boolean(),
  es_principal: z.boolean(),
})

type FormData = z.infer<typeof schema>

interface Props {
  initial?: Cuenta
  onSuccess: () => void
  onCancel?: () => void
}

export function CuentaForm({ initial, onSuccess, onCancel }: Props) {
  const [loading, setLoading] = useState(false)
  const [color, setColor] = useState(initial?.color || COLORES[5])

  const esTarjetaInicial = initial?.tipo === 'tarjeta'
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      nombre: initial?.nombre || '',
      tipo: (initial?.tipo as FormData['tipo']) || 'corriente',
      banco: initial?.banco || '',
      // En una tarjeta el saldo_inicial se guarda negativo (es deuda); en el
      // formulario se muestra como un monto de deuda positivo.
      saldo_inicial: initial
        ? (esTarjetaInicial ? Math.abs(initial.saldo_inicial).toString() : initial.saldo_inicial.toString())
        : '',
      cupo: initial?.cupo?.toString() || '',
      dia_corte: initial?.dia_corte?.toString() || '',
      dia_pago: initial?.dia_pago?.toString() || '',
      es_disponible: initial?.es_disponible ?? true,
      es_principal: initial?.es_principal ?? false,
    },
  })

  const tipo = watch('tipo')
  const esTarjeta = tipo === 'tarjeta'
  const esDisponible = watch('es_disponible')
  const esPrincipal = watch('es_principal')

  // Ahorro y tarjeta NO cuentan como disponible.
  function handleTipoChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const nuevo = e.target.value as FormData['tipo']
    setValue('tipo', nuevo)
    setValue('es_disponible', nuevo === 'corriente' || nuevo === 'efectivo')
    if (nuevo === 'tarjeta') setValue('es_principal', false)
  }

  async function onSubmit(data: FormData) {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      toast.error('Sesión expirada, volvé a iniciar sesión')
      setLoading(false)
      return
    }

    // Solo una cuenta puede ser principal: desmarcar las demás antes.
    if (data.es_principal) {
      await supabase.from('cuentas').update({ es_principal: false }).eq('user_id', user.id)
    }

    // En una tarjeta lo que se ingresa es deuda: se guarda como saldo negativo.
    const saldoNum = data.saldo_inicial ? parseFloat(data.saldo_inicial) : 0
    const payload = {
      nombre: data.nombre,
      tipo: data.tipo,
      banco: data.banco || null,
      saldo_inicial: data.tipo === 'tarjeta' ? -Math.abs(saldoNum) : saldoNum,
      // El trigger de la migración 040 fuerza estos dos en false para tarjetas,
      // pero los mandamos coherentes igual.
      es_disponible: data.tipo === 'tarjeta' ? false : data.es_disponible,
      es_principal: data.tipo === 'tarjeta' ? false : data.es_principal,
      cupo: data.tipo === 'tarjeta' && data.cupo ? parseFloat(data.cupo) : null,
      dia_corte: data.tipo === 'tarjeta' && data.dia_corte ? parseInt(data.dia_corte, 10) : null,
      dia_pago: data.tipo === 'tarjeta' && data.dia_pago ? parseInt(data.dia_pago, 10) : null,
      color,
    }

    const { error } = initial
      ? await supabase.from('cuentas').update(payload).eq('id', initial.id)
      : await supabase.from('cuentas').insert({ ...payload, user_id: user.id })

    if (error) {
      toast.error('Error al guardar la cuenta')
    } else {
      toast.success(initial ? 'Cuenta actualizada' : 'Cuenta creada')
      onSuccess()
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Input
        label="Nombre"
        placeholder="Ej: BAC principal, Ahorro Ficohsa..."
        error={errors.nombre?.message}
        {...register('nombre')}
      />

      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Tipo"
          options={TIPOS}
          {...register('tipo', { onChange: handleTipoChange })}
        />
        <Input
          label="Banco (opcional)"
          placeholder="Ej: BAC, Ficohsa..."
          {...register('banco')}
        />
      </div>

      <Input
        label={esTarjeta ? 'Deuda actual (L)' : (initial ? 'Saldo inicial' : 'Saldo actual (L)')}
        type="number"
        step="0.01"
        placeholder="0.00"
        {...register('saldo_inicial')}
      />

      {esTarjeta && (
        <>
          <p className="-mt-2 text-xs text-gray-500 dark:text-slate-400">
            Cuánto debés hoy en la tarjeta. Los gastos que cargues la suben; los pagos la bajan.
          </p>
          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Cupo (L)"
              type="number"
              step="0.01"
              placeholder="Opcional"
              {...register('cupo')}
            />
            <Input
              label="Día de corte"
              type="number"
              min="1"
              max="31"
              placeholder="Ej: 15"
              {...register('dia_corte')}
            />
            <Input
              label="Día de pago"
              type="number"
              min="1"
              max="31"
              placeholder="Ej: 5"
              {...register('dia_pago')}
            />
          </div>
        </>
      )}
      {!initial && !esTarjeta && (
        <p className="-mt-2 text-xs text-gray-500 dark:text-slate-400">
          Cuánto hay en la cuenta hoy. A partir de ahí se le suman ingresos y se le
          restan gastos y transferencias.
        </p>
      )}

      {/* Color */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700 dark:text-slate-300">Color</label>
        <div className="flex gap-2 flex-wrap">
          {COLORES.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className="h-7 w-7 rounded-full transition-all"
              style={{ backgroundColor: c, outline: color === c ? `3px solid ${c}` : 'none', outlineOffset: '2px' }}
            />
          ))}
        </div>
      </div>

      {/* Toggles — no aplican a tarjetas (una deuda no es disponible ni principal) */}
      {!esTarjeta && (
        <>
          <label className="flex items-start gap-3 rounded-xl border border-gray-200 dark:border-slate-700 px-4 py-3 cursor-pointer">
            <input type="checkbox" className="mt-1 accent-indigo-600" {...register('es_disponible')} />
            <span className="text-sm">
              <span className="font-medium text-gray-900 dark:text-slate-100">Cuenta para gasto diario</span>
              <span className="block text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                {esDisponible
                  ? 'Su saldo suma al dinero disponible.'
                  : 'Su saldo NO cuenta como disponible (es de ahorro).'}
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 rounded-xl border border-gray-200 dark:border-slate-700 px-4 py-3 cursor-pointer">
            <input type="checkbox" className="mt-1 accent-indigo-600" {...register('es_principal')} />
            <span className="text-sm">
              <span className="font-medium text-gray-900 dark:text-slate-100">Cuenta principal</span>
              <span className="block text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                {esPrincipal
                  ? 'Vendrá preseleccionada en gastos e ingresos.'
                  : 'Preselecciona esta cuenta en los formularios.'}
              </span>
            </span>
          </label>
        </>
      )}

      <div className="flex gap-3 pt-2">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">
            Cancelar
          </Button>
        )}
        <Button type="submit" loading={loading} className="flex-1">
          {initial ? 'Actualizar' : 'Crear cuenta'}
        </Button>
      </div>
    </form>
  )
}
