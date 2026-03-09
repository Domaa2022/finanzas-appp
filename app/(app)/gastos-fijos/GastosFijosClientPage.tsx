'use client'

import { useState, useCallback } from 'react'
import { Plus, ReceiptText } from 'lucide-react'
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

  const activos = initialFixed.filter(f => f.activo)
  const totalFijo = activos.reduce((s, f) => s + f.monto, 0)

  // Registrar todos los gastos fijos activos como gastos de hoy
  async function handleAplicar() {
    if (activos.length === 0) {
      toast.error('No hay gastos fijos activos')
      return
    }
    if (!confirm(`¿Registrar ${activos.length} gastos fijos por ${formatHNL(totalFijo)} con fecha de hoy?`)) return

    setApplying(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const today = todayISO()
    const rows = activos.map(f => ({
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
      toast.success(`${activos.length} gastos fijos registrados (${formatHNL(totalFijo)})`)
      router.refresh()
    }
    setApplying(false)
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gastos Fijos</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {activos.length} activos · Total quincenal:{' '}
            <span className="font-medium text-red-500">{formatHNL(totalFijo)}</span>
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" />
          Agregar
        </Button>
      </div>

      {/* Info de uso */}
      <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 text-sm text-amber-800 flex items-start gap-3">
        <ReceiptText className="h-5 w-5 shrink-0 mt-0.5 text-amber-600" />
        <p>
          Estos son tus gastos que se repiten cada quincena (renta, servicios, etc.).
          Cuando recibas tu pago, usa el botón <strong>"Registrar gastos fijos"</strong> para
          agregarlos todos de una vez como gastos del día.
        </p>
      </div>

      {/* Botón de aplicar */}
      {activos.length > 0 && (
        <Button
          variant="secondary"
          onClick={handleAplicar}
          loading={applying}
          className="w-full border-amber-200 text-amber-700 hover:bg-amber-50"
        >
          <ReceiptText className="h-4 w-4" />
          Registrar {activos.length} gastos fijos como gastos de hoy ({formatHNL(totalFijo)})
        </Button>
      )}

      <Card padding="none">
        <div className="px-6 py-4">
          <FixedExpenseList items={initialFixed} onChanged={() => router.refresh()} />
        </div>
      </Card>

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
