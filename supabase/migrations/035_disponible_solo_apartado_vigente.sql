-- ════════════════════════════════════════════════════════════════════════════
-- 035 · El disponible solo descuenta el ahorro que SIGUE reservado
-- ════════════════════════════════════════════════════════════════════════════
-- Bug: saldo_disponible restaba SUM(savings_allocations) = todo lo ahorrado
-- alguna vez, incluidas las metas ya completadas y gastadas. Como al gastar una
-- meta se registra un expense (que ya bajó el saldo de la cuenta), restar además
-- la allocation de esa meta descuenta el dinero DOS veces.
--
-- Corrección: descontar solo lo que todavía está apartado en las cuentas —
-- Fondo General + metas y fondos de gasto fijo NO completados. Las completadas
-- se asumen gastadas, así que su dinero ya no está y no se descuenta.
--
-- Se agrega la columna ahorros_apartados para que la pantalla de cuentas use el
-- MISMO número (antes usaba total_ahorros y por eso también inflaba).
-- Agregar columna cambia el tipo de retorno ⇒ hay que soltar la función primero.
-- ════════════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.get_dashboard_totales(UUID);

CREATE OR REPLACE FUNCTION public.get_dashboard_totales(p_user_id UUID)
RETURNS TABLE (
  total_ingresos    NUMERIC,
  total_gastos      NUMERIC,
  total_ahorros     NUMERIC,   -- histórico: todo lo asignado alguna vez
  ahorros_apartados NUMERIC,   -- lo que SIGUE reservado (no completado)
  cash_balance      NUMERIC,
  saldo_disponible  NUMERIC
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    COALESCE((SELECT SUM(monto) FROM public.income_entries WHERE user_id = p_user_id), 0),
    COALESCE((SELECT SUM(monto) FROM public.expenses WHERE user_id = p_user_id), 0),
    COALESCE((SELECT SUM(monto) FROM public.savings_allocations WHERE user_id = p_user_id), 0),
    -- Solo fondos vigentes: Fondo General + metas/fondos de gasto fijo activos o
    -- pausados. Las completadas quedan fuera (su plata ya se gastó).
    COALESCE((SELECT SUM(monto_actual) FROM public.savings_goals
              WHERE user_id = p_user_id AND estado <> 'completada'), 0),
    COALESCE((SELECT SUM(CASE WHEN tipo = 'entrada' THEN monto ELSE -monto END)
              FROM public.cash_entries WHERE user_id = p_user_id), 0),
    -- Disponible = Σ cuentas líquidas − ahorro que sigue reservado.
    COALESCE((SELECT SUM(s.saldo) FROM public.get_saldos_cuentas(p_user_id) s
              WHERE s.es_disponible), 0)
      - COALESCE((SELECT SUM(monto_actual) FROM public.savings_goals
                  WHERE user_id = p_user_id AND estado <> 'completada'), 0);
$$;
