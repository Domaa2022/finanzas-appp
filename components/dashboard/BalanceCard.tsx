'use client'

import { useState } from 'react'
import Link from 'next/link'
import { TrendingUp, TrendingDown, Plus, Wallet, Banknote, ChevronDown } from 'lucide-react'
import { SaldoCuenta } from '@/lib/types/database'
import { formatHNL } from '@/lib/utils/currency'

interface BalanceCardProps {
  saldoDisponible: number
  ingresosMes: number
  gastosMes: number
  sobranteMes: number
  cashBalance: number
  cuentasLiquidas: SaldoCuenta[]
  ahorrosApartados: number
  apartadoCompletadas: number
  deudaTarjetas: number
  ahorrado: number
}

export function BalanceCard({
  saldoDisponible, ingresosMes, gastosMes, sobranteMes, cashBalance,
  cuentasLiquidas, ahorrosApartados, apartadoCompletadas, deudaTarjetas, ahorrado,
}: BalanceCardProps) {
  const [showDesglose, setShowDesglose] = useState(false)

  // Solo tiene sentido desglosar si hay algo que mostrar (varias cuentas, ahorro
  // apartado o deuda de tarjeta que expliquen por qué el disponible es menor).
  const hayDesglose = cuentasLiquidas.length > 0 &&
    (cuentasLiquidas.length > 1 || ahorrosApartados > 0.01 || apartadoCompletadas > 0.01 || deudaTarjetas > 0.01)

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        {/* Disponible */}
        <button
          type="button"
          onClick={() => hayDesglose && setShowDesglose(v => !v)}
          disabled={!hayDesglose}
          aria-expanded={showDesglose}
          className={`col-span-2 sm:col-span-1 text-left bg-gradient-to-br from-indigo-600 to-indigo-500 rounded-xl p-5 text-white ${hayDesglose ? 'cursor-pointer hover:from-indigo-600 hover:to-indigo-600 transition-colors' : ''}`}
        >
          <div className="flex items-center gap-2.5 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
              <Wallet className="h-4 w-4 text-white" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wide text-indigo-100">Disponible</span>
            {hayDesglose && (
              <ChevronDown className={`ml-auto h-4 w-4 text-indigo-200 transition-transform ${showDesglose ? 'rotate-180' : ''}`} />
            )}
          </div>

          {/* Dos partes: lo que se puede usar y lo que está ahorrado */}
          <p className="text-[11px] font-medium uppercase tracking-wide text-indigo-100/90">Para usar</p>
          <p className="text-2xl font-bold font-mono-nums">{formatHNL(saldoDisponible === -0 ? 0 : saldoDisponible)}</p>

          <div className="mt-3 flex items-center justify-between border-t border-white/15 pt-2.5">
            <span className="text-[11px] font-medium uppercase tracking-wide text-indigo-100/90">Ahorrado</span>
            <span className="font-mono-nums text-sm font-semibold text-indigo-50">{formatHNL(ahorrado)}</span>
          </div>
        </button>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-5">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-900/30">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500">Ingresos del mes</span>
          </div>
          <p className="text-lg font-bold text-emerald-600 font-mono-nums">{formatHNL(ingresosMes)}</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-5">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/30">
              <TrendingDown className="h-4 w-4 text-red-500" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500">Gastos del mes</span>
          </div>
          <p className="text-lg font-bold text-red-500 font-mono-nums">{formatHNL(gastosMes)}</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-5">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-900/30">
              <Plus className="h-4 w-4 text-indigo-500" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500">Sobrante del mes</span>
          </div>
          <p className="text-lg font-bold text-gray-900 dark:text-slate-100 font-mono-nums">{formatHNL(sobranteMes)}</p>
        </div>

        <Link
          href="/efectivo"
          className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-5 hover:border-blue-200 dark:hover:border-blue-800/50 transition-colors"
        >
          <div className="flex items-center gap-2.5 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-900/30">
              <Banknote className="h-4 w-4 text-blue-500" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500">Efectivo</span>
          </div>
          <p className={`text-lg font-bold font-mono-nums ${cashBalance < 0 ? 'text-red-500' : 'text-blue-600'}`}>
            {formatHNL(cashBalance)}
          </p>
        </Link>
      </div>

      {/* Desglose del disponible */}
      {showDesglose && hayDesglose && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500 mb-3">
            De dónde viene tu disponible
          </p>
          <div className="flex flex-col divide-y divide-gray-50 dark:divide-slate-700">
            {cuentasLiquidas.map(c => (
              <div key={c.id} className="flex items-center gap-3 py-2">
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: c.color || '#6B7280' }}
                />
                <span className="flex-1 min-w-0 truncate text-sm text-gray-700 dark:text-slate-300">{c.nombre}</span>
                <span className="text-sm font-semibold text-gray-800 dark:text-slate-200 font-mono-nums">
                  {formatHNL(Number(c.saldo))}
                </span>
              </div>
            ))}

            {ahorrosApartados > 0.01 && (
              <div className="flex items-center gap-3 py-2">
                <span className="h-2.5 w-2.5 rounded-full shrink-0 bg-violet-400" />
                <span className="flex-1 min-w-0 text-sm text-violet-600 dark:text-violet-400">
                  Apartado en ahorro
                  <span className="block text-[11px] text-gray-400 dark:text-slate-500">sigue en tus cuentas, pero reservado</span>
                </span>
                <span className="text-sm font-semibold text-violet-600 dark:text-violet-400 font-mono-nums">
                  −{formatHNL(ahorrosApartados)}
                </span>
              </div>
            )}

            {apartadoCompletadas > 0.01 && (
              <div className="flex items-center gap-3 py-2">
                <span className="h-2.5 w-2.5 rounded-full shrink-0 bg-gray-300 dark:bg-slate-600" />
                <span className="flex-1 min-w-0 text-sm text-gray-500 dark:text-slate-400">
                  Metas ya cumplidas
                  <span className="block text-[11px] text-gray-400 dark:text-slate-500">dinero que ya usaste, no está disponible</span>
                </span>
                <span className="text-sm font-semibold text-gray-500 dark:text-slate-400 font-mono-nums">
                  −{formatHNL(apartadoCompletadas)}
                </span>
              </div>
            )}

            {deudaTarjetas > 0.01 && (
              <div className="flex items-center gap-3 py-2">
                <span className="h-2.5 w-2.5 rounded-full shrink-0 bg-red-400" />
                <span className="flex-1 min-w-0 text-sm text-red-600 dark:text-red-400">
                  Reservado para tarjetas
                  <span className="block text-[11px] text-gray-400 dark:text-slate-500">lo que debés y vas a tener que pagar</span>
                </span>
                <span className="text-sm font-semibold text-red-600 dark:text-red-400 font-mono-nums">
                  −{formatHNL(deudaTarjetas)}
                </span>
              </div>
            )}

            <div className="flex items-center gap-3 pt-3">
              <span className="flex-1 text-sm font-semibold text-gray-900 dark:text-slate-100">Disponible</span>
              <span className="text-base font-bold text-indigo-600 dark:text-indigo-400 font-mono-nums">
                {formatHNL(saldoDisponible === -0 ? 0 : saldoDisponible)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
