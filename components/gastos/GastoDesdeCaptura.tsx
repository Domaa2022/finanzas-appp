'use client'

import { useRef, useState } from 'react'
import { Camera, Upload, Trash2, CheckCircle2, Circle, ImageOff } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Category } from '@/lib/types/database'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { formatHNL } from '@/lib/utils/currency'

interface Props {
  categories: Category[]
  onSuccess: () => void
  onCancel: () => void
}

interface GastoDetectado {
  key: string
  incluir: boolean
  monto: string
  descripcion: string
  fecha: string
  category_id: string
}

interface GastoExtraido {
  monto: number
  descripcion: string
  fecha: string
  category_id: string | null
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function GastoDesdeCaptura({ categories, onSuccess, onCancel }: Props) {
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [gastos, setGastos] = useState<GastoDetectado[] | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const gastosCategories = categories.filter(c => c.tipo === 'gasto')

  async function handleFile(file: File) {
    const dataUrl = await fileToDataUrl(file)
    setPreview(dataUrl)
    setGastos(null)
    setLoading(true)

    const supabase = createClient()
    const { data, error } = await supabase.functions.invoke('parse-gasto', {
      body: {
        image: dataUrl,
        categorias: gastosCategories.map(c => ({ id: c.id, nombre: c.nombre })),
      },
    })

    setLoading(false)

    if (error || !data || data.error) {
      toast.error('No se pudo leer la captura. Intenta con otra imagen o ingresa el gasto manualmente.')
      return
    }

    const detectados: GastoExtraido[] = Array.isArray(data) ? data : [data]
    setGastos(detectados.map((g, i) => ({
      key: `${Date.now()}-${i}`,
      incluir: true,
      monto: g.monto ? String(g.monto) : '',
      descripcion: g.descripcion || '',
      fecha: g.fecha || '',
      category_id: g.category_id || '',
    })))
  }

  function updateGasto(key: string, patch: Partial<GastoDetectado>) {
    setGastos(prev => prev?.map(g => (g.key === key ? { ...g, ...patch } : g)) ?? null)
  }

  function removeGasto(key: string) {
    setGastos(prev => prev?.filter(g => g.key !== key) ?? null)
  }

  const seleccionados = (gastos ?? []).filter(g => g.incluir)
  const totalSeleccionado = seleccionados.reduce((s, g) => s + (parseFloat(g.monto) || 0), 0)

  async function handleGuardar() {
    if (seleccionados.length === 0) {
      toast.error('Selecciona al menos un gasto')
      return
    }
    const invalido = seleccionados.find(g => !(parseFloat(g.monto) > 0) || !g.category_id || !g.fecha)
    if (invalido) {
      toast.error('Revisa los gastos: falta monto, categoría o fecha en alguno')
      return
    }

    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setSaving(false)
      return
    }

    const { error } = await supabase.from('expenses').insert(
      seleccionados.map(g => ({
        user_id: user.id,
        monto: parseFloat(g.monto),
        category_id: g.category_id,
        descripcion: g.descripcion || 'Gasto',
        fecha: g.fecha,
        notas: null,
      }))
    )

    setSaving(false)

    if (error) {
      toast.error('Error al guardar los gastos')
      return
    }

    toast.success(`${seleccionados.length} gasto${seleccionados.length !== 1 ? 's' : ''} registrado${seleccionados.length !== 1 ? 's' : ''}`)
    onSuccess()
  }

