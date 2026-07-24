'use client'

import { RecentTransaction, SavingsGoal, FixedExpense, ScheduledSaving, SaldoCuenta } from '@/lib/types/database'
import { BalanceCard } from '@/components/dashboard/BalanceCard'
import { CuentasResumen } from '@/components/dashboard/CuentasResumen'
import { RecentTransactions } from '@/components/dashboard/RecentTransactions'
import { SavingsOverview } from '@/components/dashboard/SavingsOverview'
import { IncomeExpenseChart } from '@/components/dashboard/IncomeExpenseChart'
import { QuincenaCard } from '@/components/dashboard/QuincenaCard'
import { SobranteMesCard } from '@/components/dashboard/SobranteMesCard'
import { ProximosPagos, PagoMensual } from '@/components/dashboard/ProximosPagos'
import { Card } from '@/components/ui/Card'

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
  saludo: string
  fechaHoyLabel: string
  pagosMensuales: PagoMensual[]
  saldoDisponible: number
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
  saldosCuentas: SaldoCuenta[]
  ahorrosApartados: number
  apartadoCompletadas: number
}

export default function DashboardClientPage({
  saludo,
  fechaHoyLabel,
  pagosMensuales,
  saldoDisponible,
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
  saldosCuentas,
  ahorrosApartados,
  apartadoCompletadas,
}: Props) {
  const hayMetas = goals.some((g: any) => g.estado === 'activa' && !g.es_general)

  return (
    <div className="flex flex-col gap-6 max-w-[1600px] mx-auto">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">{saludo}</h1>
        <p className="text-sm text-gray-400 dark:text-slate-500">{fechaHoyLabel}</p>
      </div>

      {quincenaData ? (
        <QuincenaCard {...quincenaData} />
      ) : (
        <div className="rounded-xl border border-dashed border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 text-center text-sm text-gray-400 dark:text-slate-500">
          Registra tu primer ingreso para ver el resumen de tu último período
        </div>
      )}

      <BalanceCard
        saldoDisponible={saldoDisponible}
        ingresosMes={ingresosMes}
        gastosMes={gastosMes}
        sobranteMes={sobranteMes}
        cashBalance={cashBalance}
        cuentasLiquidas={saldosCuentas.filter(s => s.es_disponible)}
        ahorrosApartados={ahorrosApartados}
        apartadoCompletadas={apartadoCompletadas}
      />

      <CuentasResumen saldos={saldosCuentas} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <SobranteMesCard
          ingresosMes={ingresosMes}
          gastosMes={gastosMes}
          ahorroMes={ahorroMes}
          sobranteMes={sobranteMes}
          ultimoIngresoId={ultimoIngresoId}
          hayMetas={hayMetas}
        />

        <ProximosPagos pagos={pagosMensuales} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-4">Ingresos vs Gastos</h2>
          <IncomeExpenseChart data={chartData} />
        </Card>

        <Card>
          <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-4">Metas de ahorro</h2>
          <SavingsOverview goals={goals} />
        </Card>
      </div>

      <Card>
        <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-2">Transacciones recientes</h2>
        <RecentTransactions transactions={recentTransactions} />
      </Card>
    </div>
  )
}
