-- Función que distribuye el monto de ahorro entre las metas activas según prioridad
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
BEGIN
  v_remaining := p_total_savings;

  -- Sumar prioridades de todas las metas activas
  SELECT COALESCE(SUM(prioridad), 0) INTO v_total_priority
  FROM public.savings_goals
  WHERE user_id = p_user_id AND estado = 'activa';

  IF v_total_priority = 0 THEN RETURN; END IF;

  -- Distribuir proporcionalmente por prioridad
  FOR v_goal IN
    SELECT id, prioridad, monto_objetivo, monto_actual
    FROM public.savings_goals
    WHERE user_id = p_user_id AND estado = 'activa'
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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
