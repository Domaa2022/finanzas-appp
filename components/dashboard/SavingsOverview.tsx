import Link from 'next/link'
import { SavingsGoal } from '@/lib/types/database'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { formatHNL } from '@/lib/utils/currency'
import { calcularPorcentaje } from '@/lib/utils/calculations'

interface SavingsOverviewProps {
  goals: SavingsGoal[]
}

export function SavingsOverview({ goals }: SavingsOverviewProps) {
  const activeGoals = goals.filter(g => g.estado === 'activa').slice(0, 4)

  if (activeGoals.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 text-sm">
        <p>No tienes metas activas</p>
        <Link href="/ahorros" className="text-emerald-600 hover:underline mt-1 block text-xs">
          Crear meta de ahorro
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {activeGoals.map(goal => {
        const pct = calcularPorcentaje(goal.monto_actual, goal.monto_objetivo)
        return (
          <div key={goal.id}>
            <div className="flex justify-between text-sm mb-1">
              <span className="font-medium text-gray-700 truncate">{goal.nombre}</span>
              <span className="text-gray-400 shrink-0 ml-2">{pct}%</span>
            </div>
            <ProgressBar value={pct} />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>{formatHNL(goal.monto_actual)}</span>
              <span>{formatHNL(goal.monto_objetivo)}</span>
            </div>
          </div>
        )
      })}
      {goals.length > 4 && (
        <Link href="/ahorros" className="text-xs text-emerald-600 hover:underline text-center">
          Ver todas las metas ({goals.length})
        </Link>
      )}
    </div>
  )
}
