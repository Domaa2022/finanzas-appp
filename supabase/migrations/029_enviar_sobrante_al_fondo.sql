-- ─── 029: Cerrar período → sobrante al Fondo General ────────────────────────
-- Cuando se registra un ingreso nuevo y se fija como quincena actual, el
-- sobrante del período que deja de ser actual se envía automáticamente al
-- Fondo General (en vez de hacerlo a mano con el botón "Ahorrar sobrante").
--
-- El sobrante se calcula igual que `sobranteAhorrable` en el dashboard:
--   sobrante = monto_ingreso − gastos_del_período − ahorros_reales
-- donde ahorros_reales descuenta los "apoyos" (allocations negativas que
-- trajeron dinero DESDE el Fondo General hacia la quincena).
--
-- SEGURO con o sin el trigger de la 028: monto_actual se fija al valor
-- ABSOLUTO (SUM de allocations), no incremental, así nunca se duplica.

CREATE OR REPLACE FUNCTION public.enviar_sobrante_al_fondo(
  p_user_id  UUID,
  p_income_id UUID
) RETURNS NUMERIC AS $$
DECLARE
  v_income          RECORD;
  v_gastos          NUMERIC;
  v_ahorros_ya      NUMERIC;
  v_apoyo           NUMERIC;
  v_sobrante        NUMERIC;
  v_general_goal_id UUID;
  v_ya_cerrado      INT;
BEGIN
  SELECT id, monto, fecha INTO v_income
  FROM public.income_entries
  WHERE id = p_income_id AND user_id = p_user_id;

  IF NOT FOUND THEN RETURN 0; END IF;

  -- Idempotencia: si este período ya tiene un cierre, no volver a transferir.
  SELECT COUNT(*) INTO v_ya_cerrado
  FROM public.savings_allocations
  WHERE user_id = p_user_id
    AND income_entry_id = p_income_id
    AND notas = 'Sobrante de quincena';
  IF v_ya_cerrado > 0 THEN RETURN 0; END IF;

  -- Gastos del período (desde la fecha del ingreso en adelante).
  SELECT COALESCE(SUM(monto), 0) INTO v_gastos
  FROM public.expenses
  WHERE user_id = p_user_id AND fecha >= v_income.fecha;

  -- Ahorros ya aplicados al período (linkeados o manuales en el rango),
  -- incluyendo las allocations negativas de apoyos.
  SELECT COALESCE(SUM(monto), 0) INTO v_ahorros_ya
  FROM public.savings_allocations
  WHERE user_id = p_user_id
    AND (income_entry_id = p_income_id
         OR (income_entry_id IS NULL AND fecha >= v_income.fecha));

  -- Apoyos desde el Fondo General hacia este período (allocations negativas).
  SELECT COALESCE(-SUM(monto), 0) INTO v_apoyo
  FROM public.savings_allocations
  WHERE user_id = p_user_id
    AND income_entry_id = p_income_id
    AND monto < 0;

  -- Sobrante realmente ahorrable (sin contar el dinero traído por apoyos).
  v_sobrante := v_income.monto - v_gastos - (v_ahorros_ya + v_apoyo);

  IF v_sobrante <= 0.01 THEN RETURN 0; END IF;

  -- Buscar/crear el Fondo General.
  SELECT id INTO v_general_goal_id
  FROM public.savings_goals
  WHERE user_id = p_user_id AND es_general = TRUE
  LIMIT 1;

  IF v_general_goal_id IS NULL THEN
    INSERT INTO public.savings_goals
      (user_id, nombre, monto_objetivo, monto_actual, prioridad, estado, es_general)
    VALUES (p_user_id, 'Fondo General', 0, 0, 1, 'activa', TRUE)
    RETURNING id INTO v_general_goal_id;
  END IF;

  -- Registrar el sobrante como ahorro del período que se cierra.
  INSERT INTO public.savings_allocations
    (user_id, income_entry_id, savings_goal_id, monto, fecha, notas)
  VALUES
    (p_user_id, p_income_id, v_general_goal_id, v_sobrante, CURRENT_DATE, 'Sobrante de quincena');

  -- Fijar el saldo del fondo al valor absoluto (seguro con o sin trigger 028).
  UPDATE public.savings_goals g
  SET monto_actual = COALESCE((
        SELECT SUM(monto) FROM public.savings_allocations WHERE savings_goal_id = g.id
      ), 0),
      updated_at = now()
  WHERE g.id = v_general_goal_id;

  RETURN v_sobrante;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
