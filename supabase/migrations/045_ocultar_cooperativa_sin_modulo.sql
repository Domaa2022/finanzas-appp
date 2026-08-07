-- ════════════════════════════════════════════════════════════════════════════
-- 045 · Ocultar las cuentas de cooperativa si el módulo no está activado
-- ════════════════════════════════════════════════════════════════════════════
-- Las cuentas de cooperativa se siembran para todos (mig. 023) y get_saldos_cuentas
-- las proyecta en la lista. Resultado: a un usuario que no usa cooperativa igual
-- le aparecían en /cuentas y en el resumen del dashboard.
--
-- Fix en un solo punto: la rama de cooperativa solo se incluye si el módulo está
-- activado en las preferencias. Si no hay preferencia (usuarios previos), se
-- muestra como antes.
-- ════════════════════════════════════════════════════════════════════════════

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
    -- Solo si el módulo de cooperativa está activo (o no hay preferencia: legacy).
    AND COALESCE(
      (SELECT (p.preferencias->'modulos'->>'cooperativa')::boolean
       FROM public.profiles p WHERE p.id = p_user_id),
      TRUE
    )

  ORDER BY orden;
$$;
