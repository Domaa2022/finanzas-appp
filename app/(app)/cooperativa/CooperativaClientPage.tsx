'use client'

import { useMemo, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Building2, TrendingUp, ArrowDownToLine, ArrowUpFromLine,
  Sparkles, ArrowLeftRight, Percent, CalendarClock, Trash2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { CooperativaCuenta, CooperativaMovimiento, IncomeEntry } from '@/lib/types/database'
import { formatHNL } from '@/lib/utils/currency'
import { formatDate } from '@/lib/utils/dates'
import {
  interesMensualProyectado, tasaAnualPara, rangosPara, nombreCuenta,
} from '@/lib/cooperativa/interes'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { MovimientoForm } from '@/components/cooperativa/MovimientoForm'
import { TransferirQuincenaForm } from '@/components/cooperativa/TransferirQuincenaForm'

interface Props {
  cuentas: CooperativaCuenta[]
  movimientos: CooperativaMovimiento[]
  incomes: IncomeEntry[]
}

const TIPO_LABEL: Record<CooperativaMovimiento['tipo'], string> = {
  deposito: 'Depósito',
  retiro: 'Retiro',
  interes: 'Intereses',
  transferencia_quincena: 'Desde quincena',
  ajuste: 'Ajuste',
}

const TIPO_ICON: Record<CooperativaMovimiento['tipo'], React.ElementType> = {
  deposito: ArrowDownToLine,
  retiro: ArrowUpFromLine,
  interes: Sparkles,
  transferencia_quincena: ArrowLeftRight,
  ajuste: Percent,
}

export default function CooperativaClientPage({ cuentas, movimientos, incomes }: Props) {
  const router = useRouter()
  const [cuentaSel, setCuentaSel] = useState<string>(cuentas[0]?.id ?? '')
  const [movModal, setMovModal] = useState<CooperativaCuenta | null>(null)
  const [transferModal, setTransferModal] = useState<string | null>(null)

  const refresh = useCallback(() => {
    setMovModal(null)
    setTransferModal(null)
    router.refresh()
  }, [router])

  const aportaciones = cuentas.find(c => c.tipo === 'aportaciones')
  const retirable = cuentas.find(c => c.tipo === 'retirable')

  const saldoTotal = cuentas.reduce((s, c) => s + Number(c.saldo), 0)
  const interesProyectadoTotal = cuentas.reduce(
    (s, c) => s + interesMensualProyectado(c.tipo, Number(c.saldo)),
    0,
  )

  const movimientosCuenta = useMemo(
    () => movimientos.filter(m => m.cuenta_id === cuentaSel),
    [movimientos, cuentaSel],
  )

  const cuentaActiva = cuentas.find(c => c.id === cuentaSel)

  async function eliminarMovimiento(m: CooperativaMovimiento) {
    if (m.tipo === 'interes') {
      toast.error('Los intereses aplicados no se pueden borrar manualmente')
      return
    }
    if (!confirm('¿Eliminar este movimiento? Se ajustará el saldo.')) return

    const supabase = createClient()
    const { error } = await supabase.from('cooperativa_movimientos').delete().eq('id', m.id)
    if (error) toast.error(error.message)
    else { toast.success('Movimiento eliminado'); router.refresh() }
  }

  if (cuentas.length === 0) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <p className="text-center text-gray-500 dark:text-slate-400 py-10">
            No se encontraron cuentas de cooperativa. Recarga la página para inicializarlas.
          </p>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Cooperativa</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
            Aportaciones y Ahorro Retirable
          </p>
        </div>
        <Button onClick={() => setTransferModal('any')}>
          <ArrowLeftRight className="h-4 w-4" />
          Transferir desde quincena
        </Button>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="h-4 w-4 text-emerald-500" />
            <p className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">Saldo total</p>
          </div>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatHNL(saldoTotal)}</p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">en ambas cuentas</p>
        </Card>
        <Card>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-4 w-4 text-violet-500" />
            <p className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">Intereses este mes</p>
          </div>
          <p className="text-2xl font-bold text-violet-600 dark:text-violet-400">{formatHNL(interesProyectadoTotal)}</p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">proyección al cierre</p>
        </Card>
      </div>

      {/* Cuentas */}
      <div className="grid md:grid-cols-2 gap-4">
        {cuentas.map(c => (
          <CuentaCard
            key={c.id}
            cuenta={c}
            onDepositar={() => setMovModal(c)}
            onTransferir={() => setTransferModal(c.id)}
            onSeleccionar={() => setCuentaSel(c.id)}
            seleccionada={c.id === cuentaSel}
          />
        ))}
      </div>

      {/* Selector + historial */}
      <Card padding="none">
        <div className="flex border-b border-gray-100 dark:border-slate-700">
          {cuentas.map(c => (
            <button
              key={c.id}
              onClick={() => setCuentaSel(c.id)}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                cuentaSel === c.id
                  ? 'text-emerald-700 dark:text-emerald-400 border-b-2 border-emerald-600 dark:border-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/10'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
              }`}
            >
              {nombreCuenta(c.tipo)} ({movimientos.filter(m => m.cuenta_id === c.id).length})
            </button>
          ))}
        </div>

        <div className="px-5 py-3">
          {movimientosCuenta.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-slate-500 text-center py-8">
              Sin movimientos en esta cuenta
            </p>
          ) : (
            <div className="flex flex-col divide-y divide-gray-50 dark:divide-slate-700">
              {movimientosCuenta.map(m => {
                const Icon = TIPO_ICON[m.tipo]
                const positivo = m.monto >= 0
                return (
                  <div key={m.id} className="flex items-center gap-3 py-2.5 group">
                    <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${
                      m.tipo === 'interes'
                        ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400'
                        : positivo
                          ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                          : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                    }`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-slate-100 truncate">
                        {TIPO_LABEL[m.tipo]}
                        {m.mes_aplicado && <span className="text-gray-400 dark:text-slate-500 font-normal"> · {m.mes_aplicado}</span>}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-slate-500 truncate">
                        {m.descripcion || formatDate(m.fecha)}
                        {m.descripcion && ` · ${formatDate(m.fecha)}`}
                      </p>
                    </div>
                    <p className={`text-sm font-semibold shrink-0 ${
                      m.tipo === 'interes'
                        ? 'text-violet-600 dark:text-violet-400'
                        : positivo
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400'
                    }`}>
                      {positivo ? '+' : ''}{formatHNL(m.monto)}
                    </p>
                    {m.tipo !== 'interes' && (
                      <button
                        onClick={() => eliminarMovimiento(m)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30"
                        title="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </Card>

      {/* Tabla de rangos */}
      {cuentaActiva && (
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <Percent className="h-4 w-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300">
              Rangos de interés · {nombreCuenta(cuentaActiva.tipo)}
            </h3>
          </div>
          <RangosTabla tipo={cuentaActiva.tipo} saldoActual={Number(cuentaActiva.saldo)} />
        </Card>
      )}

      {/* Próxima aplicación */}
      <div className="rounded-xl bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 px-4 py-3 text-xs text-gray-500 dark:text-slate-400 flex items-start gap-2">
        <CalendarClock className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
        <p>
          Los intereses proyectados se ingresan automáticamente al cierre del mes la próxima vez que abras esta página.
          El cálculo usa el saldo al último día del mes y la tasa de su rango, dividida entre 12.
        </p>
      </div>

      {/* Modales */}
      <Modal
        open={!!movModal}
        onClose={() => setMovModal(null)}
        title={movModal ? `Movimiento · ${nombreCuenta(movModal.tipo)}` : ''}
        size="sm"
      >
        {movModal && (
          <MovimientoForm cuenta={movModal} onSuccess={refresh} onCancel={() => setMovModal(null)} />
        )}
      </Modal>

      <Modal
        open={!!transferModal}
        onClose={() => setTransferModal(null)}
        title="Transferir desde la quincena"
        size="sm"
      >
        {transferModal && (
          <TransferirQuincenaForm
            cuentas={cuentas}
            incomes={incomes}
            cuentaPreseleccionada={transferModal === 'any' ? undefined : transferModal}
            onSuccess={refresh}
            onCancel={() => setTransferModal(null)}
          />
        )}
      </Modal>
    </div>
  )

  // ─── subcomponentes ──────────────────────────────────────────────────────
  function CuentaCard({
    cuenta, onDepositar, onTransferir, onSeleccionar, seleccionada,
  }: {
    cuenta: CooperativaCuenta
    onDepositar: () => void
    onTransferir: () => void
    onSeleccionar: () => void
    seleccionada: boolean
  }) {
    const saldo = Number(cuenta.saldo)
    const tasa = tasaAnualPara(cuenta.tipo, saldo)
    const interes = interesMensualProyectado(cuenta.tipo, saldo)

    return (
      <Card
        className={`cursor-pointer transition ${
          seleccionada ? 'ring-2 ring-emerald-500' : ''
        }`}
        onClick={onSeleccionar}
      >
        <div className="flex items-start justify-between mb-2">
          <div>
            <p className="text-xs uppercase tracking-wide font-medium text-gray-500 dark:text-slate-400">
              {nombreCuenta(cuenta.tipo)}
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-slate-100 mt-1">{formatHNL(saldo)}</p>
          </div>
          <Badge variant={cuenta.tipo === 'aportaciones' ? 'green' : 'blue'}>
            {(tasa * 100).toFixed(2)}% anual
          </Badge>
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-300 mb-3">
          <TrendingUp className="h-4 w-4 text-violet-500" />
          Interés este mes: <span className="font-semibold text-violet-600 dark:text-violet-400">{formatHNL(interes)}</span>
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            className="flex-1"
            onClick={e => { e.stopPropagation(); onDepositar() }}
          >
            <ArrowDownToLine className="h-3.5 w-3.5" />
            Movimiento
          </Button>
          <Button
            size="sm"
            className="flex-1"
            onClick={e => { e.stopPropagation(); onTransferir() }}
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
            Quincena
          </Button>
        </div>
      </Card>
    )
  }
}

function RangosTabla({ tipo, saldoActual }: { tipo: CooperativaCuenta['tipo']; saldoActual: number }) {
  const rangos = rangosPara(tipo)
  return (
    <div className="text-sm">
      <div className="grid grid-cols-2 text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-slate-500 border-b border-gray-100 dark:border-slate-700 py-2">
        <span>Rango</span>
        <span className="text-right">Tasa</span>
      </div>
      {rangos.map((r, i) => {
        const dentro =
          saldoActual >= r.desde && (r.hasta === null || saldoActual <= r.hasta)
        return (
          <div
            key={i}
            className={`grid grid-cols-2 py-2 border-b border-gray-50 dark:border-slate-700/60 last:border-0 ${
              dentro ? 'bg-emerald-50/60 dark:bg-emerald-900/10 rounded-lg px-2 -mx-2 font-semibold' : ''
            }`}
          >
            <span className="text-gray-700 dark:text-slate-300">
              {r.hasta === null
                ? `De ${formatHNL(r.desde)} en adelante`
                : `${formatHNL(r.desde)} – ${formatHNL(r.hasta)}`}
            </span>
            <span className="text-right text-gray-700 dark:text-slate-300">
              {(r.tasa * 100).toFixed(2)}%
            </span>
          </div>
        )
      })}
    </div>
  )
}
