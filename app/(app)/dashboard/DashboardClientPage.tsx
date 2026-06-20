'use client'

import Link from 'next/link'
import { Wallet } from 'lucide-react'
import { RecentTransaction, SavingsGoal, FixedExpense, ScheduledSaving } from '@/lib/types/database'
import { BalanceCard } from '@/components/dashboard/BalanceCard'
import { RecentTransactions } from '@/components/dashboard/RecentTransactions'
import { SavingsOverview } from '@/components/dashboard/SavingsOverview'
import { IncomeExpenseChart } from '@/components/dashboard/IncomeExpenseChart'
import { QuincenaCard } from '@/components/dashboard/QuincenaCard'
import { SobranteMesCard } from '@/components/dashboard/SobranteMesCard'
import { ProximosPagos, PagoMensual } from '@/components/dashboard/ProximosPagos'
import { Card } from '@/components/ui/Card'
import { formatHNL } from '@/lib/utils/currency'

interface QuincenaData {
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

interface Props {
  pagosMensuales: PagoMensual[]
  saldoTotal: number
  ingresosMes: number
  gastosMes: number
  ahorroMes: number
  sobranteMes: number
  ultimoIngresoId: string | null
  recentTransactions: RecentTransaction[]
  goals: SavingsGoal[]
  chartData: { mes: string; ingresos: number; gastos: number }[]
  quincenaData: QuincenaData | null
  cashBalance: number
}

export default function DashboardClientPage({
  pagosMensuales,
  saldoTotal,
  ingresosMes,
  gastosMes,
  ahorroMes,
  sobranteMes,
  ultimoIngresoId,
  recentTransactions,
  goals,
  chartData,
  quincenaData,
  cashBalance,
}: Props) {
  const hayMetas = goals.some((g: any) => g.estado === 'activa' && !g.es_general)

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Panel Principal</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">Resumen de tus finanzas</p>
      </div>

      <BalanceCard
        saldoTotal={saldoTotal}
        ingresosMes={ingresosMes}
        gastosMes={gastosMes}
        ahorroMes={ahorroMes}
      />

      <SobranteMesCard
        ingresosMes={ingresosMes}
        gastosMes={gastosMes}
        ahorroMes={ahorroMes}
        sobranteMes={sobranteMes}
        ultimoIngresoId={ultimoIngresoId}
        hayMetas={hayMetas}
      />

      {quincenaData ? (
        <QuincenaCard {...quincenaData} />
      ) : (
        <div className="rounded-xl border border-dashed border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 text-center text-sm text-gray-400 dark:text-slate-500">
          Registra tu primer ingreso para ver el resumen de tu último período
        </div>
      )}

      <ProximosPagos pagos={pagosMensuales} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-4">Ingresos vs Gastos</h2>
          <IncomeExpenseChart data={chartData} />
        </Card>

        <div className="flex flex-col gap-6">
          {/* Panel efectivo */}
          <Link href="/efectivo" className="block">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-5 text-white hover:opacity-95 transition-opacity cursor-pointer shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <Wallet className="h-4 w-4 text-blue-200" />
                <p className="text-xs text-blue-100 font-medium">Efectivo disponible</p>
              </div>
              <p className={`text-3xl font-bold mt-1 ${cashBalance < 0 ? 'text-red-200' : 'text-white'}`}>
                {formatHNL(cashBalance)}
              </p>
              <p className="text-xs text-blue-200 mt-2">Ver historial →</p>
            </div>
          </Link>

          <Card>
            <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-4">Metas de ahorro</h2>
            <SavingsOverview goals={goals} />
          </Card>
        </div>
      </div>

      <Card>
        <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-2">Transacciones recientes</h2>
        <RecentTransactions transactions={recentTransactions} />
      </Card>
    </div>
  )
}
