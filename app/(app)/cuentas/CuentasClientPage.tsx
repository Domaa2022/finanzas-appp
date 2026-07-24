'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Plus, ArrowLeftRight, Pencil, Trash2, Star, Wallet,
  PiggyBank, Building2, Landmark, ArrowRight, CreditCard,
} from 'lucide-react'
import { Cuenta, SaldoCuenta } from '@/lib/types/database'
import { formatHNL } from '@/lib/utils/currency'
import { formatDate } from '@/lib/utils/dates'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { CuentaForm } from '@/components/cuentas/CuentaForm'
import { TransferForm } from '@/components/cuentas/TransferForm'
import { PagarTarjetaModal } from '@/components/cuentas/PagarTarjetaModal'

interface TransferenciaVista {
  id: string
  monto: number
  fecha: string
  notas: string | null
  origen: { nombre: string } | null
  destino: { nombre: string } | null
}

interface Props {
  saldos: SaldoCuenta[]
  cuentas: Cuenta[]
  transferencias: TransferenciaVista[]
  /** Ahorro vigente (metas activas/pausadas + fondos): resta del disponible y es ahorro. */
  ahorrosApartados: number
  /** Metas completadas: dinero ya gastado. Resta del disponible pero NO es ahorro. */
  apartadoCompletadas: number
}

function iconoTipo(tipo: string) {
  if (tipo === 'efectivo') return Wallet
  if (tipo === 'ahorro') return PiggyBank
  if (tipo === 'cooperativa') return Building2
  if (tipo === 'tarjeta') return CreditCard
  return Landmark
}

