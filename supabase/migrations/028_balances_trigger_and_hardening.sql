-- ─── 028: Saldo de metas por trigger + endurecimiento de funciones ───────────
-- Mejoras "de fondo" (revisar y PROBAR antes de aplicar en producción):
--   1. savings_goals.monto_actual pasa a calcularse SIEMPRE desde la suma de
--      savings_allocations, vía trigger (igual que ya hace cooperativa_cuentas).
--      => Se eliminan TODAS las actualizaciones manuales de monto_actual en las
--         funciones, para no duplicar el saldo.
--   2. El estado (activa/completada) también lo gestiona el trigger; 'pausada'
--      y los fondos (es_general / es_gasto_fijo) NO se tocan.
--   3. SET search_path = public en todas las funciones SECURITY DEFINER
--      (cierra el warning de seguridad de Supabase).
--   4. updated_at automático en profiles y savings_goals.
--   5. Reconciliación: recalcula monto_actual/estado de todo lo existente.
--
-- CAMBIO DE COMPORTAMIENTO a tener presente: una meta 'completada' que pierde
-- saldo (p.ej. traslado al Fondo General) vuelve a 'activa'. Antes quedaba
-- "pegada" en completada.

-- ════════════════════════════════════════════════════════════════════════════
-- 1. Trigger: monto_actual y estado de savings_goals = suma de allocations
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.sync_savings_goal_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_ids UUID[] := ARRAY[]::UUID[];
  v_id  UUID;
  v_sum NUMERIC;
BEGIN
  IF TG_OP <> 'DELETE' THEN v_ids := array_append(v_ids, NEW.savings_goal_id); END IF;
  IF TG_OP <> 'INSERT' THEN v_ids := array_append(v_ids, OLD.savings_goal_id); END IF;

  FOR v_id IN SELECT DISTINCT x FROM unnest(v_ids) AS x WHERE x IS NOT NULL
  LOOP
    SELECT COALESCE(SUM(monto), 0) INTO v_sum
    FROM public.savings_allocations
    WHERE savings_goal_id = v_id;

    UPDATE public.savings_goals g
    SET monto_actual = v_sum,
        estado = CASE
          WHEN g.estado = 'pausada' THEN 'pausada'
          WHEN COALESCE(g.es_general, FALSE) OR COALESCE(g.es_gasto_fijo, FALSE) THEN g.estado
          WHEN g.monto_objetivo > 0 AND v_sum >= g.monto_objetivo THEN 'completada'
          ELSE 'activa'
        END
    WHERE g.id = v_id;
  END LOOP;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_sync_savings_goal_balance ON public.savings_allocations;
CREATE TRIGGER trg_sync_savings_goal_balance
AFTER INSERT OR UPDATE OR DELETE ON public.savings_allocations
FOR EACH ROW EXECUTE FUNCTION public.sync_savings_goal_balance();

-- ════════════════════════════════════════════════════════════════════════════
-- 2. updated_at automático
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_savings_goals_updated_at ON public.savings_goals;
CREATE TRIGGER trg_savings_goals_updated_at BEFORE UPDATE ON public.savings_goals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ════════════════════════════════════════════════════════════════════════════
-- 3. Funciones reescritas: SIN tocar monto_actual (lo hace el trigger)
--    + SET search_path = public
-- ════════════════════════════════════════════════════════════════════════════

