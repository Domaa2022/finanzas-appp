import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DeudasClientPage from './DeudasClientPage'

export default async function DeudasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: deudas } = await supabase
    .from('deudas')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const { data: pagos } = await supabase
    .from('deuda_pagos')
    .select('*')
    .eq('user_id', user.id)
    .order('fecha', { ascending: false })

  return (
    <DeudasClientPage
      initialDeudas={deudas || []}
      initialPagos={pagos || []}
    />
  )
}
