import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CategoriasClientPage from './CategoriasClientPage'

export default async function CategoriasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', user.id)
    .order('nombre')

  return <CategoriasClientPage categories={categories || []} />
}
