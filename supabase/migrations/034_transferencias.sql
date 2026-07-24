-- ════════════════════════════════════════════════════════════════════════════
-- 034 · Transferencias entre cuentas  (Fase 2)
-- ════════════════════════════════════════════════════════════════════════════
-- Mover plata entre tus cuentas NO es ingreso ni gasto: si se modelara como los
-- dos, los totales de la quincena se duplicarían. Por eso vive en su propia
-- tabla y solo afecta el saldo de las cuentas involucradas.
--
-- Esta migración:
--   1. Crea `transferencias`.
--   2. Actualiza get_saldos_cuentas para restar del origen y sumar al destino.
--   3. Agrega registrar_transferencia (con validaciones).
--   4. Propaga cuenta_id a los gastos que generan las funciones de gasto fijo.
-- ════════════════════════════════════════════════════════════════════════════


-- ────────────────────────────────────────────────────────────────────────────
-- 1. Tabla transferencias
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.transferencias (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  cuenta_origen_id  UUID NOT NULL REFERENCES public.cuentas(id) ON DELETE RESTRICT,
  cuenta_destino_id UUID NOT NULL REFERENCES public.cuentas(id) ON DELETE RESTRICT,
  monto             NUMERIC(14,2) NOT NULL CHECK (monto > 0),
  fecha             DATE NOT NULL DEFAULT CURRENT_DATE,
  -- 'traspaso'     = movimiento normal entre cuentas
  -- 'pago_tarjeta' = pago de una tarjeta de crédito (Fase 3)
  tipo              TEXT NOT NULL DEFAULT 'traspaso'
                      CHECK (tipo IN ('traspaso', 'pago_tarjeta')),
  notas             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT transferencia_cuentas_distintas CHECK (cuenta_origen_id <> cuenta_destino_id)
);

