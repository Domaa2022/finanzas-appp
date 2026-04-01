'use client'

import { useState } from 'react'
import { PiggyBank, TrendingDown, TrendingUp, ArrowRight, ReceiptText, ExternalLink, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatHNL } from '@/lib/utils/currency'
import { formatDate, todayISO } from '@/lib/utils/dates'
import { Button } from '@/components/ui/Button'
import { useRouter } from 'next/navigation'
import { FixedExpense, ScheduledSaving, SavingsGoal } from '@/lib/types/database'
import { DistribuirAhorroModal } from '@/components/ahorros/DistribuirAhorroModal'

interface QuincenaCardProps {
  ultimoIngresoId: string
  ultimoIngresoMonto: number
  ultimoIngresoFecha: string
  ultimoIngresoFuente: string
  gastosDesdeIngreso: number
  ahorrosYaAplicados: number
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
  gastosDesdeIngreso,
  ahorrosYaAplicados,
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

  async function handleAplicarFijos() {
    const activos = gastosFijos.filter(f => f.activo)
    if (activos.length === 0) return
    setLoadingFijos(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoadingFijos(false); return }

    // Gastos fijos ya registrados desde el último ingreso
    const { data: gastosExistentes } = await supabase
      .from('expenses')
      .select('descripcion')
      .eq('user_id', user.id)
      .eq('notas', 'Gasto fijo quincenal')
      .gte('fecha', ultimoIngresoFecha)

    const yaAplicados = new Set((gastosExistentes || []).map(e => e.descripcion))
    const pendientes = activos.filter(f => !yaAplicados.has(f.nombre))

    if (pendientes.length === 0) {
      toast.info('Todos los gastos fijos ya están registrados esta quincena')
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
    if (sobrante <= 0) {
      toast.error('No hay sobrante para ahorrar')
      return
    }
    setLoadingAhorro(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.rpc('distribute_savings', {
      p_income_id: ultimoIngresoId,
      p_user_id: user.id,
      p_total_savings: sobrante,
    })

    if (error) {
      toast.error('Error al guardar sobrante')
    } else {
      toast.success(`${formatHNL(sobrante)} guardados`)
      router.refresh()
    }
    setLoadingAhorro(false)
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm p-5 flex flex-col gap-4">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">Quincena actual</h2>
        <span className="text-xs text-gray-400 dark:text-slate-500">
          {ultimoIngresoFuente} · {formatDate(ultimoIngresoFecha)}
        </span>
      </div>

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
        </div>

        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-slate-400">
            <PiggyBank className="h-3 w-3 text-blue-500" />
            Ahorrado
          </div>
          <p className="font-bold text-blue-600 text-sm sm:text-base">{formatHNL(ahorrosYaAplicados)}</p>
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

      {/* Barra visual */}
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

      {/* Ahorros programados */}
      {ahorrosProgramados.filter(s => s.activo).length > 0 && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="h-4 w-4 text-blue-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-blue-800">
                Ahorro programado: {formatHNL(totalProgramado)}
              </p>
              <p className="text-xs text-blue-600">
                {ahorrosProgramados.filter(s => s.activo).length} reglas activas ·{' '}
                {ahorrosProgramadosAplicados
                  ? <span className="text-emerald-700 font-medium">Ya aplicado</span>
                  : <span>Pendiente de aplicar</span>
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
          Configura un ahorro programado quincenal
        </Link>
      )}

      {/* Gastos fijos */}
      {gastosFijos.filter(f => f.activo).length > 0 && (
        <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <ReceiptText className="h-4 w-4 text-amber-600 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-amber-800">
                Gastos fijos: {formatHNL(totalFijos)}
              </p>
              <p className="text-xs text-amber-600">
                {gastosFijos.filter(f => f.activo).length} conceptos ·{' '}
                {gastosFijosAplicados
                  ? <span className="text-emerald-700 font-medium">Ya registrados</span>
                  : <span>Pendientes de registrar</span>
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

      {/* Botón ahorrar sobrante */}
      {sobrante <= 0 ? (
        <div className="flex items-center gap-2 rounded-lg bg-gray-50 dark:bg-slate-700/50 px-3 py-2 text-sm text-gray-500 dark:text-slate-400">
          <PiggyBank className="h-4 w-4" />
          {ahorrosYaAplicados > 0
            ? `Has ahorrado ${formatHNL(ahorrosYaAplicados)} esta quincena`
            : 'Sin sobrante disponible esta quincena'}
        </div>
      ) : yaAhorroSobrante ? (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
          <PiggyBank className="h-4 w-4" />
          Todo el sobrante fue enviado a tus metas
        </div>
      ) : (
        <Button onClick={handleAhorrarSobrante} loading={loadingAhorro} className="w-full">
          <PiggyBank className="h-4 w-4" />
          Ahorrar sobrante ({formatHNL(sobrante)})
          <ArrowRight className="h-4 w-4 ml-auto" />
        </Button>
      )}

      {/* Modal de distribución manual */}
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
