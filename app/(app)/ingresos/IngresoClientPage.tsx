'use client'

import { useState, useCallback } from 'react'
import { Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { IncomeEntry } from '@/lib/types/database'
import { IncomeForm } from '@/components/ingresos/IncomeForm'
import { IncomeList } from '@/components/ingresos/IncomeList'
import { Modal } from '@/components/ui/Modal'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { formatHNL } from '@/lib/utils/currency'

interface Props {
  initialIncomes: IncomeEntry[]
}

export default function IngresoClientPage({ initialIncomes }: Props) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)

  const handleSuccess = useCallback(() => {
    setModalOpen(false)
    router.refresh()
  }, [router])

  const totalMes = initialIncomes
    .filter(i => {
      const d = new Date(i.fecha)
      const now = new Date()
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    .reduce((sum, i) => sum + i.monto, 0)

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ingresos</h1>
          <p className="text-sm text-gray-500 mt-0.5">Este mes: <span className="font-medium text-emerald-600">{formatHNL(totalMes)}</span></p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" />
          Registrar ingreso
        </Button>
      </div>

      <Card padding="none">
        <div className="px-6 py-4">
          <IncomeList items={initialIncomes} onDeleted={() => router.refresh()} />
        </div>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Registrar ingreso">
        <IncomeForm
          onSuccess={handleSuccess}
          onCancel={() => setModalOpen(false)}
        />
      </Modal>
    </div>
  )
}