CREATE INDEX IF NOT EXISTS idx_transf_user    ON public.transferencias(user_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_transf_origen  ON public.transferencias(cuenta_origen_id);
CREATE INDEX IF NOT EXISTS idx_transf_destino ON public.transferencias(cuenta_destino_id);

ALTER TABLE public.transferencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own transferencias"
  ON public.transferencias FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- ────────────────────────────────────────────────────────────────────────────
-- 2. Saldo por cuenta, ahora con transferencias
-- ────────────────────────────────────────────────────────────────────────────
-- Mismo tipo de retorno que en 033, así que CREATE OR REPLACE alcanza.
CREATE OR REPLACE FUNCTION public.get_saldos_cuentas(p_user_id UUID)
RETURNS TABLE (
  id            UUID,
  nombre        TEXT,
  tipo          TEXT,
  es_disponible BOOLEAN,
  es_principal  BOOLEAN,
  color         TEXT,
  orden         INT,
  origen        TEXT,
  saldo         NUMERIC
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    c.id, c.nombre, c.tipo, c.es_disponible, c.es_principal, c.color, c.orden,
    'cuenta'::TEXT AS origen,
    c.saldo_inicial
      + COALESCE((SELECT SUM(monto) FROM public.income_entries i WHERE i.cuenta_id = c.id), 0)
      - COALESCE((SELECT SUM(monto) FROM public.expenses e WHERE e.cuenta_id = c.id), 0)
      + COALESCE((SELECT SUM(CASE WHEN ce.tipo = 'entrada' THEN ce.monto ELSE -ce.monto END)
                  FROM public.cash_entries ce WHERE ce.cuenta_id = c.id), 0)
      - COALESCE((SELECT SUM(monto) FROM public.transferencias t WHERE t.cuenta_origen_id = c.id), 0)
      + COALESCE((SELECT SUM(monto) FROM public.transferencias t WHERE t.cuenta_destino_id = c.id), 0)
      AS saldo
  FROM public.cuentas c
  WHERE c.user_id = p_user_id AND c.activo

  UNION ALL

  SELECT
    cc.id,
    CASE cc.tipo WHEN 'aportaciones' THEN 'Cooperativa · Aportaciones'
                 ELSE 'Cooperativa · Ahorro retirable' END,
    'cooperativa'::TEXT,
    FALSE, FALSE, NULL::TEXT,
    100 + (CASE cc.tipo WHEN 'aportaciones' THEN 0 ELSE 1 END),
    'cooperativa'::TEXT,
    cc.saldo
  FROM public.cooperativa_cuentas cc
  WHERE cc.user_id = p_user_id

  ORDER BY orden;
$$;


-- ────────────────────────────────────────────────────────────────────────────
-- 3. Registrar una transferencia (con validaciones)
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.registrar_transferencia(
  p_user_id   UUID,
  p_origen_id UUID,
  p_destino_id UUID,
  p_monto     NUMERIC,
  p_fecha     DATE DEFAULT CURRENT_DATE,
  p_tipo      TEXT DEFAULT 'traspaso',
  p_notas     TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_id       UUID;
  v_origen_ok  BOOLEAN;
  v_destino_ok BOOLEAN;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  IF p_monto <= 0 THEN
    RAISE EXCEPTION 'El monto debe ser mayor a 0';
  END IF;
  IF p_origen_id = p_destino_id THEN
    RAISE EXCEPTION 'La cuenta de origen y destino deben ser distintas';
  END IF;

  -- Ambas cuentas deben ser del usuario.
  SELECT EXISTS(SELECT 1 FROM public.cuentas WHERE id = p_origen_id  AND user_id = p_user_id) INTO v_origen_ok;
  SELECT EXISTS(SELECT 1 FROM public.cuentas WHERE id = p_destino_id AND user_id = p_user_id) INTO v_destino_ok;
  IF NOT v_origen_ok OR NOT v_destino_ok THEN
    RAISE EXCEPTION 'Cuenta de origen o destino no encontrada';
  END IF;

  INSERT INTO public.transferencias
    (user_id, cuenta_origen_id, cuenta_destino_id, monto, fecha, tipo, notas)
  VALUES
    (p_user_id, p_origen_id, p_destino_id, p_monto, p_fecha, p_tipo, p_notas)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ────────────────────────────────────────────────────────────────────────────
-- 4. Los gastos de gasto fijo salen de la cuenta configurada
-- ────────────────────────────────────────────────────────────────────────────
-- pagar_gasto_fijo y aplicar_gastos_fijos_quincenales insertan en expenses;
-- ahora fijan cuenta_id = la cuenta del gasto fijo (o la principal como respaldo).

CREATE OR REPLACE FUNCTION public.pagar_gasto_fijo(
  p_user_id UUID, p_fixed_expense_id UUID, p_fecha DATE DEFAULT CURRENT_DATE
) RETURNS JSONB AS $$
DECLARE
  v_fixed       RECORD;
  v_apartado    NUMERIC := 0;
  v_category_id UUID;
  v_cuenta_id   UUID;
  v_siguiente   DATE;
BEGIN
  SELECT id, nombre, monto, category_id, cuenta_id, savings_goal_id, frecuencia, proximo_pago
  INTO v_fixed
  FROM public.fixed_expenses
  WHERE id = p_fixed_expense_id AND user_id = p_user_id;

  IF v_fixed.id IS NULL THEN
    RAISE EXCEPTION 'Gasto fijo no encontrado';
  END IF;
  IF v_fixed.frecuencia = 'quincenal' THEN
    RAISE EXCEPTION 'Los gastos fijos quincenales se aplican con la quincena, no con este método';
  END IF;

  v_category_id := v_fixed.category_id;
  IF v_category_id IS NULL THEN
    SELECT id INTO v_category_id FROM public.categories
    WHERE user_id = p_user_id AND tipo = 'gasto' AND nombre = 'Otros Gastos' LIMIT 1;
  END IF;
  IF v_category_id IS NULL THEN
    SELECT id INTO v_category_id FROM public.categories
    WHERE user_id = p_user_id AND tipo = 'gasto' ORDER BY created_at LIMIT 1;
  END IF;
  IF v_category_id IS NULL THEN
    RAISE EXCEPTION 'No hay una categoría de gasto disponible para registrar el pago';
  END IF;

  -- Cuenta de la que sale el pago: la configurada, o la principal.
  v_cuenta_id := v_fixed.cuenta_id;
  IF v_cuenta_id IS NULL THEN
    SELECT id INTO v_cuenta_id FROM public.cuentas
    WHERE user_id = p_user_id AND es_principal LIMIT 1;
  END IF;

  IF v_fixed.savings_goal_id IS NOT NULL THEN
    SELECT COALESCE(monto_actual, 0) INTO v_apartado
    FROM public.savings_goals WHERE id = v_fixed.savings_goal_id;

    IF v_apartado > 0 THEN
      INSERT INTO public.savings_allocations
        (user_id, income_entry_id, savings_goal_id, monto, fecha, notas)
      VALUES
        (p_user_id, NULL, v_fixed.savings_goal_id, -v_apartado, p_fecha, 'Pago de ' || v_fixed.nombre);
    END IF;
  END IF;

  INSERT INTO public.expenses (user_id, monto, category_id, cuenta_id, descripcion, fecha, notas)
  VALUES (p_user_id, v_fixed.monto, v_category_id, v_cuenta_id, v_fixed.nombre, p_fecha,
          CASE WHEN v_fixed.frecuencia = 'variable'
               THEN 'Gasto fijo variable' ELSE 'Gasto fijo ' || v_fixed.frecuencia END);

  v_siguiente := public.avanzar_ciclo(COALESCE(v_fixed.proximo_pago, p_fecha), v_fixed.frecuencia);

  UPDATE public.fixed_expenses
  SET proximo_pago = v_siguiente,
      dia_pago = CASE WHEN v_siguiente IS NOT NULL AND frecuencia = 'mensual'
                      THEN EXTRACT(DAY FROM v_siguiente)::INT ELSE dia_pago END
  WHERE id = p_fixed_expense_id;

  RETURN jsonb_build_object(
    'nombre',       v_fixed.nombre,
    'monto',        v_fixed.monto,
    'del_fondo',    LEAST(v_apartado, v_fixed.monto),
    'de_quincena',  GREATEST(v_fixed.monto - v_apartado, 0),
    'proximo_pago', v_siguiente
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


CREATE OR REPLACE FUNCTION public.aplicar_gastos_fijos_quincenales(
  p_user_id   UUID,
  p_income_id UUID,
  p_fecha     DATE DEFAULT CURRENT_DATE
) RETURNS JSONB AS $$
DECLARE
  v_fixed        RECORD;
  v_income_fecha DATE;
  v_category_id  UUID;
  v_cuenta_id    UUID;
  v_principal    UUID;
  v_count        INT := 0;
  v_total        NUMERIC := 0;
BEGIN
  SELECT fecha INTO v_income_fecha
  FROM public.income_entries WHERE id = p_income_id AND user_id = p_user_id;

  IF v_income_fecha IS NULL THEN
    RETURN jsonb_build_object('count', 0, 'total', 0);
  END IF;

  SELECT id INTO v_principal FROM public.cuentas
  WHERE user_id = p_user_id AND es_principal LIMIT 1;

  FOR v_fixed IN
    SELECT id, nombre, monto, category_id, cuenta_id
    FROM public.fixed_expenses
    WHERE user_id = p_user_id AND activo AND frecuencia = 'quincenal'
  LOOP
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.expenses
      WHERE user_id = p_user_id
        AND descripcion = v_fixed.nombre
        AND notas = 'Gasto fijo quincenal'
        AND fecha >= v_income_fecha
    );

    v_category_id := v_fixed.category_id;
    IF v_category_id IS NULL THEN
      SELECT id INTO v_category_id FROM public.categories
      WHERE user_id = p_user_id AND tipo = 'gasto' AND nombre = 'Otros Gastos' LIMIT 1;
    END IF;
    IF v_category_id IS NULL THEN
      SELECT id INTO v_category_id FROM public.categories
      WHERE user_id = p_user_id AND tipo = 'gasto' ORDER BY created_at LIMIT 1;
    END IF;
    CONTINUE WHEN v_category_id IS NULL;

    v_cuenta_id := COALESCE(v_fixed.cuenta_id, v_principal);

    INSERT INTO public.expenses (user_id, monto, category_id, cuenta_id, descripcion, fecha, notas)
    VALUES (p_user_id, v_fixed.monto, v_category_id, v_cuenta_id, v_fixed.nombre, p_fecha, 'Gasto fijo quincenal');

    v_count := v_count + 1;
    v_total := v_total + v_fixed.monto;
  END LOOP;

  RETURN jsonb_build_object('count', v_count, 'total', v_total);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