  if (gastos) {
    return (
      <div className="flex flex-col gap-4">
        {gastos.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-gray-400 dark:text-slate-500">
            <ImageOff className="h-8 w-8" />
            <p className="text-sm">No se detectó ningún gasto en la captura.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              {preview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview}
                  alt="Captura"
                  className="h-12 w-12 shrink-0 rounded-lg object-cover bg-gray-100 dark:bg-slate-900 border border-gray-100 dark:border-slate-700"
                />
              )}
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                  {gastos.length} gasto{gastos.length !== 1 ? 's' : ''} detectado{gastos.length !== 1 ? 's' : ''}
                </p>
                <p className="text-xs text-gray-400 dark:text-slate-500">
                  Revisa y edita antes de guardar — la IA puede equivocarse
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 max-h-[55vh] overflow-y-auto pr-1 -mr-1">
              {gastos.map((g, i) => {
                const cat = gastosCategories.find(c => c.id === g.category_id)
                const color = cat?.color || '#9CA3AF'
                return (
                  <Card
                    key={g.key}
                    padding="sm"
                    className={`transition-opacity ${g.incluir ? '' : 'opacity-50'}`}
                  >
                    {/* Encabezado de la tarjeta: incluir/excluir + identificador + quitar */}
                    <div className="flex items-center justify-between mb-3">
                      <button
                        type="button"
                        onClick={() => updateGasto(g.key, { incluir: !g.incluir })}
                        className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-slate-400"
                      >
                        {g.incluir
                          ? <CheckCircle2 className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
                          : <Circle className="h-5 w-5 text-gray-300 dark:text-slate-600" />}
                        <span
                          className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold"
                          style={{ backgroundColor: color + '20', color }}
                        >
                          {cat?.nombre?.[0]?.toUpperCase() || '?'}
                        </span>
                        Gasto {i + 1}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeGasto(g.key)}
                        className="p-1 text-gray-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Campos editables */}
                    <div className="flex flex-col gap-3">
                      <Input
                        label="Descripción"
                        value={g.descripcion}
                        onChange={e => updateGasto(g.key, { descripcion: e.target.value })}
                        placeholder="Ej: Pizza Hut, Uber..."
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <Input
                          label="Monto (L)"
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={g.monto}
                          onChange={e => updateGasto(g.key, { monto: e.target.value })}
                        />
                        <Select
                          label="Categoría"
                          placeholder="Seleccionar..."
                          options={gastosCategories.map(c => ({ value: c.id, label: c.nombre }))}
                          value={g.category_id}
                          onChange={e => updateGasto(g.key, { category_id: e.target.value })}
                        />
                      </div>
                      <Input
                        label="Fecha"
                        type="date"
                        value={g.fecha}
                        onChange={e => updateGasto(g.key, { fecha: e.target.value })}
                      />
                    </div>
                  </Card>
                )
              })}
            </div>

            <div className="flex items-center justify-between rounded-xl bg-gray-50 dark:bg-slate-900/40 px-4 py-3">
              <span className="text-sm text-gray-500 dark:text-slate-400">
                {seleccionados.length} de {gastos.length} seleccionado{gastos.length !== 1 ? 's' : ''}
              </span>
              <span className="text-base font-semibold text-red-500">{formatHNL(totalSeleccionado)}</span>
            </div>
          </>
        )}

        <div className="flex gap-3">
          <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">
            Cancelar
          </Button>
          {gastos.length > 0 && (
            <Button type="button" loading={saving} className="flex-1" onClick={handleGuardar}>
              Guardar {seleccionados.length > 0 ? `(${seleccionados.length})` : ''}
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="Captura seleccionada" className="max-h-56 w-full rounded-lg object-contain bg-gray-50 dark:bg-slate-900" />
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 py-10 border-2 border-dashed border-gray-200 dark:border-slate-600 rounded-xl text-gray-400 dark:text-slate-500">
          <Camera className="h-8 w-8" />
          <p className="text-sm">Sube una captura de tus transacciones</p>
          <p className="text-xs">Puede tener uno o varios gastos</p>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
        }}
      />

      <div className="flex gap-3">
        <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">
          Cancelar
        </Button>
        <Button
          type="button"
          loading={loading}
          className="flex-1"
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-4 w-4" />
          {preview ? 'Subir otra' : 'Elegir imagen'}
        </Button>
      </div>
    </div>
  )
}
