-- ════════════════════════════════════════════════════════════════════════════
-- 047 · La deuda de tarjeta se reserva del disponible
-- ════════════════════════════════════════════════════════════════════════════
-- Gastar con tarjeta sube la deuda pero, hasta ahora, no bajaba el disponible
-- (la tarjeta no es cuenta líquida). Resultado: parecía que había plata de más.
--
-- La deuda de la tarjeta ES, exactamente, lo que hay que reservar para pagarla.
-- Así que el disponible pasa a descontarla:
--   disponible = Σ cuentas líquidas − ahorros apartados − deuda de tarjetas
--
-- Efecto:
--   · Comprás con tarjeta → sube la deuda → baja "Para usar" al instante.
--   · Pagás la tarjeta    → baja la cuenta líquida Y baja la deuda → el
--     disponible no se mueve (usás plata que ya estaba reservada).
-- Es autoconsistente: no hay una cuenta duplicada que se pueda desincronizar.
-- Se agrega la columna deuda_tarjetas para mostrarla como "Reservado".
-- ════════════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.get_dashboard_totales(UUID);

CREATE OR REPLACE FUNCTION public.get_dashboard_totales(p_user_id UUID)
RETURNS TABLE (
  total_ingresos        NUMERIC,
  total_gastos          NUMERIC,
  total_ahorros         NUMERIC,
  ahorros_apartados     NUMERIC,   -- ahorro vigente (metas/fondos no completados)
  apartado_completadas  NUMERIC,   -- metas ya gastadas
  deuda_tarjetas        NUMERIC,   -- reservado para pagar tarjetas
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
    -- Deuda total de tarjetas = reservado para pagarlas.
    COALESCE((SELECT SUM(GREATEST(-s.saldo, 0)) FROM public.get_saldos_cuentas(p_user_id) s
              WHERE s.tipo = 'tarjeta'), 0),
    COALESCE((SELECT SUM(CASE WHEN tipo = 'entrada' THEN monto ELSE -monto END)
              FROM public.cash_entries WHERE user_id = p_user_id), 0),
    -- Disponible = líquidas − TODO lo apartado − deuda de tarjetas.
    COALESCE((SELECT SUM(s.saldo) FROM public.get_saldos_cuentas(p_user_id) s
              WHERE s.es_disponible), 0)
      - COALESCE((SELECT SUM(monto_actual) FROM public.savings_goals
                  WHERE user_id = p_user_id), 0)
      - COALESCE((SELECT SUM(GREATEST(-s.saldo, 0)) FROM public.get_saldos_cuentas(p_user_id) s
                  WHERE s.tipo = 'tarjeta'), 0);
$$;
