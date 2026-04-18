'use client'

import { useState, useCallback } from 'react'
import { Plus, HandCoins, ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Deuda, DeudaPago } from '@/lib/types/database'
import { DeudaForm } from '@/components/deudas/DeudaForm'
import { DeudaList } from '@/components/deudas/DeudaList'
import { Modal } from '@/components/ui/Modal'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { formatHNL } from '@/lib/utils/currency'

interface Props {
  initialDeudas: Deuda[]
  initialPagos: DeudaPago[]
}

type Tab = 'deudas' | 'prestamos'

export default function DeudasClientPage({ initialDeudas, initialPagos }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('deudas')
  const [modalOpen, setModalOpen] = useState(false)

  const handleChanged = useCallback(() => {
    setModalOpen(false)
    router.refresh()
  }, [router])

  const activas = initialDeudas.filter(d => d.estado === 'activa')
  const totalDeudas = activas
    .filter(d => d.tipo === 'deuda')
    .reduce((s, d) => s + (d.monto_total - d.monto_pagado), 0)
  const totalPrestamos = activas
    .filter(d => d.tipo === 'prestamo')
    .reduce((s, d) => s + (d.monto_total - d.monto_pagado), 0)

  const countDeudas = initialDeudas.filter(d => d.tipo === 'deuda').length
  const countPrestamos = initialDeudas.filter(d => d.tipo === 'prestamo').length

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Deudas y Préstamos</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
            {countDeudas} deuda{countDeudas !== 1 ? 's' : ''} · {countPrestamos} préstamo{countPrestamos !== 1 ? 's' : ''}
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
          <div className="flex items-center gap-2 mb-1">
            <ArrowDownLeft className="h-4 w-4 text-red-500" />
            <p className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">Yo debo</p>
          </div>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">{formatHNL(totalDeudas)}</p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">pendiente total</p>
        </Card>
        <Card>
          <div className="flex items-center gap-2 mb-1">
            <ArrowUpRight className="h-4 w-4 text-emerald-500" />
            <p className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">Me deben</p>
          </div>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatHNL(totalPrestamos)}</p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">pendiente total</p>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-gray-100 dark:bg-slate-800 p-1">
        <button
          onClick={() => setTab('deudas')}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
            tab === 'deudas'
              ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 shadow-sm'
              : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
          }`}
        >
          Mis deudas
        </button>
        <button
          onClick={() => setTab('prestamos')}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
            tab === 'prestamos'
              ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 shadow-sm'
              : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
          }`}
        >
          Mis préstamos
        </button>
      </div>

      {/* Lista */}
      {initialDeudas.length === 0 ? (
        <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/40 px-4 py-3 text-sm text-blue-800 dark:text-blue-300 flex items-start gap-3">
          <HandCoins className="h-5 w-5 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
          <p>
            Registra tus deudas y préstamos para llevar un control de cuánto debes y cuánto te deben,
            con historial de pagos y fechas de vencimiento.
          </p>
        </div>
      ) : (
        <Card padding="none">
          <div className="px-6 py-4">
            <DeudaList
              deudas={initialDeudas}
              pagos={initialPagos}
              tipo={tab === 'deudas' ? 'deuda' : 'prestamo'}
              onChanged={() => router.refresh()}
            />
          </div>
        </Card>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nuevo registro" size="sm">
        <DeudaForm onSuccess={handleChanged} onCancel={() => setModalOpen(false)} />
      </Modal>
    </div>
  )
}
