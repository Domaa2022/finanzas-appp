'use client'

import { useState, useCallback } from 'react'
import { Plus, CreditCard, AlertCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Subscription } from '@/lib/types/database'
import { SubscriptionForm } from '@/components/suscripciones/SubscriptionForm'
import { SubscriptionList } from '@/components/suscripciones/SubscriptionList'
import { Modal } from '@/components/ui/Modal'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { formatHNL } from '@/lib/utils/currency'

interface Props {
  initialSubs: Subscription[]
}

const FRECUENCIA_A_MESES: Record<string, number> = {
  semanal: 0.25,
  mensual: 1,
  trimestral: 3,
  anual: 12,
}

function calcularMensual(sub: Subscription): number {
  const factor = FRECUENCIA_A_MESES[sub.frecuencia] || 1
  return sub.monto / factor
}

function diasParaRenovar(fecha: string): number {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const renovacion = new Date(fecha + 'T00:00:00')
  return Math.ceil((renovacion.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
}

export default function SuscripcionesClientPage({ initialSubs }: Props) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)

  const handleSuccess = useCallback(() => {
    setModalOpen(false)
    router.refresh()
  }, [router])

  const activas = initialSubs.filter(s => s.estado === 'activa')
  const pausadas = initialSubs.filter(s => s.estado === 'pausada')

  const totalMensual = activas.reduce((sum, s) => sum + calcularMensual(s), 0)
  const totalAnual = totalMensual * 12

  // Próximas a vencer en 7 días
  const proximasVencer = activas.filter(s => {
    if (!s.fecha_renovacion) return false
    const dias = diasParaRenovar(s.fecha_renovacion)
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
          <p className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">Gasto mensual</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-slate-100 mt-1">{formatHNL(totalMensual)}</p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{activas.length} suscripción{activas.length !== 1 ? 'es' : ''} activa{activas.length !== 1 ? 's' : ''}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">Gasto anual</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-slate-100 mt-1">{formatHNL(totalAnual)}</p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">equivalente al año</p>
        </Card>
      </div>

      {/* Alerta de próximas a vencer */}
      {proximasVencer.length > 0 && (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/40 px-4 py-3 text-sm text-amber-800 dark:text-amber-300 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="font-medium">Próximas a cobrar</p>
            <ul className="mt-1 space-y-0.5">
              {proximasVencer.map(s => {
                const dias = diasParaRenovar(s.fecha_renovacion!)
                return (
                  <li key={s.id} className="text-amber-700 dark:text-amber-400">
                    <span className="font-medium">{s.nombre}</span> —{' '}
                    {dias === 0 ? 'hoy' : `en ${dias} día${dias !== 1 ? 's' : ''}`} ({formatHNL(s.monto)})
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
            Registra tus suscripciones a apps y servicios para ver cuánto gastas mensualmente
            y recibir recordatorios antes de cada cobro.
          </p>
        </div>
      )}

      {/* Lista */}
      <Card padding="none">
        <div className="px-6 py-4">
          <SubscriptionList items={initialSubs} onChanged={() => router.refresh()} />
        </div>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nueva suscripción" size="sm">
        <SubscriptionForm onSuccess={handleSuccess} onCancel={() => setModalOpen(false)} />
      </Modal>
    </div>
  )
}
