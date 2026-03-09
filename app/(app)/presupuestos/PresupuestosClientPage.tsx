'use client'

import { useState, useCallback } from 'react'
import { Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { BudgetWithSpent, Category } from '@/lib/types/database'
import { BudgetRow } from '@/components/presupuestos/BudgetRow'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { createClient } from '@/lib/supabase/client'
import { formatMonth } from '@/lib/utils/dates'

interface Props {
  budgets: BudgetWithSpent[]
  categories: Category[]
  mes: number
  anio: number
  userId: string
}

export default function PresupuestosClientPage({ budgets, categories, mes, anio, userId }: Props) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [newCat, setNewCat] = useState('')
  const [newLimit, setNewLimit] = useState('')
  const [loading, setLoading] = useState(false)

  const availableCategories = categories.filter(
    c => !budgets.find(b => b.category_id === c.id)
  )

  async function handleAddBudget() {
    if (!newCat || !newLimit) {
      toast.error('Completa todos los campos')
      return
    }
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.from('budgets').insert({
      user_id: userId,
      category_id: newCat,
      limite_mensual: parseFloat(newLimit),
      mes,
      anio,
    })
    if (error) {
      toast.error('Error al crear presupuesto')
    } else {
      toast.success('Presupuesto creado')
      setModalOpen(false)
      setNewCat('')
      setNewLimit('')
      router.refresh()
    }
    setLoading(false)
  }

  const handleChanged = useCallback(() => router.refresh(), [router])

  const totalPresupuesto = budgets.reduce((s, b) => s + b.limite_mensual, 0)
  const totalGastado = budgets.reduce((s, b) => s + b.gastado, 0)

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Presupuestos</h1>
          <p className="text-sm text-gray-500 mt-0.5 capitalize">{formatMonth(mes, anio)}</p>
        </div>
        {availableCategories.length > 0 && (
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" />
            Agregar categoría
          </Button>
        )}
      </div>

      {/* Resumen */}
      {budgets.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <Card padding="sm">
            <p className="text-xs text-gray-500">Total presupuesto</p>
            <p className="font-bold text-gray-900 mt-1">L {totalPresupuesto.toLocaleString('es-HN', { minimumFractionDigits: 2 })}</p>
          </Card>
          <Card padding="sm">
            <p className="text-xs text-gray-500">Total gastado</p>
            <p className="font-bold text-red-500 mt-1">L {totalGastado.toLocaleString('es-HN', { minimumFractionDigits: 2 })}</p>
          </Card>
          <Card padding="sm">
            <p className="text-xs text-gray-500">Disponible</p>
            <p className={`font-bold mt-1 ${totalPresupuesto - totalGastado < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
              L {(totalPresupuesto - totalGastado).toLocaleString('es-HN', { minimumFractionDigits: 2 })}
            </p>
          </Card>
        </div>
      )}

      <Card padding="none">
        {budgets.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-base">No hay presupuestos para este mes</p>
            <p className="text-sm mt-1">Agrega categorías para establecer límites de gasto</p>
          </div>
        ) : (
          <div className="px-6 divide-y divide-gray-50">
            {budgets.map(budget => (
              <BudgetRow key={budget.id} budget={budget} onChanged={handleChanged} />
            ))}
          </div>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Agregar presupuesto" size="sm">
        <div className="flex flex-col gap-4">
          <Select
            label="Categoría"
            placeholder="Seleccionar..."
            options={availableCategories.map(c => ({ value: c.id, label: c.nombre }))}
            value={newCat}
            onChange={e => setNewCat(e.target.value)}
          />
          <Input
            label="Límite mensual (L)"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={newLimit}
            onChange={e => setNewLimit(e.target.value)}
          />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)} className="flex-1">
              Cancelar
            </Button>
            <Button onClick={handleAddBudget} loading={loading} className="flex-1">
              Agregar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
