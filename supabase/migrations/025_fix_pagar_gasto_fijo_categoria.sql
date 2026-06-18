-- ─── Fix: pagar gasto fijo mensual sin categoría ────────────────────────────
-- fixed_expenses.category_id es opcional (puede ser NULL), pero expenses.category_id
-- es NOT NULL. Al pagar una tarjeta/gasto fijo mensual sin categoría, el INSERT en
-- expenses fallaba con:
--   null value in column "category_id" of relation "expenses" violates not-null constraint
-- Solución: si el gasto fijo no tiene categoría, usar como fallback la categoría
-- "Otros Gastos" del usuario (o cualquier categoría de tipo gasto que exista).

CREATE OR REPLACE FUNCTION public.pagar_gasto_fijo_mensual(
  p_user_id           UUID,
  p_fixed_expense_id  UUID,
  p_fecha             DATE DEFAULT CURRENT_DATE
) RETURNS void AS $$
DECLARE
  v_fixed       RECORD;
  v_apartado    NUMERIC;
  v_category_id UUID;
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

  -- Resolver categoría: la del gasto fijo, o un fallback de tipo gasto
  v_category_id := v_fixed.category_id;
  IF v_category_id IS NULL THEN
    SELECT id INTO v_category_id
    FROM public.categories
    WHERE user_id = p_user_id AND tipo = 'gasto' AND nombre = 'Otros Gastos'
    LIMIT 1;
  END IF;
  IF v_category_id IS NULL THEN
    SELECT id INTO v_category_id
    FROM public.categories
    WHERE user_id = p_user_id AND tipo = 'gasto'
    ORDER BY created_at
    LIMIT 1;
  END IF;
  IF v_category_id IS NULL THEN
    RAISE EXCEPTION 'No hay una categoría de gasto disponible para registrar el pago';
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
  VALUES (p_user_id, v_fixed.monto, v_category_id, v_fixed.nombre, p_fecha,
          'Gasto fijo mensual');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
