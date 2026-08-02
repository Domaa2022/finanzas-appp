-- ════════════════════════════════════════════════════════════════════════════
-- 041 · El bono externo cae en una cuenta (arregla el disponible negativo)
-- ════════════════════════════════════════════════════════════════════════════
-- add_external_saving (flujo "Bono / externo" de Ahorros) registra un ingreso y
-- una allocation de ahorro por el mismo monto. Pero el ingreso se creaba SIN
-- cuenta_id, porque la función es anterior a las cuentas.
--
-- Con la fórmula nueva  disponible = Σ cuentas líquidas − Σ apartado:
--   · el ingreso sin cuenta NO suma a ninguna cuenta líquida
--   · la allocation SÍ suma al apartado
-- ⇒ el bono solo aparece en el lado que resta y baja el disponible. Mal.
--
-- Arreglo: el ingreso del bono cae en una cuenta (la elegida o la principal).
-- Así suma al líquido y al apartado a la vez → efecto neto CERO en el disponible
-- (no tocás tu efectivo, lo ahorraste) y el bono cuenta como ahorro.
-- ════════════════════════════════════════════════════════════════════════════


-- ────────────────────────────────────────────────────────────────────────────
-- 1. Backfill: los bonos ya cargados quedaron con ingreso sin cuenta
-- ────────────────────────────────────────────────────────────────────────────
-- Todo ingreso sin cuenta se atribuye a la principal (de ahí "salió" o "entró").
-- Corrige el disponible que venía descontado de más por esos bonos.
UPDATE public.income_entries ie
SET cuenta_id = c.id
FROM public.cuentas c
WHERE c.user_id = ie.user_id
  AND c.es_principal
  AND ie.cuenta_id IS NULL;


-- ────────────────────────────────────────────────────────────────────────────
-- 2. add_external_saving ahora fija la cuenta del ingreso
-- ────────────────────────────────────────────────────────────────────────────
-- Se agrega un parámetro ⇒ hay que soltar la firma anterior para no dejar una
-- sobrecarga que confunda a PostgREST.
DROP FUNCTION IF EXISTS public.add_external_saving(uuid, uuid, numeric, date, text, text);

CREATE OR REPLACE FUNCTION public.add_external_saving(
  p_user_id   UUID,
  p_goal_id   UUID,
  p_amount    NUMERIC,
  p_fecha     DATE,
  p_fuente    TEXT,
  p_notas     TEXT DEFAULT NULL,
  p_cuenta_id UUID DEFAULT NULL
) RETURNS void AS $$
DECLARE
  v_income_id      UUID;
  v_target_goal_id UUID;
  v_general_id     UUID;
  v_cuenta_id      UUID;
BEGIN
  -- Cuenta donde cae el bono: la elegida, o la principal.
  v_cuenta_id := p_cuenta_id;
  IF v_cuenta_id IS NULL THEN
    SELECT id INTO v_cuenta_id FROM public.cuentas
    WHERE user_id = p_user_id AND es_principal LIMIT 1;
  END IF;

  INSERT INTO public.income_entries
    (user_id, monto, fuente, frecuencia, fecha, cuenta_id, ahorro_tipo, ahorro_valor, notas)
  VALUES
    (p_user_id, p_amount, p_fuente, 'mensual', p_fecha, v_cuenta_id, 'ninguno', 0, p_notas)
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
