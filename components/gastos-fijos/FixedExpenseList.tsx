'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Trash2, ToggleLeft, ToggleRight, Pencil, Check, X } from 'lucide-react'
import { FixedExpense } from '@/lib/types/database'
import { formatHNL } from '@/lib/utils/currency'
import { createClient } from '@/lib/supabase/client'

interface FixedExpenseListProps {
  items: FixedExpense[]
  onChanged: () => void
}

export function FixedExpenseList({ items, onChanged }: FixedExpenseListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editMonto, setEditMonto] = useState('')

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este gasto fijo?')) return
    setDeletingId(id)
    const supabase = createClient()
    await supabase.from('fixed_expenses').delete().eq('id', id)
    toast.success('Gasto fijo eliminado')
    onChanged()
    setDeletingId(null)
  }

  async function handleToggle(id: string, activo: boolean) {
    const supabase = createClient()
    await supabase.from('fixed_expenses').update({ activo: !activo }).eq('id', id)
    toast.success(activo ? 'Desactivado' : 'Activado')
    onChanged()
  }

  async function handleEditSave(id: string) {
    const monto = parseFloat(editMonto)
    if (isNaN(monto) || monto <= 0) {
      toast.error('Monto inválido')
      return
    }
    const supabase = createClient()
    await supabase.from('fixed_expenses').update({ monto }).eq('id', id)
    toast.success('Monto actualizado')
    setEditingId(null)
    onChanged()
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-10 text-gray-400">
        <p className="text-base">No tienes gastos fijos registrados</p>
        <p className="text-sm mt-1">Agrega gastos que se repiten cada quincena</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col divide-y divide-gray-50">
      {items.map(item => (
        <div key={item.id} className={`flex items-center gap-3 py-3 ${!item.activo ? 'opacity-50' : ''}`}>
          <div
            className="h-9 w-9 shrink-0 rounded-full flex items-center justify-center text-xs font-bold"
            style={{
              backgroundColor: (item.categories?.color || '#6B7280') + '20',
              color: item.categories?.color || '#6B7280',
            }}
          >
            {item.nombre[0].toUpperCase()}
          </div>

          <div className="flex-1 min-w-0">
            <p className={`font-medium text-gray-900 truncate ${!item.activo ? 'line-through' : ''}`}>
              {item.nombre}
            </p>
            {item.categories && (
              <p className="text-xs text-gray-400">{item.categories.nombre}</p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {editingId === item.id ? (
              <>
                <input
                  type="number"
                  value={editMonto}
                  onChange={e => setEditMonto(e.target.value)}
                  className="w-24 rounded-lg border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                  onClick={() => { setEditingId(item.id); setEditMonto(item.monto.toString()) }}
                  className="font-semibold text-gray-700 hover:text-emerald-600 transition-colors text-sm flex items-center gap-1"
                >
                  {formatHNL(item.monto)}
                  <Pencil className="h-3 w-3 text-gray-300" />
                </button>

                <button
                  onClick={() => handleToggle(item.id, item.activo)}
                  className={`p-1 transition-colors ${item.activo ? 'text-emerald-500 hover:text-gray-400' : 'text-gray-300 hover:text-emerald-500'}`}
                  title={item.activo ? 'Desactivar' : 'Activar'}
                >
                  {item.activo
                    ? <ToggleRight className="h-5 w-5" />
                    : <ToggleLeft className="h-5 w-5" />
                  }
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
      ))}
    </div>
  )
}
