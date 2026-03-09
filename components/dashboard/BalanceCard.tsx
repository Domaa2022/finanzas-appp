import { TrendingUp, TrendingDown, PiggyBank, Wallet } from 'lucide-react'
import { formatHNL } from '@/lib/utils/currency'

interface BalanceCardProps {
  saldoTotal: number
  ingresosMes: number
  gastosMes: number
  ahorroMes: number
}

export function BalanceCard({ saldoTotal, ingresosMes, gastosMes, ahorroMes }: BalanceCardProps) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {/* Saldo total */}
      <div className="col-span-2 sm:col-span-1 bg-emerald-600 rounded-xl p-5 text-white">
        <div className="flex items-center gap-2 mb-1">
          <Wallet className="h-4 w-4 text-emerald-200" />
          <span className="text-sm text-emerald-100">Saldo total</span>
        </div>
        <p className="text-2xl font-bold">{formatHNL(saldoTotal)}</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="h-4 w-4 text-emerald-500" />
          <span className="text-xs text-gray-500">Ingresos del mes</span>
        </div>
        <p className="text-lg font-bold text-gray-900">{formatHNL(ingresosMes)}</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <div className="flex items-center gap-2 mb-1">
          <TrendingDown className="h-4 w-4 text-red-500" />
          <span className="text-xs text-gray-500">Gastos del mes</span>
        </div>
        <p className="text-lg font-bold text-red-500">{formatHNL(gastosMes)}</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <div className="flex items-center gap-2 mb-1">
          <PiggyBank className="h-4 w-4 text-blue-500" />
          <span className="text-xs text-gray-500">Ahorrado el mes</span>
        </div>
        <p className="text-lg font-bold text-blue-600">{formatHNL(ahorroMes)}</p>
      </div>
    </div>
  )
}
