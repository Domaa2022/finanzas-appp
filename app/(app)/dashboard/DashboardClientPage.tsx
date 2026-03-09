'use client'

import { RecentTransaction, SavingsGoal, FixedExpense, ScheduledSaving } from '@/lib/types/database'
import { BalanceCard } from '@/components/dashboard/BalanceCard'
import { RecentTransactions } from '@/components/dashboard/RecentTransactions'
import { SavingsOverview } from '@/components/dashboard/SavingsOverview'
import { IncomeExpenseChart } from '@/components/dashboard/IncomeExpenseChart'
import { QuincenaCard } from '@/components/dashboard/QuincenaCard'
import { SobranteMesCard } from '@/components/dashboard/SobranteMesCard'
import { Card } from '@/components/ui/Card'

interface QuincenaData {
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
}

interface Props {
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
}

export default function DashboardClientPage({
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
}: Props) {
  const hayMetas = goals.some((g: any) => g.estado === 'activa')

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Panel Principal</h1>
        <p className="text-sm text-gray-500 mt-0.5">Resumen de tus finanzas</p>
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
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-400">
          Registra tu primer ingreso para ver el resumen de tu último período
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Ingresos vs Gastos</h2>
          <IncomeExpenseChart data={chartData} />
        </Card>

        <Card>
          <h2 className="text-base font-semibold text-gray-900 mb-4">Metas de ahorro</h2>
          <SavingsOverview goals={goals} />
        </Card>
      </div>

      <Card>
        <h2 className="text-base font-semibold text-gray-900 mb-2">Transacciones recientes</h2>
        <RecentTransactions transactions={recentTransactions} />
      </Card>
    </div>
  )
}
