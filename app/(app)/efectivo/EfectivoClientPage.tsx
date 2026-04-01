'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Plus, Minus, Wallet, Trash2, TrendingUp, TrendingDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { CashEntry } from '@/lib/types/database'
import { formatHNL } from '@/lib/utils/currency'
import { formatDate, todayISO } from '@/lib/utils/dates'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'

// ─── Form schema ──────────────────────────────────────────────────────────────

const schema = z.object({
  tipo: z.enum(['entrada', 'salida']),
  monto: z.string().min(1, 'Requerido').refine(v => parseFloat(v) > 0, 'Debe ser mayor a 0'),
  descripcion: z.string().min(1, 'Requerido'),
  fecha: z.string().min(1, 'Requerido'),
  notas: z.string().optional(),
})

type FormData = z.infer<typeof schema>

function CashForm({
  defaultTipo,
  onSuccess,
  onCancel,
}: {
  defaultTipo: 'entrada' | 'salida'
  onSuccess: () => void
  onCancel: () => void
}) {
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { tipo: defaultTipo, fecha: todayISO() },
  })

  const tipo = watch('tipo')

  async function onSubmit(data: FormData) {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { error } = await supabase.from('cash_entries').insert({
      user_id: user.id,
      tipo: data.tipo,
      monto: parseFloat(data.monto),
      descripcion: data.descripcion,
      fecha: data.fecha,
      notas: data.notas || null,
    })

    if (error) toast.error('Error al registrar movimiento')
    else { toast.success(tipo === 'entrada' ? 'Efectivo añadido' : 'Gasto registrado'); onSuccess() }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      {/* Toggle entrada/salida */}
      <div className="flex rounded-xl border border-gray-200 dark:border-slate-600 overflow-hidden text-sm font-medium">
        <button
          type="button"
          onClick={() => setValue('tipo', 'entrada')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 transition-colors ${
            tipo === 'entrada' ? 'bg-emerald-600 text-white' : 'bg-white dark:bg-slate-700 text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-600'
          }`}
        >
          <TrendingUp className="h-4 w-4" /> Recibí efectivo
        </button>
        <button
          type="button"
          onClick={() => setValue('tipo', 'salida')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 border-l border-gray-200 transition-colors ${
            tipo === 'salida' ? 'bg-red-500 text-white' : 'bg-white dark:bg-slate-700 text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-600'
          }`}
        >
          <TrendingDown className="h-4 w-4" /> Gasté efectivo
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Monto (L)"
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          error={errors.monto?.message}
          {...register('monto')}
        />
        <Input
          label="Fecha"
          type="date"
          error={errors.fecha?.message}
          {...register('fecha')}
        />
      </div>

      <Input
        label="Descripción"
        placeholder={tipo === 'entrada' ? 'Ej: Vuelto, Pago en efectivo...' : 'Ej: Taxi, Mercado, Comida...'}
        error={errors.descripcion?.message}
        {...register('descripcion')}
      />

      <Input
        label="Notas (opcional)"
        placeholder="Detalles adicionales..."
        {...register('notas')}
      />

      <div className="flex gap-3 pt-1">
        <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">
          Cancelar
        </Button>
        <Button type="submit" loading={loading} className="flex-1">
          Registrar
        </Button>
      </div>
    </form>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

interface Props { initialEntries: CashEntry[] }

export default function EfectivoClientPage({ initialEntries }: Props) {
  const router = useRouter()
  const [modal, setModal] = useState<'entrada' | 'salida' | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleSuccess = useCallback(() => {
    setModal(null)
    router.refresh()
  }, [router])

  const balance = initialEntries.reduce(
    (sum, e) => sum + (e.tipo === 'entrada' ? e.monto : -e.monto),
    0,
  )

  const totalEntradas = initialEntries
    .filter(e => e.tipo === 'entrada')
    .reduce((s, e) => s + e.monto, 0)

  const totalSalidas = initialEntries
    .filter(e => e.tipo === 'salida')
    .reduce((s, e) => s + e.monto, 0)

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este movimiento?')) return
    setDeletingId(id)
    const supabase = createClient()
    await supabase.from('cash_entries').delete().eq('id', id)
    toast.success('Movimiento eliminado')
    router.refresh()
    setDeletingId(null)
  }

  return (
    <div className="flex flex-col gap-5 max-w-2xl mx-auto">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Efectivo</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">Dinero en físico que tienes disponible</p>
      </div>

      {/* Balance principal */}
      <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <Wallet className="h-5 w-5 text-blue-200" />
          <p className="text-sm text-blue-100 font-medium">Efectivo disponible</p>
        </div>
        <p className={`text-4xl font-bold mt-1 ${balance < 0 ? 'text-red-200' : 'text-white'}`}>
          {formatHNL(balance)}
        </p>

        <div className="grid grid-cols-2 gap-4 mt-5 pt-4 border-t border-blue-400/50">
          <div>
            <p className="text-xs text-blue-100">Total recibido</p>
            <p className="text-base font-semibold text-white mt-0.5">{formatHNL(totalEntradas)}</p>
          </div>
          <div>
            <p className="text-xs text-blue-100">Total gastado</p>
            <p className="text-base font-semibold text-blue-100 mt-0.5">{formatHNL(totalSalidas)}</p>
          </div>
        </div>
      </div>

      {/* Botones rápidos */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          onClick={() => setModal('entrada')}
          className="bg-emerald-600 hover:bg-emerald-700 justify-center py-3"
        >
          <Plus className="h-5 w-5" />
          Recibí efectivo
        </Button>
        <Button
          variant="secondary"
          onClick={() => setModal('salida')}
          className="border-red-200 text-red-600 hover:bg-red-50 justify-center py-3"
        >
          <Minus className="h-5 w-5" />
          Gasté efectivo
        </Button>
      </div>

      {/* Historial */}
      <Card padding="none">
        <div className="px-5 py-4 border-b border-gray-50 dark:border-slate-700">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">
            Historial ({initialEntries.length})
          </h2>
        </div>

        {initialEntries.length === 0 ? (
          <div className="text-center py-12 text-gray-400 dark:text-slate-500">
            <Wallet className="h-10 w-10 mx-auto mb-3 text-gray-200 dark:text-slate-600" />
            <p>No hay movimientos registrados</p>
            <p className="text-sm mt-1">Registra el efectivo que tienes disponible</p>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-gray-50 dark:divide-slate-700">
            {initialEntries.map(entry => (
              <div key={entry.id} className="flex items-center gap-3 px-5 py-3">
                {/* Icono */}
                <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${
                  entry.tipo === 'entrada'
                    ? 'bg-emerald-100 text-emerald-600'
                    : 'bg-red-100 text-red-500'
                }`}>
                  {entry.tipo === 'entrada'
                    ? <TrendingUp className="h-4 w-4" />
                    : <TrendingDown className="h-4 w-4" />
                  }
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-slate-100 truncate">{entry.descripcion}</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">
                    {formatDate(entry.fecha)}
                    {entry.notas && ` · ${entry.notas}`}
                  </p>
                </div>

                {/* Monto + delete */}
                <div className="flex items-center gap-2 shrink-0">
                  <p className={`text-sm font-semibold ${
                    entry.tipo === 'entrada' ? 'text-emerald-600' : 'text-red-500'
                  }`}>
                    {entry.tipo === 'entrada' ? '+' : '-'}{formatHNL(entry.monto)}
                  </p>
                  <button
                    onClick={() => handleDelete(entry.id)}
                    disabled={deletingId === entry.id}
                    className="p-1.5 text-gray-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Modal */}
      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal === 'entrada' ? 'Recibí efectivo' : 'Gasté efectivo'}
        size="sm"
      >
        {modal && (
          <CashForm
            defaultTipo={modal}
            onSuccess={handleSuccess}
            onCancel={() => setModal(null)}
          />
        )}
      </Modal>
    </div>
  )
}
