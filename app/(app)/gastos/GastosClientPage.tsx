'use client'

import { useState, useCallback } from 'react'
import { Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Expense, Category } from '@/lib/types/database'
import { ExpenseForm } from '@/components/gastos/ExpenseForm'
import { ExpenseList } from '@/components/gastos/ExpenseList'
import { Modal } from '@/components/ui/Modal'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { formatHNL } from '@/lib/utils/currency'

interface Props {
  initialExpenses: Expense[]
  categories: Category[]
}

export default function GastosClientPage({ initialExpenses, categories }: Props) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [filtroCategoria, setFiltroCategoria] = useState('')

  const handleSuccess = useCallback(() => {
    setModalOpen(false)
    router.refresh()
  }, [router])

  const gastosCategories = categories.filter(c => c.tipo === 'gasto')

  const filtered = initialExpenses.filter(e =>
    !filtroCategoria || e.category_id === filtroCategoria
  )

  const totalMes = initialExpenses
    .filter(e => {
      const d = new Date(e.fecha)
      const now = new Date()
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    .reduce((sum, e) => sum + e.monto, 0)

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gastos</h1>
          <p className="text-sm text-gray-500 mt-0.5">Este mes: <span className="font-medium text-red-500">{formatHNL(totalMes)}</span></p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" />
          Registrar gasto
        </Button>
      </div>

      {/* Filtros por categoría */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFiltroCategoria('')}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            filtroCategoria === ''
              ? 'bg-emerald-600 text-white'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          Todos
        </button>
        {gastosCategories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setFiltroCategoria(cat.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              filtroCategoria === cat.id
                ? 'text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
            style={filtroCategoria === cat.id ? { backgroundColor: cat.color || '#10B981' } : {}}
          >
            {cat.nombre}
          </button>
        ))}
      </div>

      <Card padding="none">
        <div className="px-6 py-4">
          <ExpenseList items={filtered} onDeleted={() => router.refresh()} />
        </div>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Registrar gasto">
        <ExpenseForm
          categories={categories}
          onSuccess={handleSuccess}
          onCancel={() => setModalOpen(false)}
        />
      </Modal>
    </div>
  )
}
