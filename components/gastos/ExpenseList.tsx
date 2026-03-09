'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { Expense } from '@/lib/types/database'
import { formatHNL } from '@/lib/utils/currency'
import { formatDate } from '@/lib/utils/dates'
import { createClient } from '@/lib/supabase/client'

interface ExpenseListProps {
  items: Expense[]
  onDeleted: () => void
}

export function ExpenseList({ items, onDeleted }: ExpenseListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este gasto?')) return
    setDeletingId(id)
    const supabase = createClient()
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (error) {
      toast.error('Error al eliminar')
    } else {
      toast.success('Gasto eliminado')
      onDeleted()
    }
    setDeletingId(null)
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p className="text-base">No hay gastos registrados</p>
        <p className="text-sm mt-1">Agrega tu primer gasto con el botón de arriba</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col divide-y divide-gray-50">
      {items.map(item => (
        <div key={item.id} className="flex items-center gap-3 py-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: (item.categories?.color || '#6B7280') + '20' }}
          >
            <span className="text-xs font-bold" style={{ color: item.categories?.color || '#6B7280' }}>
              {item.categories?.nombre?.[0] || '?'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 truncate">{item.descripcion}</p>
            <p className="text-xs text-gray-400">{item.categories?.nombre} · {formatDate(item.fecha)}</p>
          </div>
          <div className="flex items-center gap-2">
            <p className="font-semibold text-red-500">{formatHNL(item.monto)}</p>
            <button
              onClick={() => handleDelete(item.id)}
              disabled={deletingId === item.id}
              className="p-1 text-gray-400 hover:text-red-500 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
