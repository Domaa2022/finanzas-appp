import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BienvenidaClient from './BienvenidaClient'

export default async function BienvenidaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('nombre, onboarding_completo')
    .eq('id', user.id)
    .single()

  // Si ya pasó por la bienvenida, no la repite.
  if (profile?.onboarding_completo) redirect('/dashboard')

  const primerNombre = profile?.nombre?.split(' ')[0] ?? ''
  return <BienvenidaClient nombre={primerNombre} />
}
