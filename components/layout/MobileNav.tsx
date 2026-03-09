'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, ArrowDownCircle, ArrowUpCircle, PiggyBank, ReceiptText, Sparkles, BarChart3, FileText } from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'Panel', icon: LayoutDashboard },
  { href: '/ingresos', label: 'Ingresos', icon: ArrowUpCircle },
  { href: '/gastos', label: 'Gastos', icon: ArrowDownCircle },
  { href: '/gastos-fijos', label: 'Fijos', icon: ReceiptText },
  { href: '/ahorros', label: 'Ahorros', icon: PiggyBank },
  { href: '/ahorro-programado', label: 'Prog.', icon: Sparkles },
  { href: '/presupuestos', label: 'Presup.', icon: BarChart3 },
  { href: '/reportes', label: 'Reportes', icon: FileText },
]

export function MobileNav() {
  const pathname = usePathname()

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex overflow-x-auto z-40 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      {navItems.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-none flex-col items-center gap-1 px-3 py-2 text-xs font-medium transition-colors ${
              active ? 'text-emerald-600' : 'text-gray-400 hover:text-gray-600'
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
