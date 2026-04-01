'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  Utensils, Car, Home, Zap, Heart, BookOpen, Tv, Shirt, Tag,
  Briefcase, Laptop, ShoppingBag, TrendingUp, PlusCircle, Coffee,
  Gift, Wallet, Star, Music, Plane, Gamepad2, Dumbbell, Baby,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Category } from '@/lib/types/database'

const COLORES = [
  '#EF4444', '#F97316', '#F59E0B', '#EAB308',
  '#84CC16', '#22C55E', '#10B981', '#14B8A6',
  '#06B6D4', '#3B82F6', '#6366F1', '#8B5CF6',
  '#A855F7', '#EC4899', '#F43F5E', '#6B7280',
]

export const ICONOS: { nombre: string; componente: React.ElementType }[] = [
  { nombre: 'utensils', componente: Utensils },
  { nombre: 'car', componente: Car },
  { nombre: 'home', componente: Home },
  { nombre: 'zap', componente: Zap },
  { nombre: 'heart', componente: Heart },
  { nombre: 'book-open', componente: BookOpen },
  { nombre: 'tv', componente: Tv },
  { nombre: 'shirt', componente: Shirt },
  { nombre: 'tag', componente: Tag },
  { nombre: 'briefcase', componente: Briefcase },
  { nombre: 'laptop', componente: Laptop },
  { nombre: 'shopping-bag', componente: ShoppingBag },
  { nombre: 'trending-up', componente: TrendingUp },
  { nombre: 'plus-circle', componente: PlusCircle },
  { nombre: 'coffee', componente: Coffee },
  { nombre: 'gift', componente: Gift },
  { nombre: 'wallet', componente: Wallet },
  { nombre: 'star', componente: Star },
  { nombre: 'music', componente: Music },
  { nombre: 'plane', componente: Plane },
  { nombre: 'gamepad-2', componente: Gamepad2 },
  { nombre: 'dumbbell', componente: Dumbbell },
  { nombre: 'baby', componente: Baby },
]

const schema = z.object({
  nombre: z.string().min(1, 'Requerido').max(40, 'Máximo 40 caracteres'),
  tipo: z.enum(['gasto', 'ingreso']),
})

type FormData = z.infer<typeof schema>

interface Props {
  category?: Category   // Si se pasa, es edición
  defaultTipo?: 'gasto' | 'ingreso'
  onSuccess: () => void
  onCancel?: () => void
}

export function CategoryForm({ category, defaultTipo = 'gasto', onSuccess, onCancel }: Props) {
  const [loading, setLoading] = useState(false)
  const [color, setColor] = useState(category?.color || '#10B981')
  const [icono, setIcono] = useState(category?.icono || 'tag')

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      nombre: category?.nombre || '',
      tipo: category?.tipo || defaultTipo,
    },
  })

  async function onSubmit(data: FormData) {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    if (category) {
      const { error } = await supabase
        .from('categories')
        .update({ nombre: data.nombre, tipo: data.tipo, color, icono })
        .eq('id', category.id)

      if (error) {
        toast.error('Error al actualizar categoría')
      } else {
        toast.success('Categoría actualizada')
        onSuccess()
      }
    } else {
      const { error } = await supabase.from('categories').insert({
        user_id: user.id,
        nombre: data.nombre,
        tipo: data.tipo,
        color,
        icono,
      })

      if (error) {
        toast.error('Error al crear categoría')
      } else {
        toast.success('Categoría creada')
        onSuccess()
      }
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <Input
        label="Nombre"
        placeholder="Ej: Mascotas, Suscripciones..."
        error={errors.nombre?.message}
        {...register('nombre')}
      />

      {/* Tipo */}
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-gray-700 dark:text-slate-300">Tipo</span>
        <div className="grid grid-cols-2 gap-2">
          {(['gasto', 'ingreso'] as const).map(t => (
            <label key={t} className="flex items-center gap-2 cursor-pointer">
              <input type="radio" value={t} {...register('tipo')} className="sr-only peer" />
              <span className="w-full text-center rounded-lg border px-3 py-2 text-sm font-medium transition-colors peer-checked:bg-emerald-600 peer-checked:text-white peer-checked:border-emerald-600 border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700">
                {t === 'gasto' ? 'Gasto' : 'Ingreso'}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Color */}
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-gray-700 dark:text-slate-300">Color</span>
        <div className="flex flex-wrap gap-2">
          {COLORES.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`h-7 w-7 rounded-full transition-transform ${color === c ? 'scale-125 ring-2 ring-offset-1 ring-gray-400' : 'hover:scale-110'}`}
              style={{ backgroundColor: c }}
              title={c}
            />
          ))}
        </div>
      </div>

      {/* Icono */}
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-gray-700 dark:text-slate-300">Ícono</span>
        <div className="flex flex-wrap gap-2">
          {ICONOS.map(({ nombre, componente: Icon }) => (
            <button
              key={nombre}
              type="button"
              onClick={() => setIcono(nombre)}
              title={nombre}
              className={`p-2 rounded-lg border transition-all ${
                icono === nombre
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                  : 'border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700'
              }`}
            >
              <Icon className="h-4 w-4 text-gray-600 dark:text-slate-400" style={{ color: icono === nombre ? color : undefined }} />
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3 pt-1">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">
            Cancelar
          </Button>
        )}
        <Button type="submit" loading={loading} className="flex-1">
          {category ? 'Guardar cambios' : 'Crear categoría'}
        </Button>
      </div>
    </form>
  )
}
