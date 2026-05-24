-- ─── Gastos fijos mensuales con ahorro entre quincenas ───────────────────────
-- Algunos gastos fijos no se pagan cada quincena sino una vez al mes (ej. tarjeta,
-- préstamo). Para esos, el usuario aparta dinero real en cada quincena hacia un
-- "fondo" (una savings_goal dedicada) y al llegar el día de pago se descuenta de
-- ese fondo y se registra el gasto.

-- 1. Nuevos campos en fixed_expenses
ALTER TABLE public.fixed_expenses
  ADD COLUMN IF NOT EXISTS frecuencia TEXT NOT NULL DEFAULT 'quincenal'
    CHECK (frecuencia IN ('quincenal', 'mensual')),
  ADD COLUMN IF NOT EXISTS dia_pago INT
    CHECK (dia_pago IS NULL OR dia_pago BETWEEN 1 AND 31),
  ADD COLUMN IF NOT EXISTS savings_goal_id UUID
    REFERENCES public.savings_goals(id) ON DELETE SET NULL;

-- 2. Bandera para distinguir los "fondos de gasto fijo" de las metas normales.
--    Estos NO deben mostrarse junto a las metas del usuario ni recibir el reparto
--    automático de ahorro.
ALTER TABLE public.savings_goals
  ADD COLUMN IF NOT EXISTS es_gasto_fijo BOOLEAN DEFAULT FALSE;

-- 3. El reparto automático (distribute_savings) debe ignorar los fondos de gasto fijo.
CREATE OR REPLACE FUNCTION public.distribute_savings(
  p_income_id UUID,
  p_user_id UUID,
  p_total_savings NUMERIC
) RETURNS void AS $$
DECLARE
  v_goal RECORD;
  v_total_priority INT;
  v_allocation NUMERIC;
  v_remaining NUMERIC;
  v_general_goal_id UUID;
BEGIN
  v_remaining := p_total_savings;

  SELECT COALESCE(SUM(prioridad), 0) INTO v_total_priority
  FROM public.savings_goals
  WHERE user_id = p_user_id
    AND estado = 'activa'
    AND (es_general IS NULL OR es_general = FALSE)
    AND (es_gasto_fijo IS NULL OR es_gasto_fijo = FALSE);

  IF v_total_priority > 0 THEN
    FOR v_goal IN
      SELECT id, prioridad, monto_objetivo, monto_actual
      FROM public.savings_goals
      WHERE user_id = p_user_id
        AND estado = 'activa'
        AND (es_general IS NULL OR es_general = FALSE)
        AND (es_gasto_fijo IS NULL OR es_gasto_fijo = FALSE)
      ORDER BY prioridad DESC
    LOOP
      v_allocation := LEAST(
        ROUND((v_goal.prioridad::NUMERIC / v_total_priority) * p_total_savings, 2),
        v_goal.monto_objetivo - v_goal.monto_actual,
        v_remaining
      );

      IF v_allocation > 0 THEN
        INSERT INTO public.savings_allocations (user_id, income_entry_id, savings_goal_id, monto, fecha)
        VALUES (p_user_id, p_income_id, v_goal.id, v_allocation, CURRENT_DATE);

        UPDATE public.savings_goals
        SET
          monto_actual = monto_actual + v_allocation,
          estado = CASE
            WHEN monto_actual + v_allocation >= monto_objetivo THEN 'completada'
            ELSE estado
          END,
          updated_at = now()
        WHERE id = v_goal.id;

        v_remaining := v_remaining - v_allocation;
      END IF;

      EXIT WHEN v_remaining <= 0;
    END LOOP;
  END IF;

  IF v_remaining > 0.01 THEN
    SELECT id INTO v_general_goal_id
    FROM public.savings_goals
    WHERE user_id = p_user_id AND es_general = TRUE
    LIMIT 1;

    IF v_general_goal_id IS NULL THEN
      INSERT INTO public.savings_goals (user_id, nombre, monto_objetivo, monto_actual, prioridad, estado, es_general)
      VALUES (p_user_id, 'Fondo General', 0, 0, 1, 'activa', TRUE)
      RETURNING id INTO v_general_goal_id;
    END IF;

    INSERT INTO public.savings_allocations (user_id, income_entry_id, savings_goal_id, monto, fecha)
    VALUES (p_user_id, p_income_id, v_general_goal_id, v_remaining, CURRENT_DATE);

    UPDATE public.savings_goals
    SET monto_actual = monto_actual + v_remaining, updated_at = now()
    WHERE id = v_general_goal_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Apartar dinero hacia el fondo de un gasto fijo mensual.