export default function CuentasClientPage({ saldos, cuentas, transferencias, ahorrosApartados, apartadoCompletadas }: Props) {
  const router = useRouter()
  const [formOpen, setFormOpen] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const [editing, setEditing] = useState<Cuenta | null>(null)
  const [pagandoTarjeta, setPagandoTarjeta] = useState<SaldoCuenta | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const refresh = useCallback(() => router.refresh(), [router])

  const handleFormSuccess = useCallback(() => {
    setFormOpen(false)
    setEditing(null)
    refresh()
  }, [refresh])

  // Solo las cuentas reales se pueden transferir/editar; la cooperativa es proyección.
  const cuentasReales = saldos.filter(s => s.origen === 'cuenta')
  // Cuentas líquidas: para transferir y para pagar tarjetas.
  const cuentasLiquidas = saldos.filter(s => s.es_disponible)
  const tarjetas = saldos.filter(s => s.tipo === 'tarjeta')
  const deudaTarjetas = tarjetas.reduce((sum, s) => sum + Math.max(-Number(s.saldo), 0), 0)

  // El dinero apartado en metas sigue físicamente en las cuentas líquidas, pero
  // no es gastable: se descuenta del disponible y se suma a lo ahorrado. Así los
  // dos cards reconcilian el patrimonio total y el disponible coincide con el
  // del dashboard (misma fórmula: Σ líquidas − ahorros apartados).
  const saldoLiquido = cuentasLiquidas.reduce((sum, s) => sum + Number(s.saldo), 0)
  // Ahorro real: cuentas no líquidas SIN tarjetas (una deuda no es ahorro).
  const saldoNoLiquido = saldos
    .filter(s => !s.es_disponible && s.tipo !== 'tarjeta')
    .reduce((sum, s) => sum + Number(s.saldo), 0)
  // Disponible descuenta todo lo apartado (vigente + ya gastado en metas cumplidas).
  // En ahorro solo suma lo vigente: las metas completadas ya no son ahorro.
  const disponible = saldoLiquido - ahorrosApartados - apartadoCompletadas
  const enAhorro = saldoNoLiquido + ahorrosApartados

  function openEdit(saldoId: string) {
    const cuenta = cuentas.find(c => c.id === saldoId)
    if (cuenta) { setEditing(cuenta); setFormOpen(true) }
  }

  function openNew() {
    setEditing(null)
    setFormOpen(true)
  }

  async function handleDelete(s: SaldoCuenta) {
    if (s.es_principal) {
      toast.error('No podés eliminar la cuenta principal. Marcá otra como principal primero.')
      return
    }
    if (!confirm(`¿Eliminar la cuenta "${s.nombre}"? Solo se puede si no tiene movimientos.`)) return

    setBusyId(s.id)
    const supabase = createClient()
    const { error } = await supabase.from('cuentas').delete().eq('id', s.id)
    if (error) {
      toast.error('No se pudo eliminar: la cuenta tiene movimientos asociados.')
    } else {
      toast.success('Cuenta eliminada')
      refresh()
    }
    setBusyId(null)
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Cuentas</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
            {cuentasReales.length} cuenta{cuentasReales.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {cuentasReales.length >= 2 && (
            <Button variant="secondary" onClick={() => setTransferOpen(true)}>
              <ArrowLeftRight className="h-4 w-4" />
              Transferir
            </Button>
          )}
          <Button onClick={openNew}>
            <Plus className="h-4 w-4" />
            Nueva cuenta
          </Button>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <p className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">Disponible</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-slate-100 mt-1">{formatHNL(disponible)}</p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">en cuentas de gasto</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">En ahorro</p>
          <p className="text-2xl font-bold text-violet-600 dark:text-violet-400 mt-1">{formatHNL(enAhorro)}</p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">metas, cuentas de ahorro y cooperativa</p>
        </Card>
      </div>

      {deudaTarjetas > 0.01 && (
        <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/40 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-red-500" />
            <span className="text-sm font-medium text-red-700 dark:text-red-300">Deuda en tarjetas</span>
          </div>
          <span className="text-lg font-bold text-red-600 dark:text-red-400">{formatHNL(deudaTarjetas)}</span>
        </div>
      )}

      {/* Lista de cuentas */}
      <Card padding="none">
        <div className="flex flex-col divide-y divide-gray-50 dark:divide-slate-700 px-6">
          {saldos.map(s => {
            const Icono = iconoTipo(s.tipo)
            const esCoop = s.origen === 'cooperativa'
            const esTarjeta = s.tipo === 'tarjeta'
            const raw = esTarjeta ? cuentas.find(c => c.id === s.id) : undefined
            const deuda = Math.max(-Number(s.saldo), 0)
            const creditoDisp = raw?.cupo != null ? raw.cupo - deuda : null

            // Subtítulo por tipo de cuenta
            const subtitulo = esTarjeta
              ? [
                  raw?.dia_corte ? `corte ${raw.dia_corte}` : null,
                  raw?.dia_pago ? `pago ${raw.dia_pago}` : null,
                ].filter(Boolean).join(' · ') || 'Tarjeta de crédito'
              : esCoop ? 'Cooperativa · gestión aparte'
              : s.es_disponible ? 'Cuenta de gasto' : 'No cuenta como disponible'

            return (
              <div key={s.id} className="flex items-center gap-3 py-3.5">
                <div
                  className="h-10 w-10 shrink-0 rounded-xl flex items-center justify-center text-white"
                  style={{ backgroundColor: s.color || (esCoop ? '#0EA5E9' : esTarjeta ? '#EF4444' : '#6B7280') }}
                >
                  <Icono className="h-5 w-5" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-gray-900 dark:text-slate-100 truncate">{s.nombre}</p>
                    {s.es_principal && (
                      <Badge variant="green"><Star className="h-3 w-3" /> Principal</Badge>
                    )}
                    {esTarjeta && <Badge variant="red">Tarjeta</Badge>}
                    {!s.es_disponible && !esCoop && !esTarjeta && <Badge variant="blue">Ahorro</Badge>}
                  </div>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{subtitulo}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {esTarjeta ? (
                    <div className="text-right">
                      <p className={`font-semibold text-sm ${deuda > 0.01 ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {deuda > 0.01 ? `Debés ${formatHNL(deuda)}` : 'Al día'}
                      </p>
                      {creditoDisp != null && (
                        <p className="text-xs text-gray-400 dark:text-slate-500">{formatHNL(creditoDisp)} de cupo</p>
                      )}
                    </div>
                  ) : (
                    <p className={`font-semibold text-sm ${Number(s.saldo) < 0 ? 'text-red-500' : 'text-gray-800 dark:text-slate-200'}`}>
                      {formatHNL(Number(s.saldo))}
                    </p>
                  )}

                  {esTarjeta && deuda > 0.01 && cuentasLiquidas.length > 0 && (
                    <button
                      onClick={() => setPagandoTarjeta(s)}
                      className="p-1.5 text-gray-300 dark:text-slate-600 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                      title="Pagar tarjeta"
                    >
                      <CreditCard className="h-4 w-4" />
                    </button>
                  )}

                  {!esCoop && (
                    <>
                      <button
                        onClick={() => openEdit(s.id)}
                        className="p-1.5 text-gray-300 dark:text-slate-600 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(s)}
                        disabled={busyId === s.id}
                        className="p-1.5 text-gray-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 transition-colors disabled:opacity-40"
                        title="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Transferencias recientes */}
      {transferencias.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">Transferencias recientes</h2>
          <Card padding="none">
            <div className="flex flex-col divide-y divide-gray-50 dark:divide-slate-700 px-6">
              {transferencias.map(t => (
                <div key={t.id} className="flex items-center gap-3 py-3">
                  <div className="h-8 w-8 shrink-0 rounded-lg bg-gray-100 dark:bg-slate-700 flex items-center justify-center">
                    <ArrowLeftRight className="h-4 w-4 text-gray-400 dark:text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 dark:text-slate-200 flex items-center gap-1.5 flex-wrap">
                      <span className="font-medium">{t.origen?.nombre ?? 'Cuenta'}</span>
                      <ArrowRight className="h-3 w-3 text-gray-400" />
                      <span className="font-medium">{t.destino?.nombre ?? 'Cuenta'}</span>
                    </p>
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                      {formatDate(t.fecha)}{t.notas ? ` · ${t.notas}` : ''}
                    </p>
                  </div>
                  <p className="font-semibold text-sm text-gray-700 dark:text-slate-300 shrink-0">{formatHNL(t.monto)}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null) }}
        title={editing ? 'Editar cuenta' : 'Nueva cuenta'}
        size="sm"
      >
        <CuentaForm
          initial={editing ?? undefined}
          onSuccess={handleFormSuccess}
          onCancel={() => { setFormOpen(false); setEditing(null) }}
        />
      </Modal>

      <Modal open={transferOpen} onClose={() => setTransferOpen(false)} title="Transferir entre cuentas" size="sm">
        <TransferForm
          cuentas={cuentasReales}
          onSuccess={() => { setTransferOpen(false); refresh() }}
          onCancel={() => setTransferOpen(false)}
        />
      </Modal>

      {pagandoTarjeta && (
        <PagarTarjetaModal
          open={!!pagandoTarjeta}
          onClose={() => setPagandoTarjeta(null)}
          tarjeta={pagandoTarjeta}
          cuentasLiquidas={cuentasLiquidas}
          onSuccess={() => { setPagandoTarjeta(null); refresh() }}
        />
      )}
    </div>
  )
}
