-- ════════════════════════════════════════════════════════════════════════════
-- 037 · «Usar meta»: registrar el gasto real al cumplir una meta de ahorro
-- ════════════════════════════════════════════════════════════════════════════
-- Hasta ahora, cuando se cumplía una meta y se gastaba la plata, no se
-- registraba la salida: la meta quedaba con su monto_actual intacto y el dinero
-- seguía dentro del saldo de la cuenta. Por eso el disponible tuvo que
-- descontar también las metas completadas (migración 036) — un parche sobre el
-- síntoma.
--
-- Esta función cierra la raíz: al usar una meta se registra el gasto real y se
-- vacía el fondo, así el saldo de la cuenta refleja la realidad.
--
-- Efecto neto sobre el disponible: NINGUNO, y es lo correcto. Antes de usarla
-- el dinero estaba apartado (no disponible); después está gastado (tampoco).
-- Lo que cambia es que el saldo de la cuenta baja de verdad y la meta deja de
-- aparecer como «apartado_completadas».
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.usar_meta(
  p_user_id     UUID,
  p_goal_id     UUID,
  p_category_id UUID DEFAULT NULL,
  p_cuenta_id   UUID DEFAULT NULL,
  p_monto       NUMERIC DEFAULT NULL,   -- NULL = todo lo acumulado
  p_fecha       DATE DEFAULT CURRENT_DATE,
  p_notas       TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_goal        RECORD;
  v_monto       NUMERIC;
  v_category_id UUID;
  v_cuenta_id   UUID;
  v_restante    NUMERIC;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT id, nombre, monto_actual, estado, es_general, es_gasto_fijo
  INTO v_goal
  FROM public.savings_goals
  WHERE id = p_goal_id AND user_id = p_user_id;

  IF v_goal.id IS NULL THEN
    RAISE EXCEPTION 'Meta no encontrada';
  END IF;
  IF COALESCE(v_goal.es_general, FALSE) THEN
    RAISE EXCEPTION 'El Fondo General no se usa con este método; usá los traslados';
  END IF;
  IF COALESCE(v_goal.es_gasto_fijo, FALSE) THEN
    RAISE EXCEPTION 'Los fondos de gasto fijo se pagan con pagar_gasto_fijo';
  END IF;

  v_monto := COALESCE(p_monto, v_goal.monto_actual);

  IF v_monto <= 0 THEN
    RAISE EXCEPTION 'El monto debe ser mayor a 0';
  END IF;
  IF v_monto > v_goal.monto_actual + 0.005 THEN
    RAISE EXCEPTION 'La meta solo tiene % acumulado', v_goal.monto_actual;
  END IF;

  -- Categoría del gasto: la elegida, o un respaldo (expenses.category_id es NOT NULL)
  v_category_id := p_category_id;
  IF v_category_id IS NULL THEN
    SELECT id INTO v_category_id FROM public.categories
    WHERE user_id = p_user_id AND tipo = 'gasto' AND nombre = 'Otros Gastos' LIMIT 1;
  END IF;
  IF v_category_id IS NULL THEN
    SELECT id INTO v_category_id FROM public.categories
    WHERE user_id = p_user_id AND tipo = 'gasto' ORDER BY created_at LIMIT 1;
  END IF;
  IF v_category_id IS NULL THEN
    RAISE EXCEPTION 'No hay una categoría de gasto disponible para registrar el uso';
  END IF;

  -- Cuenta de la que sale: la elegida, o la principal
  v_cuenta_id := p_cuenta_id;
  IF v_cuenta_id IS NULL THEN
    SELECT id INTO v_cuenta_id FROM public.cuentas
    WHERE user_id = p_user_id AND es_principal LIMIT 1;
  END IF;

  -- 1. Vaciar (o reducir) el fondo de la meta.
  INSERT INTO public.savings_allocations
    (user_id, income_entry_id, savings_goal_id, monto, fecha, notas)
  VALUES
    (p_user_id, NULL, p_goal_id, -v_monto, p_fecha,
     COALESCE(p_notas, 'Meta usada: ' || v_goal.nombre));

  -- 2. Registrar el gasto real: acá es donde por fin baja el saldo de la cuenta.
  INSERT INTO public.expenses
    (user_id, monto, category_id, cuenta_id, descripcion, fecha, notas)
  VALUES
    (p_user_id, v_monto, v_category_id, v_cuenta_id, v_goal.nombre, p_fecha, 'Meta cumplida');

  -- 3. Marcar completada si no queda nada.
  --    OJO: va DESPUÉS del insert, porque el trigger sync_savings_goal_balance
  --    recalcula el estado al mover las allocations y la dejaría en 'activa'.
  SELECT monto_actual INTO v_restante
  FROM public.savings_goals WHERE id = p_goal_id;

  IF v_restante <= 0.01 THEN
    UPDATE public.savings_goals
    SET estado = 'completada', updated_at = now()
    WHERE id = p_goal_id;
  END IF;

  RETURN jsonb_build_object(
    'nombre',   v_goal.nombre,
    'monto',    v_monto,
    'restante', GREATEST(COALESCE(v_restante, 0), 0)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