--    Crea el fondo (savings_goal con es_gasto_fijo = TRUE) la primera vez.
--    La allocation se vincula al ingreso de la quincena actual para que cuente
--    como ahorro del período.
CREATE OR REPLACE FUNCTION public.reservar_gasto_fijo(
  p_user_id           UUID,
  p_fixed_expense_id  UUID,
  p_amount            NUMERIC,
  p_fecha             DATE DEFAULT CURRENT_DATE
) RETURNS void AS $$
DECLARE
  v_fixed     RECORD;
  v_goal_id   UUID;
  v_income_id UUID;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'El monto a apartar debe ser mayor a 0';
  END IF;

  SELECT id, nombre, monto, savings_goal_id, frecuencia
  INTO v_fixed
  FROM public.fixed_expenses
  WHERE id = p_fixed_expense_id AND user_id = p_user_id;

  IF v_fixed.id IS NULL THEN
    RAISE EXCEPTION 'Gasto fijo no encontrado';
  END IF;

  IF v_fixed.frecuencia <> 'mensual' THEN
    RAISE EXCEPTION 'Solo los gastos fijos mensuales pueden apartar dinero';
  END IF;

  -- Fondo del gasto fijo: crear si no existe
  v_goal_id := v_fixed.savings_goal_id;
  IF v_goal_id IS NULL THEN
    INSERT INTO public.savings_goals
      (user_id, nombre, monto_objetivo, monto_actual, prioridad, estado, es_general, es_gasto_fijo)
    VALUES
      (p_user_id, 'Pago: ' || v_fixed.nombre, v_fixed.monto, 0, 1, 'activa', FALSE, TRUE)
    RETURNING id INTO v_goal_id;

    UPDATE public.fixed_expenses
    SET savings_goal_id = v_goal_id
    WHERE id = p_fixed_expense_id;
  END IF;

  -- Ingreso de la quincena actual (para que cuente como ahorro del período)
  SELECT id INTO v_income_id
  FROM public.income_entries
  WHERE user_id = p_user_id AND es_quincena_actual = TRUE
  ORDER BY fecha DESC
  LIMIT 1;

  IF v_income_id IS NULL THEN
    SELECT id INTO v_income_id
    FROM public.income_entries
    WHERE user_id = p_user_id
    ORDER BY fecha DESC
    LIMIT 1;
  END IF;

  INSERT INTO public.savings_allocations
    (user_id, income_entry_id, savings_goal_id, monto, fecha, notas)
  VALUES
    (p_user_id, v_income_id, v_goal_id, p_amount, p_fecha, 'Apartado para ' || v_fixed.nombre);

  UPDATE public.savings_goals
  SET monto_actual = monto_actual + p_amount, monto_objetivo = v_fixed.monto, updated_at = now()
  WHERE id = v_goal_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Pagar un gasto fijo mensual: devuelve lo apartado al saldo (allocation
--    negativa), deja el fondo en 0 y registra el gasto real del mes.
--    El saldo queda consistente: el monto ya se había "apartado" en quincenas
--    previas, por eso al pagar se devuelve y luego se descuenta como gasto.
CREATE OR REPLACE FUNCTION public.pagar_gasto_fijo_mensual(
  p_user_id           UUID,
  p_fixed_expense_id  UUID,
  p_fecha             DATE DEFAULT CURRENT_DATE
) RETURNS void AS $$
DECLARE
  v_fixed     RECORD;
  v_apartado  NUMERIC;
BEGIN
  SELECT id, nombre, monto, category_id, savings_goal_id, frecuencia
  INTO v_fixed
  FROM public.fixed_expenses
  WHERE id = p_fixed_expense_id AND user_id = p_user_id;

  IF v_fixed.id IS NULL THEN
    RAISE EXCEPTION 'Gasto fijo no encontrado';
  END IF;

  IF v_fixed.frecuencia <> 'mensual' THEN
    RAISE EXCEPTION 'Solo los gastos fijos mensuales se pagan con este método';
  END IF;

  -- Devolver lo apartado en el fondo (si hay)
  IF v_fixed.savings_goal_id IS NOT NULL THEN
    SELECT monto_actual INTO v_apartado
    FROM public.savings_goals
    WHERE id = v_fixed.savings_goal_id;

    IF v_apartado IS NOT NULL AND v_apartado > 0 THEN
      INSERT INTO public.savings_allocations
        (user_id, income_entry_id, savings_goal_id, monto, fecha, notas)
      VALUES
        (p_user_id, NULL, v_fixed.savings_goal_id, -v_apartado, p_fecha,
         'Pago de ' || v_fixed.nombre);

      UPDATE public.savings_goals
      SET monto_actual = 0, estado = 'activa', updated_at = now()
      WHERE id = v_fixed.savings_goal_id;
    END IF;
  END IF;

  -- Registrar el gasto real del mes
  INSERT INTO public.expenses (user_id, monto, category_id, descripcion, fecha, notas)
  VALUES (p_user_id, v_fixed.monto, v_fixed.category_id, v_fixed.nombre, p_fecha,
          'Gasto fijo mensual');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
