'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { Plus, Search, X, ArrowUpDown, ChevronDown, CalendarRange, Camera } from 'lucide-react'
import { Expense, Category } from '@/lib/types/database'
import { ExpenseForm } from '@/components/gastos/ExpenseForm'
import { ExpenseList } from '@/components/gastos/ExpenseList'
import { GastoDesdeCaptura } from '@/components/gastos/GastoDesdeCaptura'
import { Modal } from '@/components/ui/Modal'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { formatHNL } from '@/lib/utils/currency'
import { createClient } from '@/lib/supabase/client'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Periodo = 'todo' | 'hoy' | 'semana' | 'mes' | 'anio' | 'custom'
type Orden = 'fecha_desc' | 'fecha_asc' | 'monto_desc' | 'monto_asc'

const PERIODO_LABEL: Record<Periodo, string> = {
  todo: 'Todo',
  hoy: 'Hoy',
  semana: 'Esta semana',
  mes: 'Este mes',
  anio: 'Este año',
  custom: 'Personalizado',
}

const ORDEN_LABEL: Record<Orden, string> = {
  fecha_desc: 'Más reciente',
  fecha_asc: 'Más antiguo',
  monto_desc: 'Mayor monto',
  monto_asc: 'Menor monto',
}

// ─── Utilidad de fechas ───────────────────────────────────────────────────────

function getStartDate(periodo: Periodo): string | null {
  const now = new Date()
  if (periodo === 'todo' || periodo === 'custom') return null
  if (periodo === 'hoy') return now.toISOString().slice(0, 10)
  if (periodo === 'semana') {
    const d = new Date(now)
    d.setDate(d.getDate() - d.getDay())
    return d.toISOString().slice(0, 10)
  }
  if (periodo === 'mes') {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  }
  if (periodo === 'anio') return `${now.getFullYear()}-01-01`
  return null
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  initialExpenses: Expense[]
  categories: Category[]
}

