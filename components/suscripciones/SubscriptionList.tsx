'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Trash2, Pencil, ToggleLeft, ToggleRight, CalendarDays, Check, PiggyBank } from 'lucide-react'
import { Category, FixedExpense } from '@/lib/types/database'
import { formatHNL } from '@/lib/utils/currency'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { SubscriptionForm } from './SubscriptionForm'
import { ApartarFondoModal } from './ApartarFondoModal'

const GRUPO_LABELS: Record<string, string> = {
  entretenimiento: 'Entretenimiento',
  software: 'Software',
  educacion: 'Educación',
  productividad: 'Productividad',
  gaming: 'Gaming',
  otro: 'Otro',
}

const FRECUENCIA_LABELS: Record<string, string> = {
  semanal: 'sem.',
  quincenal: 'quinc.',
  mensual: 'mes',
  trimestral: 'trim.',
  anual: 'año',
  variable: 'sin fecha',
}

function diasParaRenovar(fecha: string | null): number | null {
  if (!fecha) return null
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const renovacion = new Date(fecha + 'T00:00:00')
  return Math.ceil((renovacion.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
}

function RenovacionBadge({ fecha }: { fecha: string | null }) {
  const dias = diasParaRenovar(fecha)
  if (dias === null) return null

  // El cobro automático corre al abrir el dashboard, así que una fecha pasada
  // solo se ve fugazmente. Igual se marca por si el cobro falló.
  if (dias < 0) return <Badge variant="red">Por cobrar</Badge>
  if (dias === 0) return <Badge variant="red">Hoy</Badge>
  if (dias <= 3) return <Badge variant="yellow">{dias}d</Badge>
  if (dias <= 7) return <Badge variant="blue">{dias}d</Badge>
  return null
}

interface Props {
  items: FixedExpense[]
  categorias: Category[]
  onChanged: () => void
}

export function SubscriptionList({ items, categorias, onChanged }: Props) {
  const [busyId, setBusyId] = useState<string | null>(null)
  const [editingItem, setEditingItem] = useState<FixedExpense | null>(null)
  const [apartandoItem, setApartandoItem] = useState<FixedExpense | null>(null)

  async function handleDelete(item: FixedExpense) {
    const apartado = item.fondo?.monto_actual ?? 0
    const aviso = apartado > 0.01
      ? `¿Eliminar ${item.nombre}? Tiene ${formatHNL(apartado)} apartados en su fondo; ese dinero queda en tus ahorros.`
      : `¿Eliminar ${item.nombre}?`
    if (!confirm(aviso)) return

    setBusyId(item.id)
    const supabase = createClient()
    const { error } = await supabase.from('fixed_expenses').delete().eq('id', item.id)
    if (error) toast.error('No se pudo eliminar')
    else {
      toast.success('Suscripción eliminada')
      onChanged()
    }
    setBusyId(null)
  }

  async function handleToggle(item: FixedExpense) {
    setBusyId(item.id)
    const supabase = createClient()
    const { error } = await supabase
      .from('fixed_expenses')
      .update({ activo: !item.activo })
      .eq('id', item.id)

    if (error) toast.error('No se pudo cambiar el estado')
    else {
      toast.success(item.activo
        ? 'Suscripción pausada — deja de apartarse dinero'
        : 'Suscripción activada')
      onChanged()
    }
    setBusyId(null)
  }

  /** Cobro manual: para las de frecuencia variable, que no se pagan solas. */
  async function handlePagar(item: FixedExpense) {
    const apartado = item.fondo?.monto_actual ?? 0
    const falta = Math.max(item.monto - apartado, 0)
    const aviso = falta > 0.01
      ? `Registrar el pago de ${item.nombre} por ${formatHNL(item.monto)}. Solo hay ${formatHNL(apartado)} apartados, los ${formatHNL(falta)} restantes saldrán de tu quincena actual.`
      : `Registrar el pago de ${item.nombre} por ${formatHNL(item.monto)} desde su fondo.`
    if (!confirm(aviso)) return

    setBusyId(item.id)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setBusyId(null); return }

    const { data, error } = await supabase.rpc('pagar_gasto_fijo', {
      p_user_id: user.id,
      p_fixed_expense_id: item.id,
    })

    if (error) {
      toast.error('No se pudo registrar el pago')
    } else {
      const deQuincena = data?.de_quincena ?? 0
      toast.success(deQuincena > 0.01
        ? `${item.nombre} pagado · ${formatHNL(deQuincena)} salieron de tu quincena`
        : `${item.nombre} pagado desde su fondo`)
      onChanged()
    }
    setBusyId(null)
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400 dark:text-slate-500">
        <p className="text-base">No tienes suscripciones registradas</p>
        <p className="text-sm mt-1">Agrega tus apps y servicios para llevar el control</p>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col divide-y divide-gray-50 dark:divide-slate-700">
        {items.map(item => {
          const inactiva = !item.activo
          const apartado = item.fondo?.monto_actual ?? 0
          const pct = item.monto > 0 ? Math.min((apartado / item.monto) * 100, 100) : 0
          const lleno = apartado >= item.monto - 0.01
          const dias = diasParaRenovar(item.proximo_pago)
          // Las variables no se cobran solas: siempre ofrecen el botón manual.
          const pagoManual = item.frecuencia === 'variable' || (dias !== null && dias <= 0)

          return (
            <div key={item.id} className={`py-3.5 ${inactiva ? 'opacity-50' : ''}`}>
              <div className="flex items-center gap-3">
                {/* Avatar con color */}
                <div
                  className="h-10 w-10 shrink-0 rounded-xl flex items-center justify-center text-sm font-bold text-white"
                  style={{ backgroundColor: item.color || '#6B7280' }}
                >
                  {item.nombre[0].toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`font-medium text-gray-900 dark:text-slate-100 truncate ${inactiva ? 'line-through' : ''}`}>
                      {item.nombre}
                    </p>
                    {!inactiva && <RenovacionBadge fecha={item.proximo_pago} />}
                    {!inactiva && lleno && <Badge variant="green">Fondo listo</Badge>}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                    <span>{GRUPO_LABELS[item.grupo ?? 'otro'] ?? item.grupo}</span>
                    {item.proximo_pago && (
                      <>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <CalendarDays className="h-3 w-3" />
                          {new Date(item.proximo_pago + 'T00:00:00').toLocaleDateString('es-HN', {
                            day: '2-digit', month: 'short',
                          })}
                        </span>
                      </>
                    )}
                    {inactiva && (
                      <>
                        <span>·</span>
                        <span className="text-amber-500 dark:text-amber-400">pausada</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Monto + acciones */}
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <p className="font-semibold text-gray-800 dark:text-slate-200 text-sm">{formatHNL(item.monto)}</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500">
                      /{FRECUENCIA_LABELS[item.frecuencia] || item.frecuencia}
                    </p>
                  </div>

                  {!inactiva && (
                    <button
                      onClick={() => setApartandoItem(item)}
                      className="p-1.5 text-gray-300 dark:text-slate-600 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
                      title="Apartar dinero extra a su fondo"
                    >
                      <PiggyBank className="h-4 w-4" />
                    </button>
                  )}

                  {!inactiva && pagoManual && (
                    <button
                      onClick={() => handlePagar(item)}
                      disabled={busyId === item.id}
                      className="p-1.5 text-gray-300 dark:text-slate-600 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors disabled:opacity-40"
                      title="Ya lo pagué"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  )}

                  <button
                    onClick={() => setEditingItem(item)}
                    className="p-1.5 text-gray-300 dark:text-slate-600 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                    title="Editar"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>

                  <button
                    onClick={() => handleToggle(item)}
                    disabled={busyId === item.id}
                    className={`p-1.5 transition-colors disabled:opacity-40 ${item.activo ? 'text-emerald-500 hover:text-gray-400' : 'text-gray-300 hover:text-emerald-500'}`}
                    title={item.activo ? 'Pausar' : 'Activar'}
                  >
                    {item.activo
                      ? <ToggleRight className="h-5 w-5" />
                      : <ToggleLeft className="h-5 w-5" />
                    }
                  </button>

                  <button
                    onClick={() => handleDelete(item)}
                    disabled={busyId === item.id}
                    className="p-1.5 text-gray-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 transition-colors disabled:opacity-40"
                    title="Eliminar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Progreso del fondo apartado */}
              {!inactiva && (
                <div className="mt-2 pl-13">
                  <ProgressBar value={pct} />
                  <div className="flex justify-between mt-1 text-xs">
                    <span className={lleno
                      ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                      : 'text-gray-400 dark:text-slate-500'}>
                      {formatHNL(apartado)} apartado
                    </span>
                    <span className="text-gray-400 dark:text-slate-500">
                      {lleno ? 'cubierta' : `faltan ${formatHNL(item.monto - apartado)}`}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {apartandoItem && (
        <ApartarFondoModal
          open={!!apartandoItem}
          onClose={() => setApartandoItem(null)}
          item={apartandoItem}
          onSuccess={onChanged}
        />
      )}

      {editingItem && (
        <Modal
          open={!!editingItem}
          onClose={() => setEditingItem(null)}
          title="Editar suscripción"
          size="sm"
        >
          <SubscriptionForm
            categorias={categorias}
            initial={editingItem}
            onSuccess={() => { setEditingItem(null); onChanged() }}
            onCancel={() => setEditingItem(null)}
          />
        </Modal>
      )}
    </>
  )
}
