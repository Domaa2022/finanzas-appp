'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Trash2, ChevronDown, ChevronUp, Pin, PinOff } from 'lucide-react'
import { IncomeEntry } from '@/lib/types/database'
import { formatHNL } from '@/lib/utils/currency'
import { formatDate } from '@/lib/utils/dates'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/Badge'

interface IncomeListProps {
  items: IncomeEntry[]
  onDeleted: () => void
}

const frecuenciaLabel: Record<string, string> = {
  diario: 'Diario',
  quincenal: 'Quincenal',
  mensual: 'Mensual',
}

const frecuenciaBadge: Record<string, 'blue' | 'green' | 'yellow'> = {
  diario: 'blue',
  quincenal: 'yellow',
  mensual: 'green',
}

const ahorroLabel = (tipo: string, valor: number) => {
  if (tipo === 'ninguno') return 'Sin ahorro'
  if (tipo === 'porcentaje') return `${valor}%`
  return formatHNL(valor)
}

export function IncomeList({ items, onDeleted }: IncomeListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [pinningId, setPinningId] = useState<string | null>(null)

  async function handleTogglePin(item: IncomeEntry) {
    setPinningId(item.id)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setPinningId(null); return }

    if (item.es_quincena_actual) {
      // Desfijar
      const { error } = await supabase
        .from('income_entries')
        .update({ es_quincena_actual: false })
        .eq('id', item.id)
      if (error) toast.error('Error al desfijar')
      else { toast.success('Quincena desfijada'); onDeleted() }
    } else {
      // Desfijar todos y fijar este
      await supabase
        .from('income_entries')
        .update({ es_quincena_actual: false })
        .eq('user_id', user.id)
      const { error } = await supabase
        .from('income_entries')
        .update({ es_quincena_actual: true })
        .eq('id', item.id)
      if (error) toast.error('Error al fijar quincena')
      else { toast.success(`"${item.fuente}" fijado como quincena actual`); onDeleted() }
    }
    setPinningId(null)
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este ingreso? También se eliminarán las asignaciones de ahorro asociadas.')) return
    setDeletingId(id)
    const supabase = createClient()
    const { error } = await supabase.from('income_entries').delete().eq('id', id)
    if (error) {
      toast.error('Error al eliminar')
    } else {
      toast.success('Ingreso eliminado')
      onDeleted()
    }
    setDeletingId(null)
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400 dark:text-slate-500">
        <p className="text-base">No hay ingresos registrados</p>
        <p className="text-sm mt-1">Agrega tu primer ingreso con el botón de arriba</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col divide-y divide-gray-50 dark:divide-slate-700">
      {items.map(item => (
        <div key={item.id} className="py-3">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-gray-900 dark:text-slate-100 truncate">{item.fuente}</span>
                <Badge variant={frecuenciaBadge[item.frecuencia]}>
                  {frecuenciaLabel[item.frecuencia]}
                </Badge>
                {item.es_quincena_actual && (
                  <Badge variant="green">Actual</Badge>
                )}
              </div>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{formatDate(item.fecha)}</p>
            </div>
            <div className="text-right flex items-center gap-2">
              <div>
                <p className="font-semibold text-emerald-600">{formatHNL(item.monto)}</p>
                {item.ahorro_tipo !== 'ninguno' && (
                  <p className="text-xs text-gray-400 dark:text-slate-500">Ahorro: {ahorroLabel(item.ahorro_tipo, item.ahorro_valor)}</p>
                )}
              </div>
              <button
                onClick={() => handleTogglePin(item)}
                disabled={pinningId === item.id}
                title={item.es_quincena_actual ? 'Desfijar quincena' : 'Fijar como quincena actual'}
                className={`p-1 transition-colors ${
                  item.es_quincena_actual
                    ? 'text-violet-500 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300'
                    : 'text-gray-300 dark:text-slate-600 hover:text-violet-400 dark:hover:text-violet-500'
                }`}
              >
                {item.es_quincena_actual
                  ? <PinOff className="h-4 w-4" />
                  : <Pin className="h-4 w-4" />
                }
              </button>
              <button
                onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                className="p-1 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300"
              >
                {expandedId === item.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              <button
                onClick={() => handleDelete(item.id)}
                disabled={deletingId === item.id}
                className="p-1 text-gray-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          {expandedId === item.id && item.notas && (
            <div className="mt-2 ml-0 bg-gray-50 dark:bg-slate-700 rounded-lg px-3 py-2">
              <p className="text-xs text-gray-500 dark:text-slate-400">{item.notas}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
