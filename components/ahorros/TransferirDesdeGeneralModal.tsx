'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { ArrowRight } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { createClient } from '@/lib/supabase/client'
import { formatHNL } from '@/lib/utils/currency'
import { SavingsGoal } from '@/lib/types/database'

interface Props {
  open: boolean
  onClose: () => void
  fondoGeneral: SavingsGoal
  metasDestino: SavingsGoal[]   // Metas activas regulares con espacio disponible
  onSuccess: () => void
}

export function TransferirDesdeGeneralModal({ open, onClose, fondoGeneral, metasDestino, onSuccess }: Props) {
  const [goalId, setGoalId] = useState('')
  const [monto, setMonto] = useState('')
  const [loading, setLoading] = useState(false)

  const metasConEspacio = metasDestino.filter(g => g.monto_objetivo - g.monto_actual > 0.01)

  const metaSeleccionada = metasConEspacio.find(g => g.id === goalId)
  const espacioMeta = metaSeleccionada
    ? Math.round((metaSeleccionada.monto_objetivo - metaSeleccionada.monto_actual) * 100) / 100
    : 0

  const montoNum = parseFloat(monto) || 0

  function getMontoError(): string | undefined {
    if (montoNum <= 0) return undefined  // No error when empty
    if (montoNum > fondoGeneral.monto_actual + 0.005)
      return `Saldo insuficiente en Fondo General (${formatHNL(fondoGeneral.monto_actual)})`
    if (metaSeleccionada && montoNum > espacioMeta + 0.005)
      return `La meta solo admite ${formatHNL(espacioMeta)} más`
    return undefined
  }

  const canSubmit = goalId && montoNum > 0 && !getMontoError()

  async function handleConfirm() {
    if (!canSubmit) return
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.rpc('transfer_from_general', {
      p_user_id: user.id,
      p_target_goal_id: goalId,
      p_amount: montoNum,
    })

    if (error) {
      toast.error(error.message || 'Error al trasladar')
    } else {
      toast.success(`${formatHNL(montoNum)} trasladados correctamente`)
      setGoalId('')
      setMonto('')
      onSuccess()
      onClose()
    }
    setLoading(false)
  }

  return (
    <Modal open={open} onClose={onClose} title="Trasladar al Fondo General" size="sm">
      <div className="flex flex-col gap-4">
        <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-emerald-700 font-medium">Saldo disponible</span>
          <span className="text-lg font-bold text-emerald-800">{formatHNL(fondoGeneral.monto_actual)}</span>
        </div>

        {metasConEspacio.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-2">
            No tienes metas activas con espacio disponible.
          </p>
        ) : (
          <>
            <Select
              label="Meta destino"
              options={[
                { value: '', label: 'Selecciona una meta...' },
                ...metasConEspacio.map(g => ({
                  value: g.id,
                  label: `${g.nombre} (${formatHNL(Math.round((g.monto_objetivo - g.monto_actual) * 100) / 100)} disponibles)`,
                })),
              ]}
              value={goalId}
              onChange={e => setGoalId(e.target.value)}
            />

            <Input
              label="Monto a trasladar (L)"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={monto}
              onChange={e => setMonto(e.target.value)}
              error={getMontoError()}
            />
          </>
        )}

        <div className="flex gap-3 pt-1">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          <Button onClick={handleConfirm} loading={loading} disabled={!canSubmit} className="flex-1">
            <ArrowRight className="h-4 w-4" />
            Trasladar
          </Button>
        </div>
      </div>
    </Modal>
  )
}
