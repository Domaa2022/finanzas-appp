-- Función para ahorrar dinero externo (bono, regalo, etc.)
-- A diferencia de add_manual_saving, esta crea también el income_entry
-- para que el balance no quede negativo.
CREATE OR REPLACE FUNCTION public.add_external_saving(
  p_user_id  UUID,
  p_goal_id  UUID,       -- NULL = va al fondo general
  p_amount   NUMERIC,
  p_fecha    DATE,
  p_fuente   TEXT,       -- ej: 'Bono', 'Regalo', 'Comisión'
  p_notas    TEXT DEFAULT NULL
) RETURNS void AS $$
DECLARE
  v_income_id      UUID;
  v_target_goal_id UUID;
  v_general_id     UUID;
BEGIN
  -- 1. Registrar como ingreso (sin ahorro automático) para cuadrar el balance
  INSERT INTO public.income_entries
    (user_id, monto, fuente, frecuencia, fecha, ahorro_tipo, ahorro_valor, notas)
  VALUES
    (p_user_id, p_amount, p_fuente, 'mensual', p_fecha, 'ninguno', 0, p_notas)
  RETURNING id INTO v_income_id;

  -- 2. Determinar la meta de destino
  IF p_goal_id IS NULL THEN
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

    v_target_goal_id := v_general_id;
  ELSE
    v_target_goal_id := p_goal_id;
  END IF;

  -- 3. Crear la allocation vinculada al income_entry creado
  INSERT INTO public.savings_allocations
    (user_id, income_entry_id, savings_goal_id, monto, fecha, notas)
  VALUES
    (p_user_id, v_income_id, v_target_goal_id, p_amount, p_fecha, p_notas);

  -- 4. Actualizar saldo de la meta
  UPDATE public.savings_goals
  SET
    monto_actual = monto_actual + p_amount,
    estado = CASE
      WHEN (es_general IS NULL OR es_general = FALSE)
           AND monto_actual + p_amount >= monto_objetivo THEN 'completada'
      ELSE estado
    END,
    updated_at = now()
  WHERE id = v_target_goal_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─── SCRIPT DE CORRECCIÓN DE DATOS ───────────────────────────────────────────
-- Ejecuta esto en el SQL Editor de Supabase para identificar y corregir
-- las allocations manuales (income_entry_id IS NULL) que dejaron el balance negativo.
--
-- PASO 1: Ver cuáles allocations manuales tienes (sin ingreso asociado)
-- SELECT sa.id, sa.monto, sa.fecha, sa.notas, sg.nombre as meta
-- FROM savings_allocations sa
-- JOIN savings_goals sg ON sg.id = sa.savings_goal_id
-- WHERE sa.user_id = auth.uid()
--   AND sa.income_entry_id IS NULL
-- ORDER BY sa.fecha DESC;
--
-- PASO 2: Para cada allocation problemática, ejecuta esto reemplazando
--         los valores con los reales de tu consulta anterior:
--
-- DO $$
-- DECLARE
--   v_alloc_id   UUID := 'PEGA-AQUI-EL-ID-DE-LA-ALLOCATION';
--   v_income_id  UUID;
--   v_monto      NUMERIC;
--   v_fecha      DATE;
--   v_user_id    UUID;
-- BEGIN
--   -- Obtener datos de la allocation
--   SELECT monto, fecha, user_id
--   INTO v_monto, v_fecha, v_user_id
--   FROM savings_allocations WHERE id = v_alloc_id;
--
--   -- Crear el income_entry que faltaba
--   INSERT INTO income_entries
--     (user_id, monto, fuente, frecuencia, fecha, ahorro_tipo, ahorro_valor, notas)
--   VALUES
--     (v_user_id, v_monto, 'Bono / Ingreso externo', 'mensual', v_fecha, 'ninguno', 0,
--      'Creado para corregir balance de ahorro manual')
--   RETURNING id INTO v_income_id;
--
--   -- Vincular la allocation al nuevo income_entry
--   UPDATE savings_allocations
--   SET income_entry_id = v_income_id
--   WHERE id = v_alloc_id;
--
--   RAISE NOTICE 'Corregido: allocation % vinculada al ingreso %', v_alloc_id, v_income_id;
-- END $$;
