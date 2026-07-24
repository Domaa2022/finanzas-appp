'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { PiggyBank } from 'lucide-react'
import { FixedExpense } from '@/lib/types/database'
import { createClient } from '@/lib/supabase/client'
import { formatHNL } from '@/lib/utils/currency'
import { todayISO } from '@/lib/utils/dates'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ProgressBar } from '@/components/ui/ProgressBar'

interface Props {
  open: boolean
  onClose: () => void
  item: FixedExpense
  onSuccess: () => void
}

/**
 * Adelanta dinero al fondo de un pago, además de lo que se aparta solo cada
 * quincena. Útil cuando sobra plata y querés cubrir un pago próximo antes.
 */
export function ApartarFondoModal({ open, onClose, item, onSuccess }: Props) {
  const [loading, setLoading] = useState(false)
  const [monto, setMonto] = useState('')
  const [fecha, setFecha] = useState(todayISO())

  const apartado = item.fondo?.monto_actual ?? 0
  const falta = Math.max(item.monto - apartado, 0)
  const pct = item.monto > 0 ? Math.min((apartado / item.monto) * 100, 100) : 0

  useEffect(() => {
    if (!open) return
    setMonto(falta > 0 ? falta.toFixed(2) : '')
    setFecha(todayISO())
  }, [open, falta])

  const montoNum = parseFloat(monto)
  const invalido = !montoNum || montoNum <= 0

  async function handleApartar() {
    if (invalido) { toast.error('Ingresá un monto mayor a 0'); return }
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { toast.error('Sesión expirada'); setLoading(false); return }

    const { error } = await supabase.rpc('reservar_gasto_fijo', {
      p_user_id: user.id,
      p_fixed_expense_id: item.id,
      p_amount: montoNum,
      p_fecha: fecha,
    })

    if (error) {
      toast.error(error.message || 'No se pudo apartar')
    } else {
      toast.success(`${formatHNL(montoNum)} apartados para ${item.nombre}`)
      onSuccess()
      onClose()
    }
    setLoading(false)
  }

  return (
    <Modal open={open} onClose={onClose} title={`Apartar para "${item.nombre}"`} size="sm">
      <div className="flex flex-col gap-4">
        <div className="rounded-lg bg-gray-50 dark:bg-slate-700/50 px-4 py-3">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-gray-500 dark:text-slate-400">Fondo actual</span>
            <span className="font-semibold text-gray-800 dark:text-slate-100">
              {formatHNL(apartado)} <span className="text-gray-400 font-normal">de {formatHNL(item.monto)}</span>
            </span>
          </div>
          <ProgressBar value={pct} />
        </div>

        <p className="text-xs text-gray-500 dark:text-slate-400">
          {falta > 0.01
            ? `Faltan ${formatHNL(falta)} para cubrirlo. Este apartado es extra: cada quincena se sigue apartando solo.`
            : 'El fondo ya está completo. Podés apartar más si el monto va a subir.'}
        </p>

        <Input
          label="Monto a apartar (L)"
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          value={monto}
          onChange={e => setMonto(e.target.value)}
        />

        <Input
          label="Fecha"
          type="date"
          value={fecha}
          onChange={e => setFecha(e.target.value)}
        />

        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          <Button onClick={handleApartar} loading={loading} disabled={invalido} className="flex-1">
            <PiggyBank className="h-4 w-4" />
            Apartar
          </Button>
        </div>
      </div>
    </Modal>
  )
}
