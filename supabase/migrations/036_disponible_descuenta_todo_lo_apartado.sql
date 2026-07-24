-- ════════════════════════════════════════════════════════════════════════════
-- 036 · El disponible descuenta TODO lo apartado (vigente + ya gastado)
-- ════════════════════════════════════════════════════════════════════════════
-- La 035 excluía las metas completadas del descuento, asumiendo que su gasto se
-- había registrado como un `expense` (y que restarlas sería doble conteo). Pero
-- en la práctica, cuando una meta se completa y se gasta la plata NO se registra
-- un gasto aparte: la meta misma es el registro. Entonces ese dinero sigue
-- físicamente dentro del saldo de la cuenta líquida (income − expenses nunca
-- bajó), y al no restarlo reaparecía como "disponible" siendo plata ya gastada.
--
-- Corrección:
--   · saldo_disponible descuenta TODO lo apartado (metas activas + completadas +
--     fondos de gasto fijo). Nada apartado cuenta como gastable.
--   · ahorros_apartados = solo lo vigente (activas/pausadas) → es lo que se
--     muestra como "ahorro" real.
--   · apartado_completadas = lo de metas ya cumplidas → dinero que se usó; se
--     resta del disponible pero NO es ahorro. Se expone aparte para el desglose.
--
-- Nota: los fondos de gasto fijo, al pagarse, generan una allocation negativa
-- que deja su monto_actual en 0 (y sí registran expense), así que no sufren el
-- problema: contribuyen 0 y no hay doble conteo.
-- ════════════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.get_dashboard_totales(UUID);

CREATE OR REPLACE FUNCTION public.get_dashboard_totales(p_user_id UUID)
RETURNS TABLE (
  total_ingresos        NUMERIC,
  total_gastos          NUMERIC,
  total_ahorros         NUMERIC,   -- histórico: todo lo asignado alguna vez
  ahorros_apartados     NUMERIC,   -- vigente: ahorro real (no completado)
  apartado_completadas  NUMERIC,   -- ya gastado: ni ahorro ni disponible
  cash_balance          NUMERIC,
  saldo_disponible      NUMERIC
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    COALESCE((SELECT SUM(monto) FROM public.income_entries WHERE user_id = p_user_id), 0),
    COALESCE((SELECT SUM(monto) FROM public.expenses WHERE user_id = p_user_id), 0),
    COALESCE((SELECT SUM(monto) FROM public.savings_allocations WHERE user_id = p_user_id), 0),
    COALESCE((SELECT SUM(monto_actual) FROM public.savings_goals
              WHERE user_id = p_user_id AND estado <> 'completada'), 0),
    COALESCE((SELECT SUM(monto_actual) FROM public.savings_goals
              WHERE user_id = p_user_id AND estado =  'completada'), 0),
    COALESCE((SELECT SUM(CASE WHEN tipo = 'entrada' THEN monto ELSE -monto END)
              FROM public.cash_entries WHERE user_id = p_user_id), 0),
    -- Disponible = Σ cuentas líquidas − TODO lo apartado (vigente + completado).
    COALESCE((SELECT SUM(s.saldo) FROM public.get_saldos_cuentas(p_user_id) s
              WHERE s.es_disponible), 0)
      - COALESCE((SELECT SUM(monto_actual) FROM public.savings_goals
                  WHERE user_id = p_user_id), 0);
$$;
