'use client'

import { useState, useMemo } from 'react'
import {
  ChevronLeft, ChevronRight, TrendingUp, TrendingDown,
  PiggyBank, Sparkles, ArrowRight,
  CalendarDays,
} from 'lucide-react'
import Link from 'next/link'
import { formatHNL } from '@/lib/utils/currency'
import { formatDate, todayISO } from '@/lib/utils/dates'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'

// ─── Types ────────────────────────────────────────────────────────────────────

interface IncomeRaw {
  id: string
  monto: number
  fecha: string
  fuente: string
  ahorro_tipo: string
  ahorro_valor: number
  categories: { nombre: string; color: string } | null
}

interface ExpenseRaw {
  id: string
  monto: number
  fecha: string
  descripcion: string | null
  notas: string | null
  categories: { nombre: string; color: string } | null
}

interface AllocationRaw {
  id: string
  monto: number
  fecha: string
  income_entry_id: string | null
  notas: string | null
  savings_goals: { nombre: string; color: string | null } | null
}

interface Props {
  incomes: IncomeRaw[]
  expenses: ExpenseRaw[]
  allocations: AllocationRaw[]
}

// ─── Quincena builder ─────────────────────────────────────────────────────────

function buildQuincenas(
  incomes: IncomeRaw[],
  expenses: ExpenseRaw[],
  allocations: AllocationRaw[],
) {
  return incomes.map((income, i) => {
    const prevIncome = incomes[i - 1]
    const startDate = income.fecha
    const endDate = prevIncome ? prevIncome.fecha : todayISO()

    const periodExpenses = expenses.filter(
      e => e.fecha >= startDate && (i === 0 ? true : e.fecha < endDate),
    )
    const periodAllocations = allocations.filter(a =>
      a.income_entry_id === income.id ||
      (!a.income_entry_id && a.fecha >= startDate && (i === 0 ? true : a.fecha < endDate))
    )

    const totalGastos = periodExpenses.reduce((s, e) => s + e.monto, 0)
    const totalAhorros = periodAllocations.reduce((s, a) => s + a.monto, 0)
    const sobrante = income.monto - totalGastos - totalAhorros

    const byCategory: Record<string, { nombre: string; color: string; total: number }> = {}
    for (const e of periodExpenses) {
      const key = e.categories?.nombre || 'Sin categoría'
      if (!byCategory[key]) {
        byCategory[key] = { nombre: key, color: e.categories?.color || '#6B7280', total: 0 }
      }
      byCategory[key].total += e.monto
    }
    const categoriasGasto = Object.values(byCategory).sort((a, b) => b.total - a.total)

    return {
      income,
      startDate,
      endDate,
      isCurrent: i === 0,
      expenses: periodExpenses,
      allocations: periodAllocations,
      totalGastos,
      totalAhorros,
      sobrante,
      categoriasGasto,
    }
  })
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  prev,
}: {
  label: string
  value: number
  icon: React.ElementType
  color: string
  prev?: number
}) {
  const diff = prev !== undefined ? value - prev : null
  const pct = prev && prev > 0 ? Math.round(((value - prev) / prev) * 100) : null

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-slate-400">
        <Icon className={`h-3.5 w-3.5 ${color}`} />
        {label}
      </div>
      <p className={`font-bold text-base ${color.replace('-500', '-600').replace('-400', '-600')}`}>
        {formatHNL(Math.max(value, 0))}
      </p>
      {diff !== null && pct !== null && prev !== 0 && (
        <p className={`text-xs ${diff > 0 ? 'text-red-400' : 'text-emerald-500'}`}>
          {diff > 0 ? '+' : ''}{pct}% vs anterior
        </p>
      )}
    </div>
  )
}

// ─── Barra de distribución ────────────────────────────────────────────────────