-- ── distribute_savings ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.distribute_savings(
  p_income_id UUID, p_user_id UUID, p_total_savings NUMERIC
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
  WHERE user_id = p_user_id AND estado = 'activa'
    AND (es_general IS NULL OR es_general = FALSE)
    AND (es_gasto_fijo IS NULL OR es_gasto_fijo = FALSE);

  IF v_total_priority > 0 THEN
    FOR v_goal IN
      SELECT id, prioridad, monto_objetivo, monto_actual
      FROM public.savings_goals
      WHERE user_id = p_user_id AND estado = 'activa'
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
        v_remaining := v_remaining - v_allocation;
      END IF;
      EXIT WHEN v_remaining <= 0;
    END LOOP;
  END IF;

  IF v_remaining > 0.01 THEN
    SELECT id INTO v_general_goal_id
    FROM public.savings_goals
    WHERE user_id = p_user_id AND es_general = TRUE LIMIT 1;

    IF v_general_goal_id IS NULL THEN
      INSERT INTO public.savings_goals (user_id, nombre, monto_objetivo, monto_actual, prioridad, estado, es_general)
      VALUES (p_user_id, 'Fondo General', 0, 0, 1, 'activa', TRUE)
      RETURNING id INTO v_general_goal_id;
    END IF;

    INSERT INTO public.savings_allocations (user_id, income_entry_id, savings_goal_id, monto, fecha)
    VALUES (p_user_id, p_income_id, v_general_goal_id, v_remaining, CURRENT_DATE);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── distribute_savings_manual ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.distribute_savings_manual(
  p_income_id UUID, p_user_id UUID, p_total_savings NUMERIC, p_allocations JSONB
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
    v_amount  := (v_item->>'amount')::NUMERIC;
    IF v_amount > 0 THEN
      INSERT INTO public.savings_allocations (user_id, income_entry_id, savings_goal_id, monto, fecha)
      VALUES (p_user_id, p_income_id, v_goal_id, v_amount, CURRENT_DATE);
      v_remaining := v_remaining - v_amount;
    END IF;
  END LOOP;

  IF v_remaining > 0.01 THEN
    SELECT id INTO v_general_goal_id
    FROM public.savings_goals
    WHERE user_id = p_user_id AND es_general = TRUE LIMIT 1;

    IF v_general_goal_id IS NULL THEN
      INSERT INTO public.savings_goals (user_id, nombre, monto_objetivo, monto_actual, prioridad, estado, es_general)
      VALUES (p_user_id, 'Fondo General', 0, 0, 1, 'activa', TRUE)
      RETURNING id INTO v_general_goal_id;
    END IF;

    INSERT INTO public.savings_allocations (user_id, income_entry_id, savings_goal_id, monto, fecha)
    VALUES (p_user_id, p_income_id, v_general_goal_id, v_remaining, CURRENT_DATE);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── add_manual_saving ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.add_manual_saving(
  p_user_id UUID, p_goal_id UUID, p_amount NUMERIC, p_fecha DATE, p_notas TEXT DEFAULT NULL
) RETURNS void AS $$
DECLARE
  v_general_goal_id UUID;
  v_target_goal_id  UUID;
BEGIN
  IF p_goal_id IS NULL THEN
    SELECT id INTO v_general_goal_id
    FROM public.savings_goals
    WHERE user_id = p_user_id AND es_general = TRUE LIMIT 1;

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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── transfer_from_general ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.transfer_from_general(
  p_user_id UUID, p_target_goal_id UUID, p_amount NUMERIC, p_fecha DATE DEFAULT CURRENT_DATE
) RETURNS void AS $$
DECLARE
  v_general_goal_id UUID;
  v_general_balance NUMERIC;
  v_target_space    NUMERIC;
BEGIN
  SELECT id, monto_actual INTO v_general_goal_id, v_general_balance
  FROM public.savings_goals
  WHERE user_id = p_user_id AND es_general = TRUE LIMIT 1;

  IF v_general_goal_id IS NULL THEN
    RAISE EXCEPTION 'No existe un Fondo General para este usuario';
  END IF;
  IF v_general_balance < p_amount THEN
    RAISE EXCEPTION 'Saldo insuficiente en el Fondo General (disponible: %)', v_general_balance;
  END IF;

  SELECT monto_objetivo - monto_actual INTO v_target_space
  FROM public.savings_goals
  WHERE id = p_target_goal_id AND user_id = p_user_id;

  IF v_target_space IS NULL THEN
    RAISE EXCEPTION 'Meta no encontrada';
  END IF;
  IF p_amount > v_target_space + 0.01 THEN
    RAISE EXCEPTION 'El monto supera el espacio disponible en la meta (disponible: %)', v_target_space;
  END IF;

  INSERT INTO public.savings_allocations (user_id, income_entry_id, savings_goal_id, monto, fecha, notas)
  VALUES (p_user_id, NULL, v_general_goal_id, -p_amount, p_fecha, 'Traslado a meta');

  INSERT INTO public.savings_allocations (user_id, income_entry_id, savings_goal_id, monto, fecha, notas)
  VALUES (p_user_id, NULL, p_target_goal_id, p_amount, p_fecha, 'Traslado desde Fondo General');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── transfer_to_general ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.transfer_to_general(
  p_user_id UUID, p_source_goal_id UUID, p_amount NUMERIC, p_fecha DATE DEFAULT CURRENT_DATE
) RETURNS void AS $$
DECLARE
  v_general_id UUID;
  v_source_bal NUMERIC;
BEGIN
  SELECT monto_actual INTO v_source_bal
  FROM public.savings_goals
  WHERE id = p_source_goal_id AND user_id = p_user_id;

  IF v_source_bal IS NULL THEN
    RAISE EXCEPTION 'Meta no encontrada';
  END IF;
  IF v_source_bal < p_amount THEN
    RAISE EXCEPTION 'Saldo insuficiente en la meta (disponible: %)', v_source_bal;
  END IF;

  SELECT id INTO v_general_id
  FROM public.savings_goals
  WHERE user_id = p_user_id AND es_general = TRUE LIMIT 1;

  IF v_general_id IS NULL THEN
    INSERT INTO public.savings_goals (user_id, nombre, monto_objetivo, monto_actual, prioridad, estado, es_general)
    VALUES (p_user_id, 'Fondo General', 0, 0, 1, 'activa', TRUE)
    RETURNING id INTO v_general_id;
  END IF;

  INSERT INTO public.savings_allocations (user_id, income_entry_id, savings_goal_id, monto, fecha, notas)
  VALUES (p_user_id, NULL, p_source_goal_id, -p_amount, p_fecha, 'Traslado al Fondo General');

  INSERT INTO public.savings_allocations (user_id, income_entry_id, savings_goal_id, monto, fecha, notas)
  VALUES (p_user_id, NULL, v_general_id, p_amount, p_fecha, 'Traslado desde meta');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── transfer_general_to_quincena ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.transfer_general_to_quincena(
  p_user_id UUID, p_income_id UUID, p_amount NUMERIC, p_fecha DATE DEFAULT CURRENT_DATE
) RETURNS void AS $$
DECLARE
  v_general_id  UUID;
  v_general_bal NUMERIC;
BEGIN
  SELECT id, monto_actual INTO v_general_id, v_general_bal
  FROM public.savings_goals
  WHERE user_id = p_user_id AND es_general = TRUE LIMIT 1;

  IF v_general_id IS NULL THEN
    RAISE EXCEPTION 'No existe un Fondo General';
  END IF;
  IF v_general_bal < p_amount THEN
    RAISE EXCEPTION 'Saldo insuficiente en el Fondo General (disponible: %)', v_general_bal;
  END IF;

  INSERT INTO public.savings_allocations
    (user_id, income_entry_id, savings_goal_id, monto, fecha, notas)
  VALUES
    (p_user_id, p_income_id, v_general_id, -p_amount, p_fecha, 'Apoyo desde Fondo General');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── add_external_saving ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.add_external_saving(
  p_user_id UUID, p_goal_id UUID, p_amount NUMERIC, p_fecha DATE,
  p_fuente TEXT, p_notas TEXT DEFAULT NULL
) RETURNS void AS $$
DECLARE
  v_income_id      UUID;
  v_target_goal_id UUID;
  v_general_id     UUID;
BEGIN
  INSERT INTO public.income_entries
    (user_id, monto, fuente, frecuencia, fecha, ahorro_tipo, ahorro_valor, notas)
  VALUES
    (p_user_id, p_amount, p_fuente, 'mensual', p_fecha, 'ninguno', 0, p_notas)
  RETURNING id INTO v_income_id;

  IF p_goal_id IS NULL THEN
    SELECT id INTO v_general_id
    FROM public.savings_goals
    WHERE user_id = p_user_id AND es_general = TRUE LIMIT 1;

    IF v_general_id IS NULL THEN
      INSERT INTO public.savings_goals
        (user_id, nombre, monto_objetivo, monto_actual, prioridad, estado, es_general)
      VALUES (p_user_id, 'Fondo General', 0, 0, 1, 'activa', TRUE)
      RETURNING id INTO v_general_id;
    END IF;
    v_target_goal_id := v_general_id;
  ELSE
    v_target_goal_id := p_goal_id;
  END IF;

  INSERT INTO public.savings_allocations
    (user_id, income_entry_id, savings_goal_id, monto, fecha, notas)
  VALUES
    (p_user_id, v_income_id, v_target_goal_id, p_amount, p_fecha, p_notas);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── reservar_gasto_fijo (mantiene update de monto_objetivo, NO de monto_actual) ─
CREATE OR REPLACE FUNCTION public.reservar_gasto_fijo(
  p_user_id UUID, p_fixed_expense_id UUID, p_amount NUMERIC, p_fecha DATE DEFAULT CURRENT_DATE
) RETURNS void AS $$
DECLARE
  v_fixed     RECORD;
  v_goal_id   UUID;
  v_income_id UUID;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'El monto a apartar debe ser mayor a 0';
  END IF;

  SELECT id, nombre, monto, savings_goal_id, frecuencia INTO v_fixed
  FROM public.fixed_expenses
  WHERE id = p_fixed_expense_id AND user_id = p_user_id;

  IF v_fixed.id IS NULL THEN
    RAISE EXCEPTION 'Gasto fijo no encontrado';
  END IF;
  IF v_fixed.frecuencia <> 'mensual' THEN
    RAISE EXCEPTION 'Solo los gastos fijos mensuales pueden apartar dinero';
  END IF;

  v_goal_id := v_fixed.savings_goal_id;
  IF v_goal_id IS NULL THEN
    INSERT INTO public.savings_goals
      (user_id, nombre, monto_objetivo, monto_actual, prioridad, estado, es_general, es_gasto_fijo)
    VALUES
      (p_user_id, 'Pago: ' || v_fixed.nombre, v_fixed.monto, 0, 1, 'activa', FALSE, TRUE)
    RETURNING id INTO v_goal_id;

    UPDATE public.fixed_expenses SET savings_goal_id = v_goal_id WHERE id = p_fixed_expense_id;
  END IF;

  SELECT id INTO v_income_id
  FROM public.income_entries
  WHERE user_id = p_user_id AND es_quincena_actual = TRUE
  ORDER BY fecha DESC LIMIT 1;

  IF v_income_id IS NULL THEN
    SELECT id INTO v_income_id
    FROM public.income_entries
    WHERE user_id = p_user_id
    ORDER BY fecha DESC LIMIT 1;
  END IF;

  INSERT INTO public.savings_allocations
    (user_id, income_entry_id, savings_goal_id, monto, fecha, notas)
  VALUES
    (p_user_id, v_income_id, v_goal_id, p_amount, p_fecha, 'Apartado para ' || v_fixed.nombre);

  -- Mantener el objetivo del fondo igual al monto del gasto fijo (no es saldo).
  UPDATE public.savings_goals SET monto_objetivo = v_fixed.monto WHERE id = v_goal_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── pagar_gasto_fijo_mensual (con fallback de categoría; sin update de saldo) ──
CREATE OR REPLACE FUNCTION public.pagar_gasto_fijo_mensual(
  p_user_id UUID, p_fixed_expense_id UUID, p_fecha DATE DEFAULT CURRENT_DATE
) RETURNS void AS $$
DECLARE
  v_fixed       RECORD;
  v_apartado    NUMERIC;
  v_category_id UUID;
BEGIN
  SELECT id, nombre, monto, category_id, savings_goal_id, frecuencia INTO v_fixed
  FROM public.fixed_expenses
  WHERE id = p_fixed_expense_id AND user_id = p_user_id;

  IF v_fixed.id IS NULL THEN
    RAISE EXCEPTION 'Gasto fijo no encontrado';
  END IF;
  IF v_fixed.frecuencia <> 'mensual' THEN
    RAISE EXCEPTION 'Solo los gastos fijos mensuales se pagan con este método';
  END IF;

  -- Resolver categoría: la del gasto fijo, o un fallback de tipo gasto
  v_category_id := v_fixed.category_id;
  IF v_category_id IS NULL THEN
    SELECT id INTO v_category_id
    FROM public.categories
    WHERE user_id = p_user_id AND tipo = 'gasto' AND nombre = 'Otros Gastos' LIMIT 1;
  END IF;
  IF v_category_id IS NULL THEN
    SELECT id INTO v_category_id
    FROM public.categories
    WHERE user_id = p_user_id AND tipo = 'gasto'
    ORDER BY created_at LIMIT 1;
  END IF;
  IF v_category_id IS NULL THEN
    RAISE EXCEPTION 'No hay una categoría de gasto disponible para registrar el pago';
  END IF;

  -- Devolver lo apartado en el fondo (allocation negativa). El trigger deja
  -- monto_actual en 0 automáticamente.
  IF v_fixed.savings_goal_id IS NOT NULL THEN
    SELECT monto_actual INTO v_apartado
    FROM public.savings_goals WHERE id = v_fixed.savings_goal_id;

    IF v_apartado IS NOT NULL AND v_apartado > 0 THEN
      INSERT INTO public.savings_allocations
        (user_id, income_entry_id, savings_goal_id, monto, fecha, notas)
      VALUES
        (p_user_id, NULL, v_fixed.savings_goal_id, -v_apartado, p_fecha, 'Pago de ' || v_fixed.nombre);
    END IF;
  END IF;

  -- Registrar el gasto real del mes
  INSERT INTO public.expenses (user_id, monto, category_id, descripcion, fecha, notas)
  VALUES (p_user_id, v_fixed.monto, v_category_id, v_fixed.nombre, p_fecha, 'Gasto fijo mensual');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. search_path en el resto de funciones SECURITY DEFINER (sin reescribir cuerpo)
-- ════════════════════════════════════════════════════════════════════════════
ALTER FUNCTION public.handle_new_user()                                              SET search_path = public;
ALTER FUNCTION public.seed_default_categories(uuid)                                  SET search_path = public;
ALTER FUNCTION public.sync_deuda_monto_pagado()                                      SET search_path = public;
ALTER FUNCTION public.sync_cooperativa_saldo()                                       SET search_path = public;
ALTER FUNCTION public.seed_cooperativa_accounts()                                    SET search_path = public;
ALTER FUNCTION public.cooperativa_tasa_anual(text, numeric)                          SET search_path = public;
ALTER FUNCTION public.cooperativa_aplicar_intereses_pendientes(uuid)                 SET search_path = public;
ALTER FUNCTION public.cooperativa_transferir_quincena(uuid, uuid, uuid, numeric, date, text) SET search_path = public;

-- ════════════════════════════════════════════════════════════════════════════
-- 5. Reconciliación: recalcular saldos y estados de lo ya existente
-- ════════════════════════════════════════════════════════════════════════════
UPDATE public.savings_goals g
SET monto_actual = COALESCE((
  SELECT SUM(monto) FROM public.savings_allocations WHERE savings_goal_id = g.id
), 0);

UPDATE public.savings_goals g
SET estado = CASE
  WHEN g.estado = 'pausada' THEN 'pausada'
  WHEN COALESCE(g.es_general, FALSE) OR COALESCE(g.es_gasto_fijo, FALSE) THEN g.estado
  WHEN g.monto_objetivo > 0 AND g.monto_actual >= g.monto_objetivo THEN 'completada'
  ELSE 'activa'
END;
