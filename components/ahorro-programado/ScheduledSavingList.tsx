'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Trash2, ToggleLeft, ToggleRight, Pencil, Check, X } from 'lucide-react'
import { ScheduledSaving } from '@/lib/types/database'
import { formatHNL } from '@/lib/utils/currency'
import { createClient } from '@/lib/supabase/client'

interface ScheduledSavingListProps {
  items: ScheduledSaving[]
  ingresoReferencia?: number   // Para preview del monto calculado
  onChanged: () => void
}

export function ScheduledSavingList({ items, ingresoReferencia, onChanged }: ScheduledSavingListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValor, setEditValor] = useState('')

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este ahorro programado?')) return
    setDeletingId(id)
    const supabase = createClient()
    await supabase.from('scheduled_savings').delete().eq('id', id)
    toast.success('Ahorro programado eliminado')
    onChanged()
    setDeletingId(null)
  }

  async function handleToggle(id: string, activo: boolean) {
    const supabase = createClient()
    await supabase.from('scheduled_savings').update({ activo: !activo }).eq('id', id)
    toast.success(activo ? 'Desactivado' : 'Activado')
    onChanged()
  }

  async function handleEditSave(id: string) {
    const valor = parseFloat(editValor)
    if (isNaN(valor) || valor <= 0) { toast.error('Valor inválido'); return }
    const supabase = createClient()
    await supabase.from('scheduled_savings').update({ valor }).eq('id', id)
    toast.success('Actualizado')
    setEditingId(null)
    onChanged()
  }

  function calcularMonto(item: ScheduledSaving): number | null {
    if (!ingresoReferencia) return null
    return item.tipo === 'porcentaje'
      ? (ingresoReferencia * item.valor) / 100
      : Math.min(item.valor, ingresoReferencia)
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-10 text-gray-400">
        <p className="text-base">No tienes ahorros programados</p>
        <p className="text-sm mt-1">Agrega un ahorro que se aplique cada quincena automáticamente</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col divide-y divide-gray-50">
      {items.map(item => {
        const montoCalculado = calcularMonto(item)
        return (
          <div key={item.id} className={`flex items-center gap-3 py-3 ${!item.activo ? 'opacity-50' : ''}`}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50">
              <span className="text-sm font-bold text-blue-600">
                {item.tipo === 'porcentaje' ? '%' : 'L'}
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <p className={`font-medium text-gray-900 truncate ${!item.activo ? 'line-through' : ''}`}>
                {item.nombre}
              </p>
              {montoCalculado !== null && item.activo && (
                <p className="text-xs text-blue-600">
                  ≈ {formatHNL(montoCalculado)} por quincena
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {editingId === item.id ? (
                <>
                  <input
                    type="number"
                    value={editValor}
                    onChange={e => setEditValor(e.target.value)}
                    className="w-20 rounded-lg border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    autoFocus
                  />
                  <button onClick={() => handleEditSave(item.id)} className="p-1 text-emerald-600 hover:text-emerald-700">
                    <Check className="h-4 w-4" />
                  </button>
                  <button onClick={() => setEditingId(null)} className="p-1 text-gray-400 hover:text-gray-600">
                    <X className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => { setEditingId(item.id); setEditValor(item.valor.toString()) }}
                    className="text-sm font-semibold text-gray-700 hover:text-blue-600 transition-colors flex items-center gap-1"
                  >
                    {item.tipo === 'porcentaje' ? `${item.valor}%` : formatHNL(item.valor)}
                    <Pencil className="h-3 w-3 text-gray-300" />
                  </button>

                  <button
                    onClick={() => handleToggle(item.id, item.activo)}
                    className={`p-1 transition-colors ${item.activo ? 'text-blue-500 hover:text-gray-400' : 'text-gray-300 hover:text-blue-500'}`}
                  >
                    {item.activo ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
                  </button>

                  <button
                    onClick={() => handleDelete(item.id)}
                    disabled={deletingId === item.id}
                    className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
