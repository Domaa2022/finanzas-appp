'use client'

import Link from 'next/link'
import { CalendarClock, ExternalLink, CheckCircle2 } from 'lucide-react'
import { formatHNL } from '@/lib/utils/currency'
import { formatDate } from '@/lib/utils/dates'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Badge } from '@/components/ui/Badge'

export interface PagoMensual {
  id: string
  nombre: string
  monto: number
  apartado: number
  falta: number
  pct: number
  fechaPago: string | null
  dias: number | null
  color: string | null
}

export function ProximosPagos({ pagos }: { pagos: PagoMensual[] }) {
  const proximos = pagos.filter(p => p.dias !== null && p.dias <= 5).slice(0, 2)

  if (proximos.length === 0) return null

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-violet-500" />
          <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">Próximos pagos</h2>
        </div>
        <Link href="/gastos-fijos" className="text-gray-300 dark:text-slate-600 hover:text-violet-500 transition-colors" title="Ver gastos fijos">
          <ExternalLink className="h-4 w-4" />
        </Link>
      </div>

      <div className="flex flex-col divide-y divide-gray-50 dark:divide-slate-700">
        {proximos.map(p => {
          const listo = p.falta <= 0.01
          return (
            <div key={p.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: p.color || '#8B5CF6' }}
                  />
                  <span className="font-medium text-sm text-gray-900 dark:text-slate-100 truncate">{p.nombre}</span>
                  {listo && <Badge variant="green">Listo</Badge>}
                </div>
                <span className="text-xs text-gray-400 dark:text-slate-500 shrink-0">
                  {p.fechaPago && formatDate(p.fechaPago)}
                  {p.dias !== null && (
                    <span className={p.dias <= 5 ? ' text-amber-600 dark:text-amber-400 font-medium' : ''}>
                      {' · '}{p.dias <= 0 ? 'hoy' : `${p.dias}d`}
                    </span>
                  )}
                </span>
              </div>
              <ProgressBar value={p.pct} />
              <div className="flex justify-between mt-1 text-xs">
                <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                  {listo && <CheckCircle2 className="h-3 w-3" />}
                  {formatHNL(p.apartado)} apartado
                </span>
                <span className="text-gray-400 dark:text-slate-500">
                  {listo ? `de ${formatHNL(p.monto)}` : `faltan ${formatHNL(p.falta)}`}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