function DistribucionBar({
  ingreso, gastos, ahorros, sobrante,
}: { ingreso: number; gastos: number; ahorros: number; sobrante: number }) {
  if (ingreso <= 0) return null
  const pctGastos = Math.min((gastos / ingreso) * 100, 100)
  const pctAhorros = Math.min((ahorros / ingreso) * 100, Math.max(0, 100 - pctGastos))
  const pctSobrante = Math.max(0, (sobrante / ingreso) * 100)

  return (
    <div className="flex flex-col gap-2">
      <div className="h-3 w-full rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden flex">
        <div className="h-full bg-red-400 transition-all" style={{ width: `${pctGastos}%` }} />
        <div className="h-full bg-blue-400 transition-all" style={{ width: `${pctAhorros}%` }} />
        {sobrante > 0 && (
          <div className="h-full bg-violet-300 transition-all" style={{ width: `${pctSobrante}%` }} />
        )}
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-gray-500 dark:text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400 inline-block" />
          Gastos {Math.round(pctGastos)}%
        </span>
        {ahorros > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-400 inline-block" />
            Ahorros {Math.round(pctAhorros)}%
          </span>
        )}
        {sobrante > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-violet-300 inline-block" />
            Sobrante {Math.round(pctSobrante)}%
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Categorías breakdown ─────────────────────────────────────────────────────

function CategoriasBreakdown({
  categorias, total, onSelect,
}: {
  categorias: { nombre: string; color: string; total: number }[]
  total: number
  onSelect: (cat: { nombre: string; color: string; total: number }) => void
}) {
  if (categorias.length === 0) return null
  return (
    <div className="flex flex-col gap-1">
      {categorias.map(cat => {
        const pct = total > 0 ? Math.round((cat.total / total) * 100) : 0
        return (
          <button
            key={cat.nombre}
            onClick={() => onSelect(cat)}
            className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-gray-50 dark:hover:bg-slate-700/50 active:bg-gray-100 dark:active:bg-slate-700 transition-colors text-left w-full group"
          >
            <div className="flex items-center gap-2 w-32 shrink-0">
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
              <span className="text-sm text-gray-700 dark:text-slate-300 truncate group-hover:text-gray-900 dark:group-hover:text-slate-100">{cat.nombre}</span>
            </div>
            <div className="flex-1 h-2 rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, backgroundColor: cat.color }}
              />
            </div>
            <div className="flex items-center gap-2 w-28 justify-end shrink-0">
              <span className="text-xs text-gray-400 dark:text-slate-500">{pct}%</span>
              <span className="text-sm font-medium text-gray-800 dark:text-slate-100">{formatHNL(cat.total)}</span>
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ─── Lista de gastos ──────────────────────────────────────────────────────────

function GastosList({ expenses }: { expenses: ExpenseRaw[] }) {
  if (expenses.length === 0)
    return <p className="text-sm text-gray-400 dark:text-slate-500 text-center py-6">Sin gastos en esta quincena</p>

  return (
    <div className="flex flex-col divide-y divide-gray-50 dark:divide-slate-700">
      {expenses.map(e => (
        <div key={e.id} className="flex items-center gap-3 py-2.5">
          <div
            className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
            style={{
              backgroundColor: (e.categories?.color || '#6B7280') + '20',
              color: e.categories?.color || '#6B7280',
            }}
          >
            {(e.descripcion || e.categories?.nombre || 'G')[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 dark:text-slate-100 truncate">
              {e.descripcion || 'Sin descripción'}
            </p>
            <p className="text-xs text-gray-400 dark:text-slate-500">
              {e.categories?.nombre || 'Sin categoría'} · {formatDate(e.fecha)}
            </p>
          </div>
          <p className="text-sm font-semibold text-red-500 shrink-0">{formatHNL(e.monto)}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Lista de ahorros ─────────────────────────────────────────────────────────

function AhorrosList({ allocations }: { allocations: AllocationRaw[] }) {
  if (allocations.length === 0)
    return <p className="text-sm text-gray-400 dark:text-slate-500 text-center py-6">Sin ahorros en esta quincena</p>

  return (
    <div className="flex flex-col divide-y divide-gray-50 dark:divide-slate-700">
      {allocations.map(a => (
        <div key={a.id} className="flex items-center gap-3 py-2.5">
          <div
            className="h-8 w-8 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: (a.savings_goals?.color || '#3B82F6') + '20' }}
          >
            <PiggyBank className="h-4 w-4" style={{ color: a.savings_goals?.color || '#3B82F6' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 dark:text-slate-100 truncate">
              {a.savings_goals?.nombre || 'Ahorro general'}
            </p>
            <p className="text-xs text-gray-400 dark:text-slate-500">{a.notas || formatDate(a.fecha)}</p>
          </div>
          <p className="text-sm font-semibold text-blue-600 shrink-0">{formatHNL(a.monto)}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function QuincenaClientPage({ incomes, expenses, allocations }: Props) {
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [tab, setTab] = useState<'gastos' | 'ahorros'>('gastos')
  const [catModal, setCatModal] = useState<{ nombre: string; color: string; total: number } | null>(null)

  const quincenas = useMemo(
    () => buildQuincenas(incomes, expenses, allocations),
    [incomes, expenses, allocations],
  )

  if (quincenas.length === 0) {
    return (
      <div className="flex flex-col gap-6 max-w-2xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Resumen por Quincena</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">Historial detallado de cada periodo</p>
        </div>
        <Card>
          <div className="text-center py-10 text-gray-400 dark:text-slate-500">
            <CalendarDays className="h-10 w-10 mx-auto mb-3 text-gray-200 dark:text-slate-600" />
            <p className="text-base">No hay ingresos registrados</p>
            <p className="text-sm mt-1">Registra tu primer ingreso para ver el resumen</p>
            <Link href="/ingresos" className="mt-4 inline-flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400 hover:underline">
              Ir a Ingresos <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </Card>
      </div>
    )
  }

  const q = quincenas[selectedIdx]
  const prev = quincenas[selectedIdx + 1]
  const numQuincenas = quincenas.length

  return (
    <div className="flex flex-col gap-5 max-w-2xl mx-auto">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Resumen por Quincena</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
          {numQuincenas} periodo{numQuincenas !== 1 ? 's' : ''} registrado{numQuincenas !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Navegador */}
      <div className="flex items-center justify-between bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl px-4 py-3 shadow-sm">
        <button
          onClick={() => setSelectedIdx(i => i + 1)}
          disabled={selectedIdx >= numQuincenas - 1}
          className="p-1.5 rounded-lg text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <div className="text-center">
          <div className="flex items-center gap-2 justify-center">
            <p className="font-semibold text-gray-900 dark:text-slate-100">{q.income.fuente}</p>
            {q.isCurrent && <Badge variant="green">Actual</Badge>}
          </div>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
            <CalendarDays className="h-3 w-3 inline mr-1" />
            {formatDate(q.startDate)}
            {!q.isCurrent && ` → ${formatDate(q.endDate)}`}
          </p>
        </div>

        <button
          onClick={() => setSelectedIdx(i => i - 1)}
          disabled={selectedIdx <= 0}
          className="p-1.5 rounded-lg text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Stats */}
      <Card>
        <div className="grid grid-cols-4 gap-3 mb-4">
          <StatCard label="Recibido" value={q.income.monto} icon={TrendingUp} color="text-emerald-500" prev={prev?.income.monto} />
          <StatCard label="Gastado" value={q.totalGastos} icon={TrendingDown} color="text-red-500" prev={prev?.totalGastos} />
          <StatCard label="Ahorrado" value={q.totalAhorros} icon={PiggyBank} color="text-blue-500" prev={prev?.totalAhorros} />
          <StatCard label="Sobrante" value={Math.max(q.sobrante, 0)} icon={Sparkles} color="text-violet-500" prev={prev ? Math.max(prev.sobrante, 0) : undefined} />
        </div>

        <DistribucionBar
          ingreso={q.income.monto}
          gastos={q.totalGastos}
          ahorros={q.totalAhorros}
          sobrante={q.sobrante}
        />
      </Card>

      {/* Desglose por categoría */}
      {q.categoriasGasto.length > 0 && (
        <Card>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">
            Gastos por categoría
            <span className="ml-2 text-xs font-normal text-gray-400 dark:text-slate-500">Toca una para ver el detalle</span>
          </h3>
          <CategoriasBreakdown
            categorias={q.categoriasGasto}
            total={q.totalGastos}
            onSelect={cat => setCatModal(cat)}
          />
        </Card>
      )}

      {/* Modal detalle categoría */}
      {catModal && (
        <Modal
          open={!!catModal}
          onClose={() => setCatModal(null)}
          title={
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full inline-block shrink-0" style={{ backgroundColor: catModal.color }} />
              {catModal.nombre}
              <span className="text-sm font-normal text-gray-400 dark:text-slate-500 ml-1">{formatHNL(catModal.total)}</span>
            </span>
          }
          size="sm"
        >
          <GastosList
            expenses={q.expenses.filter(
              e => (e.categories?.nombre || 'Sin categoría') === catModal.nombre,
            )}
          />
        </Modal>
      )}

      {/* Tabs */}
      <Card padding="none">
        <div className="flex border-b border-gray-100 dark:border-slate-700">
          {(['gastos', 'ahorros'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3 text-sm font-medium transition-colors capitalize ${
                tab === t
                  ? 'text-emerald-700 dark:text-emerald-400 border-b-2 border-emerald-600 dark:border-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/10'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
              }`}
            >
              {t === 'gastos'
                ? `Gastos (${q.expenses.length})`
                : `Ahorros (${q.allocations.length})`}
            </button>
          ))}
        </div>

        <div className="px-5 py-2">
          {tab === 'gastos'
            ? <GastosList expenses={q.expenses} />
            : <AhorrosList allocations={q.allocations} />
          }
        </div>
      </Card>

    </div>
  )
}