export default function GastosClientPage({ initialExpenses, categories }: Props) {
  const [modalOpen, setModalOpen] = useState(false)
  const [modalCapturaOpen, setModalCapturaOpen] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroPeriodo, setFiltroPeriodo] = useState<Periodo>('mes')
  const [customDesde, setCustomDesde] = useState('')
  const [customHasta, setCustomHasta] = useState('')
  const [orden, setOrden] = useState<Orden>('fecha_desc')
  const [ordenMenuOpen, setOrdenMenuOpen] = useState(false)

  // La carga inicial del servidor solo trae "Este mes" (el filtro por
  // defecto). Cuando el usuario pide un período distinto, se consulta ese
  // rango directamente a Supabase en vez de mandar siempre todo el
  // historial de gastos desde el servidor.
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses)
  const [loading, setLoading] = useState(false)
  const didMount = useRef(false)

  const fetchExpenses = useCallback(async (periodo: Periodo, desde: string, hasta: string) => {
    const supabase = createClient()
    let query = supabase.from('expenses').select('*, categories(*)').order('fecha', { ascending: false })
    const startDate = periodo === 'custom' ? (desde || null) : getStartDate(periodo)
    const endDate = periodo === 'custom' ? (hasta || null) : null
    if (startDate) query = query.gte('fecha', startDate)
    if (endDate) query = query.lte('fecha', endDate)

    setLoading(true)
    const { data } = await query
    setExpenses(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true
      return
    }
    fetchExpenses(filtroPeriodo, customDesde, customHasta)
  }, [filtroPeriodo, customDesde, customHasta, fetchExpenses])

  const handleSuccess = useCallback(() => {
    setModalOpen(false)
    fetchExpenses(filtroPeriodo, customDesde, customHasta)
  }, [fetchExpenses, filtroPeriodo, customDesde, customHasta])

  const handleSuccessCaptura = useCallback(() => {
    setModalCapturaOpen(false)
    fetchExpenses(filtroPeriodo, customDesde, customHasta)
  }, [fetchExpenses, filtroPeriodo, customDesde, customHasta])

  const gastosCategories = categories.filter(c => c.tipo === 'gasto')

  const filtered = useMemo(() => {
    const q = busqueda.toLowerCase().trim()

    let result = expenses.filter(e => {
      if (filtroCategoria && e.category_id !== filtroCategoria) return false
      if (q && !e.descripcion?.toLowerCase().includes(q) && !e.notas?.toLowerCase().includes(q)) return false
      return true
    })

    result = [...result].sort((a, b) => {
      if (orden === 'fecha_desc') return b.fecha.localeCompare(a.fecha)
      if (orden === 'fecha_asc') return a.fecha.localeCompare(b.fecha)
      if (orden === 'monto_desc') return b.monto - a.monto
      if (orden === 'monto_asc') return a.monto - b.monto
      return 0
    })

    return result
  }, [expenses, busqueda, filtroCategoria, orden])

  const totalFiltrado = filtered.reduce((s, e) => s + e.monto, 0)
  const hayFiltros = busqueda !== '' || filtroCategoria !== '' || filtroPeriodo !== 'mes'

  function limpiarFiltros() {
    setBusqueda('')
    setFiltroCategoria('')
    setFiltroPeriodo('mes')
    setCustomDesde('')
    setCustomHasta('')
    setOrden('fecha_desc')
  }

  function handlePeriodoChange(p: Periodo) {
    setFiltroPeriodo(p)
    // Al salir de personalizado, limpiar las fechas custom
    if (p !== 'custom') {
      setCustomDesde('')
      setCustomHasta('')
    }
  }

  return (
    <div className="flex flex-col gap-5 max-w-3xl mx-auto">

      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Gastos</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
            {loading ? (
              'Cargando…'
            ) : (
              <>
                {filtered.length} resultado{filtered.length !== 1 ? 's' : ''} ·{' '}
                <span className="font-medium text-red-500">{formatHNL(totalFiltrado)}</span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setModalCapturaOpen(true)}>
            <Camera className="h-4 w-4" />
            Desde captura
          </Button>
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" />
            Registrar gasto
          </Button>
        </div>
      </div>

      {/* ── Panel de filtros ── */}
      <div className="flex flex-col gap-3">

        {/* Fila 1: Búsqueda + Ordenar */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-300 dark:text-slate-600 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por descripción o nota..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              className="w-full pl-9 pr-9 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder-gray-300 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
            />
            {busqueda && (
              <button
                onClick={() => setBusqueda('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 dark:text-slate-600 hover:text-gray-500 dark:hover:text-slate-400"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Dropdown de orden */}
          <div className="relative">
            <button
              onClick={() => setOrdenMenuOpen(v => !v)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors whitespace-nowrap"
            >
              <ArrowUpDown className="h-3.5 w-3.5 text-gray-400 dark:text-slate-500" />
              {ORDEN_LABEL[orden]}
              <ChevronDown className="h-3.5 w-3.5 text-gray-300 dark:text-slate-600" />
            </button>
            {ordenMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setOrdenMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 w-40 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden">
                  {(Object.keys(ORDEN_LABEL) as Orden[]).map(o => (
                    <button
                      key={o}
                      onClick={() => { setOrden(o); setOrdenMenuOpen(false) }}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                        orden === o
                          ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 font-medium'
                          : 'text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700'
                      }`}
                    >
                      {ORDEN_LABEL[o]}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Fila 2: Período */}
        <div className="flex gap-1.5 flex-wrap">
          {(Object.keys(PERIODO_LABEL) as Periodo[]).map(p => (
            <button
              key={p}
              onClick={() => handlePeriodoChange(p)}
              className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filtroPeriodo === p
                  ? 'bg-gray-900 dark:bg-slate-100 text-white dark:text-slate-900'
                  : 'bg-white dark:bg-slate-800 text-gray-500 dark:text-slate-400 border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700'
              }`}
            >
              {p === 'custom' && <CalendarRange className="h-3 w-3" />}
              {PERIODO_LABEL[p]}
            </button>
          ))}
        </div>

        {/* Rango personalizado */}
        {filtroPeriodo === 'custom' && (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-xs text-gray-400 dark:text-slate-500">Desde</label>
                <input
                  type="date"
                  value={customDesde}
                  onChange={e => setCustomDesde(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
                />
              </div>
              <span className="text-gray-300 dark:text-slate-600 mt-5">→</span>
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-xs text-gray-400 dark:text-slate-500">Hasta</label>
                <input
                  type="date"
                  value={customHasta}
                  min={customDesde || undefined}
                  onChange={e => setCustomHasta(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
                />
              </div>
            </div>
            {(customDesde || customHasta) && (
              <button
                onClick={() => { setCustomDesde(''); setCustomHasta('') }}
                className="mt-5 text-xs text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 flex items-center gap-1"
              >
                <X className="h-3 w-3" /> Limpiar fechas
              </button>
            )}
          </div>
        )}

        {/* Fila 3: Categorías */}
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setFiltroCategoria('')}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filtroCategoria === ''
                ? 'bg-emerald-600 text-white'
                : 'bg-white dark:bg-slate-800 text-gray-500 dark:text-slate-400 border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700'
            }`}
          >
            Todas las categorías
          </button>
          {gastosCategories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setFiltroCategoria(filtroCategoria === cat.id ? '' : cat.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filtroCategoria === cat.id
                  ? 'text-white'
                  : 'bg-white dark:bg-slate-800 text-gray-500 dark:text-slate-400 border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700'
              }`}
              style={filtroCategoria === cat.id ? { backgroundColor: cat.color || '#10B981' } : {}}
            >
              {cat.nombre}
            </button>
          ))}
        </div>

        {/* Limpiar filtros */}
        {hayFiltros && (
          <button
            onClick={limpiarFiltros}
            className="self-start flex items-center gap-1 text-xs text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition-colors"
          >
            <X className="h-3 w-3" />
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Lista */}
      <Card padding="none">
        <div className="px-6 py-4">
          <ExpenseList items={filtered} onDeleted={() => fetchExpenses(filtroPeriodo, customDesde, customHasta)} />
        </div>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Registrar gasto">
        <ExpenseForm
          categories={categories}
          onSuccess={handleSuccess}
          onCancel={() => setModalOpen(false)}
        />
      </Modal>

      <Modal open={modalCapturaOpen} onClose={() => setModalCapturaOpen(false)} title="Registrar gasto desde captura">
        <GastoDesdeCaptura
          categories={categories}
          onSuccess={handleSuccessCaptura}
          onCancel={() => setModalCapturaOpen(false)}
        />
      </Modal>
    </div>
  )
}
