'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Trash2, Calendar, ChevronDown, ChevronUp, Pause, Play, Wallet, ArrowRight, ArrowLeft, Check } from 'lucide-react'
import { ActionMenu, ActionMenuItem } from '@/components/ui/ActionMenu'
import { SavingsGoal, SavingsAllocation } from '@/lib/types/database'
import { formatHNL } from '@/lib/utils/currency'
import { formatDate, diasRestantes } from '@/lib/utils/dates'
import { calcularPorcentaje } from '@/lib/utils/calculations'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { createClient } from '@/lib/supabase/client'
import { TransferirDesdeGeneralModal } from '@/components/ahorros/TransferirDesdeGeneralModal'
import { TransferirAQuincenaModal } from '@/components/ahorros/TransferirAQuincenaModal'
import { UsarMetaModal } from '@/components/ahorros/UsarMetaModal'

interface GoalCardProps {
  goal: SavingsGoal
  allocations?: SavingsAllocation[]
  onChanged: () => void
  metasRegulares?: SavingsGoal[]
}

const estadoBadge: Record<string, 'green' | 'yellow' | 'gray' | 'blue'> = {
  activa: 'green',
  completada: 'blue',
  pausada: 'yellow',
}

const estadoLabel: Record<string, string> = {
  activa: 'Activa',
  completada: 'Completada',
  pausada: 'Pausada',
}

