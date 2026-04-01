import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import QuincenaClientPage from './QuincenaClientPage'

export default async function QuincenaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [incomesRes, expensesRes, allocationsRes] = await Promise.all([
    supabase
      .from('income_entries')
      .select('id, monto, fecha, fuente, ahorro_tipo, ahorro_valor, categories(nombre, color)')
      .eq('user_id', user.id)
      .order('fecha', { ascending: false })
      .limit(50),
    supabase
      .from('expenses')
      .select('id, monto, fecha, descripcion, notas, categories(nombre, color)')
      .eq('user_id', user.id)
      .order('fecha', { ascending: false })
      .limit(500),
    supabase
      .from('savings_allocations')
      .select('id, monto, fecha, income_entry_id, notas')
      .eq('user_id', user.id)
      .order('fecha', { ascending: false }),
  ])
  
  console.log(incomesRes);
  console.log(expensesRes);
    console.log(allocationsRes);

  return (
    <QuincenaClientPage
      incomes={(incomesRes.data || []) as any}
      expenses={(expensesRes.data || []) as any}
      allocations={(allocationsRes.data || []) as any}
    />
  )
}
