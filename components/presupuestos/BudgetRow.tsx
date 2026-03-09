'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Trash2, Check, X } from 'lucide-react'
import { BudgetWithSpent } from '@/lib/types/database'
import { formatHNL } from '@/lib/utils/currency'
import { getBudgetStatus } from '@/lib/utils/calculations'
import { createClient } from '@/lib/supabase/client'

interface BudgetRowProps {
  budget: BudgetWithSpent
  onChanged: () => void
}

const statusColors = {
  ok: { bar: '#10B981', text: 'text-emerald-600', bg: 'bg-emerald-500' },
  warning: { bar: '#F59E0B', text: 'text-yellow-600', bg: 'bg-yellow-400' },
  danger: { bar: '#EF4444', text: 'text-red-600', bg: 'bg-red-500' },
}

export function BudgetRow({ budget, onChanged }: BudgetRowProps) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(budget.limite_mensual.toString())
  const [loading, setLoading] = useState(false)

  const status = getBudgetStatus(budget.porcentaje)
  const colors = statusColors[status]

  async function handleSave() {
    const newLimit = parseFloat(value)
    if (isNaN(newLimit) || newLimit <= 0) {
      toast.error('Ingresa un monto válido')
      return
    }
    setLoading(true)
    const supabase = createClient()
    await supabase.from('budgets').update({ limite_mensual: newLimit }).eq('id', budget.id)
    toast.success('Presupuesto actualizado')
    setEditing(false)
    onChanged()
    setLoading(false)
  }

  async function handleDelete() {
    if (!confirm('¿Eliminar este presupuesto?')) return
    setLoading(true)
    const supabase = createClient()
    await supabase.from('budgets').delete().eq('id', budget.id)
    toast.success('Presupuesto eliminado')
    onChanged()
  }

  return (
    <div className="py-4">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="h-3 w-3 rounded-full shrink-0"
            style={{ backgroundColor: budget.categories?.color || '#6B7280' }}
          />
          <span className="font-medium text-gray-900 truncate">{budget.categories?.nombre}</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {editing ? (
            <>
              <input
                type="number"
                value={value}
                onChange={e => setValue(e.target.value)}
                className="w-28 rounded-lg border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                autoFocus
              />
              <button onClick={handleSave} disabled={loading} className="p-1 text-emerald-600 hover:text-emerald-700">
                <Check className="h-4 w-4" />
              </button>
              <button onClick={() => setEditing(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              <div className="text-right">
                <button onClick={() => setEditing(true)} className="text-sm font-medium text-gray-700 hover:text-emerald-600 transition-colors">
                  {formatHNL(budget.limite_mensual)}
                </button>
                <p className={`text-xs ${colors.text}`}>
                  {formatHNL(budget.gastado)} gastado
                </p>
              </div>
              <button
                onClick={handleDelete}
                disabled={loading}
                className="p-1 text-gray-300 hover:text-red-500 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${Math.min(budget.porcentaje, 100)}%`,
            backgroundColor: colors.bar,
          }}
        />
      </div>

      <div className="flex justify-between mt-1 text-xs text-gray-400">
        <span>{budget.porcentaje}% usado</span>
        <span className={budget.restante < 0 ? 'text-red-500 font-medium' : ''}>
          {budget.restante < 0 ? `Excedido ${formatHNL(Math.abs(budget.restante))}` : `${formatHNL(budget.restante)} restante`}
        </span>
      </div>
    </div>
  )
}
