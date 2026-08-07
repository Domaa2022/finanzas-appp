-- ════════════════════════════════════════════════════════════════════════════
-- 046 · Automatizaciones genéricas para cualquier frecuencia de pago
-- ════════════════════════════════════════════════════════════════════════════
-- El presupuesto (la card del panel) ya se adaptaba a la frecuencia del ingreso,
-- pero las automatizaciones estaban clavadas a la quincena de 15 días:
--   · el apartado dividía "lo que falta" entre CEIL(días / 15)
--   · los ahorros programados se escalaban a una base de 15 días
--
-- Ahora ambas usan la duración REAL del período de pago del usuario, que sale de
-- la frecuencia del ingreso fijado como actual (o de su preferencia de cobro).
-- Así funciona igual para quien cobra semanal, quincenal, mensual, etc.
--
-- Los nombres internos (es_quincena_actual, procesar_quincena, cuota_quincenal…)
-- se conservan a propósito: son invisibles y renombrarlos solo agregaría riesgo.
-- ════════════════════════════════════════════════════════════════════════════


-- ────────────────────────────────────────────────────────────────────────────
-- 1. Días que dura un período según la frecuencia
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.dias_periodo(p_frecuencia TEXT)
RETURNS NUMERIC AS $$
  SELECT CASE p_frecuencia
    WHEN 'diario'    THEN 1
    WHEN 'semanal'   THEN 7
    WHEN 'quincenal' THEN 15
    WHEN 'mensual'   THEN 30
    ELSE 15   -- default seguro (incluye 'variable' y desconocidos)
  END::NUMERIC;
$$ LANGUAGE sql IMMUTABLE;

