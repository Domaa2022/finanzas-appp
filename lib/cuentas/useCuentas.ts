'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Cuenta } from '@/lib/types/database'

/**
 * Trae las cuentas activas del usuario. RLS garantiza que solo se vean las
 * propias, así que los formularios cliente pueden consumirlo directo sin
 * threading desde cada server component.
 */
export function useCuentas() {
  const [cuentas, setCuentas] = useState<Cuenta[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelado = false
    const supabase = createClient()
    supabase
      .from('cuentas')
      .select('*')
      .eq('activo', true)
      .order('orden', { ascending: true })
      .then(({ data }) => {
        if (cancelado) return
        setCuentas(data || [])
        setLoading(false)
      })
    return () => { cancelado = true }
  }, [])

  const principal = cuentas.find(c => c.es_principal) ?? cuentas[0] ?? null

  return { cuentas, principal, loading }
}
