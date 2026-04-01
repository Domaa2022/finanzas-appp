'use client'

import { useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, EyeOff, Eye } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Category } from '@/lib/types/database'
import { CategoryForm, ICONOS } from '@/components/categorias/CategoryForm'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

interface Props {
  categories: Category[]
}

function CategoryIcon({ nombre, color }: { nombre: string | null; color: string | null }) {
  const found = ICONOS.find(i => i.nombre === nombre)
  if (!found) return <span className="h-4 w-4 rounded-full inline-block" style={{ backgroundColor: color || '#6B7280' }} />
  const Icon = found.componente
  return <Icon className="h-4 w-4" style={{ color: color || '#6B7280' }} />
}

export default function CategoriasClientPage({ categories }: Props) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [defaultTipo, setDefaultTipo] = useState<'gasto' | 'ingreso'>('gasto')

  const handleSuccess = useCallback(() => {
    setModalOpen(false)
    setEditingCategory(null)
    router.refresh()
  }, [router])

  function openCreate(tipo: 'gasto' | 'ingreso') {
    setEditingCategory(null)
    setDefaultTipo(tipo)
    setModalOpen(true)
  }

  function openEdit(cat: Category) {
    setEditingCategory(cat)
    setModalOpen(true)
  }

  async function handleDelete(cat: Category) {
    if (!confirm(`¿Eliminar la categoría "${cat.nombre}"? Los registros que la usen quedarán sin categoría.`)) return
    const supabase = createClient()
    const { error } = await supabase.from('categories').delete().eq('id', cat.id)
    if (error) {
      toast.error('No se pudo eliminar (puede estar en uso)')
    } else {
      toast.success('Categoría eliminada')
      router.refresh()
    }
  }

  async function handleToggle(cat: Category) {
    const supabase = createClient()
    await supabase.from('categories').update({ is_active: !cat.is_active }).eq('id', cat.id)
    toast.success(cat.is_active ? 'Categoría ocultada' : 'Categoría activada')
    router.refresh()
  }

  const gastos = categories.filter(c => c.tipo === 'gasto')
  const ingresos = categories.filter(c => c.tipo === 'ingreso')

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Categorías</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">{categories.length} categorías en total</p>
        </div>
        <Button onClick={() => openCreate('gasto')}>
          <Plus className="h-4 w-4" />
          Nueva categoría
        </Button>
      </div>

      <Section
        title="Gastos"
        categories={gastos}
        onEdit={openEdit}
        onDelete={handleDelete}
        onToggle={handleToggle}
        onAdd={() => openCreate('gasto')}
      />

      <Section
        title="Ingresos"
        categories={ingresos}
        onEdit={openEdit}
        onDelete={handleDelete}
        onToggle={handleToggle}
        onAdd={() => openCreate('ingreso')}
      />

      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingCategory(null) }}
        title={editingCategory ? 'Editar categoría' : 'Nueva categoría'}
      >
        <CategoryForm
          category={editingCategory || undefined}
          defaultTipo={defaultTipo}
          onSuccess={handleSuccess}
          onCancel={() => { setModalOpen(false); setEditingCategory(null) }}
        />
      </Modal>
    </div>
  )
}

interface SectionProps {
  title: string
  categories: Category[]
  onEdit: (c: Category) => void
  onDelete: (c: Category) => void
  onToggle: (c: Category) => void
  onAdd: () => void
}

function Section({ title, categories, onEdit, onDelete, onToggle, onAdd }: SectionProps) {
  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">{title}</h2>
        <button
          onClick={onAdd}
          className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 transition-colors"
        >
          <Plus className="h-3 w-3" />
          Agregar
        </button>
      </div>

      {categories.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 dark:border-slate-700 py-8 text-center text-sm text-gray-400 dark:text-slate-500">
          No hay categorías de {title.toLowerCase()}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm divide-y divide-gray-50 dark:divide-slate-700">
          {categories.map(cat => (
            <div key={cat.id} className={`flex items-center gap-3 px-4 py-3 ${!cat.is_active ? 'opacity-50' : ''}`}>
              <div
                className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0"
                style={{ backgroundColor: `${cat.color}20` }}
              >
                <CategoryIcon nombre={cat.icono} color={cat.color} />
              </div>

              <span className="flex-1 text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{cat.nombre}</span>

              {!cat.is_active && <Badge variant="gray">Oculta</Badge>}

              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => onToggle(cat)}
                  className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition-colors"
                  title={cat.is_active ? 'Ocultar' : 'Mostrar'}
                >
                  {cat.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => onEdit(cat)}
                  className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                  title="Editar"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => onDelete(cat)}
                  className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                  title="Eliminar"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
