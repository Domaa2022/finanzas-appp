import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { MobileNav } from '@/components/layout/MobileNav'
import { terminoPeriodo } from '@/lib/periodo'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('nombre, avatar_url, onboarding_completo, preferencias')
    .eq('id', user.id)
    .single()

  // Usuario nuevo que aún no eligió sus módulos → a la bienvenida.
  if (profile && !profile.onboarding_completo) redirect('/bienvenida')

  const prefs = profile?.preferencias as { modulos?: Record<string, boolean>; cobro?: string } | null
  const modulos = prefs?.modulos ?? {}
  // Etiqueta del período según cómo cobra el usuario (Quincena / Mes / Semana…).
  const periodoLabel = terminoPeriodo(prefs?.cobro).Singular

  return (
    <div className="flex min-h-screen">
      <Sidebar modulos={modulos} periodoLabel={periodoLabel} />
      <div className="flex flex-1 flex-col min-w-0">
        <Header userName={profile?.nombre} avatarUrl={profile?.avatar_url} />
        <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6">
          {children}
        </main>
        <MobileNav modulos={modulos} periodoLabel={periodoLabel} />
      </div>
    </div>
  )
}
