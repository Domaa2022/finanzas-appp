'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, ArrowDownCircle, ArrowUpCircle, PiggyBank,
  ReceiptText, Sparkles, BarChart3, FileText, Tags, CreditCard,
  Settings, CalendarRange, Wallet, HandCoins, Building2, Landmark, Menu, X,
} from 'lucide-react'
import { isActiveRoute } from '@/lib/utils/nav'
import { ModuloKey } from '@/lib/preferencias'

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard; modulo?: ModuloKey }

const primaryItems: NavItem[] = [
  { href: '/dashboard', label: 'Panel', icon: LayoutDashboard },
  { href: '/cuentas', label: 'Cuentas', icon: Landmark },
  { href: '/gastos', label: 'Gastos', icon: ArrowDownCircle },
  { href: '/ahorros', label: 'Ahorros', icon: PiggyBank, modulo: 'ahorros' },
]

const moreItems: NavItem[] = [
  { href: '/ingresos', label: 'Ingresos', icon: ArrowUpCircle },
  { href: '/gastos-fijos', label: 'Gastos Fijos', icon: ReceiptText, modulo: 'gastos_fijos' },
  { href: '/suscripciones', label: 'Suscripciones', icon: CreditCard, modulo: 'suscripciones' },
  { href: '/deudas', label: 'Deudas', icon: HandCoins, modulo: 'deudas' },
  { href: '/ahorro-programado', label: 'Ahorro Prog.', icon: Sparkles, modulo: 'ahorro_programado' },
  { href: '/cooperativa', label: 'Cooperativa', icon: Building2, modulo: 'cooperativa' },
  { href: '/quincena', label: 'Quincena', icon: CalendarRange, modulo: 'quincena' },
  { href: '/efectivo', label: 'Efectivo', icon: Wallet, modulo: 'efectivo' },
  { href: '/presupuestos', label: 'Presupuestos', icon: BarChart3, modulo: 'presupuestos' },
  { href: '/reportes', label: 'Reportes', icon: FileText },
  { href: '/categorias', label: 'Categorías', icon: Tags, modulo: 'categorias' },
  { href: '/configuracion', label: 'Configuración', icon: Settings },
]

export function MobileNav({ modulos = {} }: { modulos?: Record<string, boolean> }) {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)
  const visible = (i: NavItem) => !i.modulo || modulos[i.modulo]
  const primary = primaryItems.filter(visible)
  const more = moreItems.filter(visible)

  // El botón "Más" se marca activo si la ruta actual está dentro de su lista
  const moreActive = more.some(i => isActiveRoute(pathname, i.href))

  return (
    <>
      {/* Hoja inferior "Más opciones" */}
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-50" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMoreOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 max-h-[75vh] overflow-y-auto rounded-t-2xl bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800 pb-[env(safe-area-inset-bottom)] shadow-2xl">
            <div className="flex items-center justify-between px-5 pt-4 pb-1">
              <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">Más opciones</h2>
              <button
                onClick={() => setMoreOpen(false)}
                aria-label="Cerrar"
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:text-slate-500 dark:hover:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 p-4 pt-2">
              {more.map(({ href, label, icon: Icon }) => {
                const active = isActiveRoute(pathname, href)
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMoreOpen(false)}
                    className={`flex flex-col items-center justify-center gap-1.5 rounded-xl px-2 py-3 text-xs font-medium text-center transition-colors ${
                      active
                        ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                        : 'text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Icon className={`h-5 w-5 ${active ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-slate-500'}`} />
                    {label}
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Barra inferior fija */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800 pb-[env(safe-area-inset-bottom)]">
        {primary.map(({ href, label, icon: Icon }) => {
          const active = isActiveRoute(pathname, href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-1 flex-col items-center gap-1 px-1 py-2 text-xs font-medium transition-colors ${
                active ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300'
              }`}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          )
        })}
        <button
          onClick={() => setMoreOpen(v => !v)}
          aria-label="Más opciones"
          className={`flex flex-1 flex-col items-center gap-1 px-1 py-2 text-xs font-medium transition-colors ${
            moreOpen || moreActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300'
          }`}
        >
          <Menu className="h-5 w-5" />
          Más
        </button>
      </nav>
    </>
  )
}
