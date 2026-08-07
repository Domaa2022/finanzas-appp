'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Modulos, ModuloKey } from '@/lib/preferencias'

/**
 * Lee los módulos activados del usuario (desde profiles.preferencias) para
 * mostrar/ocultar partes de la UI. Mientras carga, `moduloActivo` devuelve
 * false para no mostrar de más antes de saber.
 */
export function useModulos() {
  const [modulos, setModulos] = useState<Partial<Modulos>>({})
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelado = false
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setLoaded(true); return }
      supabase.from('profiles').select('preferencias').eq('id', user.id).maybeSingle()
        .then(({ data }) => {
          if (cancelado) return
          setModulos((data?.preferencias as { modulos?: Partial<Modulos> } | null)?.modulos ?? {})
          setLoaded(true)
        })
    })
    return () => { cancelado = true }
  }, [])

  return {
    modulos,
    loaded,
    activo: (key: ModuloKey) => !!modulos[key],
  }
}
