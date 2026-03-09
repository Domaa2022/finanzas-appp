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
} from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'Panel', icon: LayoutDashboard },
  { href: '/ingresos', label: 'Ingresos', icon: ArrowUpCircle },
  { href: '/gastos', label: 'Gastos', icon: ArrowDownCircle },
  { href: '/gastos-fijos', label: 'Gastos Fijos', icon: ReceiptText },
  { href: '/ahorros', label: 'Ahorros', icon: PiggyBank },
  { href: '/ahorro-programado', label: 'Ahorro Prog.', icon: Sparkles },
  { href: '/presupuestos', label: 'Presupuestos', icon: BarChart3 },
  { href: '/reportes', label: 'Reportes', icon: FileText },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden md:flex md:flex-col w-60 bg-white border-r border-gray-100 h-screen sticky top-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-100">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600">
          <PiggyBank className="h-5 w-5 text-white" />
        </div>
        <span className="font-bold text-gray-900 text-lg">Mis Finanzas</span>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1 p-3 flex-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                active
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Icon className={`h-5 w-5 ${active ? 'text-emerald-600' : 'text-gray-400'}`} />
              {label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
