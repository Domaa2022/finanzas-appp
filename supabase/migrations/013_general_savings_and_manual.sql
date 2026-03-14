-- 1. Agregar columna es_general a savings_goals
ALTER TABLE public.savings_goals
ADD COLUMN IF NOT EXISTS es_general BOOLEAN DEFAULT FALSE;

-- 2. Hacer income_entry_id nullable para ahorros manuales (sin ingreso)
ALTER TABLE public.savings_allocations
ALTER COLUMN income_entry_id DROP NOT NULL;

-- 3. Agregar notas a savings_allocations
ALTER TABLE public.savings_allocations
ADD COLUMN IF NOT EXISTS notas TEXT;

-- 4. Actualizar distribute_savings: excluye fondo general del reparto proporcional
--    y envía el sobrante al fondo general automáticamente
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

  -- Sumar prioridades de metas activas (excluyendo fondo general)
  SELECT COALESCE(SUM(prioridad), 0) INTO v_total_priority
  FROM public.savings_goals
  WHERE user_id = p_user_id
    AND estado = 'activa'
    AND (es_general IS NULL OR es_general = FALSE);

  IF v_total_priority > 0 THEN
    FOR v_goal IN
      SELECT id, prioridad, monto_objetivo, monto_actual
      FROM public.savings_goals
      WHERE user_id = p_user_id
        AND estado = 'activa'
        AND (es_general IS NULL OR es_general = FALSE)
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

  -- Enviar sobrante al fondo general
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

-- 5. Nueva función: distribución manual con asignaciones específicas por meta
--    El sobrante va automáticamente al fondo general
CREATE OR REPLACE FUNCTION public.distribute_savings_manual(
  p_income_id UUID,
  p_user_id UUID,
  p_total_savings NUMERIC,
  p_allocations JSONB  -- [{"goal_id": "uuid", "amount": 100.00}, ...]
) RETURNS void AS $$
DECLARE
  v_item JSONB;
  v_goal_id UUID;
  v_amount NUMERIC;
  v_remaining NUMERIC;
  v_general_goal_id UUID;
BEGIN
  v_remaining := p_total_savings;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_allocations)
  LOOP
    v_goal_id := (v_item->>'goal_id')::UUID;
    v_amount := (v_item->>'amount')::NUMERIC;

    IF v_amount > 0 THEN
      INSERT INTO public.savings_allocations (user_id, income_entry_id, savings_goal_id, monto, fecha)
      VALUES (p_user_id, p_income_id, v_goal_id, v_amount, CURRENT_DATE);

      UPDATE public.savings_goals
      SET
        monto_actual = monto_actual + v_amount,
        estado = CASE
          WHEN (es_general IS NULL OR es_general = FALSE) AND monto_actual + v_amount >= monto_objetivo THEN 'completada'
          ELSE estado
        END,
        updated_at = now()
      WHERE id = v_goal_id;

      v_remaining := v_remaining - v_amount;
    END IF;
  END LOOP;

  -- Sobrante al fondo general
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

-- 6. Nueva función: agregar ahorro manual (sin ingreso asociado)
CREATE OR REPLACE FUNCTION public.add_manual_saving(
  p_user_id UUID,
  p_goal_id UUID,     -- NULL = va al fondo general
  p_amount NUMERIC,
  p_fecha DATE,
  p_notas TEXT DEFAULT NULL
) RETURNS void AS $$
DECLARE
  v_general_goal_id UUID;
  v_target_goal_id UUID;
BEGIN
  IF p_goal_id IS NULL THEN
    SELECT id INTO v_general_goal_id
    FROM public.savings_goals
    WHERE user_id = p_user_id AND es_general = TRUE
    LIMIT 1;

    IF v_general_goal_id IS NULL THEN
      INSERT INTO public.savings_goals (user_id, nombre, monto_objetivo, monto_actual, prioridad, estado, es_general)
      VALUES (p_user_id, 'Fondo General', 0, 0, 1, 'activa', TRUE)
      RETURNING id INTO v_general_goal_id;
    END IF;

    v_target_goal_id := v_general_goal_id;
  ELSE
    v_target_goal_id := p_goal_id;
  END IF;

  INSERT INTO public.savings_allocations (user_id, income_entry_id, savings_goal_id, monto, fecha, notas)
  VALUES (p_user_id, NULL, v_target_goal_id, p_amount, p_fecha, p_notas);

  UPDATE public.savings_goals
  SET
    monto_actual = monto_actual + p_amount,
    estado = CASE
      WHEN (es_general IS NULL OR es_general = FALSE) AND monto_actual + p_amount >= monto_objetivo THEN 'completada'
      ELSE estado
    END,
    updated_at = now()
  WHERE id = v_target_goal_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
