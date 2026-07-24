'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  ArrowDownCircle,
  ArrowUpCircle,
  PiggyBank,
  BarChart3,
  FileText,
  ReceiptText,
  Sparkles,
  Tags,
  CreditCard,
  Settings,
  CalendarRange,
  Wallet,
  HandCoins,
  Building2,
  Landmark,
} from 'lucide-react'
import { isActiveRoute } from '@/lib/utils/nav'

const navItems = [
  { href: '/dashboard', label: 'Panel', icon: LayoutDashboard },
  { href: '/cuentas', label: 'Cuentas', icon: Landmark },
  { href: '/ingresos', label: 'Ingresos', icon: ArrowUpCircle },
  { href: '/gastos', label: 'Gastos', icon: ArrowDownCircle },
  { href: '/gastos-fijos', label: 'Gastos Fijos', icon: ReceiptText },
  { href: '/suscripciones', label: 'Suscripciones', icon: CreditCard },
  { href: '/deudas', label: 'Deudas', icon: HandCoins },
  { href: '/ahorros', label: 'Ahorros', icon: PiggyBank },
  { href: '/ahorro-programado', label: 'Ahorro Prog.', icon: Sparkles },
  { href: '/cooperativa', label: 'Cooperativa', icon: Building2 },
  { href: '/quincena', label: 'Quincena', icon: CalendarRange },
  { href: '/efectivo', label: 'Efectivo', icon: Wallet },
  { href: '/presupuestos', label: 'Presupuestos', icon: BarChart3 },
  { href: '/reportes', label: 'Reportes', icon: FileText },
  { href: '/categorias', label: 'Categorías', icon: Tags },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden md:flex md:flex-col w-[76px] bg-white dark:bg-slate-900 border-r border-gray-100 dark:border-slate-800 h-screen sticky top-0 items-center py-4 gap-4">
      {/* Logo */}
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-indigo-600" title="Mis Finanzas">
        <PiggyBank className="h-5 w-5 text-white" />
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1.5 flex-1 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = isActiveRoute(pathname, href)
          return (
            <Link
              key={href}
              href={href}
              title={label}
              aria-label={label}
              className={`flex h-11 w-11 items-center justify-center rounded-xl transition-colors ${
                active
                  ? 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400'
                  : 'text-gray-400 dark:text-slate-500 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-600 dark:hover:text-slate-300'
              }`}
            >
              <Icon className="h-5 w-5" />
            </Link>
          )
        })}
      </nav>

      {/* Configuración, fija abajo */}
      <Link
        href="/configuracion"
        title="Configuración"
        aria-label="Configuración"
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors ${
          isActiveRoute(pathname, '/configuracion')
            ? 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400'
            : 'text-gray-400 dark:text-slate-500 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-600 dark:hover:text-slate-300'
        }`}
      >
        <Settings className="h-5 w-5" />
      </Link>
    </aside>
  )
}
