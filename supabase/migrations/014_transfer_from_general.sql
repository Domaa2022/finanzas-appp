-- Función: trasladar dinero del Fondo General a una meta específica
CREATE OR REPLACE FUNCTION public.transfer_from_general(
  p_user_id UUID,
  p_target_goal_id UUID,
  p_amount NUMERIC,
  p_fecha DATE DEFAULT CURRENT_DATE
) RETURNS void AS $$
DECLARE
  v_general_goal_id UUID;
  v_general_balance NUMERIC;
  v_target_space NUMERIC;
BEGIN
  -- Obtener fondo general
  SELECT id, monto_actual INTO v_general_goal_id, v_general_balance
  FROM public.savings_goals
  WHERE user_id = p_user_id AND es_general = TRUE
  LIMIT 1;

  IF v_general_goal_id IS NULL THEN
    RAISE EXCEPTION 'No existe un Fondo General para este usuario';
  END IF;

  IF v_general_balance < p_amount THEN
    RAISE EXCEPTION 'Saldo insuficiente en el Fondo General (disponible: %)', v_general_balance;
  END IF;

  -- Verificar que la meta destino tiene espacio
  SELECT monto_objetivo - monto_actual INTO v_target_space
  FROM public.savings_goals
  WHERE id = p_target_goal_id AND user_id = p_user_id;

  IF v_target_space IS NULL THEN
    RAISE EXCEPTION 'Meta no encontrada';
  END IF;

  IF p_amount > v_target_space + 0.01 THEN
    RAISE EXCEPTION 'El monto supera el espacio disponible en la meta (disponible: %)', v_target_space;
  END IF;

  -- Restar del Fondo General
  UPDATE public.savings_goals
  SET monto_actual = monto_actual - p_amount, updated_at = now()
  WHERE id = v_general_goal_id;

  -- Registrar salida del fondo general (monto negativo)
  INSERT INTO public.savings_allocations (user_id, income_entry_id, savings_goal_id, monto, fecha, notas)
  VALUES (p_user_id, NULL, v_general_goal_id, -p_amount, p_fecha, 'Traslado a meta');

  -- Sumar a la meta destino
  UPDATE public.savings_goals
  SET
    monto_actual = monto_actual + p_amount,
    estado = CASE
      WHEN monto_actual + p_amount >= monto_objetivo THEN 'completada'
      ELSE estado
    END,
    updated_at = now()
  WHERE id = p_target_goal_id;

  -- Registrar entrada en la meta destino
  INSERT INTO public.savings_allocations (user_id, income_entry_id, savings_goal_id, monto, fecha, notas)
  VALUES (p_user_id, NULL, p_target_goal_id, p_amount, p_fecha, 'Traslado desde Fondo General');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
