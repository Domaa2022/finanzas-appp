'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Trash2, Pencil, ToggleLeft, ToggleRight, CalendarDays } from 'lucide-react'
import { Subscription } from '@/lib/types/database'
import { formatHNL } from '@/lib/utils/currency'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { SubscriptionForm } from './SubscriptionForm'

const CATEGORIA_LABELS: Record<string, string> = {
  entretenimiento: 'Entretenimiento',
  software: 'Software',
  educacion: 'Educación',
  productividad: 'Productividad',
  gaming: 'Gaming',
  otro: 'Otro',
}

const FRECUENCIA_LABELS: Record<string, string> = {
  semanal: 'sem.',
  mensual: 'mes',
  trimestral: 'trim.',
  anual: 'año',
}

function diasParaRenovar(fecha: string | null): number | null {
  if (!fecha) return null
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const renovacion = new Date(fecha + 'T00:00:00')
  return Math.ceil((renovacion.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
}

function RenovacionBadge({ fecha }: { fecha: string | null }) {
  if (!fecha) return null
  const dias = diasParaRenovar(fecha)
  if (dias === null) return null

  if (dias < 0) return <Badge variant="red">Vencida</Badge>
  if (dias === 0) return <Badge variant="red">Hoy</Badge>
  if (dias <= 3) return <Badge variant="yellow">{dias}d</Badge>
  if (dias <= 7) return <Badge variant="blue">{dias}d</Badge>
  return null
}

interface Props {
  items: Subscription[]
  onChanged: () => void
}

export function SubscriptionList({ items, onChanged }: Props) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editingItem, setEditingItem] = useState<Subscription | null>(null)

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta suscripción?')) return
    setDeletingId(id)
    const supabase = createClient()
    await supabase.from('subscriptions').delete().eq('id', id)
    toast.success('Suscripción eliminada')
    onChanged()
    setDeletingId(null)
  }

  async function handleToggle(item: Subscription) {
    const nuevoEstado = item.estado === 'activa' ? 'pausada' : 'activa'
    const supabase = createClient()
    await supabase.from('subscriptions').update({ estado: nuevoEstado }).eq('id', item.id)
    toast.success(nuevoEstado === 'activa' ? 'Suscripción activada' : 'Suscripción pausada')
    onChanged()
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
          const inactiva = item.estado !== 'activa'
          return (
            <div key={item.id} className={`flex items-center gap-3 py-3.5 ${inactiva ? 'opacity-50' : ''}`}>
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
                  <RenovacionBadge fecha={item.fecha_renovacion} />
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                  <span>{CATEGORIA_LABELS[item.categoria] || item.categoria}</span>
                  {item.fecha_renovacion && (
                    <>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        {new Date(item.fecha_renovacion + 'T00:00:00').toLocaleDateString('es-HN', {
                          day: '2-digit', month: 'short',
                        })}
                      </span>
                    </>
                  )}
                  {item.estado !== 'activa' && (
                    <>
                      <span>·</span>
                      <span className="text-amber-500 dark:text-amber-400 capitalize">{item.estado}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Monto + acciones */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="text-right">
                  <p className="font-semibold text-gray-800 dark:text-slate-200 text-sm">{formatHNL(item.monto)}</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">/{FRECUENCIA_LABELS[item.frecuencia] || item.frecuencia}</p>
                </div>

                <button
                  onClick={() => setEditingItem(item)}
                  className="p-1.5 text-gray-300 dark:text-slate-600 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                  title="Editar"
                >
                  <Pencil className="h-4 w-4" />
                </button>

                <button
                  onClick={() => handleToggle(item)}
                  className={`p-1.5 transition-colors ${item.estado === 'activa' ? 'text-emerald-500 hover:text-gray-400' : 'text-gray-300 hover:text-emerald-500'}`}
                  title={item.estado === 'activa' ? 'Pausar' : 'Activar'}
                >
                  {item.estado === 'activa'
                    ? <ToggleRight className="h-5 w-5" />
                    : <ToggleLeft className="h-5 w-5" />
                  }
                </button>

                <button
                  onClick={() => handleDelete(item.id)}
                  disabled={deletingId === item.id}
                  className="p-1.5 text-gray-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                  title="Eliminar"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {editingItem && (
        <Modal
          open={!!editingItem}
          onClose={() => setEditingItem(null)}
          title="Editar suscripción"
          size="sm"
        >
          <SubscriptionForm
            initial={editingItem}
            onSuccess={() => { setEditingItem(null); onChanged() }}
            onCancel={() => setEditingItem(null)}
          />
        </Modal>
      )}
    </>
  )
}
