'use client'

import { useState } from 'react'
import { PiggyBank, ArrowRight, TrendingUp, TrendingDown, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatHNL } from '@/lib/utils/currency'
import { Button } from '@/components/ui/Button'

interface SobranteMesCardProps {
  ingresosMes: number
  gastosMes: number
  ahorroMes: number
  sobranteMes: number
  ultimoIngresoId: string | null
  hayMetas: boolean
}

export function SobranteMesCard({
  ingresosMes,
  gastosMes,
  ahorroMes,
  sobranteMes,
  ultimoIngresoId,
  hayMetas,
}: SobranteMesCardProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleAhorrar() {
    if (!ultimoIngresoId || sobranteMes <= 0) return
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.rpc('distribute_savings', {
      p_income_id: ultimoIngresoId,
      p_user_id: user.id,
      p_total_savings: sobranteMes,
    })

    if (error) {
      toast.error('Error al guardar sobrante')
    } else {
      toast.success(`${formatHNL(sobranteMes)} enviados a tus metas`)
      router.refresh()
    }
    setLoading(false)
  }

  const porcentajeGastos = ingresosMes > 0 ? Math.min((gastosMes / ingresosMes) * 100, 100) : 0
  const porcentajeAhorro = ingresosMes > 0 ? Math.min((ahorroMes / ingresosMes) * 100, 100 - porcentajeGastos) : 0
  const porcentajeSobrante = ingresosMes > 0 && sobranteMes > 0
    ? Math.min((sobranteMes / ingresosMes) * 100, 100 - porcentajeGastos - porcentajeAhorro)
    : 0

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">Resumen del mes</h2>
        <span className="text-xs text-gray-400">Sobrante disponible</span>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <TrendingUp className="h-3 w-3 text-emerald-500" />
            Ingresos
          </div>
          <p className="font-bold text-emerald-600 text-sm sm:text-base">{formatHNL(ingresosMes)}</p>
        </div>

        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <TrendingDown className="h-3 w-3 text-red-500" />
            Gastos
          </div>
          <p className="font-bold text-red-500 text-sm sm:text-base">{formatHNL(gastosMes)}</p>
        </div>

        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <PiggyBank className="h-3 w-3 text-blue-500" />
            Ahorrado
          </div>
          <p className="font-bold text-blue-600 text-sm sm:text-base">{formatHNL(ahorroMes)}</p>
        </div>

        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Sparkles className="h-3 w-3 text-violet-500" />
            Sobrante
          </div>
          <p className={`font-bold text-sm sm:text-base ${sobranteMes > 0 ? 'text-violet-600' : 'text-gray-400'}`}>
            {formatHNL(Math.max(sobranteMes, 0))}
          </p>
        </div>
      </div>

      {/* Barra visual */}
      {ingresosMes > 0 && (
        <div>
          <div className="h-2.5 w-full rounded-full bg-gray-100 overflow-hidden flex">
            <div className="h-full bg-red-400 transition-all" style={{ width: `${porcentajeGastos}%` }} />
            <div className="h-full bg-blue-400 transition-all" style={{ width: `${porcentajeAhorro}%` }} />
            {sobranteMes > 0 && (
              <div className="h-full bg-violet-300 transition-all" style={{ width: `${porcentajeSobrante}%` }} />
            )}
          </div>
          <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-gray-400">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-400 inline-block" /> Gastos</span>
            {ahorroMes > 0 && <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-400 inline-block" /> Ahorrado</span>}
            {sobranteMes > 0 && <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-violet-300 inline-block" /> Sobrante</span>}
          </div>
        </div>
      )}

      {/* Acción */}
      {sobranteMes <= 0 ? (
        <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-500">
          <PiggyBank className="h-4 w-4" />
          {ahorroMes > 0
            ? `Has ahorrado ${formatHNL(ahorroMes)} este mes`
            : 'Sin sobrante disponible este mes'}
        </div>
      ) : !hayMetas ? (
        <Link href="/ahorros" className="flex items-center gap-2 rounded-lg bg-yellow-50 px-3 py-2 text-sm text-yellow-700 hover:bg-yellow-100 transition-colors">
          <PiggyBank className="h-4 w-4" />
          Crea una meta de ahorro para guardar el sobrante
        </Link>
      ) : !ultimoIngresoId ? (
        <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-500">
          <PiggyBank className="h-4 w-4" />
          Registra un ingreso para poder ahorrar el sobrante
        </div>
      ) : (
        <Button onClick={handleAhorrar} loading={loading} className="w-full">
          <PiggyBank className="h-4 w-4" />
          Ahorrar sobrante del mes ({formatHNL(sobranteMes)})
          <ArrowRight className="h-4 w-4 ml-auto" />
        </Button>
      )}
    </div>
  )
}
