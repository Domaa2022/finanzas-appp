'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Trash2, Pencil, PlusCircle, CalendarDays, CheckCircle2 } from 'lucide-react'
import { Deuda, DeudaPago } from '@/lib/types/database'
import { formatHNL } from '@/lib/utils/currency'
import { formatDate } from '@/lib/utils/dates'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Modal } from '@/components/ui/Modal'
import { DeudaForm } from './DeudaForm'
import { RegistrarPagoModal } from './RegistrarPagoModal'

function estadoBadge(estado: Deuda['estado']) {
  if (estado === 'pagada') return <Badge variant="green">Pagada</Badge>
  if (estado === 'cancelada') return <Badge variant="gray">Cancelada</Badge>
  return <Badge variant="yellow">Activa</Badge>
}

function vencimientoBadge(fecha: string | null) {
  if (!fecha) return null
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const limite = new Date(fecha + 'T00:00:00')
  const dias = Math.ceil((limite.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
  if (dias < 0) return <Badge variant="red">Vencida</Badge>
  if (dias <= 3) return <Badge variant="red">{dias}d</Badge>
  if (dias <= 7) return <Badge variant="yellow">{dias}d</Badge>
  return null
}

interface Props {
  deudas: Deuda[]
  pagos: DeudaPago[]
  tipo: 'deuda' | 'prestamo'
  onChanged: () => void
}

export function DeudaList({ deudas, pagos, tipo, onChanged }: Props) {
  const [editando, setEditando] = useState<Deuda | null>(null)
  const [pagando, setPagando] = useState<Deuda | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const filtradas = deudas.filter(d => d.tipo === tipo)

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este registro? También se eliminará el historial de pagos.')) return
    setDeletingId(id)
    const supabase = createClient()
    await supabase.from('deudas').delete().eq('id', id)
    toast.success('Eliminado')
    onChanged()
    setDeletingId(null)
  }

  async function handleCancelar(deuda: Deuda) {
    const nuevoEstado = deuda.estado === 'cancelada' ? 'activa' : 'cancelada'
    const supabase = createClient()
    await supabase.from('deudas').update({ estado: nuevoEstado }).eq('id', deuda.id)
    toast.success(nuevoEstado === 'cancelada' ? 'Marcado como cancelado' : 'Reactivado')
    onChanged()
  }

  if (filtradas.length === 0) {
    return (
      <p className="text-center py-10 text-sm text-gray-400 dark:text-slate-500">
        {tipo === 'deuda'
          ? 'No tienes deudas registradas'
          : 'No tienes préstamos registrados'}
      </p>
    )
  }

  return (
    <>
      <div className="flex flex-col divide-y divide-gray-50 dark:divide-slate-700">
        {filtradas.map(d => {
          const pct = d.monto_total > 0 ? Math.round((d.monto_pagado / d.monto_total) * 100) : 0
          const pendiente = d.monto_total - d.monto_pagado
          const inactiva = d.estado !== 'activa'
          const historial = pagos.filter(p => p.deuda_id === d.id)

          return (
            <div key={d.id} className={`py-4 ${inactiva ? 'opacity-60' : ''}`}>
              {/* Fila principal */}
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className={`h-10 w-10 shrink-0 rounded-xl flex items-center justify-center text-sm font-bold text-white ${tipo === 'deuda' ? 'bg-red-500' : 'bg-emerald-500'}`}>
                  {d.nombre_persona[0].toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-gray-900 dark:text-slate-100 truncate">{d.nombre_persona}</p>
                    {estadoBadge(d.estado)}
                    {d.estado === 'activa' && vencimientoBadge(d.fecha_vencimiento)}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-slate-400 truncate">{d.descripcion}</p>
                  <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" />
                      {formatDate(d.fecha_inicio)}
                    </span>
                    {d.fecha_vencimiento && (
                      <span>hasta {formatDate(d.fecha_vencimiento)}</span>
                    )}
                  </div>
                </div>

                {/* Montos + acciones */}
                <div className="flex items-center gap-1 shrink-0">
                  <div className="text-right mr-1">
                    <p className="font-semibold text-gray-800 dark:text-slate-200 text-sm">{formatHNL(pendiente)}</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500">de {formatHNL(d.monto_total)}</p>
                  </div>

                  {d.estado === 'activa' && (
                    <button
                      onClick={() => setPagando(d)}
                      className="p-1.5 text-gray-300 dark:text-slate-600 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                      title={tipo === 'deuda' ? 'Registrar abono' : 'Registrar cobro'}
                    >
                      <PlusCircle className="h-4 w-4" />
                    </button>
                  )}

                  <button
                    onClick={() => setEditando(d)}
                    className="p-1.5 text-gray-300 dark:text-slate-600 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                    title="Editar"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>

                  <button
                    onClick={() => handleCancelar(d)}
                    className={`p-1.5 transition-colors ${d.estado === 'cancelada' ? 'text-emerald-500 hover:text-gray-400' : 'text-gray-300 dark:text-slate-600 hover:text-amber-500'}`}
                    title={d.estado === 'cancelada' ? 'Reactivar' : 'Marcar como cancelada'}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </button>

                  <button
                    onClick={() => handleDelete(d.id)}
                    disabled={deletingId === d.id}
                    className="p-1.5 text-gray-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Barra de progreso */}
              <div className="mt-3 ml-13">
                <ProgressBar
                  value={pct}
                  color={d.estado === 'pagada' ? '#10B981' : tipo === 'deuda' ? '#EF4444' : '#10B981'}
                />
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{pct}% pagado</p>
              </div>

              {/* Historial de pagos (últimos 3) */}
              {historial.length > 0 && (
                <div className="mt-2 ml-13 space-y-1">
                  {historial.slice(0, 3).map(p => (
                    <div key={p.id} className="flex items-center gap-2 text-xs text-gray-400 dark:text-slate-500">
                      <span className="h-1.5 w-1.5 rounded-full bg-gray-300 dark:bg-slate-600" />
                      <span>{formatDate(p.fecha)}</span>
                      <span className="font-medium text-gray-600 dark:text-slate-400">{formatHNL(p.monto)}</span>
                      {p.notas && <span className="truncate">— {p.notas}</span>}
                    </div>
                  ))}
                  {historial.length > 3 && (
                    <p className="text-xs text-gray-400 dark:text-slate-500 ml-3.5">+{historial.length - 3} más</p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {editando && (
        <Modal open={!!editando} onClose={() => setEditando(null)} title="Editar" size="sm">
          <DeudaForm
            initial={editando}
            onSuccess={() => { setEditando(null); onChanged() }}
            onCancel={() => setEditando(null)}
          />
        </Modal>
      )}

      {pagando && (
        <RegistrarPagoModal
          deuda={pagando}
          open={!!pagando}
          onClose={() => setPagando(null)}
          onSuccess={() => { setPagando(null); onChanged() }}
        />
      )}
    </>
  )
}
