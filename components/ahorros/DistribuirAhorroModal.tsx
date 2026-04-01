'use client'

import { useState, useMemo } from 'react'
import { toast } from 'sonner'
import { PiggyBank, Wallet } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { createClient } from '@/lib/supabase/client'
import { formatHNL } from '@/lib/utils/currency'
import { SavingsGoal } from '@/lib/types/database'

interface Props {
  open: boolean
  onClose: () => void
  totalAmount: number
  metasActivas: SavingsGoal[]   // Solo metas regulares activas (no full, no general)
  incomeId: string
  onSuccess: () => void
}

export function DistribuirAhorroModal({ open, onClose, totalAmount, metasActivas, incomeId, onSuccess }: Props) {
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  const metas = metasActivas.filter(g => g.monto_actual < g.monto_objetivo)

  const totalAsignado = useMemo(() => {
    return Object.values(amounts).reduce((sum, v) => sum + (parseFloat(v) || 0), 0)
  }, [amounts])

  const alFondoGeneral = Math.max(0, totalAmount - totalAsignado)

  function setAmount(goalId: string, value: string) {
    setAmounts(prev => ({ ...prev, [goalId]: value }))
  }

  function getError(goal: SavingsGoal): string | undefined {
    const v = parseFloat(amounts[goal.id] || '0')
    const espacio = Math.round((goal.monto_objetivo - goal.monto_actual) * 100) / 100
    if (v < 0) return 'No puede ser negativo'
    if (v > espacio + 0.005) return `Máx. disponible: ${formatHNL(espacio)}`
    return undefined
  }

  const hasErrors = metas.some(g => !!getError(g)) || totalAsignado > totalAmount + 0.01

  async function handleConfirm() {
    if (hasErrors) return
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const allocations = metas
      .map(g => ({ goal_id: g.id, amount: parseFloat(amounts[g.id] || '0') }))
      .filter(a => a.amount > 0)

    const { error } = await supabase.rpc('distribute_savings_manual', {
      p_income_id: incomeId,
      p_user_id: user.id,
      p_total_savings: totalAmount,
      p_allocations: allocations,
    })

    if (error) {
      toast.error('Error al distribuir ahorros')
    } else {
      toast.success(`${formatHNL(totalAmount)} distribuidos correctamente`)
      setAmounts({})
      onSuccess()
      onClose()
    }
    setLoading(false)
  }

  return (
    <Modal open={open} onClose={onClose} title="Distribuir ahorro programado" size="md">
      <div className="flex flex-col gap-4">
        <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/40 px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-blue-700 dark:text-blue-400 font-medium">Total a distribuir</span>
          <span className="text-lg font-bold text-blue-800 dark:text-blue-300">{formatHNL(totalAmount)}</span>
        </div>

        {metas.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-2">
            No tienes metas activas con espacio disponible. El total irá al Fondo General.
          </p>
        ) : (
          <div className="flex flex-col gap-3 max-h-64 overflow-y-auto pr-1">
            {metas.map(goal => {
              const espacio = Math.round((goal.monto_objetivo - goal.monto_actual) * 100) / 100
              return (
                <div key={goal.id} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-slate-400">
                    <span className="font-medium text-gray-700 dark:text-slate-300">{goal.nombre}</span>
                    <span>Disponible: {formatHNL(espacio)}</span>
                  </div>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={amounts[goal.id] || ''}
                    onChange={e => setAmount(goal.id, e.target.value)}
                    error={getError(goal)}
                  />
                </div>
              )
            })}
          </div>
        )}

        {/* Fondo General */}
        <div className="rounded-lg border border-emerald-100 dark:border-emerald-800/40 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <div>
              <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">Fondo General</p>
              <p className="text-xs text-emerald-600 dark:text-emerald-500">Sobrante sin asignar</p>
            </div>
          </div>
          <span className="text-base font-bold text-emerald-700 dark:text-emerald-300">{formatHNL(alFondoGeneral)}</span>
        </div>

        {totalAsignado > totalAmount + 0.01 && (
          <p className="text-xs text-red-600 text-center">
            La suma asignada ({formatHNL(totalAsignado)}) supera el total disponible
          </p>
        )}

        <div className="flex gap-3 pt-1">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          <Button onClick={handleConfirm} loading={loading} disabled={hasErrors} className="flex-1">
            <PiggyBank className="h-4 w-4" />
            Aplicar distribución
          </Button>
        </div>
      </div>
    </Modal>
  )
}
