'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { CreditCard } from 'lucide-react'
import { SaldoCuenta } from '@/lib/types/database'
import { createClient } from '@/lib/supabase/client'
import { formatHNL } from '@/lib/utils/currency'
import { todayISO } from '@/lib/utils/dates'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'

interface Props {
  open: boolean
  onClose: () => void
  tarjeta: SaldoCuenta
  /** Cuentas líquidas desde las que se puede pagar. */
  cuentasLiquidas: SaldoCuenta[]
  onSuccess: () => void
}

/**
 * Paga una tarjeta transfiriendo dinero desde una cuenta líquida. Es una
 * transferencia (tipo pago_tarjeta), NO un gasto: el gasto ya se registró al
 * hacer cada compra. Reduce la deuda de la tarjeta y baja el saldo de la cuenta
 * de origen.
 */
export function PagarTarjetaModal({ open, onClose, tarjeta, cuentasLiquidas, onSuccess }: Props) {
  const [loading, setLoading] = useState(false)
  const [origenId, setOrigenId] = useState('')
  const [monto, setMonto] = useState('')
  const [fecha, setFecha] = useState(todayISO())

  const deuda = Math.max(-Number(tarjeta.saldo), 0)

  useEffect(() => {
    if (!open) return
    setMonto(deuda > 0 ? deuda.toFixed(2) : '')
    setFecha(todayISO())
    const principal = cuentasLiquidas.find(c => c.es_principal) ?? cuentasLiquidas[0]
    setOrigenId(principal?.id ?? '')
  }, [open, deuda, cuentasLiquidas])

  const montoNum = parseFloat(monto)
  const saldoOrigen = cuentasLiquidas.find(c => c.id === origenId)?.saldo ?? 0
  const invalido = !montoNum || montoNum <= 0 || !origenId

  async function handlePagar() {
    if (invalido) { toast.error('Revisá el monto y la cuenta de origen'); return }
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { toast.error('Sesión expirada'); setLoading(false); return }

    const { error } = await supabase.rpc('registrar_transferencia', {
      p_user_id: user.id,
      p_origen_id: origenId,
      p_destino_id: tarjeta.id,
      p_monto: montoNum,
      p_fecha: fecha,
      p_tipo: 'pago_tarjeta',
      p_notas: `Pago de ${tarjeta.nombre}`,
    })

    if (error) {
      toast.error(error.message || 'No se pudo registrar el pago')
    } else {
      toast.success(`${formatHNL(montoNum)} pagados a ${tarjeta.nombre}`)
      onSuccess()
      onClose()
    }
    setLoading(false)
  }

  return (
    <Modal open={open} onClose={onClose} title={`Pagar "${tarjeta.nombre}"`} size="sm">
      <div className="flex flex-col gap-4">
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/40 px-4 py-3 flex items-center justify-between text-sm">
          <span className="text-red-700 dark:text-red-300">Deuda actual</span>
          <span className="font-semibold text-red-700 dark:text-red-300">{formatHNL(deuda)}</span>
        </div>

        <div>
          <Select
            label="Pagar desde"
            placeholder="Cuenta de origen..."
            options={cuentasLiquidas.map(c => ({ value: c.id, label: c.nombre }))}
            value={origenId}
            onChange={e => setOrigenId(e.target.value)}
          />
          {origenId && (
            <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
              Saldo: <span className="font-medium">{formatHNL(saldoOrigen)}</span>
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Monto (L)"
            type="number"
            step="0.01"
            min="0"
            value={monto}
            onChange={e => setMonto(e.target.value)}
          />
          <Input
            label="Fecha"
            type="date"
            value={fecha}
            onChange={e => setFecha(e.target.value)}
          />
        </div>

        <p className="text-xs text-gray-500 dark:text-slate-400">
          Es una transferencia, no un gasto: el gasto ya se registró en cada compra.
          Baja la deuda de la tarjeta y el saldo de la cuenta de origen.
        </p>

        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button onClick={handlePagar} loading={loading} disabled={invalido} className="flex-1">
            <CreditCard className="h-4 w-4" />
            Registrar pago
          </Button>
        </div>
      </div>
    </Modal>
  )
}
