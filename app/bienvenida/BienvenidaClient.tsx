'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  PiggyBank, ReceiptText, CreditCard, HandCoins, Building2, Wallet, Check,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { modulosVacios, ModuloKey } from '@/lib/preferencias'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

// Módulos que se ofrecen en la bienvenida. El resto (ahorro programado,
// presupuestos, categorías) queda para activar después en Configuración.
const OPCIONES: { key: ModuloKey; label: string; descripcion: string; icon: typeof PiggyBank }[] = [
  { key: 'ahorros',       label: 'Metas de ahorro',   descripcion: 'Guardá para objetivos', icon: PiggyBank },
  { key: 'gastos_fijos',  label: 'Gastos fijos',      descripcion: 'Pagos de cada quincena', icon: ReceiptText },
  { key: 'suscripciones', label: 'Suscripciones',     descripcion: 'Netflix, seguros, etc.', icon: CreditCard },
  { key: 'deudas',        label: 'Deudas y préstamos', descripcion: 'Lo que debés o te deben', icon: HandCoins },
  { key: 'cooperativa',   label: 'Cooperativa',       descripcion: 'Aportaciones y ahorro', icon: Building2 },
  { key: 'efectivo',      label: 'Efectivo',          descripcion: 'Dinero en mano', icon: Wallet },
]

const COBROS = [
  { value: 'quincenal', label: 'Por quincena', descripcion: 'Cada 15 días' },
  { value: 'mensual',   label: 'Mensual',      descripcion: 'Una vez al mes' },
  { value: 'variable',  label: 'Variable',     descripcion: 'Ingresos irregulares' },
] as const

export default function BienvenidaClient({ nombre }: { nombre: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [cobro, setCobro] = useState<'quincenal' | 'mensual' | 'variable'>('quincenal')
  const [activos, setActivos] = useState<Set<ModuloKey>>(new Set())
  const [saldo, setSaldo] = useState('')

  function toggle(key: ModuloKey) {
    setActivos(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  async function handleEmpezar() {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    // Armar los módulos: los elegidos + quincena si cobra por quincena.
    const modulos = modulosVacios()
    activos.forEach(k => { modulos[k] = true })
    if (cobro === 'quincenal') modulos.quincena = true

    const { error } = await supabase
      .from('profiles')
      .update({
        onboarding_completo: true,
        preferencias: { cobro, modulos },
      })
      .eq('id', user.id)

    if (error) {
      toast.error('No se pudo guardar. Intentá de nuevo.')
      setLoading(false)
      return
    }

    // Saldo inicial de la cuenta principal (opcional).
    const saldoNum = parseFloat(saldo)
    if (saldoNum > 0) {
      await supabase.from('cuentas')
        .update({ saldo_inicial: saldoNum })
        .eq('user_id', user.id)
        .eq('es_principal', true)
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm p-6 sm:p-8 flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
            {nombre ? `Hola, ${nombre}` : 'Bienvenido'} 👋
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Configurá tu app en un minuto. Podés cambiar todo esto después.
          </p>
        </div>

        {/* Cómo cobra */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700 dark:text-slate-300">¿Cómo cobrás normalmente?</label>
          <div className="grid grid-cols-3 gap-2">
            {COBROS.map(c => (
              <button
                key={c.value}
                type="button"
                onClick={() => setCobro(c.value)}
                className={`rounded-xl border p-3 text-left transition-colors ${
                  cobro === c.value
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
                    : 'border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700'
                }`}
              >
                <p className="text-sm font-medium text-gray-900 dark:text-slate-100">{c.label}</p>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{c.descripcion}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Módulos */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700 dark:text-slate-300">¿Qué querés usar?</label>
          <p className="text-xs text-gray-400 dark:text-slate-500 -mt-1">
            Elegí lo que te sirva. Cuentas, ingresos y gastos ya vienen incluidos.
          </p>
          <div className="grid grid-cols-2 gap-2 mt-1">
            {OPCIONES.map(({ key, label, descripcion, icon: Icon }) => {
              const on = activos.has(key)
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggle(key)}
                  className={`relative flex items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
                    on
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
                      : 'border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700'
                  }`}
                >
                  <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${on ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-slate-500'}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-slate-100">{label}</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500">{descripcion}</p>
                  </div>
                  {on && <Check className="h-4 w-4 text-indigo-600 dark:text-indigo-400 absolute top-2.5 right-2.5" />}
                </button>
              )
            })}
          </div>
        </div>

        {/* Saldo inicial */}
        <Input
          label="¿Cuánto tenés hoy en tu cuenta principal? (opcional)"
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          value={saldo}
          onChange={e => setSaldo(e.target.value)}
        />

        <Button onClick={handleEmpezar} loading={loading} className="w-full">
          Empezar
        </Button>
      </div>
    </div>
  )
}
