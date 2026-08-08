'use client'

import { useEffect, useState } from 'react'
import { Bell, CalendarClock, CreditCard } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Noti {
  id: string
  tipo: 'corte' | 'pago'
  titulo: string
  detalle: string
  urgente: boolean
}

/** Días desde hoy hasta la próxima ocurrencia de un día del mes. */
function diasHastaDia(dia: number): number {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const y = hoy.getFullYear()
  const m = hoy.getMonth()
  const ultimoEste = new Date(y, m + 1, 0).getDate()
  let fecha = new Date(y, m, Math.min(dia, ultimoEste))
  if (fecha < hoy) {
    const ultimoProx = new Date(y, m + 2, 0).getDate()
    fecha = new Date(y, m + 1, Math.min(dia, ultimoProx))
  }
  return Math.round((fecha.getTime() - hoy.getTime()) / 86_400_000)
}

// Cuántos días antes empezar a avisar.
const AVISO_DIAS = 3

function etiquetaDias(d: number): string {
  return d === 0 ? 'hoy' : `en ${d} día${d !== 1 ? 's' : ''}`
}

export function NotificationsBell() {
  const [notis, setNotis] = useState<Noti[]>([])
  const [open, setOpen] = useState(false)
  const [visto, setVisto] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('cuentas')
      .select('id, nombre, dia_corte, dia_pago')
      .eq('tipo', 'tarjeta')
      .eq('activo', true)
      .then(({ data }) => {
        const list: Noti[] = []
        for (const c of data ?? []) {
          if (c.dia_corte) {
            const d = diasHastaDia(c.dia_corte)
            if (d <= AVISO_DIAS) list.push({
              id: `corte-${c.id}`,
              tipo: 'corte',
              titulo: d === 0 ? `Hoy es la fecha de corte de ${c.nombre}` : `Corte de ${c.nombre} ${etiquetaDias(d)}`,
              detalle: 'Se cierra el estado de cuenta; revisá cuánto vas a pagar.',
              urgente: d === 0,
            })
          }
          if (c.dia_pago) {
            const d = diasHastaDia(c.dia_pago)
            if (d <= AVISO_DIAS) list.push({
              id: `pago-${c.id}`,
              tipo: 'pago',
              titulo: d === 0 ? `Hoy vence el pago de ${c.nombre}` : `Pago de ${c.nombre} ${etiquetaDias(d)}`,
              detalle: 'No te olvides de pagarla para no generar intereses.',
              urgente: d === 0,
            })
          }
        }
        list.sort((a, b) => Number(b.urgente) - Number(a.urgente))
        setNotis(list)
      })
  }, [])

  const count = notis.length
  const hayUrgente = notis.some(n => n.urgente)
  const mostrarBadge = count > 0 && !visto

  function toggle() {
    setOpen(v => !v)
    setVisto(true)
  }

  return (
    <div className="relative">
      <button
        onClick={toggle}
        aria-label="Notificaciones"
        aria-expanded={open}
        className="relative rounded-xl p-2 border border-gray-200 dark:border-slate-700 text-gray-400 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-600 dark:hover:text-slate-200 transition-colors"
      >
        <Bell className="h-4 w-4" />
        {mostrarBadge && (
          <span className={`absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center ring-2 ring-white dark:ring-slate-900 ${hayUrgente ? 'bg-red-500' : 'bg-amber-500'}`}>
            {count}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-30 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50 dark:border-slate-700">
              <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">Notificaciones</p>
            </div>

            {count === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400 dark:text-slate-500">
                Sin notificaciones por ahora
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto divide-y divide-gray-50 dark:divide-slate-700">
                {notis.map(n => {
                  const Icono = n.tipo === 'corte' ? CalendarClock : CreditCard
                  return (
                    <div key={n.id} className="flex items-start gap-3 px-4 py-3">
                      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${n.urgente ? 'bg-red-50 dark:bg-red-900/30 text-red-500' : 'bg-amber-50 dark:bg-amber-900/30 text-amber-500'}`}>
                        <Icono className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-slate-100">{n.titulo}</p>
                        <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{n.detalle}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
