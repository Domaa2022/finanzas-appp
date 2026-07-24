'use client'

import { useState } from 'react'
import {
  PiggyBank, ReceiptText, ExternalLink, Sparkles,
  Clock, ChevronDown, ChevronUp,
} from 'lucide-react'
import { differenceInDays, addDays, format } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatHNL } from '@/lib/utils/currency'
import { todayISO } from '@/lib/utils/dates'
import { Button } from '@/components/ui/Button'
import { useRouter } from 'next/navigation'
import { FixedExpense, ScheduledSaving, SavingsGoal } from '@/lib/types/database'
import { DistribuirAhorroModal } from '@/components/ahorros/DistribuirAhorroModal'

// ─── Ciclo de pago ────────────────────────────────────────────────────────────

const CYCLE_DAYS: Record<string, number> = {
  diario: 1,
  semanal: 7,
  quincenal: 15,
  mensual: 30,
}

function getCycleInfo(fechaIngreso: string, frecuencia: string) {
  const cycleDays = CYCLE_DAYS[frecuencia] ?? 15
  const start = new Date(fechaIngreso + 'T12:00:00')
  const today = new Date(todayISO() + 'T12:00:00')
  const elapsed = Math.max(differenceInDays(today, start), 0)
  const remaining = cycleDays - elapsed
  const pct = Math.min(Math.max((elapsed / cycleDays) * 100, 0), 100)
  const nextPayment = addDays(start, cycleDays)
  const overdue = elapsed >= cycleDays
  return { elapsed, remaining, pct, nextPayment, overdue, cycleDays }
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface QuincenaCardProps {
  ultimoIngresoId: string
  ultimoIngresoMonto: number
  ultimoIngresoFecha: string
  ultimoIngresoFuente: string
  ultimoIngresoFrecuencia: string
  gastosDesdeIngreso: number
  gastoHoy: number
  ahorrosYaAplicados: number
  sobranteAhorrable: number
  yaAhorroSobrante: boolean
  hayMetas: boolean
  gastosFijos: FixedExpense[]
  gastosFijosAplicados: boolean
  ahorrosProgramados: ScheduledSaving[]
  ahorrosProgramadosAplicados: boolean
  metasActivas: SavingsGoal[]
}

export function QuincenaCard({
  ultimoIngresoId,
  ultimoIngresoMonto,
  ultimoIngresoFecha,
  ultimoIngresoFuente,
  ultimoIngresoFrecuencia,
  gastosDesdeIngreso,
  gastoHoy,
  ahorrosYaAplicados,
  sobranteAhorrable,
  gastosFijos,
  gastosFijosAplicados,
  ahorrosProgramados,
  ahorrosProgramadosAplicados,
  metasActivas,
}: QuincenaCardProps) {
  const router = useRouter()
  const [loadingFijos, setLoadingFijos] = useState(false)
  const [modalDistribuirOpen, setModalDistribuirOpen] = useState(false)
  const [ritmoExpanded, setRitmoExpanded] = useState(false)
  const [detallesExpanded, setDetallesExpanded] = useState(false)

  const totalFijos = gastosFijos.filter(f => f.activo).reduce((s, f) => s + f.monto, 0)
  const totalProgramado = ahorrosProgramados
    .filter(s => s.activo)
    .reduce((sum, s) => {
      const monto = s.tipo === 'porcentaje'
        ? (ultimoIngresoMonto * s.valor) / 100
        : s.valor
      return sum + monto
    }, 0)

  const sobrante = ultimoIngresoMonto - gastosDesdeIngreso - ahorrosYaAplicados
  const cycle = getCycleInfo(ultimoIngresoFecha, ultimoIngresoFrecuencia)

  const gastoDiario = cycle.elapsed > 0 ? Math.round(gastosDesdeIngreso / cycle.elapsed) : 0
  const proyeccionGasto = gastoDiario * cycle.cycleDays
  const sobranteProyectado = Math.max(ultimoIngresoMonto - proyeccionGasto - ahorrosYaAplicados, 0)

  // Presupuesto diario: reparte el sobrante entre los días que faltan para el
  // próximo pago. Si hoy gastas de más, el exceso sale del presupuesto de mañana
  // (el límite del día siguiente baja porque queda menos sobrante para más días).
  const diasParaPago = Math.max(cycle.remaining, 1)
  const sobranteInicioHoy = sobrante + gastoHoy            // sobrante antes de los gastos de hoy
  const limiteDiario = sobranteInicioHoy / diasParaPago
  const restanteHoy = Math.max(limiteDiario - gastoHoy, 0)
  const excesoHoy = Math.max(gastoHoy - limiteDiario, 0)
  const overBudget = gastoHoy > limiteDiario
  const pctGastoHoy = limiteDiario > 0 ? (gastoHoy / limiteDiario) * 100 : 0
  const fillPct = Math.min(pctGastoHoy, 100)
  const limiteManana = sobrante / Math.max(diasParaPago - 1, 1)
  const showDonut = !cycle.overdue && sobrante > 0
  const DONUT_CIRCUMFERENCE = 263.89

  async function handleAplicarFijos() {
    const activos = gastosFijos.filter(f => f.activo)
    if (activos.length === 0) return
    setLoadingFijos(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoadingFijos(false); return }

    const { data: gastosExistentes } = await supabase
      .from('expenses')
      .select('descripcion')
      .eq('user_id', user.id)
      .eq('notas', 'Gasto fijo quincenal')
      .gte('fecha', ultimoIngresoFecha)

    const yaAplicados = new Set((gastosExistentes || []).map(e => e.descripcion))
    const pendientes = activos.filter(f => !yaAplicados.has(f.nombre))

    if (pendientes.length === 0) {
      toast.info('Todos los gastos fijos ya están registrados este período')
      setLoadingFijos(false)
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
      const total = pendientes.reduce((s, f) => s + f.monto, 0)
      toast.success(`${pendientes.length} gastos fijos registrados (${formatHNL(total)})`)
      router.refresh()
    }
    setLoadingFijos(false)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className={`grid grid-cols-1 gap-4 ${showDonut ? 'lg:grid-cols-3' : ''}`}>

        {/* ── Encabezado + progreso del ciclo ── */}
        <div className={`relative overflow-hidden rounded-2xl px-5 pt-4 pb-4 bg-gradient-to-br from-indigo-600 to-indigo-500 text-white shadow-sm ${showDonut ? 'lg:col-span-2' : ''}`}>
          <div className="absolute -right-10 -top-14 h-48 w-48 rounded-full bg-white/10" />
          <div className="relative flex items-start justify-between gap-3 mb-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-100">Ciclo de quincena actual</p>
              <h2 className="text-lg font-bold mt-0.5" title={ultimoIngresoFuente}>
                {format(new Date(ultimoIngresoFecha + 'T12:00:00'), "d MMM", { locale: es })} → {format(cycle.nextPayment, "d MMM", { locale: es })}
              </h2>
            </div>

            <div className="text-right shrink-0">
              {cycle.overdue ? (
                <p className="text-xs font-medium text-indigo-100">Ciclo cerrado</p>
              ) : (
                <>
                  <p className="text-sm font-bold font-mono-nums">
                    Día {cycle.elapsed + 1}
                    <span className="text-xs font-normal text-indigo-100"> / {cycle.cycleDays}</span>
                  </p>
                  <p className="text-xs text-indigo-100">
                    {cycle.remaining <= 0
                      ? 'Último día'
                      : `${cycle.remaining} día${cycle.remaining !== 1 ? 's' : ''} restante${cycle.remaining !== 1 ? 's' : ''}`}
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Barra de progreso del ciclo */}
          <div className="relative flex flex-col gap-1.5">
            <div className="h-1.5 w-full rounded-full bg-white/25 overflow-hidden">
              <div
                className="h-full rounded-full bg-white transition-all"
                style={{ width: `${cycle.pct}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-indigo-100">
              <span>{Math.round(cycle.pct)}% del ciclo transcurrido</span>
              {!cycle.overdue && <span>Se renueva el {format(cycle.nextPayment, "d MMM", { locale: es })}</span>}
            </div>
          </div>

          {/* Ingreso / Gastado / Ahorrado / Sobrante ahorrable */}
          <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-white/20">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-100">Ingreso</p>
              <p className="text-sm sm:text-base font-bold font-mono-nums mt-0.5">{formatHNL(ultimoIngresoMonto)}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-100">Gastado</p>
              <p className="text-sm sm:text-base font-bold font-mono-nums mt-0.5">{formatHNL(gastosDesdeIngreso)}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-100">Ahorrado</p>
              <p className="text-sm sm:text-base font-bold font-mono-nums mt-0.5">{formatHNL(ahorrosYaAplicados)}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-100">Sobrante ahorrable</p>
              <p className="text-sm sm:text-base font-bold font-mono-nums mt-0.5">{formatHNL(Math.max(sobrante, 0))}</p>
            </div>
          </div>
        </div>

        {/* ── Presupuesto de hoy: dona morada ── */}
        {showDonut && (
          <div className="rounded-2xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm p-5 flex flex-col items-center justify-center text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500 mb-3 self-start">
              Presupuesto de hoy
            </p>
            <div className="relative h-36 w-36">
              <svg viewBox="0 0 120 120" className="h-36 w-36 -rotate-90">
                <circle cx="60" cy="60" r="42" fill="none" stroke="currentColor" strokeWidth="10" className="text-gray-100 dark:text-slate-700" />
                <circle
                  cx="60" cy="60" r="42" fill="none" strokeWidth="10" strokeLinecap="round"
                  stroke="currentColor"
                  className={overBudget ? 'text-rose-500' : 'text-indigo-500'}
                  strokeDasharray={`${(fillPct / 100) * DONUT_CIRCUMFERENCE} ${DONUT_CIRCUMFERENCE}`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center px-2">
                <p className={`text-base font-bold font-mono-nums ${overBudget ? 'text-rose-500' : 'text-indigo-600 dark:text-indigo-400'}`}>
                  {overBudget ? `−${formatHNL(excesoHoy)}` : formatHNL(restanteHoy)}
                </p>
                {!overBudget && (
                  <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5 text-center leading-tight">
                    disponible hoy
                  </p>
                )}
              </div>
            </div>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-3">
              Límite: {formatHNL(limiteDiario)}/día
            </p>
            {overBudget && (
              <p className="text-[11px] text-rose-500 mt-1">
                {diasParaPago > 1 ? `Nuevo límite mañana ~${formatHNL(limiteManana)}` : 'Último día del período'}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm overflow-hidden">

      {/* ── Ver más detalles ── */}
      <button
        onClick={() => setDetallesExpanded(v => !v)}
        className="flex w-full items-center justify-center gap-1.5 px-5 py-2 text-xs font-medium text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
      >
        {detallesExpanded ? 'Ocultar detalles del período' : 'Ver detalles del período'}
        {detallesExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>

      {/* ── Cuerpo ── */}
      {detallesExpanded && (
      <div className="px-5 pb-4 pt-1 flex flex-col gap-4 border-t border-gray-50 dark:border-slate-700/60">

        {/* Ritmo de gasto (solo si hay días transcurridos y hay gastos) */}
        {cycle.elapsed > 0 && gastosDesdeIngreso > 0 && !cycle.overdue && (
          <>
            <button
              onClick={() => setRitmoExpanded(v => !v)}
              className="flex items-center justify-between w-full rounded-xl bg-gray-50 dark:bg-slate-700/50 px-3 py-2.5 text-left hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-400 dark:text-slate-500 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-gray-700 dark:text-slate-300">
                    Ritmo: {formatHNL(gastoDiario)} / día
                  </p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">
                    Proyección al cierre: {formatHNL(proyeccionGasto)}
                  </p>
                </div>
              </div>
              {ritmoExpanded
                ? <ChevronUp className="h-4 w-4 text-gray-300 dark:text-slate-600" />
                : <ChevronDown className="h-4 w-4 text-gray-300 dark:text-slate-600" />}
            </button>

            {ritmoExpanded && (
              <div className="grid grid-cols-3 gap-2 -mt-2">
                {[
                  { label: 'Gasto / día', value: gastoDiario, color: 'text-red-500' },
                  { label: 'Proy. total', value: proyeccionGasto, color: 'text-amber-600' },
                  { label: 'Sobrante proy.', value: sobranteProyectado, color: 'text-violet-600' },
                ].map(item => (
                  <div key={item.label} className="rounded-xl bg-gray-50 dark:bg-slate-700/40 px-2.5 py-2 text-center">
                    <p className={`text-sm font-bold ${item.color}`}>{formatHNL(item.value)}</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{item.label}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Ahorros programados */}
        {ahorrosProgramados.filter(s => s.activo).length > 0 && (
          <div className="rounded-xl border border-blue-100 bg-blue-50 dark:bg-blue-900/10 dark:border-blue-800/30 p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles className="h-4 w-4 text-blue-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
                  Ahorro programado: {formatHNL(totalProgramado)}
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  {ahorrosProgramados.filter(s => s.activo).length} reglas ·{' '}
                  {ahorrosProgramadosAplicados
                    ? <span className="text-emerald-700 dark:text-emerald-400 font-medium">Ya aplicado</span>
                    : <span>Pendiente</span>
                  }
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {!ahorrosProgramadosAplicados && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setModalDistribuirOpen(true)}
                  className="border-blue-200 text-blue-700 hover:bg-blue-100 text-xs"
                >
                  Distribuir
                </Button>
              )}
              <Link href="/ahorro-programado" className="p-1 text-blue-400 hover:text-blue-600 transition-colors" title="Gestionar ahorros programados">
                <ExternalLink className="h-4 w-4" />
              </Link>
            </div>
          </div>
        )}

        {ahorrosProgramados.length === 0 && (
          <Link
            href="/ahorro-programado"
            className="flex items-center gap-2 rounded-xl border border-dashed border-gray-200 dark:border-slate-700 px-3 py-2 text-xs text-gray-400 dark:text-slate-500 hover:border-blue-200 hover:text-blue-600 transition-colors"
          >
            <Sparkles className="h-4 w-4" />
            Configura un ahorro programado
          </Link>
        )}

        {/* Gastos fijos */}
        {gastosFijos.filter(f => f.activo).length > 0 && (
          <div className="rounded-xl border border-amber-100 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-800/30 p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <ReceiptText className="h-4 w-4 text-amber-600 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  Gastos fijos: {formatHNL(totalFijos)}
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {gastosFijos.filter(f => f.activo).length} conceptos ·{' '}
                  {gastosFijosAplicados
                    ? <span className="text-emerald-700 dark:text-emerald-400 font-medium">Ya registrados</span>
                    : <span>Pendientes de este período</span>
                  }
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {!gastosFijosAplicados && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleAplicarFijos}
                  loading={loadingFijos}
                  className="border-amber-200 text-amber-700 hover:bg-amber-100 text-xs"
                >
                  Registrar
                </Button>
              )}
              <Link href="/gastos-fijos" className="p-1 text-amber-400 hover:text-amber-600 transition-colors">
                <ExternalLink className="h-4 w-4" />
              </Link>
            </div>
          </div>
        )}

        {/* El sobrante se envía al Fondo General al iniciar un nuevo período */}
        {sobranteAhorrable > 0.01 ? (
          <div className="flex items-start gap-2 rounded-xl bg-violet-50 dark:bg-violet-900/20 px-3 py-2.5 text-sm text-violet-700 dark:text-violet-300">
            <PiggyBank className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              Tu sobrante de <span className="font-semibold">{formatHNL(sobranteAhorrable)}</span> pasará
              al Fondo General cuando registres un nuevo período y lo fijes como actual.
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-xl bg-gray-50 dark:bg-slate-700/50 px-3 py-2.5 text-sm text-gray-500 dark:text-slate-400">
            <PiggyBank className="h-4 w-4" />
            {ahorrosYaAplicados > 0
              ? `Has ahorrado ${formatHNL(ahorrosYaAplicados)} este período`
              : 'Sin sobrante disponible este período'}
          </div>
        )}
      </div>
      )}
      </div>

      {/* Modal distribución */}
      <DistribuirAhorroModal
        open={modalDistribuirOpen}
        onClose={() => setModalDistribuirOpen(false)}
        totalAmount={totalProgramado}
        metasActivas={metasActivas}
        incomeId={ultimoIngresoId}
        onSuccess={() => router.refresh()}
      />
    </div>
  )
}
