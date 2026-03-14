'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Trash2, Calendar, ChevronDown, ChevronUp, Pause, Play, Wallet, ArrowRight } from 'lucide-react'
import { SavingsGoal, SavingsAllocation } from '@/lib/types/database'
import { formatHNL } from '@/lib/utils/currency'
import { formatDate, diasRestantes } from '@/lib/utils/dates'
import { calcularPorcentaje } from '@/lib/utils/calculations'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { createClient } from '@/lib/supabase/client'
import { TransferirDesdeGeneralModal } from '@/components/ahorros/TransferirDesdeGeneralModal'

interface GoalCardProps {
  goal: SavingsGoal
  allocations?: SavingsAllocation[]
  onChanged: () => void
  metasRegulares?: SavingsGoal[]   // Solo necesario para el Fondo General
}

const estadoBadge: Record<string, 'green' | 'yellow' | 'gray' | 'blue'> = {
  activa: 'green',
  completada: 'blue',
  pausada: 'yellow',
}

const estadoLabel: Record<string, string> = {
  activa: 'Activa',
  completada: 'Completada',
  pausada: 'Pausada',
}

export function GoalCard({ goal, allocations = [], onChanged, metasRegulares = [] }: GoalCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [modalTransferir, setModalTransferir] = useState(false)
  const pct = goal.es_general ? 100 : calcularPorcentaje(goal.monto_actual, goal.monto_objetivo)
  const dias = goal.fecha_limite ? diasRestantes(goal.fecha_limite) : null

  async function handleDelete() {
    if (!confirm('¿Eliminar? Se perderán los registros de ahorro asociados.')) return
    setLoading(true)
    const supabase = createClient()
    await supabase.from('savings_goals').delete().eq('id', goal.id)
    toast.success(goal.es_general ? 'Fondo General eliminado' : 'Meta eliminada')
    onChanged()
  }

  async function togglePausa() {
    setLoading(true)
    const supabase = createClient()
    const newEstado = goal.estado === 'pausada' ? 'activa' : 'pausada'
    await supabase.from('savings_goals').update({ estado: newEstado }).eq('id', goal.id)
    toast.success(newEstado === 'pausada' ? 'Meta pausada' : 'Meta reactivada')
    onChanged()
    setLoading(false)
  }

  // Tarjeta especial para Fondo General
  if (goal.es_general) {
    return (
      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-100 shadow-sm p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-100 rounded-lg">
              <Wallet className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Fondo General</h3>
              <p className="text-xs text-gray-500">Ahorro sin meta específica</p>
            </div>
          </div>
          <button
            onClick={handleDelete}
            disabled={loading}
            className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
            title="Eliminar fondo general"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">Saldo acumulado</span>
          <span className="text-2xl font-bold text-emerald-600">{formatHNL(goal.monto_actual)}</span>
        </div>

        {goal.monto_actual > 0 && metasRegulares.filter(g => g.monto_objetivo - g.monto_actual > 0.01).length > 0 && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setModalTransferir(true)}
            className="mt-2 w-full border-emerald-200 text-emerald-700 hover:bg-emerald-100 text-xs"
          >
            <ArrowRight className="h-3 w-3" />
            Trasladar a una meta
          </Button>
        )}

        {allocations.length > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 mt-3 text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {allocations.length} movimientos
          </button>
        )}

        {expanded && (
          <div className="mt-2 space-y-1 border-t border-emerald-100 pt-2">
            {allocations.slice(0, 10).map(alloc => (
              <div key={alloc.id} className="flex justify-between text-xs text-gray-500">
                <span>{formatDate(alloc.fecha)}{alloc.notas ? ` · ${alloc.notas}` : ''}</span>
                <span className={`font-medium ${alloc.monto >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {alloc.monto >= 0 ? '+' : ''}{formatHNL(alloc.monto)}
                </span>
              </div>
            ))}
          </div>
        )}

        <TransferirDesdeGeneralModal
          open={modalTransferir}
          onClose={() => setModalTransferir(false)}
          fondoGeneral={goal}
          metasDestino={metasRegulares}
          onSuccess={onChanged}
        />
      </div>
    )
  }

  // Tarjeta normal para metas regulares
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-900 truncate">{goal.nombre}</h3>
            <Badge variant={estadoBadge[goal.estado]}>{estadoLabel[goal.estado]}</Badge>
          </div>
          {goal.fecha_limite && (
            <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
              <Calendar className="h-3 w-3" />
              <span>{formatDate(goal.fecha_limite)}</span>
              {dias !== null && (
                <span className={dias < 0 ? 'text-red-500' : dias < 30 ? 'text-yellow-600' : ''}>
                  ({dias < 0 ? `Vencida hace ${Math.abs(dias)} días` : `${dias} días restantes`})
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {goal.estado !== 'completada' && (
            <button
              onClick={togglePausa}
              disabled={loading}
              className="p-1.5 text-gray-400 hover:text-yellow-500 transition-colors"
              title={goal.estado === 'pausada' ? 'Reactivar' : 'Pausar'}
            >
              {goal.estado === 'pausada' ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={loading}
            className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <ProgressBar value={pct} showLabel />

      <div className="flex justify-between mt-2 text-sm">
        <span className="font-medium text-emerald-600">{formatHNL(goal.monto_actual)}</span>
        <span className="text-gray-400">de {formatHNL(goal.monto_objetivo)}</span>
      </div>

      {allocations.length > 0 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 mt-3 text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {allocations.length} asignaciones
        </button>
      )}

      {expanded && (
        <div className="mt-2 space-y-1 border-t border-gray-50 pt-2">
          {allocations.slice(0, 10).map(alloc => (
            <div key={alloc.id} className="flex justify-between text-xs text-gray-500">
              <span>{formatDate(alloc.fecha)}{alloc.notas ? ` · ${alloc.notas}` : ''}</span>
              <span className="font-medium text-emerald-600">+{formatHNL(alloc.monto)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
