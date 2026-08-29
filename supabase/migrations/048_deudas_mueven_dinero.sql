-- ════════════════════════════════════════════════════════════════════════════
-- 048 · Los abonos/cobros de deudas mueven dinero real
-- ════════════════════════════════════════════════════════════════════════════
-- El módulo de deudas estaba desconectado: registrar un abono solo escribía en
-- deuda_pagos y no tocaba ninguna cuenta, así que el disponible no bajaba. Mismo
-- patrón que tenía la cooperativa antes de arreglarla.
--
-- Ahora cada pago indica de qué cuenta sale (o a cuál entra) y el saldo lo
-- refleja, según el tipo de deuda:
--   · 'deuda'    (yo debo)   → abonar = plata que sale  → baja la cuenta
--   · 'prestamo' (me deben)  → cobrar = plata que entra → sube la cuenta
--
-- No cuenta como "gasto" (es saldar una deuda, no un gasto nuevo): solo mueve el
-- saldo de la cuenta, igual que la cooperativa.
--
-- Los pagos ya existentes quedan sin cuenta (cuenta_id NULL) y no afectan saldos,
-- para no mover dinero retroactivamente.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.deuda_pagos
  ADD COLUMN IF NOT EXISTS cuenta_id UUID
    REFERENCES public.cuentas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_deuda_pagos_cuenta
  ON public.deuda_pagos(cuenta_id) WHERE cuenta_id IS NOT NULL;


-- Mismo tipo de retorno ⇒ alcanza CREATE OR REPLACE.
CREATE OR REPLACE FUNCTION public.get_saldos_cuentas(p_user_id UUID)
RETURNS TABLE (
  id            UUID,
  nombre        TEXT,
  tipo          TEXT,
  es_disponible BOOLEAN,
  es_principal  BOOLEAN,
  color         TEXT,
  orden         INT,
  origen        TEXT,
  saldo         NUMERIC
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    c.id, c.nombre, c.tipo, c.es_disponible, c.es_principal, c.color, c.orden,
    'cuenta'::TEXT AS origen,
    c.saldo_inicial
      + COALESCE((SELECT SUM(monto) FROM public.income_entries i WHERE i.cuenta_id = c.id), 0)
      - COALESCE((SELECT SUM(monto) FROM public.expenses e WHERE e.cuenta_id = c.id), 0)
      + COALESCE((SELECT SUM(CASE WHEN ce.tipo = 'entrada' THEN ce.monto ELSE -ce.monto END)
                  FROM public.cash_entries ce WHERE ce.cuenta_id = c.id), 0)
      - COALESCE((SELECT SUM(monto) FROM public.transferencias t WHERE t.cuenta_origen_id = c.id), 0)
      + COALESCE((SELECT SUM(monto) FROM public.transferencias t WHERE t.cuenta_destino_id = c.id), 0)
      - COALESCE((SELECT SUM(monto) FROM public.cooperativa_movimientos cm WHERE cm.cuenta_bancaria_id = c.id), 0)
      -- Deudas: abono de deuda resta, cobro de préstamo suma.
      + COALESCE((SELECT SUM(CASE WHEN d.tipo = 'deuda' THEN -dp.monto ELSE dp.monto END)
                  FROM public.deuda_pagos dp
                  JOIN public.deudas d ON d.id = dp.deuda_id
                  WHERE dp.cuenta_id = c.id), 0)
      AS saldo
  FROM public.cuentas c
  WHERE c.user_id = p_user_id AND c.activo

  UNION ALL

  SELECT
    cc.id,
    CASE cc.tipo WHEN 'aportaciones' THEN 'Cooperativa · Aportaciones'
                 ELSE 'Cooperativa · Ahorro retirable' END,
    'cooperativa'::TEXT,
    FALSE, FALSE, NULL::TEXT,
    100 + (CASE cc.tipo WHEN 'aportaciones' THEN 0 ELSE 1 END),
    'cooperativa'::TEXT,
    cc.saldo
  FROM public.cooperativa_cuentas cc
  WHERE cc.user_id = p_user_id
    AND COALESCE(
      (SELECT (p.preferencias->'modulos'->>'cooperativa')::boolean
       FROM public.profiles p WHERE p.id = p_user_id),
      TRUE
    )

  ORDER BY orden;
$$;
