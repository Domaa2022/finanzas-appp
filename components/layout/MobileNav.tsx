'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, ArrowDownCircle, ArrowUpCircle, PiggyBank, ReceiptText, Sparkles, BarChart3, FileText, Tags, CreditCard, Settings, CalendarRange, Wallet, HandCoins } from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'Panel', icon: LayoutDashboard },
  { href: '/ingresos', label: 'Ingresos', icon: ArrowUpCircle },
  { href: '/gastos', label: 'Gastos', icon: ArrowDownCircle },
  { href: '/gastos-fijos', label: 'Fijos', icon: ReceiptText },
  { href: '/suscripciones', label: 'Suscripc.', icon: CreditCard },
  { href: '/deudas', label: 'Deudas', icon: HandCoins },
  { href: '/ahorros', label: 'Ahorros', icon: PiggyBank },
  { href: '/ahorro-programado', label: 'Prog.', icon: Sparkles },
  { href: '/quincena', label: 'Quincena', icon: CalendarRange },
  { href: '/efectivo', label: 'Efectivo', icon: Wallet },
  { href: '/presupuestos', label: 'Presup.', icon: BarChart3 },
  { href: '/reportes', label: 'Reportes', icon: FileText },
  { href: '/categorias', label: 'Categ.', icon: Tags },
  { href: '/configuracion', label: 'Config.', icon: Settings },
]

export function MobileNav() {
  const pathname = usePathname()

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800 flex overflow-x-auto z-40 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      {navItems.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-none flex-col items-center gap-1 px-3 py-2 text-xs font-medium transition-colors ${
              active ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300'
            }`}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
