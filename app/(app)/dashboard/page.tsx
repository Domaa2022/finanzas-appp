import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getCurrentMonth, getMonthRange } from '@/lib/utils/dates'
import { RecentTransaction } from '@/lib/types/database'
import DashboardClientPage from './DashboardClientPage'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'

export default async function DashboardPage() {

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  
  debugger;
  const { mes, anio } = getCurrentMonth()
  const { start, end } = getMonthRange(mes, anio)

  const [incomesRes, expensesRes, allocationsRes, goalsRes, fixedRes, scheduledRes, cashRes] = await Promise.all([
    supabase
      .from('income_entries')
      .select('id, monto, fecha, fuente, frecuencia, es_quincena_actual, categories(nombre, color)')
      .eq('user_id', user.id)
      .order('fecha', { ascending: false }),
    supabase
      .from('expenses')
      .select('monto, fecha, descripcion, notas, categories(nombre, color)')
      .eq('user_id', user.id)
      .order('fecha', { ascending: false }),
    supabase
      .from('savings_allocations')
      .select('monto, fecha, income_entry_id')
      .eq('user_id', user.id),
    supabase
      .from('savings_goals')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('fixed_expenses')
      .select('*, categories(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('scheduled_savings')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('cash_entries')
      .select('tipo, monto')
      .eq('user_id', user.id),
  ])

  const incomes = incomesRes.data || []
  const expenses = expensesRes.data || []


  const allocations = allocationsRes.data || []
  const goals = goalsRes.data || []
  const gastosFijos = fixedRes.data || []
  const ahorrosProgramados = scheduledRes.data || []
  const cashEntries = cashRes.data || []
  const cashBalance = cashEntries.reduce(
    (sum: number, e: any) => sum + (e.tipo === 'entrada' ? e.monto : -e.monto),
    0,
  )

  // --- Quincena actual ---
  // Prioriza el ingreso fijado; si no hay ninguno, usa el más reciente
  const ultimoIngreso = incomes.find((i: any) => i.es_quincena_actual) ?? incomes[0] ?? null
  let quincenaData = null

  if (ultimoIngreso) {
    const inicioQuincena = ultimoIngreso.fecha

    // Gastos desde el último ingreso
    const gastosQuincena = expenses
      .filter(e => e.fecha >= inicioQuincena)
      .reduce((s, e) => s + e.monto, 0)

    // Ahorros ya distribuidos para este ingreso:
    // - con income_entry_id explícito (distribute_savings / distribute_savings_manual)
    // - sin income_entry_id pero con fecha >= inicio de la quincena (add_manual_saving)
    const ahorrosYaAplicados = allocations
      .filter(a =>
        a.income_entry_id === ultimoIngreso.id ||
        (!a.income_entry_id && a.fecha >= ultimoIngreso.fecha)
      )
      .reduce((s, a) => s + a.monto, 0)

    // Sobrante real = ingreso - gastos - ahorros ya aplicados
    const sobranteReal = ultimoIngreso.monto - gastosQuincena - ahorrosYaAplicados

    // ¿El sobrante final ya fue guardado? (sobrante <= 0 o no hay más que guardar)
    const yaAhorroSobrante = sobranteReal <= 0.01

    // ¿Los gastos fijos ya se aplicaron?
    const fijosActivos = gastosFijos.filter((f: any) => f.activo)
    const gastosDesdeQuincena = expenses.filter(e => e.fecha >= ultimoIngreso.fecha)
    const gastosFijosAplicados = fijosActivos.length > 0 && fijosActivos.every((f: any) =>
      gastosDesdeQuincena.some(e =>
        (e as any).descripcion === f.nombre && (e as any).notas === 'Gasto fijo quincenal'
      )
    )

    // ¿Los ahorros programados ya se aplicaron?
    // Se detecta si el total de ahorros ya aplicados >= total programado calculado
    const totalProgramado = ahorrosProgramados
      .filter((s: any) => s.activo)
      .reduce((sum: number, s: any) => {
        const monto = s.tipo === 'porcentaje'
          ? (ultimoIngreso.monto * s.valor) / 100
          : s.valor
        return sum + monto
      }, 0)
    const ahorrosProgramadosAplicados = totalProgramado > 0 && ahorrosYaAplicados >= totalProgramado - 0.01

    quincenaData = {
      ultimoIngresoId: ultimoIngreso.id,
      ultimoIngresoMonto: ultimoIngreso.monto,
      ultimoIngresoFecha: ultimoIngreso.fecha,
      ultimoIngresoFuente: ultimoIngreso.fuente,
      ultimoIngresoFrecuencia: ultimoIngreso.frecuencia,
      gastosDesdeIngreso: gastosQuincena,
      ahorrosYaAplicados,
      yaAhorroSobrante,
      hayMetas: goals.some((g: any) => g.estado === 'activa' && !g.es_general),
      gastosFijos,
      gastosFijosAplicados,
      ahorrosProgramados,
      ahorrosProgramadosAplicados,
      metasActivas: goals.filter((g: any) => g.estado === 'activa' && !g.es_general),
    }
  }

  // --- Totales generales ---
  const totalIngresos = incomes.reduce((s, i) => s + i.monto, 0)
  const totalGastos = expenses.reduce((s, e) => s + e.monto, 0)
  const totalAhorros = allocations.reduce((s, a) => s + a.monto, 0)

  const saldoTotal = parseFloat((totalIngresos - totalGastos - totalAhorros).toFixed(2))

  // --- Este mes ---
  const ingresosMes = incomes.filter(i => i.fecha >= start && i.fecha <= end).reduce((s, i) => s + i.monto, 0)
  const gastosMes = expenses.filter(e => e.fecha >= start && e.fecha <= end).reduce((s, e) => s + e.monto, 0)
  const ahorroMes = allocations.filter(a => a.fecha >= start && a.fecha <= end).reduce((s, a) => s + a.monto, 0)
  const sobranteMes = ingresosMes - gastosMes - ahorroMes

  // --- Transacciones recientes ---
  const allTx: RecentTransaction[] = [
    ...incomes.slice(0, 20).map((i: any) => ({
      id: `i-${i.id}`,
      tipo: 'ingreso' as const,
      monto: i.monto,
      descripcion: i.fuente,
      fecha: i.fecha,
      categoria: i.categories?.nombre || 'Ingreso',
      color: i.categories?.color || '#10B981',
    })),
    ...expenses.slice(0, 20).map((e: any) => ({
      id: `e-${e.fecha}-${e.monto}`,
      tipo: 'gasto' as const,
      monto: e.monto,
      descripcion: e.descripcion,
      fecha: e.fecha,
      categoria: e.categories?.nombre || 'Gasto',
      color: e.categories?.color || '#EF4444',
    })),
  ]
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .slice(0, 10)

  // --- Gráfico últimos 6 meses ---
  const chartData = Array.from({ length: 6 }, (_, i) => {
    const date = subMonths(new Date(anio, mes - 1, 1), 5 - i)
    const mStart = format(startOfMonth(date), 'yyyy-MM-dd')
    const mEnd = format(endOfMonth(date), 'yyyy-MM-dd')
    const mesLabel = format(date, 'MMM', { locale: es })
    return {
      mes: mesLabel.charAt(0).toUpperCase() + mesLabel.slice(1),
      ingresos: incomes.filter(inc => inc.fecha >= mStart && inc.fecha <= mEnd).reduce((s, inc) => s + inc.monto, 0),
      gastos: expenses.filter(exp => exp.fecha >= mStart && exp.fecha <= mEnd).reduce((s, exp) => s + exp.monto, 0),
    }
  })

  return (
    <DashboardClientPage
      saldoTotal={saldoTotal}
      ingresosMes={ingresosMes}
      gastosMes={gastosMes}
      ahorroMes={ahorroMes}
      sobranteMes={sobranteMes}
      ultimoIngresoId={ultimoIngreso?.id ?? null}
      recentTransactions={allTx}
      goals={goals}
      chartData={chartData}
      quincenaData={quincenaData}
      cashBalance={cashBalance}
    />
  )
}
