'use client'

import { useState, useMemo } from 'react'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import { CategoryBreakdown } from '@/components/reportes/CategoryBreakdown'
import { IncomeExpenseChart } from '@/components/dashboard/IncomeExpenseChart'
import { Card } from '@/components/ui/Card'
import { formatHNL } from '@/lib/utils/currency'
import { getMonthRange } from '@/lib/utils/dates'

type Periodo = '1m' | '3m' | '6m' | '12m'

interface Props {
  incomes: any[]
  expenses: any[]
  allocations: any[]
  currentMes: number
  currentAnio: number
}

const periodos: { value: Periodo; label: string; months: number }[] = [
  { value: '1m', label: 'Este mes', months: 1 },
  { value: '3m', label: 'Últimos 3 meses', months: 3 },
  { value: '6m', label: 'Últimos 6 meses', months: 6 },
  { value: '12m', label: 'Último año', months: 12 },
]

export default function ReportesClientPage({ incomes, expenses, allocations, currentMes, currentAnio }: Props) {
  const [periodo, setPeriodo] = useState<Periodo>('1m')
  const months = periodos.find(p => p.value === periodo)!.months

  const { start, end } = useMemo(() => {
    const endDate = endOfMonth(new Date(currentAnio, currentMes - 1, 1))
    const startDate = startOfMonth(subMonths(endDate, months - 1))
    return {
      start: format(startDate, 'yyyy-MM-dd'),
      end: format(endDate, 'yyyy-MM-dd'),
    }
  }, [periodo, currentMes, currentAnio, months])

  const filteredIncomes = incomes.filter(i => i.fecha >= start && i.fecha <= end)
  const filteredExpenses = expenses.filter(e => e.fecha >= start && e.fecha <= end)
  const filteredAllocations = allocations.filter(a => a.fecha >= start && a.fecha <= end)

  const totalIngresos = filteredIncomes.reduce((s, i) => s + i.monto, 0)
  const totalGastos = filteredExpenses.reduce((s, e) => s + e.monto, 0)
  const totalAhorros = filteredAllocations.reduce((s, a) => s + a.monto, 0)
  const balance = totalIngresos - totalGastos - totalAhorros

  // Agrupación por categoría para el donut
  const categoryData = useMemo(() => {
    const byCategory: Record<string, { nombre: string; monto: number; color: string }> = {}
    for (const exp of filteredExpenses) {
      const id = exp.category_id
      if (!byCategory[id]) {
        byCategory[id] = {
          nombre: exp.categories?.nombre || 'Sin categoría',
          monto: 0,
          color: exp.categories?.color || '#6B7280',
        }
      }
      byCategory[id].monto += exp.monto
    }
    return Object.values(byCategory).sort((a, b) => b.monto - a.monto)
  }, [filteredExpenses])

  // Datos del gráfico mes a mes
  const chartData = useMemo(() => {
    return Array.from({ length: months }, (_, i) => {
      const date = subMonths(new Date(currentAnio, currentMes - 1, 1), months - 1 - i)
      const mStart = format(startOfMonth(date), 'yyyy-MM-dd')
      const mEnd = format(endOfMonth(date), 'yyyy-MM-dd')
      const mesLabel = format(date, 'MMM', { locale: es })

      return {
        mes: mesLabel.charAt(0).toUpperCase() + mesLabel.slice(1),
        ingresos: incomes.filter(i => i.fecha >= mStart && i.fecha <= mEnd).reduce((s, i) => s + i.monto, 0),
        gastos: expenses.filter(e => e.fecha >= mStart && e.fecha <= mEnd).reduce((s, e) => s + e.monto, 0),
      }
    })
  }, [incomes, expenses, months, currentMes, currentAnio])

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>
          <p className="text-sm text-gray-500 mt-0.5">Análisis de tus finanzas</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {periodos.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriodo(p.value)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                periodo === p.value
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card padding="sm">
          <p className="text-xs text-gray-500">Ingresos</p>
          <p className="font-bold text-emerald-600 mt-1">{formatHNL(totalIngresos)}</p>
        </Card>
        <Card padding="sm">
          <p className="text-xs text-gray-500">Gastos</p>
          <p className="font-bold text-red-500 mt-1">{formatHNL(totalGastos)}</p>
        </Card>
        <Card padding="sm">
          <p className="text-xs text-gray-500">Ahorros</p>
          <p className="font-bold text-blue-600 mt-1">{formatHNL(totalAhorros)}</p>
        </Card>
        <Card padding="sm">
          <p className="text-xs text-gray-500">Balance</p>
          <p className={`font-bold mt-1 ${balance >= 0 ? 'text-gray-900' : 'text-red-600'}`}>{formatHNL(balance)}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h2 className="text-base font-semibold text-gray-900 mb-4">Ingresos vs Gastos</h2>
          <IncomeExpenseChart data={chartData} />
        </Card>

        <Card>
          <h2 className="text-base font-semibold text-gray-900 mb-4">Gastos por categoría</h2>
          <CategoryBreakdown data={categoryData} />
        </Card>
      </div>

      {/* Tabla de categorías */}
      {categoryData.length > 0 && (
        <Card>
          <h2 className="text-base font-semibold text-gray-900 mb-4">Detalle por categoría</h2>
          <div className="flex flex-col divide-y divide-gray-50">
            {categoryData.map(cat => {
              const pct = totalGastos > 0 ? Math.round((cat.monto / totalGastos) * 100) : 0
              return (
                <div key={cat.nombre} className="flex items-center gap-3 py-3">
                  <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                  <span className="flex-1 text-sm text-gray-700">{cat.nombre}</span>
                  <span className="text-xs text-gray-400">{pct}%</span>
                  <span className="font-medium text-sm text-gray-900">{formatHNL(cat.monto)}</span>
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}
