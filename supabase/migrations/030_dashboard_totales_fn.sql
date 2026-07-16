-- ─── 030: Función agregada para totales del dashboard ────────────────────────
-- El dashboard calculaba saldo_total sumando en JS TODO el historial de
-- income_entries/expenses/savings_allocations/cash_entries traído por fila.
-- Esto crece sin límite con el tiempo. Se reemplaza por una suma hecha en
-- Postgres (usa los índices existentes) y se transfiere un solo número por
-- tabla en vez de todas las filas. SECURITY INVOKER: respeta RLS igual que
-- cualquier query normal del usuario autenticado.

CREATE OR REPLACE FUNCTION public.get_dashboard_totales(p_user_id UUID)
RETURNS TABLE (
  total_ingresos NUMERIC,
  total_gastos NUMERIC,
  total_ahorros NUMERIC,
  cash_balance NUMERIC
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    COALESCE((SELECT SUM(monto) FROM public.income_entries WHERE user_id = p_user_id), 0),
    COALESCE((SELECT SUM(monto) FROM public.expenses WHERE user_id = p_user_id), 0),
    COALESCE((SELECT SUM(monto) FROM public.savings_allocations WHERE user_id = p_user_id), 0),
    COALESCE((SELECT SUM(CASE WHEN tipo = 'entrada' THEN monto ELSE -monto END)
              FROM public.cash_entries WHERE user_id = p_user_id), 0);
$$;
