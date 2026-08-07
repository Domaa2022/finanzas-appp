import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CuentasClientPage from './CuentasClientPage'

export default async function CuentasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [saldosRes, cuentasRes, transfRes, totalesRes, lineasRes] = await Promise.all([
    // Motor único de saldo: cuentas reales + cooperativa proyectada.
    supabase.rpc('get_saldos_cuentas', { p_user_id: user.id }),
    // Filas crudas para el formulario de edición.
    supabase.from('cuentas').select('*').eq('user_id', user.id).order('orden'),
    supabase
      .from('transferencias')
      .select('id, monto, fecha, notas, origen:cuentas!transferencias_cuenta_origen_id_fkey(nombre), destino:cuentas!transferencias_cuenta_destino_id_fkey(nombre)')
      .eq('user_id', user.id)
      .order('fecha', { ascending: false })
      .limit(10),
    // Total de ahorros apartados: misma fuente que el dashboard, para que el
    // "Disponible" de las dos pantallas dé exactamente lo mismo.
    supabase.rpc('get_dashboard_totales', { p_user_id: user.id }),
    // Líneas de crédito compartidas (límite, deuda total, disponible).
    supabase.rpc('get_lineas_credito', { p_user_id: user.id }),
  ])

  const t = totalesRes.data?.[0]
  // Vigente = ahorro real (se resta del disponible y cuenta como ahorro).
  const ahorrosApartados = Number(t?.ahorros_apartados ?? 0)
  // Completado = dinero ya gastado; se resta del disponible pero NO es ahorro.
  const apartadoCompletadas = Number(t?.apartado_completadas ?? 0)

  return (
    <CuentasClientPage
      saldos={saldosRes.data || []}
      cuentas={cuentasRes.data || []}
      transferencias={(transfRes.data as any) || []}
      ahorrosApartados={ahorrosApartados}
      apartadoCompletadas={apartadoCompletadas}
      lineas={lineasRes.data || []}
    />
  )
}