-- Duración del período de pago actual del usuario:
--   1º la frecuencia del ingreso fijado como período actual,
--   2º si no hay, su preferencia de cobro,
--   3º si tampoco, 15 días.
CREATE OR REPLACE FUNCTION public.dias_periodo_usuario(p_user_id UUID)
RETURNS NUMERIC AS $$
  SELECT COALESCE(
    (SELECT public.dias_periodo(frecuencia)
     FROM public.income_entries
     WHERE user_id = p_user_id AND es_quincena_actual = TRUE
     ORDER BY fecha DESC LIMIT 1),
    (SELECT public.dias_periodo(preferencias->>'cobro')
     FROM public.profiles WHERE id = p_user_id),
    15
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;


-- ────────────────────────────────────────────────────────────────────────────
-- 2. Apartado: repartir "lo que falta" entre los períodos que quedan
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cuota_quincenal_gasto_fijo(
  p_fixed_expense_id UUID
) RETURNS NUMERIC AS $$
DECLARE
  v_fixed      RECORD;
  v_apartado   NUMERIC := 0;
  v_falta      NUMERIC;
  v_dias       INT;
  v_periodo    NUMERIC;
  v_periodos   INT;
BEGIN
  SELECT user_id, monto, frecuencia, proximo_pago, apartado_quincenal, savings_goal_id
  INTO v_fixed
  FROM public.fixed_expenses
  WHERE id = p_fixed_expense_id;

  IF NOT FOUND OR v_fixed.frecuencia = 'quincenal' THEN
    RETURN 0;
  END IF;

  IF v_fixed.savings_goal_id IS NOT NULL THEN
    SELECT COALESCE(monto_actual, 0) INTO v_apartado
    FROM public.savings_goals WHERE id = v_fixed.savings_goal_id;
  END IF;

  v_falta := v_fixed.monto - COALESCE(v_apartado, 0);
  IF v_falta <= 0.01 THEN
    RETURN 0;
  END IF;

  -- Monto fijo definido por el usuario, topado a lo que falte.
  IF v_fixed.apartado_quincenal IS NOT NULL THEN
    RETURN ROUND(LEAST(v_fixed.apartado_quincenal, v_falta), 2);
  END IF;

  -- Sin fecha (variable): media cuota por período hasta llenar.
  IF v_fixed.proximo_pago IS NULL OR v_fixed.frecuencia = 'variable' THEN
    RETURN ROUND(LEAST(v_fixed.monto / 2, v_falta), 2);
  END IF;

  -- Con fecha: lo que falte entre los PERÍODOS DE PAGO que quedan hasta el cobro.
  v_dias := GREATEST(v_fixed.proximo_pago - CURRENT_DATE, 0);
  v_periodo := public.dias_periodo_usuario(v_fixed.user_id);
  v_periodos := GREATEST(CEIL(v_dias / v_periodo)::INT, 1);

  RETURN ROUND(v_falta / v_periodos, 2);
END;
$$ LANGUAGE plpgsql STABLE SET search_path = public;


-- ────────────────────────────────────────────────────────────────────────────
-- 3. Ahorros programados: escalar al período de pago real
-- ────────────────────────────────────────────────────────────────────────────
-- Un ahorro "fijo" con su propia frecuencia se convierte a cuánto corresponde
-- guardar en un período de pago del usuario:
--   monto = valor × (días del período del usuario / días de la frecuencia del ahorro)
-- Ej.: ahorro diario de L50, usuario mensual (30 d) → L1500; quincenal (15 d) → L750.
CREATE OR REPLACE FUNCTION public.aplicar_ahorros_programados(
  p_user_id   UUID,
  p_income_id UUID,
  p_fecha     DATE DEFAULT CURRENT_DATE
) RETURNS JSONB AS $$
DECLARE
  v_sched         RECORD;
  v_income_monto  NUMERIC;
  v_monto         NUMERIC;
  v_periodo       NUMERIC;
  v_goal_id       UUID;
  v_notas         TEXT;
  v_count         INT := 0;
  v_total         NUMERIC := 0;
BEGIN
  SELECT monto INTO v_income_monto
  FROM public.income_entries WHERE id = p_income_id AND user_id = p_user_id;

  IF v_income_monto IS NULL THEN
    RETURN jsonb_build_object('count', 0, 'total', 0);
  END IF;

  v_periodo := public.dias_periodo_usuario(p_user_id);

  FOR v_sched IN
    SELECT id, nombre, tipo, valor, frecuencia, savings_goal_id
    FROM public.scheduled_savings
    WHERE user_id = p_user_id AND activo
  LOOP
    v_notas := 'Ahorro programado: ' || v_sched.nombre;

    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.savings_allocations
      WHERE user_id = p_user_id AND income_entry_id = p_income_id AND notas = v_notas
    );

    IF v_sched.tipo = 'porcentaje' THEN
      v_monto := ROUND(v_income_monto * v_sched.valor / 100, 2);
    ELSE
      -- Escalar el ahorro fijo al período de pago del usuario.
      v_monto := ROUND(v_sched.valor * v_periodo / public.dias_periodo(v_sched.frecuencia), 2);
    END IF;

    CONTINUE WHEN v_monto IS NULL OR v_monto <= 0;

    v_goal_id := v_sched.savings_goal_id;
    IF v_goal_id IS NULL THEN
      SELECT id INTO v_goal_id FROM public.savings_goals
      WHERE user_id = p_user_id AND es_general = TRUE LIMIT 1;

      IF v_goal_id IS NULL THEN
        INSERT INTO public.savings_goals
          (user_id, nombre, monto_objetivo, monto_actual, prioridad, estado, es_general)
        VALUES (p_user_id, 'Fondo General', 0, 0, 1, 'activa', TRUE)
        RETURNING id INTO v_goal_id;
      END IF;
    END IF;

    INSERT INTO public.savings_allocations
      (user_id, income_entry_id, savings_goal_id, monto, fecha, notas)
    VALUES (p_user_id, p_income_id, v_goal_id, v_monto, p_fecha, v_notas);

    v_count := v_count + 1;
    v_total := v_total + v_monto;
  END LOOP;

  RETURN jsonb_build_object('count', v_count, 'total', v_total);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
