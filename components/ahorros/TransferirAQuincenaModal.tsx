'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { CalendarDays, Loader2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { createClient } from '@/lib/supabase/client'
import { formatHNL } from '@/lib/utils/currency'
import { formatDate } from '@/lib/utils/dates'
import { tr } from 'date-fns/locale'

interface QuincenaInfo {
  id: string
  fuente: string
  fecha: string
  monto: number
}

interface Props {
  open: boolean
  onClose: () => void
  fondoDisponible: number
  onSuccess: () => void
}

export function TransferirAQuincenaModal({ open, onClose, fondoDisponible, onSuccess }: Props) {
  const [quincena, setQuincena] = useState<QuincenaInfo | null>(null)
  const [loadingInfo, setLoadingInfo] = useState(false)
  const [monto, setMonto] = useState('')
  const [loading, setLoading] = useState(false)

  // Cargar la quincena actual al abrir el modal
  useEffect(() => {
    if (!open) return
    setLoadingInfo(true)
    const supabase = createClient()
    supabase
      .from('income_entries')
      .select('id, fuente, fecha, monto, es_quincena_actual')
      .eq('es_quincena_actual', true)
      .limit(1)
      .single()
      .then(({ data }) => {
        setQuincena(data ?? null)
        setLoadingInfo(false)
      })
  }, [open])

  const montoNum = parseFloat(monto) || 0

  function getError(): string | undefined {
    if (montoNum <= 0) return undefined
    if (montoNum > fondoDisponible + 0.005)
      return `Saldo insuficiente en Fondo General (${formatHNL(fondoDisponible)})`
    return undefined
  }

  const canSubmit = quincena && montoNum > 0 && !getError()

  async function handleConfirm() {
    if (!canSubmit || !quincena) return
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { error } = await supabase.rpc('transfer_general_to_quincena', {
      p_user_id: user.id,
      p_income_id: quincena.id,
      p_amount: montoNum,
    })

    if (error) {
      toast.error(error.message || 'Error al trasladar')
    } else {
      toast.success(`${formatHNL(montoNum)} enviados a tu quincena`)
      setMonto('')
      onSuccess()
      onClose()
    }
    setLoading(false)
  }

  return (
    <Modal open={open} onClose={onClose} title="Apoyar quincena actual" size="sm">
      <div className="flex flex-col gap-4">

        {/* Info de la quincena */}
        {loadingInfo ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400 dark:text-slate-500" />
          </div>
        ) : quincena ? (
          <div className="rounded-lg bg-violet-50 dark:bg-violet-900/20 border border-violet-100 dark:border-violet-800/40 px-4 py-3">
            <p className="text-xs text-violet-500 dark:text-violet-400 font-medium uppercase tracking-wide mb-1">Quincena actual</p>
            <p className="text-sm font-semibold text-violet-900 dark:text-violet-200">{quincena.fuente}</p>
            <p className="text-xs text-violet-600 dark:text-violet-400 flex items-center gap-1 mt-0.5">
              <CalendarDays className="h-3 w-3" />
              {formatDate(quincena.fecha)} · {formatHNL(quincena.monto)}
            </p>
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-2">
            No hay una quincena registrada. Registra un ingreso primero.
          </p>
        )}

        {/* Saldo disponible */}
        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/40 px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">Fondo General disponible</span>
          <span className="text-base font-bold text-emerald-800 dark:text-emerald-300">{formatHNL(fondoDisponible)}</span>
        </div>

        <Input
          label="Monto a enviar a la quincena (L)"
          type="number"
          min="0"
          step="0.01"
          placeholder="0.00"
          value={monto}
          onChange={e => setMonto(e.target.value)}
          error={getError()}
          disabled={!quincena}
          helpText="Este monto se restará del Fondo General y quedará disponible en tu quincena."
        />

        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            loading={loading}
            disabled={!canSubmit}
            className="flex-1"
          >
            Enviar a quincena
          </Button>
        </div>
      </div>
    </Modal>
  )
}
