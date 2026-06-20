'use client'

import { useState } from 'react'
import {
  PiggyBank, TrendingDown, TrendingUp, ArrowRight,
  ReceiptText, ExternalLink, Sparkles, CalendarClock,
  Clock, ChevronDown, ChevronUp, Pin, Wallet,
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

const FRECUENCIA_LABEL: Record<string, string> = {
  diario: 'Diario',
  semanal: 'Semanal',
  quincenal: 'Quincenal',
  mensual: 'Mensual',
}

function getCycleInfo(fechaIngreso: string, frecuencia: string) {
  const cycleDays = CYCLE_DAYS[frecuencia] ?? 15
  const start = new Date(fechaIngreso + 'T12:00:00')
  const today = new Date()
  today.setHours(12, 0, 0, 0)
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
  yaAhorroSobrante,
  gastosFijos,
  gastosFijosAplicados,
  ahorrosProgramados,
  ahorrosProgramadosAplicados,
  metasActivas,
}: QuincenaCardProps) {
  const router = useRouter()
  const [loadingAhorro, setLoadingAhorro] = useState(false)
  const [loadingFijos, setLoadingFijos] = useState(false)
  const [modalDistribuirOpen, setModalDistribuirOpen] = useState(false)
  const [ritmoExpanded, setRitmoExpanded] = useState(false)

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

  const cycleBarColor =
    cycle.overdue ? 'bg-gray-300 dark:bg-slate-600' :
    cycle.pct > 80 ? 'bg-amber-400' :
    'bg-emerald-400'

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
  const barColor = overBudget ? 'bg-red-500' : pctGastoHoy > 80 ? 'bg-amber-400' : 'bg-emerald-500'

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

  async function handleAhorrarSobrante() {
    if (sobranteAhorrable <= 0) { toast.error('No hay sobrante para ahorrar'); return }
    setLoadingAhorro(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.rpc('distribute_savings', {
      p_income_id: ultimoIngresoId,
      p_user_id: user.id,
      p_total_savings: sobranteAhorrable,
    })

    if (error) {
      toast.error('Error al guardar sobrante')
    } else {
      toast.success(`${formatHNL(sobranteAhorrable)} guardados`)
      router.refresh()
    }
    setLoadingAhorro(false)
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm overflow-hidden">

      {/* ── Encabezado + progreso del ciclo ── */}
      <div className="px-5 pt-4 pb-3 border-b border-gray-50 dark:border-slate-700/60">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">Período actual</h2>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                {FRECUENCIA_LABEL[ultimoIngresoFrecuencia] ?? ultimoIngresoFrecuencia}
              </span>
            </div>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5 flex items-center gap-1">
              <Pin className="h-3 w-3" />
              {ultimoIngresoFuente} · {format(new Date(ultimoIngresoFecha + 'T12:00:00'), "d MMM", { locale: es })}
            </p>
          </div>

          <div className="text-right shrink-0">
            {cycle.overdue ? (
              <p className="text-xs font-medium text-gray-400 dark:text-slate-500">Ciclo cerrado</p>
            ) : (
              <>
                <p className="text-sm font-bold text-gray-700 dark:text-slate-200">
                  Día {cycle.elapsed + 1}
                  <span className="text-xs font-normal text-gray-400 dark:text-slate-500"> / {cycle.cycleDays}</span>
                </p>
                <p className="text-xs text-gray-400 dark:text-slate-500">
                  {cycle.remaining <= 0
                    ? 'Último día'
                    : `${cycle.remaining} día${cycle.remaining !== 1 ? 's' : ''} restante${cycle.remaining !== 1 ? 's' : ''}`}
                </p>
              </>
            )}
          </div>
        </div>

        {/* Barra de progreso del ciclo */}
        <div className="flex flex-col gap-1.5">
          <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${cycleBarColor}`}
              style={{ width: `${cycle.pct}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-300 dark:text-slate-600">
            <span>{format(new Date(ultimoIngresoFecha + 'T12:00:00'), "d MMM", { locale: es })}</span>
            {!cycle.overdue && (
              <span className="flex items-center gap-1 text-gray-400 dark:text-slate-500">
                <CalendarClock className="h-3 w-3" />
                Próximo ~{format(cycle.nextPayment, "d MMM", { locale: es })}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Cuerpo ── */}
      <div className="px-5 py-4 flex flex-col gap-4">

        {/* Números */}
        <div className="grid grid-cols-4 gap-2 sm:gap-3">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-slate-400">
              <TrendingUp className="h-3 w-3 text-emerald-500" />
              Recibido
            </div>
            <p className="font-bold text-emerald-600 text-sm sm:text-base">{formatHNL(ultimoIngresoMonto)}</p>
          </div>

          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-slate-400">
              <TrendingDown className="h-3 w-3 text-red-500" />
              Gastado
            </div>
            <p className="font-bold text-red-500 text-sm sm:text-base">{formatHNL(gastosDesdeIngreso)}</p>
            {ultimoIngresoMonto > 0 && (
              <p className="text-xs text-gray-300 dark:text-slate-600">
                {Math.round((gastosDesdeIngreso / ultimoIngresoMonto) * 100)}%
              </p>
            )}
          </div>

          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-slate-400">
              <PiggyBank className="h-3 w-3 text-blue-500" />
              Ahorrado
            </div>
            <p className="font-bold text-blue-600 text-sm sm:text-base">{formatHNL(ahorrosYaAplicados)}</p>
            {ultimoIngresoMonto > 0 && (
              <p className="text-xs text-gray-300 dark:text-slate-600">
                {Math.round((ahorrosYaAplicados / ultimoIngresoMonto) * 100)}%
              </p>
            )}
          </div>

          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-slate-400">
              <Sparkles className="h-3 w-3 text-violet-500" />
              Sobrante
            </div>
            <p className={`font-bold text-sm sm:text-base ${sobrante > 0 ? 'text-violet-600' : 'text-gray-400 dark:text-slate-500'}`}>
              {formatHNL(Math.max(sobrante, 0))}
            </p>
          </div>
        </div>

        {/* Barra de distribución */}
        {ultimoIngresoMonto > 0 && (
          <div>
            <div className="h-2.5 w-full rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden flex">
              <div
                className="h-full bg-red-400 transition-all"
                style={{ width: `${Math.min((gastosDesdeIngreso / ultimoIngresoMonto) * 100, 100)}%` }}
              />
              <div
                className="h-full bg-blue-400 transition-all"
                style={{ width: `${Math.min((ahorrosYaAplicados / ultimoIngresoMonto) * 100, 100 - (gastosDesdeIngreso / ultimoIngresoMonto) * 100)}%` }}
              />
              {sobrante > 0 && (
                <div
                  className="h-full bg-violet-300 transition-all"
                  style={{ width: `${(sobrante / ultimoIngresoMonto) * 100}%` }}
                />
              )}
            </div>
            <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-gray-400 dark:text-slate-500">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-400 inline-block" /> Gastos</span>
              {ahorrosYaAplicados > 0 && <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-400 inline-block" /> Ahorrado</span>}
              {sobrante > 0 && <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-violet-300 inline-block" /> Sobrante</span>}
            </div>
          </div>
        )}

        {/* Presupuesto diario con barra de avance del gasto de hoy */}
        {!cycle.overdue && sobrante > 0 && (
          <div className={`rounded-xl border p-4 ${
            overBudget
              ? 'border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-800/30'
              : 'border-emerald-100 bg-emerald-50 dark:bg-emerald-900/10 dark:border-emerald-800/30'
          }`}>
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${
                  overBudget ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-emerald-100 dark:bg-emerald-900/30'
                }`}>
                  <Wallet className={`h-5 w-5 ${overBudget ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    {overBudget ? 'Te pasaste hoy' : 'Disponible para hoy'}
                  </p>
                  <p className={`text-2xl font-bold leading-tight ${
                    overBudget ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-300'
                  }`}>
                    {overBudget ? `−${formatHNL(excesoHoy)}` : formatHNL(restanteHoy)}
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold text-gray-700 dark:text-slate-200">{formatHNL(limiteDiario)}</p>
                <p className="text-xs text-gray-400 dark:text-slate-500">límite del día</p>
              </div>
            </div>

            {/* Barra de llenado del gasto de hoy */}
            <div className="h-2.5 w-full rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${barColor}`}
                style={{ width: `${fillPct}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-1.5 text-xs text-gray-400 dark:text-slate-500">
              <span>Gastado hoy: {formatHNL(gastoHoy)}</span>
              <span>{Math.round(pctGastoHoy)}%</span>
            </div>

            {/* Nota inferior */}
            {overBudget ? (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1">
                <CalendarClock className="h-3 w-3 shrink-0" />
                {diasParaPago > 1
                  ? `Usando el presupuesto de mañana — nuevo límite ~${formatHNL(limiteManana)}/día`
                  : 'Es el último día del período: te pasaste del presupuesto disponible'}
              </p>
            ) : (
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-2 flex items-center gap-1">
                <CalendarClock className="h-3 w-3 shrink-0" />
                {formatHNL(sobrante)} disponible · {diasParaPago} día{diasParaPago !== 1 ? 's' : ''} hasta el próximo pago
              </p>
            )}
          </div>
        )}

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
                    : <span>Pendientes</span>
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

        {/* CTA sobrante */}
        {!yaAhorroSobrante ? (
          <Button onClick={handleAhorrarSobrante} loading={loadingAhorro} className="w-full">
            <PiggyBank className="h-4 w-4" />
            Ahorrar sobrante ({formatHNL(sobranteAhorrable)})
            <ArrowRight className="h-4 w-4 ml-auto" />
          </Button>
        ) : sobrante > 0 ? (
          // Ya se distribuyó todo el ahorro; el sobrante restante proviene de
          // un apoyo del Fondo General y está disponible para gastar.
          <div className="flex items-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2.5 text-sm text-emerald-700 dark:text-emerald-400">
            <PiggyBank className="h-4 w-4" />
            Todo el sobrante fue enviado a tus metas
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
