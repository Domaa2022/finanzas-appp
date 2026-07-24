'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Check } from 'lucide-react'
import { Category, SavingsGoal } from '@/lib/types/database'
import { createClient } from '@/lib/supabase/client'
import { useCuentas } from '@/lib/cuentas/useCuentas'
import { formatHNL } from '@/lib/utils/currency'
import { todayISO } from '@/lib/utils/dates'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'

interface Props {
  open: boolean
  onClose: () => void
  goal: SavingsGoal
  onSuccess: () => void
}

/**
 * Registra el gasto real de una meta cumplida y vacía su fondo.
 * El disponible no cambia (ese dinero ya estaba apartado), pero el saldo de la
 * cuenta baja de verdad y la meta deja de contar como «apartado».
 */
export function UsarMetaModal({ open, onClose, goal, onSuccess }: Props) {
  const [loading, setLoading] = useState(false)
  const [categorias, setCategorias] = useState<Category[]>([])
  const [monto, setMonto] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [cuentaId, setCuentaId] = useState('')
  const [fecha, setFecha] = useState(todayISO())
  const { cuentas, principal } = useCuentas()

  // Cargar categorías de gasto al abrir
  useEffect(() => {
    if (!open) return
    const supabase = createClient()
    supabase
      .from('categories')
      .select('*')
      .eq('tipo', 'gasto')
      .eq('is_active', true)
      .order('nombre')
      .then(({ data }) => setCategorias(data || []))
  }, [open])

  // Valores por defecto cada vez que se abre
  useEffect(() => {
    if (!open) return
    setMonto(goal.monto_actual.toFixed(2))
    setFecha(todayISO())
  }, [open, goal.monto_actual])

  useEffect(() => {
    if (!cuentaId && principal) setCuentaId(principal.id)
  }, [principal, cuentaId])

  const montoNum = parseFloat(monto)
  const invalido = !montoNum || montoNum <= 0 || montoNum > goal.monto_actual + 0.005

  async function handleUsar() {
    if (invalido) {
      toast.error(`Ingresá un monto entre 0 y ${formatHNL(goal.monto_actual)}`)
      return
    }
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { toast.error('Sesión expirada'); setLoading(false); return }

    const { error } = await supabase.rpc('usar_meta', {
      p_user_id: user.id,
      p_goal_id: goal.id,
      p_category_id: categoriaId || null,
      p_cuenta_id: cuentaId || null,
      p_monto: montoNum,
      p_fecha: fecha,
      p_notas: null,
    })

    if (error) {
      toast.error(error.message || 'No se pudo registrar el uso de la meta')
    } else {
      toast.success(`${goal.nombre}: ${formatHNL(montoNum)} registrados como gasto`)
      onSuccess()
      onClose()
    }
    setLoading(false)
  }

  return (
    <Modal open={open} onClose={onClose} title={`Usar "${goal.nombre}"`} size="sm">
      <div className="flex flex-col gap-4">
        <div className="rounded-lg bg-gray-50 dark:bg-slate-700/50 px-4 py-3 flex items-center justify-between text-sm">
          <span className="text-gray-500 dark:text-slate-400">Acumulado en la meta</span>
          <span className="font-semibold text-gray-800 dark:text-slate-100">{formatHNL(goal.monto_actual)}</span>
        </div>

        <p className="text-xs text-gray-500 dark:text-slate-400">
          Se registrará como un gasto real y se vaciará el fondo. Tu disponible no
          cambia (ese dinero ya estaba apartado), pero el saldo de la cuenta sí baja.
        </p>

        <Input
          label="Monto usado (L)"
          type="number"
          step="0.01"
          min="0"
          max={goal.monto_actual}
          value={monto}
          onChange={e => setMonto(e.target.value)}
        />

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Categoría del gasto"
            placeholder="Automática..."
            options={categorias.map(c => ({ value: c.id, label: c.nombre }))}
            value={categoriaId}
            onChange={e => setCategoriaId(e.target.value)}
          />
          <Select
            label="Cuenta"
            placeholder="Principal..."
            options={cuentas.map(c => ({ value: c.id, label: c.nombre }))}
            value={cuentaId}
            onChange={e => setCuentaId(e.target.value)}
          />
        </div>

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
          <Button onClick={handleUsar} loading={loading} disabled={invalido} className="flex-1">
            <Check className="h-4 w-4" />
            Registrar uso
          </Button>
        </div>
      </div>
    </Modal>
  )
}
