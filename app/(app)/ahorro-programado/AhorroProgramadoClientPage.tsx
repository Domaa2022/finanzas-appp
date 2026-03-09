'use client'

import { useState, useCallback } from 'react'
import { Plus, Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { ScheduledSaving } from '@/lib/types/database'
import { ScheduledSavingForm } from '@/components/ahorro-programado/ScheduledSavingForm'
import { ScheduledSavingList } from '@/components/ahorro-programado/ScheduledSavingList'
import { Modal } from '@/components/ui/Modal'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { formatHNL } from '@/lib/utils/currency'

interface Props {
  initialScheduled: ScheduledSaving[]
  ultimoIngreso: number | null
}

export default function AhorroProgramadoClientPage({ initialScheduled, ultimoIngreso }: Props) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)

  const handleSuccess = useCallback(() => {
    setModalOpen(false)
    router.refresh()
  }, [router])

  const activos = initialScheduled.filter(s => s.activo)

  // Calcular total programado basado en el último ingreso
  const totalProgramado = ultimoIngreso
    ? activos.reduce((sum, s) => {
        const monto = s.tipo === 'porcentaje' ? (ultimoIngreso * s.valor) / 100 : s.valor
        return sum + monto
      }, 0)
    : null

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ahorro Programado</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {activos.length} reglas activas
            {totalProgramado !== null && ` · ${formatHNL(totalProgramado)} por quincena`}
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" />
          Agregar
        </Button>
      </div>

      {/* Info */}
      <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 text-sm text-blue-800 flex items-start gap-3">
        <Sparkles className="h-5 w-5 shrink-0 mt-0.5 text-blue-500" />
        <div>
          <p className="font-medium mb-1">¿Cómo funciona?</p>
          <p>Cada quincena cuando recibes tu pago, el Panel Principal te muestra un botón para aplicar estos ahorros antes de gastar. El monto se distribuye automáticamente entre tus metas activas según su prioridad. Lo que quede después es tu sobrante disponible.</p>
        </div>
      </div>

      {/* Preview basado en último ingreso */}
      {ultimoIngreso !== null && activos.length > 0 && (
        <div className="rounded-xl bg-white border border-blue-100 px-4 py-3">
          <p className="text-xs text-gray-500 mb-2">Basado en tu último ingreso de {formatHNL(ultimoIngreso)}</p>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Total a ahorrar automáticamente</span>
            <span className="font-bold text-blue-600">{formatHNL(totalProgramado ?? 0)}</span>
          </div>
          <div className="flex justify-between text-sm mt-1">
            <span className="text-gray-600">Disponible para gastar</span>
            <span className="font-semibold text-gray-700">{formatHNL(ultimoIngreso - (totalProgramado ?? 0))}</span>
          </div>
        </div>
      )}

      <Card padding="none">
        <div className="px-6 py-4">
          <ScheduledSavingList
            items={initialScheduled}
            ingresoReferencia={ultimoIngreso ?? undefined}
            onChanged={() => router.refresh()}
          />
        </div>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nuevo ahorro programado" size="sm">
        <ScheduledSavingForm onSuccess={handleSuccess} onCancel={() => setModalOpen(false)} />
      </Modal>
    </div>
  )
}
