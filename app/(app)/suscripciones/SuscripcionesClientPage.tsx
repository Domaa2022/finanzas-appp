'use client'

import { useState, useCallback } from 'react'
import { Plus, CreditCard, AlertCircle, PiggyBank } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Category, FixedExpense, FrecuenciaGastoFijo } from '@/lib/types/database'
import { SubscriptionForm } from '@/components/suscripciones/SubscriptionForm'
import { SubscriptionList } from '@/components/suscripciones/SubscriptionList'
import { Modal } from '@/components/ui/Modal'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { formatHNL } from '@/lib/utils/currency'

interface Props {
  initialSubs: FixedExpense[]
  categorias: Category[]
}

/**
 * Meses que dura un ciclo de cada frecuencia.
 * `variable` no tiene fecha, pero el motor le aparta medio monto por quincena
 * (ver cuota_quincenal_gasto_fijo en la migración 031), así que su ciclo
 * efectivo es de un mes. Tratarlo como "no estimable" lo hacía contar 0 y
 * hundía el total.
 */
const MESES_POR_CICLO: Record<FrecuenciaGastoFijo, number> = {
  semanal: 12 / 52,
  quincenal: 0.5,
  mensual: 1,
  trimestral: 3,
  anual: 12,
  variable: 1,
}

/** Costo mensual equivalente, prorrateando el ciclo. */
function costoMensual(sub: FixedExpense): number {
  return sub.monto / MESES_POR_CICLO[sub.frecuencia]
}

function diasParaRenovar(fecha: string): number {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const renovacion = new Date(fecha + 'T00:00:00')
  return Math.ceil((renovacion.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
}

/**
 * Lo que se apartará por este gasto en la próxima quincena.
 * Réplica exacta de `cuota_quincenal_gasto_fijo` (migración 031): lo que falte
 * repartido entre las quincenas que quedan, y 0 si el fondo ya está lleno.
 */
function cuotaQuincenal(sub: FixedExpense): number {
  const apartado = sub.fondo?.monto_actual ?? 0
  const falta = sub.monto - apartado
  if (falta <= 0.01) return 0

  if (sub.apartado_quincenal != null) return Math.min(sub.apartado_quincenal, falta)
  if (!sub.proximo_pago || sub.frecuencia === 'variable') return Math.min(sub.monto / 2, falta)

  const dias = Math.max(diasParaRenovar(sub.proximo_pago), 0)
  const quincenas = Math.max(Math.ceil(dias / 15), 1)
  return falta / quincenas
}

export default function SuscripcionesClientPage({ initialSubs, categorias }: Props) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)

  const handleSuccess = useCallback(() => {
    setModalOpen(false)
    router.refresh()
  }, [router])

  const activas = initialSubs.filter(s => s.activo)
  const pausadas = initialSubs.filter(s => !s.activo)

  const totalMensual = activas.reduce((sum, s) => sum + costoMensual(s), 0)
  const totalAnual = totalMensual * 12

  // Lo que realmente se te va en la próxima quincena. Baja a medida que los
  // fondos se llenan, así que no coincide con el costo mensual prorrateado.
  const totalPorQuincena = activas.reduce((sum, s) => sum + cuotaQuincenal(s), 0)

  // Cuánto hay ya guardado y cuánto suman los ciclos completos. Ojo: esta base
  // es el monto íntegro de cada gasto, no un prorrateo mensual.
  const totalApartado = activas.reduce((sum, s) => sum + (s.fondo?.monto_actual ?? 0), 0)
  const totalACubrir = activas.reduce((sum, s) => sum + s.monto, 0)
  const pctCubierto = totalACubrir > 0 ? Math.round((totalApartado / totalACubrir) * 100) : 0

  // Próximas a cobrar en 7 días
  const proximasVencer = activas.filter(s => {
    if (!s.proximo_pago) return false
    const dias = diasParaRenovar(s.proximo_pago)
    return dias >= 0 && dias <= 7
  })

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Suscripciones</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
            {activas.length} activa{activas.length !== 1 ? 's' : ''}
            {pausadas.length > 0 && ` · ${pausadas.length} pausada${pausadas.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" />
          Agregar
        </Button>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <p className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">Próxima quincena</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-slate-100 mt-1">{formatHNL(totalPorQuincena)}</p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
            se apartarán de tu quincena
          </p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">Ya apartado</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{formatHNL(totalApartado)}</p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
            {pctCubierto}% de {formatHNL(totalACubrir)} en fondos
          </p>
        </Card>
      </div>

      {/* Costo real prorrateado, en su propia línea para no confundirlo con lo
          que se aparta por quincena (que baja cuando los fondos se llenan). */}
      <div className="-mt-2 flex items-baseline justify-between px-1 text-sm">
        <span className="text-gray-500 dark:text-slate-400">Te cuestan en total</span>
        <span className="text-gray-700 dark:text-slate-300">
          <span className="font-semibold">{formatHNL(totalMensual)}</span>
          <span className="text-gray-400 dark:text-slate-500"> al mes · {formatHNL(totalAnual)} al año</span>
        </span>
      </div>

      {/* Cómo funciona */}
      {activas.length > 0 && (
        <div className="rounded-xl bg-violet-50 dark:bg-violet-900/20 border border-violet-100 dark:border-violet-800/40 px-4 py-3 text-sm text-violet-800 dark:text-violet-300 flex items-start gap-3">
          <PiggyBank className="h-5 w-5 shrink-0 mt-0.5 text-violet-600 dark:text-violet-400" />
          <p>
            Cada vez que fijás una quincena se aparta automáticamente lo que falte para
            cubrirlas. Cuando llega el día de cobro se pagan solas desde ese fondo — y si
            ya está lleno, deja de apartarse.
          </p>
        </div>
      )}

      {/* Alerta de próximas a cobrar */}
      {proximasVencer.length > 0 && (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/40 px-4 py-3 text-sm text-amber-800 dark:text-amber-300 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="font-medium">Próximas a cobrar</p>
            <ul className="mt-1 space-y-0.5">
              {proximasVencer.map(s => {
                const dias = diasParaRenovar(s.proximo_pago!)
                const apartado = s.fondo?.monto_actual ?? 0
                const falta = Math.max(s.monto - apartado, 0)
                return (
                  <li key={s.id} className="text-amber-700 dark:text-amber-400">
                    <span className="font-medium">{s.nombre}</span> —{' '}
                    {dias === 0 ? 'hoy' : `en ${dias} día${dias !== 1 ? 's' : ''}`} ({formatHNL(s.monto)})
                    {falta > 0.01 && (
                      <span className="text-amber-600 dark:text-amber-500">
                        {' · '}faltan {formatHNL(falta)} en el fondo
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      )}

      {/* Info */}
      {initialSubs.length === 0 && (
        <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/40 px-4 py-3 text-sm text-blue-800 dark:text-blue-300 flex items-start gap-3">
          <CreditCard className="h-5 w-5 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
          <p>
            Todo lo que pagás una vez al mes, al año o sin fecha fija va acá: apps,
            tarjetas, préstamos, seguros. La app irá apartando dinero cada quincena y
            los pagará solos el día del cobro. Lo que se paga completo en cada
            quincena va en Gastos fijos.
          </p>
        </div>
      )}

      {/* Lista */}
      <Card padding="none">
        <div className="px-6 py-4">
          <SubscriptionList items={initialSubs} categorias={categorias} onChanged={() => router.refresh()} />
        </div>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nueva suscripción" size="sm">
        <SubscriptionForm categorias={categorias} onSuccess={handleSuccess} onCancel={() => setModalOpen(false)} />
      </Modal>
    </div>
  )
}
