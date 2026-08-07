'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Sliders } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { MODULOS, ModuloKey, Preferencias, modulosVacios } from '@/lib/preferencias'
import { Card } from '@/components/ui/Card'

/**
 * Activar/desactivar los módulos opcionales después del onboarding.
 * Cambiar un toggle guarda de una y refresca para que el menú se actualice.
 */
export function FuncionesSection({ preferencias }: { preferencias: Preferencias | null }) {
  const router = useRouter()
  const [modulos, setModulos] = useState<Record<string, boolean>>({
    ...modulosVacios(),
    ...(preferencias?.modulos ?? {}),
  })
  const [guardando, setGuardando] = useState<ModuloKey | null>(null)

  async function toggle(key: ModuloKey) {
    const nuevo = { ...modulos, [key]: !modulos[key] }
    setModulos(nuevo)
    setGuardando(key)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setGuardando(null); return }

    const { error } = await supabase
      .from('profiles')
      .update({ preferencias: { ...preferencias, modulos: nuevo } })
      .eq('id', user.id)

    if (error) {
      toast.error('No se pudo guardar')
      setModulos(modulos) // revertir
    } else {
      router.refresh() // el menú lateral se recalcula
    }
    setGuardando(null)
  }

  return (
    <Card>
      <div className="flex items-center gap-2 mb-1">
        <Sliders className="h-4 w-4 text-indigo-500" />
        <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">Funciones</h2>
      </div>
      <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
        Activá solo lo que uses. Lo que apagues desaparece del menú (tus datos no se borran).
      </p>

      <div className="flex flex-col divide-y divide-gray-50 dark:divide-slate-700">
        {MODULOS.map(({ key, label, descripcion }) => {
          const on = !!modulos[key]
          return (
            <div key={key} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-slate-100">{label}</p>
                <p className="text-xs text-gray-400 dark:text-slate-500">{descripcion}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={label}
                disabled={guardando === key}
                onClick={() => toggle(key)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
                  on ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-slate-600'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    on ? 'translate-x-[22px]' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
