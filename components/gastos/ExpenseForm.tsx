'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Category } from '@/lib/types/database'
import { useCuentas } from '@/lib/cuentas/useCuentas'
import { todayISO } from '@/lib/utils/dates'
import { formatHNL } from '@/lib/utils/currency'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'

// El Fondo General aparece como origen del gasto con este prefijo.
const FONDO_PREFIX = 'fondo:'

const schema = z.object({
  monto: z.string().min(1, 'Requerido').refine(v => parseFloat(v) > 0, 'Debe ser mayor a 0'),
  category_id: z.string().min(1, 'Selecciona una categoría'),
  cuenta_id: z.string().min(1, 'Selecciona una cuenta'),
  descripcion: z.string().min(1, 'Requerido'),
  fecha: z.string().min(1, 'Requerido'),
  notas: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface ExpenseFormProps {
  categories: Category[]
  onSuccess: () => void
  onCancel?: () => void
}

export function ExpenseForm({ categories, onSuccess, onCancel }: ExpenseFormProps) {
  const [loading, setLoading] = useState(false)
  const [fondoGeneral, setFondoGeneral] = useState<{ id: string; saldo: number } | null>(null)
  const expenseCategories = categories.filter(c => c.tipo === 'gasto')
  const { cuentas, principal } = useCuentas()

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { fecha: todayISO(), cuenta_id: '' },
  })

  // Traer el Fondo General para ofrecerlo como origen (si tiene saldo).
  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('savings_goals')
      .select('id, monto_actual')
      .eq('es_general', true)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data && data.monto_actual > 0.01) setFondoGeneral({ id: data.id, saldo: data.monto_actual })
      })
  }, [])

  // Preseleccionar la cuenta principal cuando cargan las cuentas.
  const cuentaId = watch('cuenta_id')
  useEffect(() => {
    if (!cuentaId && principal) setValue('cuenta_id', principal.id)
  }, [principal, cuentaId, setValue])

  const desdeFondo = cuentaId.startsWith(FONDO_PREFIX)

  async function onSubmit(data: FormData) {
    setLoading(true)
    const monto = parseFloat(data.monto)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    // Gasto pagado con el Fondo General: libera el fondo y registra el gasto.
    if (data.cuenta_id.startsWith(FONDO_PREFIX)) {
      if (fondoGeneral && monto > fondoGeneral.saldo + 0.005) {
        toast.error(`El Fondo General solo tiene ${formatHNL(fondoGeneral.saldo)}`)
        setLoading(false)
        return
      }
      const { error } = await supabase.rpc('registrar_gasto_desde_fondo', {
        p_user_id: user.id,
        p_goal_id: data.cuenta_id.slice(FONDO_PREFIX.length),
        p_monto: monto,
        p_descripcion: data.descripcion,
        p_category_id: data.category_id,
        p_cuenta_id: principal?.id ?? null,
        p_fecha: data.fecha,
        p_notas: data.notas || null,
      })
      if (error) toast.error(error.message || 'Error al gastar del Fondo General')
      else { toast.success('Gasto registrado desde el Fondo General'); onSuccess() }
      setLoading(false)
      return
    }

    const { error } = await supabase.from('expenses').insert({
      user_id: user.id,
      monto,
      category_id: data.category_id,
      cuenta_id: data.cuenta_id,
      descripcion: data.descripcion,
      fecha: data.fecha,
      notas: data.notas || null,
    })

    if (error) {
      toast.error('Error al guardar gasto')
    } else {
      toast.success('Gasto registrado')
      onSuccess()
    }
    setLoading(false)
  }

  return (
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
        <Select
          label="Categoría"
          placeholder="Seleccionar..."
          options={expenseCategories.map(c => ({ value: c.id, label: c.nombre }))}
          error={errors.category_id?.message}
          {...register('category_id')}
        />
      </div>

      <Input
        label="Descripción"
        placeholder="Ej: Almuerzo, gasolina..."
        error={errors.descripcion?.message}
        {...register('descripcion')}
      />

      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Pagar desde"
          placeholder="Seleccionar..."
          options={[
            ...cuentas.map(c => ({ value: c.id, label: c.nombre })),
            ...(fondoGeneral
              ? [{ value: `${FONDO_PREFIX}${fondoGeneral.id}`, label: `Fondo General (${formatHNL(fondoGeneral.saldo)})` }]
              : []),
          ]}
          error={errors.cuenta_id?.message}
          {...register('cuenta_id')}
        />
        <Input
          label="Fecha"
          type="date"
          error={errors.fecha?.message}
          {...register('fecha')}
        />
      </div>

      {desdeFondo && (
        <p className="-mt-2 text-xs text-violet-600 dark:text-violet-400">
          Se descontará de tu Fondo General. Tu disponible no cambia (ese dinero ya
          estaba ahorrado), pero tu ahorro baja por este gasto.
        </p>
      )}

      <Input
        label="Notas (opcional)"
        placeholder="Comentarios adicionales..."
        {...register('notas')}
      />

      <div className="flex gap-3 pt-2">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">
            Cancelar
          </Button>
        )}
        <Button type="submit" loading={loading} className="flex-1">
          Registrar gasto
        </Button>
      </div>
    </form>
  )
}
