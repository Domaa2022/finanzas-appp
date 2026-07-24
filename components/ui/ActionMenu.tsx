'use client'

import { useState, ReactNode } from 'react'
import { MoreVertical } from 'lucide-react'

export interface ActionMenuItem {
  label: string
  icon?: ReactNode
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}

interface Props {
  items: ActionMenuItem[]
  /** Etiqueta accesible del botón. */
  label?: string
}

/**
 * Menú "⋯" para agrupar acciones secundarias de una tarjeta y no amontonarlas.
 * Deja a la vista solo la acción principal; el resto vive acá dentro.
 */
export function ActionMenu({ items, label = 'Más acciones' }: Props) {
  const [open, setOpen] = useState(false)

  if (items.length === 0) return null

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        className="p-1.5 rounded-lg text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            role="menu"
            className="absolute right-0 top-full mt-1 z-20 min-w-[11rem] py-1 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden"
          >
            {items.map((item, i) => (
              <button
                key={i}
                role="menuitem"
                disabled={item.disabled}
                onClick={() => { setOpen(false); item.onClick() }}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors disabled:opacity-40 disabled:pointer-events-none ${
                  item.danger
                    ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                    : 'text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700'
                }`}
              >
                {item.icon && <span className="shrink-0">{item.icon}</span>}
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
