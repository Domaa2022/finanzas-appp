'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { CalendarClock, PiggyBank, Trash2, ToggleLeft, ToggleRight, CheckCircle2 } from 'lucide-react'
import { FixedExpense } from '@/lib/types/database'
import { formatHNL } from '@/lib/utils/currency'
import { formatDate, proximoDiaPago, diasRestantes } from '@/lib/utils/dates'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { createClient } from '@/lib/supabase/client'

interface Props {
  item: FixedExpense
  onChanged: () => void
}

export function FixedExpenseMonthlyCard({ item, onChanged }: Props) {
  const [reservando, setReservando] = useState(false)
  const [pagando, setPagando] = useState(false)
  const [eliminando, setEliminando] = useState(false)

  const apartado = item.fondo?.monto_actual ?? 0
  const monto = item.monto
  const falta = Math.max(monto - apartado, 0)
  const pct = monto > 0 ? Math.round((apartado / monto) * 100) : 0
  const listo = falta <= 0.01

  // Mitad automática, sin pasarse de lo que falta
  const sugerido = Math.min(Math.round((monto / 2) * 100) / 100, falta)

  const fechaPago = item.dia_pago ? proximoDiaPago(item.dia_pago) : null
  const dias = fechaPago ? diasRestantes(fechaPago) : null

  async function handleApartar() {
    if (sugerido <= 0) { toast.info('Ya tienes el monto completo apartado'); return }
    setReservando(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setReservando(false); return }

    const { error } = await supabase.rpc('reservar_gasto_fijo', {
      p_user_id: user.id,
      p_fixed_expense_id: item.id,
      p_amount: sugerido,
    })
    if (error) toast.error(error.message || 'Error al apartar')
    else {
      toast.success(`${formatHNL(sugerido)} apartados para ${item.nombre}`)
      onChanged()
    }
    setReservando(false)
  }

  async function handlePagar() {
    const msg = listo
      ? `¿Registrar el pago de ${item.nombre} por ${formatHNL(monto)}? Se usará lo apartado (${formatHNL(apartado)}).`
      : `Solo tienes ${formatHNL(apartado)} apartado de ${formatHNL(monto)}. ¿Pagar de todos modos? La diferencia saldrá de tu saldo disponible.`
    if (!confirm(msg)) return

    setPagando(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setPagando(false); return }

    const { error } = await supabase.rpc('pagar_gasto_fijo_mensual', {
      p_user_id: user.id,
      p_fixed_expense_id: item.id,
    })
    if (error) toast.error(error.message || 'Error al pagar')
    else {
      toast.success(`${item.nombre} pagado (${formatHNL(monto)})`)
      onChanged()
    }
    setPagando(false)
  }

  async function handleToggle() {
    const supabase = createClient()
    await supabase.from('fixed_expenses').update({ activo: !item.activo }).eq('id', item.id)
    toast.success(item.activo ? 'Desactivado' : 'Activado')
    onChanged()
  }

  async function handleDelete() {
    if (!confirm(`¿Eliminar "${item.nombre}"? El dinero apartado regresará a tu saldo.`)) return
    setEliminando(true)
    const supabase = createClient()
    // Devolver lo apartado al saldo antes de borrar (registra salida del fondo)
    if (item.savings_goal_id && apartado > 0) {
      await supabase.from('savings_allocations').insert({
        user_id: item.user_id,
        savings_goal_id: item.savings_goal_id,
        monto: -apartado,
        fecha: new Date().toISOString().slice(0, 10),
        notas: `Cancelación de ${item.nombre}`,
      })
    }
    if (item.savings_goal_id) {
      await supabase.from('savings_goals').delete().eq('id', item.savings_goal_id)
    }
    await supabase.from('fixed_expenses').delete().eq('id', item.id)
    toast.success('Gasto fijo eliminado')
    onChanged()
  }

  return (
    <div className={`bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm p-3.5 flex flex-col gap-2.5 ${!item.activo ? 'opacity-60' : ''}`}>
      {/* Encabezado */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="h-8 w-8 shrink-0 rounded-full flex items-center justify-center"
            style={{
              backgroundColor: (item.categories?.color || '#8B5CF6') + '20',
              color: item.categories?.color || '#8B5CF6',
            }}
          >
            <PiggyBank className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className={`font-medium text-sm text-gray-900 dark:text-slate-100 truncate ${!item.activo ? 'line-through' : ''}`}>
                {item.nombre}
              </h3>
              {listo && <Badge variant="green">Listo</Badge>}
            </div>
            {fechaPago && (
              <p className="flex items-center gap-1 text-xs text-gray-400 dark:text-slate-500">
                <CalendarClock className="h-3 w-3" />
                vence {formatDate(fechaPago)}
                {dias !== null && (
                  <span className={dias <= 5 ? 'text-amber-600 dark:text-amber-400 font-medium' : ''}>
                    · {dias <= 0 ? 'hoy' : `${dias}d`}
                  </span>
                )}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={handleToggle}
            className={`p-1 transition-colors ${item.activo ? 'text-emerald-500 hover:text-gray-400' : 'text-gray-300 hover:text-emerald-500'}`}
            title={item.activo ? 'Desactivar' : 'Activar'}
          >
            {item.activo ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
          </button>
          <button
            onClick={handleDelete}
            disabled={eliminando}
            className="p-1 text-gray-300 hover:text-red-500 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Progreso */}
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="font-medium text-emerald-600 dark:text-emerald-400">{formatHNL(apartado)}</span>
          <span className="text-gray-400 dark:text-slate-500">
            {listo ? `de ${formatHNL(monto)}` : `faltan ${formatHNL(falta)}`}
          </span>
        </div>
        <ProgressBar value={pct} />
      </div>

      {/* Acciones */}
      <div className="flex gap-2">
        {!listo && (
          <Button
            size="sm"
            variant="secondary"
            onClick={handleApartar}
            loading={reservando}
            disabled={!item.activo}
            className="flex-1 border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 text-xs"
          >
            <PiggyBank className="h-3.5 w-3.5" />
            Apartar {formatHNL(sugerido)}
          </Button>
        )}
        <Button
          size="sm"
          onClick={handlePagar}
          loading={pagando}
          disabled={!item.activo}
          className={`${listo ? 'flex-1' : ''} text-xs`}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          Pagar
        </Button>
      </div>
    </div>
  )
}
