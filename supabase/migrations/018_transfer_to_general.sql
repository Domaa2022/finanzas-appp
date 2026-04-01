-- Función: trasladar dinero de una meta activa al Fondo General
CREATE OR REPLACE FUNCTION public.transfer_to_general(
  p_user_id        UUID,
  p_source_goal_id UUID,
  p_amount         NUMERIC,
  p_fecha          DATE DEFAULT CURRENT_DATE
) RETURNS void AS $$
DECLARE
  v_general_id  UUID;
  v_source_bal  NUMERIC;
BEGIN
  -- Obtener saldo de la meta origen
  SELECT monto_actual INTO v_source_bal
  FROM public.savings_goals
  WHERE id = p_source_goal_id AND user_id = p_user_id;

  IF v_source_bal IS NULL THEN
    RAISE EXCEPTION 'Meta no encontrada';
  END IF;

  IF v_source_bal < p_amount THEN
    RAISE EXCEPTION 'Saldo insuficiente en la meta (disponible: %)', v_source_bal;
  END IF;

  -- Obtener o crear fondo general
  SELECT id INTO v_general_id
  FROM public.savings_goals
  WHERE user_id = p_user_id AND es_general = TRUE
  LIMIT 1;

  IF v_general_id IS NULL THEN
    INSERT INTO public.savings_goals
      (user_id, nombre, monto_objetivo, monto_actual, prioridad, estado, es_general)
    VALUES
      (p_user_id, 'Fondo General', 0, 0, 1, 'activa', TRUE)
    RETURNING id INTO v_general_id;
  END IF;

  -- Restar de la meta origen
  UPDATE public.savings_goals
  SET monto_actual = monto_actual - p_amount, updated_at = now()
  WHERE id = p_source_goal_id;

  INSERT INTO public.savings_allocations
    (user_id, income_entry_id, savings_goal_id, monto, fecha, notas)
  VALUES
    (p_user_id, NULL, p_source_goal_id, -p_amount, p_fecha, 'Traslado al Fondo General');

  -- Sumar al fondo general
  UPDATE public.savings_goals
  SET monto_actual = monto_actual + p_amount, updated_at = now()
  WHERE id = v_general_id;

  INSERT INTO public.savings_allocations
    (user_id, income_entry_id, savings_goal_id, monto, fecha, notas)
  VALUES
    (p_user_id, NULL, v_general_id, p_amount, p_fecha, 'Traslado desde meta');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
