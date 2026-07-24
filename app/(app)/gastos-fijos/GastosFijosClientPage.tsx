'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { Plus, ReceiptText, PiggyBank, ArrowRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { FixedExpense, Category } from '@/lib/types/database'
import { FixedExpenseForm } from '@/components/gastos-fijos/FixedExpenseForm'
import { FixedExpenseList } from '@/components/gastos-fijos/FixedExpenseList'
import { Modal } from '@/components/ui/Modal'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { formatHNL } from '@/lib/utils/currency'
import { todayISO } from '@/lib/utils/dates'
import { createClient } from '@/lib/supabase/client'

interface Props {
  initialFixed: FixedExpense[]
  categories: Category[]
}

export default function GastosFijosClientPage({ initialFixed, categories }: Props) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [applying, setApplying] = useState(false)

  const handleSuccess = useCallback(() => {
    setModalOpen(false)
    router.refresh()
  }, [router])

  // Esta pantalla solo recibe quincenales (ver page.tsx): se cobran completos
  // al recibir el pago, sin fondo de por medio.
  const activos = initialFixed.filter(f => f.activo)
  const totalPorQuincena = activos.reduce((s, f) => s + f.monto, 0)

  // Registra los que aún no se aplicaron esta quincena. Normalmente esto ocurre
  // solo al fijar la quincena actual (procesar_quincena); el botón queda como
  // red de seguridad si esa automatización falló.
  async function handleAplicar() {
    if (activos.length === 0) {
      toast.error('No hay gastos fijos quincenales activos')
      return
    }

    setApplying(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setApplying(false); return }

    const { data: ultimoIngreso } = await supabase
      .from('income_entries')
      .select('fecha')
      .eq('user_id', user.id)
      .order('fecha', { ascending: false })
      .limit(1)
      .single()

    const fechaDesde = ultimoIngreso?.fecha ?? todayISO()

    const { data: gastosExistentes } = await supabase
      .from('expenses')
      .select('descripcion')
      .eq('user_id', user.id)
      .eq('notas', 'Gasto fijo quincenal')
      .gte('fecha', fechaDesde)

    const yaAplicados = new Set((gastosExistentes || []).map(e => e.descripcion))
    const pendientes = activos.filter(f => !yaAplicados.has(f.nombre))

    if (pendientes.length === 0) {
      toast.info('Todos los gastos fijos quincenales ya están registrados esta quincena')
      setApplying(false)
      return
    }

    const totalPendiente = pendientes.reduce((s, f) => s + f.monto, 0)
    if (!confirm(`¿Registrar ${pendientes.length} gasto${pendientes.length !== 1 ? 's' : ''} fijo${pendientes.length !== 1 ? 's' : ''} por ${formatHNL(totalPendiente)} con fecha de hoy?`)) {
      setApplying(false)
      return
    }

    const today = todayISO()
    const rows = pendientes.map(f => ({
      user_id: user.id,
      monto: f.monto,
      category_id: f.category_id,
      descripcion: f.nombre,
      fecha: today,
      notas: 'Gasto fijo quincenal',
    }))

    const { error } = await supabase.from('expenses').insert(rows)
    if (error) {
      toast.error('Error al registrar gastos fijos')
    } else {
      toast.success(`${pendientes.length} gasto${pendientes.length !== 1 ? 's' : ''} fijo${pendientes.length !== 1 ? 's' : ''} registrado${pendientes.length !== 1 ? 's' : ''} (${formatHNL(totalPendiente)})`)
      router.refresh()
    }
    setApplying(false)
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Gastos Fijos</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
            Por quincena:{' '}
            <span className="font-medium text-red-500">{formatHNL(totalPorQuincena)}</span>
            <span className="text-xs text-gray-400 dark:text-slate-500">
              {' '}· se registran completos al recibir tu pago
            </span>
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" />
          Agregar
        </Button>
      </div>

      {/* Los pagos con fondo ahora viven en Suscripciones */}
      <Link
        href="/suscripciones"
        className="flex items-center gap-3 rounded-xl border border-violet-100 dark:border-violet-800/40 bg-violet-50 dark:bg-violet-900/20 px-4 py-3 text-sm text-violet-800 dark:text-violet-300 hover:border-violet-300 transition-colors"
      >
        <PiggyBank className="h-5 w-5 shrink-0 text-violet-600 dark:text-violet-400" />
        <p className="flex-1">
          ¿Un pago mensual, anual o sin fecha fija? Va en{' '}
          <span className="font-medium">Suscripciones</span>, donde se aparta dinero
          cada quincena y se paga solo el día del cobro.
        </p>
        <ArrowRight className="h-4 w-4 shrink-0" />
      </Link>

      {activos.length > 0 && (
        <Button
          variant="secondary"
          onClick={handleAplicar}
          loading={applying}
          className="w-full border-amber-200 text-amber-700 hover:bg-amber-50"
        >
          <ReceiptText className="h-4 w-4" />
          Registrar {activos.length} gastos quincenales como gastos de hoy ({formatHNL(totalPorQuincena)})
        </Button>
      )}

      <Card padding="none">
        <div className="px-6 py-4">
          <FixedExpenseList items={initialFixed} onChanged={() => router.refresh()} />
        </div>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Agregar gasto fijo quincenal" size="sm">
        <FixedExpenseForm
          categories={categories}
          onSuccess={handleSuccess}
          onCancel={() => setModalOpen(false)}
        />
      </Modal>
    </div>
  )
}