export function GoalCard({ goal, allocations = [], onChanged, metasRegulares = [] }: GoalCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [modalTransferir, setModalTransferir] = useState(false)
  const [modalQuincena, setModalQuincena] = useState(false)
  const [modalUsar, setModalUsar] = useState(false)
  const [modalEnviarGeneral, setModalEnviarGeneral] = useState(false)
  const [montoEnviar, setMontoEnviar] = useState('')
  const [loadingEnviar, setLoadingEnviar] = useState(false)
  const pct = goal.es_general ? 100 : calcularPorcentaje(goal.monto_actual, goal.monto_objetivo)
  const dias = goal.fecha_limite ? diasRestantes(goal.fecha_limite) : null

  async function handleEnviarAGeneral() {
    const monto = parseFloat(montoEnviar)
    if (!monto || monto <= 0) { toast.error('Ingresa un monto válido'); return }
    if (monto > goal.monto_actual + 0.005) { toast.error(`Saldo insuficiente (${formatHNL(goal.monto_actual)})`); return }
    setLoadingEnviar(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoadingEnviar(false); return }
    const { error } = await supabase.rpc('transfer_to_general', {
      p_user_id: user.id,
      p_source_goal_id: goal.id,
      p_amount: monto,
    })
    if (error) toast.error(error.message || 'Error al trasladar')
    else {
      toast.success(`${formatHNL(monto)} enviados al Fondo General`)
      setModalEnviarGeneral(false)
      setMontoEnviar('')
      onChanged()
    }
    setLoadingEnviar(false)
  }

  async function handleDelete() {
    if (!confirm('¿Eliminar? Se perderán los registros de ahorro asociados.')) return
    setLoading(true)
    const supabase = createClient()
    await supabase.from('savings_goals').delete().eq('id', goal.id)
    toast.success(goal.es_general ? 'Fondo General eliminado' : 'Meta eliminada')
    onChanged()
  }

  async function togglePausa() {
    setLoading(true)
    const supabase = createClient()
    const newEstado = goal.estado === 'pausada' ? 'activa' : 'pausada'
    await supabase.from('savings_goals').update({ estado: newEstado }).eq('id', goal.id)
    toast.success(newEstado === 'pausada' ? 'Meta pausada' : 'Meta reactivada')
    onChanged()
    setLoading(false)
  }

  // Tarjeta especial para Fondo General
  if (goal.es_general) {
    return (
      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800/40 shadow-sm p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/40 rounded-lg">
              <Wallet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-slate-100">Fondo General</h3>
              <p className="text-xs text-gray-500 dark:text-slate-400">Ahorro sin meta específica</p>
            </div>
          </div>
          <ActionMenu items={[{
            label: 'Eliminar fondo general',
            icon: <Trash2 className="h-4 w-4" />,
            onClick: handleDelete,
            danger: true,
            disabled: loading,
          }]} />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500 dark:text-slate-400">Saldo acumulado</span>
          <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatHNL(goal.monto_actual)}</span>
        </div>

        {goal.monto_actual > 0 && (
          <div className="mt-2 flex flex-col gap-2">
            {metasRegulares.filter(g => g.monto_objetivo - g.monto_actual > 0.01).length > 0 && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setModalTransferir(true)}
                className="w-full border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-xs"
              >
                <ArrowRight className="h-3 w-3" />
                Trasladar a una meta
              </Button>
            )}
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setModalQuincena(true)}
              className="w-full border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 text-xs"
            >
              <ArrowRight className="h-3 w-3" />
              Apoyar quincena actual
            </Button>
          </div>
        )}

        {allocations.length > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 mt-3 text-xs text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition-colors"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {allocations.length} movimientos
          </button>
        )}

        {expanded && (
          <div className="mt-2 space-y-1 border-t border-emerald-100 dark:border-emerald-800/40 pt-2">
            {allocations.slice(0, 10).map(alloc => (
              <div key={alloc.id} className="flex justify-between text-xs text-gray-500 dark:text-slate-400">
                <span>{formatDate(alloc.fecha)}{alloc.notas ? ` · ${alloc.notas}` : ''}</span>
                <span className={`font-medium ${alloc.monto >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                  {alloc.monto >= 0 ? '+' : ''}{formatHNL(alloc.monto)}
                </span>
              </div>
            ))}
          </div>
        )}

        <TransferirDesdeGeneralModal
          open={modalTransferir}
          onClose={() => setModalTransferir(false)}
          fondoGeneral={goal}
          metasDestino={metasRegulares}
          onSuccess={onChanged}
        />

        <TransferirAQuincenaModal
          open={modalQuincena}
          onClose={() => setModalQuincena(false)}
          fondoDisponible={goal.monto_actual}
          onSuccess={onChanged}
        />
      </div>
    )
  }

  // Meta cumplida Y ya usada (fondo en cero): solo historial.
  // Fila mínima, sin barra ni acciones — únicamente qué era y el botón de borrar.
  // Ojo: una meta puede estar 'completada' con dinero adentro (el trigger la marca
  // al alcanzar el objetivo), y esa NO va acá: todavía se puede usar.
  if (goal.estado === 'completada' && goal.monto_actual <= 0.01) {
    return (
      <div className="flex items-center gap-3 py-2.5">
        <div className="h-6 w-6 shrink-0 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
          <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <span className="flex-1 min-w-0 truncate text-sm text-gray-600 dark:text-slate-300">
          {goal.nombre}
        </span>
        <span className="text-xs text-gray-400 dark:text-slate-500 shrink-0">
          {formatDate(goal.updated_at)}
        </span>
        <span className="text-sm font-medium text-gray-500 dark:text-slate-400 shrink-0 tabular-nums">
          {formatHNL(goal.monto_objetivo)}
        </span>
        <button
          onClick={handleDelete}
          disabled={loading}
          className="p-1 text-gray-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 transition-colors shrink-0"
          title="Eliminar del historial"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  // Tarjeta normal para metas regulares
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-900 dark:text-slate-100 truncate">{goal.nombre}</h3>
            <Badge variant={estadoBadge[goal.estado]}>{estadoLabel[goal.estado]}</Badge>
          </div>
          {goal.fecha_limite && goal.estado !== 'completada' && (
            <div className="flex items-center gap-1 mt-1 text-xs text-gray-400 dark:text-slate-500">
              <Calendar className="h-3 w-3" />
              <span>{formatDate(goal.fecha_limite)}</span>
              {dias !== null && dias >= 0 && (
                <span className={dias < 30 ? 'text-yellow-600 dark:text-yellow-500' : ''}>
                  ({dias} días restantes)
                </span>
              )}
            </div>
          )}
        </div>
        <div className="shrink-0">
          <ActionMenu items={[
            ...(goal.estado !== 'completada' ? [{
              label: goal.estado === 'pausada' ? 'Reactivar meta' : 'Pausar meta',
              icon: goal.estado === 'pausada' ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />,
              onClick: togglePausa,
              disabled: loading,
            }] : []),
            ...(goal.estado === 'activa' && goal.monto_actual > 0 ? [{
              label: 'Enviar al Fondo General',
              icon: <ArrowLeft className="h-4 w-4" />,
              onClick: () => setModalEnviarGeneral(true),
            }] : []),
            {
              label: 'Eliminar meta',
              icon: <Trash2 className="h-4 w-4" />,
              onClick: handleDelete,
              danger: true,
              disabled: loading,
            },
          ] as ActionMenuItem[]} />
        </div>
      </div>

      <ProgressBar value={pct} showLabel />

      <div className="flex justify-between mt-2 text-sm">
        <span className="font-medium text-emerald-600 dark:text-emerald-400">{formatHNL(goal.monto_actual)}</span>
        <span className="text-gray-400 dark:text-slate-500">de {formatHNL(goal.monto_objetivo)}</span>
      </div>

      {allocations.length > 0 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 mt-3 text-xs text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition-colors"
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {allocations.length} asignaciones
        </button>
      )}

      {expanded && (
        <div className="mt-2 space-y-1 border-t border-gray-50 dark:border-slate-700 pt-2">
          {allocations.slice(0, 10).map(alloc => (
            <div key={alloc.id} className="flex justify-between text-xs text-gray-500 dark:text-slate-400">
              <span>{formatDate(alloc.fecha)}{alloc.notas ? ` · ${alloc.notas}` : ''}</span>
              <span className={`font-medium ${alloc.monto >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                {alloc.monto >= 0 ? '+' : ''}{formatHNL(alloc.monto)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Acción principal a la vista: usar la meta. El resto vive en el menú "⋯". */}
      {goal.monto_actual > 0 && (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setModalUsar(true)}
          className="mt-3 w-full text-xs border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
        >
          <Check className="h-3 w-3" />
          Usar esta meta
        </Button>
      )}

      <UsarMetaModal
        open={modalUsar}
        onClose={() => setModalUsar(false)}
        goal={goal}
        onSuccess={onChanged}
      />

      {/* Modal enviar al fondo general */}
      <Modal
        open={modalEnviarGeneral}
        onClose={() => { setModalEnviarGeneral(false); setMontoEnviar('') }}
        title={`Enviar de "${goal.nombre}" al Fondo General`}
        size="sm"
      >
        <div className="flex flex-col gap-4">
          <div className="rounded-lg bg-gray-50 dark:bg-slate-700/50 px-4 py-3 flex items-center justify-between text-sm">
            <span className="text-gray-500 dark:text-slate-400">Saldo disponible en la meta</span>
            <span className="font-semibold text-gray-800 dark:text-slate-100">{formatHNL(goal.monto_actual)}</span>
          </div>
          <Input
            label="Monto a enviar (L)"
            type="number"
            min="0"
            step="0.01"
            max={goal.monto_actual}
            placeholder="0.00"
            value={montoEnviar}
            onChange={e => setMontoEnviar(e.target.value)}
          />
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => { setModalEnviarGeneral(false); setMontoEnviar('') }}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleEnviarAGeneral}
              loading={loadingEnviar}
              disabled={!montoEnviar || parseFloat(montoEnviar) <= 0}
              className="flex-1"
            >
              <ArrowLeft className="h-4 w-4" />
              Enviar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
