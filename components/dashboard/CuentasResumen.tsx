import Link from 'next/link'
import { Landmark, Wallet, PiggyBank, Building2, CreditCard, ChevronRight } from 'lucide-react'
import { SaldoCuenta } from '@/lib/types/database'
import { formatHNL } from '@/lib/utils/currency'

function iconoTipo(tipo: string) {
  if (tipo === 'efectivo') return Wallet
  if (tipo === 'ahorro') return PiggyBank
  if (tipo === 'cooperativa') return Building2
  if (tipo === 'tarjeta') return CreditCard
  return Landmark
}

export function CuentasResumen({ saldos }: { saldos: SaldoCuenta[] }) {
  // Con una sola cuenta no aporta nada: el disponible ya lo dice el balance.
  if (saldos.length <= 1) return null

  return (
    <Link
      href="/cuentas"
      className="block bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm p-5 hover:border-indigo-200 dark:hover:border-indigo-800/50 transition-colors"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Landmark className="h-4 w-4 text-indigo-500" />
          <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">Mis cuentas</h2>
        </div>
        <ChevronRight className="h-4 w-4 text-gray-300 dark:text-slate-600" />
      </div>

      <div className="flex flex-col divide-y divide-gray-50 dark:divide-slate-700">
        {saldos.map(s => {
          const Icono = iconoTipo(s.tipo)
          const esTarjeta = s.tipo === 'tarjeta'
          const deuda = Math.max(-Number(s.saldo), 0)
          return (
            <div key={s.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
              <div
                className="h-8 w-8 shrink-0 rounded-lg flex items-center justify-center text-white"
                style={{ backgroundColor: s.color || (s.origen === 'cooperativa' ? '#0EA5E9' : esTarjeta ? '#EF4444' : '#6B7280') }}
              >
                <Icono className="h-4 w-4" />
              </div>
              <span className="flex-1 min-w-0 truncate text-sm text-gray-700 dark:text-slate-300">
                {s.nombre}
                {esTarjeta ? (
                  <span className="ml-1.5 text-xs text-gray-400 dark:text-slate-500">· tarjeta</span>
                ) : !s.es_disponible && (
                  <span className="ml-1.5 text-xs text-gray-400 dark:text-slate-500">· ahorro</span>
                )}
              </span>
              {esTarjeta ? (
                <span className={`text-sm font-semibold shrink-0 ${deuda > 0.01 ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {deuda > 0.01 ? `Debés ${formatHNL(deuda)}` : 'Al día'}
                </span>
              ) : (
                <span className={`text-sm font-semibold shrink-0 ${Number(s.saldo) < 0 ? 'text-red-500' : 'text-gray-800 dark:text-slate-200'}`}>
                  {formatHNL(Number(s.saldo))}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </Link>
  )
}
