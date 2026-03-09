import { ArrowUpCircle, ArrowDownCircle } from 'lucide-react'
import { RecentTransaction } from '@/lib/types/database'
import { formatHNL } from '@/lib/utils/currency'
import { formatDate } from '@/lib/utils/dates'

interface RecentTransactionsProps {
  transactions: RecentTransaction[]
}

export function RecentTransactions({ transactions }: RecentTransactionsProps) {
  if (transactions.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 text-sm">
        No hay transacciones recientes
      </div>
    )
  }

  return (
    <div className="flex flex-col divide-y divide-gray-50">
      {transactions.map(tx => (
        <div key={tx.id} className="flex items-center gap-3 py-3">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
            tx.tipo === 'ingreso' ? 'bg-emerald-50' : 'bg-red-50'
          }`}>
            {tx.tipo === 'ingreso'
              ? <ArrowUpCircle className="h-5 w-5 text-emerald-500" />
              : <ArrowDownCircle className="h-5 w-5 text-red-500" />
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{tx.descripcion}</p>
            <p className="text-xs text-gray-400">{tx.categoria} · {formatDate(tx.fecha)}</p>
          </div>
          <span className={`text-sm font-semibold ${tx.tipo === 'ingreso' ? 'text-emerald-600' : 'text-red-500'}`}>
            {tx.tipo === 'ingreso' ? '+' : '-'}{formatHNL(tx.monto)}
          </span>
        </div>
      ))}
    </div>
  )
}
