'use client'

import { useState, useCallback } from 'react'
import { Plus, ReceiptText, PiggyBank } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { FixedExpense, Category } from '@/lib/types/database'
import { FixedExpenseForm } from '@/components/gastos-fijos/FixedExpenseForm'
import { FixedExpenseList } from '@/components/gastos-fijos/FixedExpenseList'
import { FixedExpenseMonthlyCard } from '@/components/gastos-fijos/FixedExpenseMonthlyCard'
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

  const quincenales = initialFixed.filter(f => f.frecuencia !== 'mensual')
  const mensuales = initialFixed.filter(f => f.frecuencia === 'mensual')

  const quincenalesActivos = quincenales.filter(f => f.activo)
  const mensualesActivos = mensuales.filter(f => f.activo)

  // Lo quincenal puro (se registra completo al recibir el pago)
  const totalQuincenal = quincenalesActivos.reduce((s, f) => s + f.monto, 0)
  // La mitad de cada pago mensual es lo que apartas por quincena
  const totalMensualPorQuincena = mensualesActivos.reduce((s, f) => s + f.monto / 2, 0)
  // Lo que realmente se va de cada quincena
  const totalPorQuincena = totalQuincenal + totalMensualPorQuincena

  // Registrar solo los gastos fijos quincenales que aún no se aplicaron esta quincena
  async function handleAplicar() {
    if (quincenalesActivos.length === 0) {
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

    const pendientes = quincenalesActivos.filter(f => !yaAplicados.has(f.nombre))

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
            {totalMensualPorQuincena > 0 && (
              <span className="text-xs text-gray-400 dark:text-slate-500">
                {' '}(incluye {formatHNL(totalMensualPorQuincena)} de mensuales)
              </span>
            )}
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" />
          Agregar
        </Button>
      </div>

      {/* ─── Mensuales con ahorro ─── */}
      <section className="flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <PiggyBank className="h-4 w-4 text-violet-500" />
          <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">Pagos mensuales</h2>
          {mensuales.length > 0 && (
            <span className="text-xs text-gray-400 dark:text-slate-500">· apartas la mitad cada quincena</span>
          )}
        </div>

        {mensuales.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 dark:border-slate-700 px-4 py-4 text-center text-sm text-gray-400 dark:text-slate-500">
            Gastos que pagas una vez al mes y vas ahorrando entre quincenas. Agrégalos con el tipo "Mensual".
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {mensuales.map(item => (
              <FixedExpenseMonthlyCard key={item.id} item={item} onChanged={() => router.refresh()} />
            ))}
          </div>
        )}
      </section>

      {/* ─── Quincenales ─── */}
      <section className="flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <ReceiptText className="h-4 w-4 text-amber-500" />
          <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">Quincenales</h2>
          <span className="text-xs text-gray-400 dark:text-slate-500">· se registran al recibir tu pago</span>
        </div>

        {quincenalesActivos.length > 0 && (
          <Button
            variant="secondary"
            onClick={handleAplicar}
            loading={applying}
            className="w-full border-amber-200 text-amber-700 hover:bg-amber-50"
          >
            <ReceiptText className="h-4 w-4" />
            Registrar {quincenalesActivos.length} gastos quincenales como gastos de hoy ({formatHNL(totalQuincenal)})
          </Button>
        )}

        <Card padding="none">
          <div className="px-6 py-4">
            <FixedExpenseList items={quincenales} onChanged={() => router.refresh()} />
          </div>
        </Card>
      </section>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Agregar gasto fijo" size="sm">
        <FixedExpenseForm
          categories={categories}
          onSuccess={handleSuccess}
          onCancel={() => setModalOpen(false)}
        />
      </Modal>
    </div>
  )
}
