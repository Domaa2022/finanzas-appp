import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CooperativaClientPage from './CooperativaClientPage'
import { CooperativaCuenta, CooperativaMovimiento, IncomeEntry } from '@/lib/types/database'

export default async function CooperativaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Aplicar intereses de meses cerrados antes de leer datos
  await supabase.rpc('cooperativa_aplicar_intereses_pendientes', { p_user_id: user.id })

  const [cuentasRes, movimientosRes, incomeRes] = await Promise.all([
    supabase
      .from('cooperativa_cuentas')
      .select('*')
      .eq('user_id', user.id)
      .order('tipo'),
    supabase
      .from('cooperativa_movimientos')
      .select('*')
      .eq('user_id', user.id)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(500),
    supabase
      .from('income_entries')
      .select('id, monto, fecha, fuente, frecuencia, ahorro_tipo, ahorro_valor, es_quincena_actual, notas, user_id, category_id, created_at')
      .eq('user_id', user.id)
      .order('fecha', { ascending: false })
      .limit(20),
  ])

  return (
    <CooperativaClientPage
      cuentas={(cuentasRes.data || []) as CooperativaCuenta[]}
      movimientos={(movimientosRes.data || []) as CooperativaMovimiento[]}
      incomes={(incomeRes.data || []) as IncomeEntry[]}
    />
  )
}
