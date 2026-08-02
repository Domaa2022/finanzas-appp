-- ════════════════════════════════════════════════════════════════════════════
-- 042 · Gastar directo desde un fondo de ahorro (Fondo General o una meta)
-- ════════════════════════════════════════════════════════════════════════════
-- Hasta ahora, para gastar plata del Fondo General había que dar un rodeo:
-- apoyar la quincena actual, o trasladar a una meta y usarla. Esta función lo
-- hace directo desde el formulario de gastos.
--
-- Qué hace, en una sola operación:
--   1. Libera el monto del fondo (allocation negativa) — deja de estar apartado.
--   2. Registra el gasto real contra una cuenta líquida.
--
-- Efecto sobre el disponible: CERO, y es lo correcto. Ese dinero ya estaba
-- apartado (no era disponible); al gastarlo baja el saldo de la cuenta Y se
-- libera el apartado, y las dos cosas se cancelan:
--   disponible = Σ cuentas líquidas − Σ apartado
--   gasto:      Σ líquidas − monto
--   liberación: Σ apartado − monto   ⇒  neto 0
-- Lo que cambia: sube "gastos", baja el fondo, baja el saldo de la cuenta.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.registrar_gasto_desde_fondo(
  p_user_id     UUID,
  p_goal_id     UUID,
  p_monto       NUMERIC,
  p_descripcion TEXT,
  p_category_id UUID  DEFAULT NULL,
  p_cuenta_id   UUID  DEFAULT NULL,   -- cuenta física de la que sale; NULL = principal
  p_fecha       DATE  DEFAULT CURRENT_DATE,
  p_notas       TEXT  DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_goal        RECORD;
  v_category_id UUID;
  v_cuenta_id   UUID;
  v_restante    NUMERIC;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT id, nombre, monto_actual, es_general, es_gasto_fijo
  INTO v_goal
  FROM public.savings_goals
  WHERE id = p_goal_id AND user_id = p_user_id;

  IF v_goal.id IS NULL THEN
    RAISE EXCEPTION 'Fondo no encontrado';
  END IF;
  IF COALESCE(v_goal.es_gasto_fijo, FALSE) THEN
    RAISE EXCEPTION 'Los fondos de gasto fijo se pagan con pagar_gasto_fijo';
  END IF;
  IF p_monto <= 0 THEN
    RAISE EXCEPTION 'El monto debe ser mayor a 0';
  END IF;
  IF p_monto > v_goal.monto_actual + 0.005 THEN
    RAISE EXCEPTION 'El fondo solo tiene % disponible', v_goal.monto_actual;
  END IF;

  -- Categoría: la elegida o un respaldo (expenses.category_id es NOT NULL)
  v_category_id := p_category_id;
  IF v_category_id IS NULL THEN
    SELECT id INTO v_category_id FROM public.categories
    WHERE user_id = p_user_id AND tipo = 'gasto' AND nombre = 'Otros Gastos' LIMIT 1;
  END IF;
  IF v_category_id IS NULL THEN
    SELECT id INTO v_category_id FROM public.categories
    WHERE user_id = p_user_id AND tipo = 'gasto' ORDER BY created_at LIMIT 1;
  END IF;
  IF v_category_id IS NULL THEN
    RAISE EXCEPTION 'No hay una categoría de gasto disponible';
  END IF;

  -- Cuenta física de la que sale: la elegida o la principal.
  v_cuenta_id := p_cuenta_id;
  IF v_cuenta_id IS NULL THEN
    SELECT id INTO v_cuenta_id FROM public.cuentas
    WHERE user_id = p_user_id AND es_principal LIMIT 1;
  END IF;

  -- 1. Liberar del fondo.
  INSERT INTO public.savings_allocations
    (user_id, income_entry_id, savings_goal_id, monto, fecha, notas)
  VALUES
    (p_user_id, NULL, p_goal_id, -p_monto, p_fecha,
     'Gasto desde ' || v_goal.nombre);

  -- 2. Registrar el gasto real.
  INSERT INTO public.expenses
    (user_id, monto, category_id, cuenta_id, descripcion, fecha, notas)
  VALUES
    (p_user_id, p_monto, v_category_id, v_cuenta_id, p_descripcion, p_fecha,
     COALESCE(p_notas, 'Pagado con ' || v_goal.nombre));

  -- 3. Si era una meta regular y quedó vacía, marcarla completada.
  --    (El Fondo General nunca se completa.) Va DESPUÉS del insert porque el
  --    trigger de saldos reescribe el estado al mover la allocation.
  IF NOT COALESCE(v_goal.es_general, FALSE) THEN
    SELECT monto_actual INTO v_restante
    FROM public.savings_goals WHERE id = p_goal_id;
    IF v_restante <= 0.01 THEN
      UPDATE public.savings_goals
      SET estado = 'completada', updated_at = now()
      WHERE id = p_goal_id;
    END IF;
  END IF;

  RETURN jsonb_build_object('fondo', v_goal.nombre, 'monto', p_monto);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
