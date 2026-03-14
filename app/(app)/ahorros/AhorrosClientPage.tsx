'use client'

import { useState, useCallback } from 'react'
import { Plus, PiggyBank } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { SavingsGoal, SavingsAllocation } from '@/lib/types/database'
import { GoalCard } from '@/components/ahorros/GoalCard'
import { GoalForm } from '@/components/ahorros/GoalForm'
import { ManualSavingForm } from '@/components/ahorros/ManualSavingForm'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { formatHNL } from '@/lib/utils/currency'

interface Props {
  initialGoals: SavingsGoal[]
  allocations: SavingsAllocation[]
}

export default function AhorrosClientPage({ initialGoals, allocations }: Props) {
  const router = useRouter()
  const [modalMetaOpen, setModalMetaOpen] = useState(false)
  const [modalAhorroOpen, setModalAhorroOpen] = useState(false)

  const handleSuccess = useCallback(() => {
    setModalMetaOpen(false)
    setModalAhorroOpen(false)
    router.refresh()
  }, [router])

  const generalGoal = initialGoals.find(g => g.es_general)
  const regularGoals = initialGoals.filter(g => !g.es_general)

  const totalAhorrado = initialGoals.reduce((sum, g) => sum + g.monto_actual, 0)
  const totalObjetivo = regularGoals.reduce((sum, g) => sum + g.monto_objetivo, 0)

  const goalsByStatus = {
    activa: regularGoals.filter(g => g.estado === 'activa'),
    pausada: regularGoals.filter(g => g.estado === 'pausada'),
    completada: regularGoals.filter(g => g.estado === 'completada'),
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ahorros</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {formatHNL(totalAhorrado)} <span className="text-gray-400">de {formatHNL(totalObjetivo)} en metas</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setModalAhorroOpen(true)}>
            <PiggyBank className="h-4 w-4" />
            Nuevo ahorro
          </Button>
          <Button onClick={() => setModalMetaOpen(true)}>
            <Plus className="h-4 w-4" />
            Nueva meta
          </Button>
        </div>
      </div>

      {/* Fondo General */}
      {generalGoal && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Fondo General</h2>
          <GoalCard
            goal={generalGoal}
            allocations={allocations.filter(a => a.savings_goal_id === generalGoal.id)}
            onChanged={() => router.refresh()}
            metasRegulares={regularGoals}
          />
        </section>
      )}

      {regularGoals.length === 0 && !generalGoal && (
        <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-100">
          <p className="text-base">No tienes metas de ahorro</p>
          <p className="text-sm mt-1">Crea tu primera meta o registra un ahorro</p>
        </div>
      )}

      {goalsByStatus.activa.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Metas activas</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {goalsByStatus.activa.map(goal => (
              <GoalCard
                key={goal.id}
                goal={goal}
                allocations={allocations.filter(a => a.savings_goal_id === goal.id)}
                onChanged={() => router.refresh()}
              />
            ))}
          </div>
        </section>
      )}

      {goalsByStatus.pausada.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Pausadas</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {goalsByStatus.pausada.map(goal => (
              <GoalCard
                key={goal.id}
                goal={goal}
                allocations={allocations.filter(a => a.savings_goal_id === goal.id)}
                onChanged={() => router.refresh()}
              />
            ))}
          </div>
        </section>
      )}

      {goalsByStatus.completada.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Completadas</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {goalsByStatus.completada.map(goal => (
              <GoalCard
                key={goal.id}
                goal={goal}
                allocations={allocations.filter(a => a.savings_goal_id === goal.id)}
                onChanged={() => router.refresh()}
              />
            ))}
          </div>
        </section>
      )}

      <Modal open={modalMetaOpen} onClose={() => setModalMetaOpen(false)} title="Nueva meta de ahorro">
        <GoalForm onSuccess={handleSuccess} onCancel={() => setModalMetaOpen(false)} />
      </Modal>

      <Modal open={modalAhorroOpen} onClose={() => setModalAhorroOpen(false)} title="Registrar ahorro">
        <ManualSavingForm
          goals={regularGoals}
          onSuccess={handleSuccess}
          onCancel={() => setModalAhorroOpen(false)}
        />
      </Modal>
    </div>
  )
}
