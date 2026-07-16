'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Plus } from 'lucide-react'
import { IncomeEntry } from '@/lib/types/database'
import { IncomeForm } from '@/components/ingresos/IncomeForm'
import { IncomeList } from '@/components/ingresos/IncomeList'
import { Modal } from '@/components/ui/Modal'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { formatHNL } from '@/lib/utils/currency'
import { createClient } from '@/lib/supabase/client'

type Periodo = 'mes' | 'anio' | 'todo'

const PERIODO_LABEL: Record<Periodo, string> = {
  mes: 'Este mes',
  anio: 'Este año',
  todo: 'Todo',
}

function getStartDate(periodo: Periodo): string | null {
  const now = new Date()
  if (periodo === 'todo') return null
  if (periodo === 'mes') {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  }
  return `${now.getFullYear()}-01-01`
}

interface Props {
  initialIncomes: IncomeEntry[]
}

export default function IngresoClientPage({ initialIncomes }: Props) {
  const [modalOpen, setModalOpen] = useState(false)

  // La carga inicial del servidor solo trae "Este mes". Otros períodos se
  // piden bajo demanda a Supabase en vez de traer siempre todo el historial.
  const [incomes, setIncomes] = useState<IncomeEntry[]>(initialIncomes)
  const [periodo, setPeriodo] = useState<Periodo>('mes')
  const [loading, setLoading] = useState(false)
  const didMount = useRef(false)

  const fetchIncomes = useCallback(async (p: Periodo) => {
    const supabase = createClient()
    let query = supabase.from('income_entries').select('*').order('fecha', { ascending: false })
    const startDate = getStartDate(p)
    if (startDate) query = query.gte('fecha', startDate)

    setLoading(true)
    const { data } = await query
    setIncomes(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true
      return
    }
    fetchIncomes(periodo)
  }, [periodo, fetchIncomes])

  const handleSuccess = useCallback(() => {
    setModalOpen(false)
    fetchIncomes(periodo)
  }, [fetchIncomes, periodo])

  const totalMes = incomes
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Ingresos</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">Este mes: <span className="font-medium text-emerald-600">{formatHNL(totalMes)}</span></p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" />
          Registrar ingreso
        </Button>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {(Object.keys(PERIODO_LABEL) as Periodo[]).map(p => (
          <button
            key={p}
            onClick={() => setPeriodo(p)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              periodo === p
                ? 'bg-gray-900 dark:bg-slate-100 text-white dark:text-slate-900'
                : 'bg-white dark:bg-slate-800 text-gray-500 dark:text-slate-400 border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700'
            }`}
          >
            {PERIODO_LABEL[p]}
          </button>
        ))}
      </div>

      <Card padding="none">
        <div className="px-6 py-4">
          {loading ? (
            <p className="text-center py-8 text-sm text-gray-400 dark:text-slate-500">Cargando…</p>
          ) : (
            <IncomeList items={incomes} onDeleted={() => fetchIncomes(periodo)} />
          )}
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
