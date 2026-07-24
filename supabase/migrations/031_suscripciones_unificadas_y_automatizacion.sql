-- ════════════════════════════════════════════════════════════════════════════
-- 031 · Suscripciones unificadas en gastos fijos + automatización de quincena
-- ════════════════════════════════════════════════════════════════════════════
-- Contexto: `subscriptions` era una tabla paralela que reimplementaba, peor, lo
-- que los gastos fijos mensuales ya hacían: un cargo recurrente con fecha de
-- cobro. Nunca generaba un `expenses`, así que su "gasto mensual" era un número
-- decorativo que no bajaba de la quincena ni salía en reportes.
--
-- Aquí una suscripción pasa a ser, simplemente, un gasto fijo no quincenal con
-- `es_suscripcion = TRUE`. Gana gratis toda la maquinaria existente: fondo de
-- apartado, barra de progreso y pago que descuenta de lo apartado.
--
-- Reglas de negocio que implementa esta migración:
--
--   1. Cada quincena se aparta hacia el fondo del gasto lo que falte para
--      completarlo, dividido entre las quincenas que quedan hasta el día de
--      pago. Si el fondo YA está lleno, no aparta nada más (falta <= 0 ⇒ 0).
--   2. Al llegar el día de pago se cobra solo: devuelve lo apartado, registra
--      el gasto completo y avanza la fecha al siguiente ciclo. Si el fondo no
--      alcanzaba, el faltante lo absorbe el sobrante de la quincena actual
--      (efecto natural de devolver el fondo y gastar el monto completo).
--   3. Frecuencia `variable`: gastos sin fecha fija ("a veces cae este mes, a
--      veces el otro"). Se aparta hasta llenar el fondo y ahí se detiene; nunca
--      se cobra solo, se paga cuando el usuario lo confirma.
--   4. Al fijar una quincena actual se aplican solos los gastos fijos
--      quincenales y los ahorros programados.
--
-- Nota de implementación: desde 028 `savings_goals.monto_actual` lo calcula un
-- trigger desde la suma de allocations. Ninguna función aquí lo actualiza a
-- mano; solo insertan allocations.
-- ════════════════════════════════════════════════════════════════════════════


-- ────────────────────────────────────────────────────────────────────────────
-- 1. Frecuencias extendidas y campos de suscripción en fixed_expenses
-- ────────────────────────────────────────────────────────────────────────────

-- El CHECK de frecuencia se creó inline en 024, así que su nombre lo asignó
-- Postgres. Se busca por definición en vez de adivinarlo.
DO $$
DECLARE v_name TEXT;
BEGIN
  SELECT conname INTO v_name
  FROM pg_constraint
  WHERE conrelid = 'public.fixed_expenses'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%frecuencia%';

  IF v_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.fixed_expenses DROP CONSTRAINT %I', v_name);
  END IF;
END $$;

ALTER TABLE public.fixed_expenses
  ADD CONSTRAINT fixed_expenses_frecuencia_check
  CHECK (frecuencia IN ('quincenal', 'semanal', 'mensual', 'trimestral', 'anual', 'variable'));

ALTER TABLE public.fixed_expenses
  -- Marca las que se muestran en /suscripciones. Puramente de presentación:
  -- el motor de apartado y cobro no la mira.
  ADD COLUMN IF NOT EXISTS es_suscripcion BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS color TEXT,
  ADD COLUMN IF NOT EXISTS notas TEXT,
  -- Agrupación visual heredada de subscriptions (entretenimiento, software, …).
  -- La categoría real de contabilidad sigue siendo category_id.
  ADD COLUMN IF NOT EXISTS grupo TEXT,
  -- Fuente de verdad del próximo cobro para TODA frecuencia. Reemplaza a
  -- dia_pago, que solo podía expresar ciclos mensuales.
  ADD COLUMN IF NOT EXISTS proximo_pago DATE,
  -- Si se define, se aparta exactamente esto por quincena en vez del cálculo
  -- automático (topado a lo que falte).
  ADD COLUMN IF NOT EXISTS apartado_quincenal NUMERIC(12,2)
    CHECK (apartado_quincenal IS NULL OR apartado_quincenal > 0);

CREATE INDEX IF NOT EXISTS idx_fixed_expenses_proximo_pago
  ON public.fixed_expenses(user_id, proximo_pago)
  WHERE activo AND frecuencia <> 'quincenal';


-- ────────────────────────────────────────────────────────────────────────────
-- 2. Helpers de fecha
-- ────────────────────────────────────────────────────────────────────────────

-- Siguiente ocurrencia de un día del mes a partir de una fecha. Si el mes no
-- tiene ese día (31 en febrero) cae al último día del mes.
CREATE OR REPLACE FUNCTION public.siguiente_dia_pago(
  p_dia   INT,
  p_desde DATE DEFAULT CURRENT_DATE
) RETURNS DATE AS $$
DECLARE
  v_base       DATE;
  v_ultimo_dia INT;
BEGIN
  IF p_dia IS NULL THEN RETURN NULL; END IF;

  v_base := date_trunc('month', p_desde)::DATE;
  v_ultimo_dia := EXTRACT(DAY FROM (v_base + INTERVAL '1 month - 1 day'))::INT;

  IF LEAST(p_dia, v_ultimo_dia) >= EXTRACT(DAY FROM p_desde)::INT THEN
    RETURN v_base + (LEAST(p_dia, v_ultimo_dia) - 1);
  END IF;

  -- Ya pasó este mes: mismo cálculo sobre el mes siguiente
  v_base := (v_base + INTERVAL '1 month')::DATE;
  v_ultimo_dia := EXTRACT(DAY FROM (v_base + INTERVAL '1 month - 1 day'))::INT;
  RETURN v_base + (LEAST(p_dia, v_ultimo_dia) - 1);
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

-- Avanza una fecha un ciclo completo según la frecuencia.
-- `variable` no tiene ciclo: devuelve NULL.
CREATE OR REPLACE FUNCTION public.avanzar_ciclo(
  p_fecha      DATE,
  p_frecuencia TEXT
) RETURNS DATE AS $$
BEGIN
  IF p_fecha IS NULL THEN RETURN NULL; END IF;

  RETURN CASE p_frecuencia
    WHEN 'semanal'    THEN p_fecha + INTERVAL '7 days'
    WHEN 'quincenal'  THEN p_fecha + INTERVAL '15 days'
    WHEN 'mensual'    THEN p_fecha + INTERVAL '1 month'
    WHEN 'trimestral' THEN p_fecha + INTERVAL '3 months'
    WHEN 'anual'      THEN p_fecha + INTERVAL '1 year'
    ELSE NULL
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;


-- ────────────────────────────────────────────────────────────────────────────
-- 3. Backfill de proximo_pago desde dia_pago
-- ────────────────────────────────────────────────────────────────────────────

UPDATE public.fixed_expenses
SET proximo_pago = public.siguiente_dia_pago(dia_pago, CURRENT_DATE)
WHERE proximo_pago IS NULL
  AND dia_pago IS NOT NULL
  AND frecuencia <> 'quincenal';


-- Cualquier cliente (la pantalla de gastos fijos, la app móvil) puede seguir
-- guardando solo `dia_pago`. Sin proximo_pago el cobro automático nunca se
-- dispararía, así que se deriva aquí en vez de en cada formulario.
CREATE OR REPLACE FUNCTION public.sync_proximo_pago()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.frecuencia IN ('quincenal', 'variable') THEN
    NEW.proximo_pago := NULL;
  ELSIF NEW.proximo_pago IS NULL AND NEW.dia_pago IS NOT NULL THEN
    NEW.proximo_pago := public.siguiente_dia_pago(NEW.dia_pago, CURRENT_DATE);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_sync_proximo_pago ON public.fixed_expenses;
CREATE TRIGGER trg_sync_proximo_pago
BEFORE INSERT OR UPDATE OF frecuencia, dia_pago, proximo_pago ON public.fixed_expenses
FOR EACH ROW EXECUTE FUNCTION public.sync_proximo_pago();


-- ────────────────────────────────────────────────────────────────────────────
-- 4. Migrar subscriptions → fixed_expenses
-- ────────────────────────────────────────────────────────────────────────────
-- Las canceladas no se migran (son historial muerto). Las pausadas llegan como
-- activo = FALSE.
--
-- expenses.category_id es NOT NULL, así que cada suscripción necesita una
-- categoría real o su cobro fallaría. Se usa/crea una categoría "Suscripciones"
-- por usuario.

DO $$
DECLARE
  v_sub         RECORD;
  v_category_id UUID;
BEGIN
  IF to_regclass('public.subscriptions') IS NULL THEN
    RETURN;
  END IF;

  FOR v_sub IN
    SELECT * FROM public.subscriptions WHERE estado <> 'cancelada'
  LOOP
    SELECT id INTO v_category_id
    FROM public.categories
    WHERE user_id = v_sub.user_id AND tipo = 'gasto' AND nombre = 'Suscripciones'
    LIMIT 1;

    IF v_category_id IS NULL THEN
      INSERT INTO public.categories (user_id, nombre, tipo, icono, color)
      VALUES (v_sub.user_id, 'Suscripciones', 'gasto', 'credit-card',
              COALESCE(v_sub.color, '#8B5CF6'))
      RETURNING id INTO v_category_id;
    END IF;

    INSERT INTO public.fixed_expenses (
      user_id, nombre, monto, category_id, activo, frecuencia,
      dia_pago, proximo_pago, es_suscripcion, color, notas, grupo
    )
    VALUES (
      v_sub.user_id,
      v_sub.nombre,
      v_sub.monto,
      v_category_id,
      v_sub.estado = 'activa',
      v_sub.frecuencia,
      CASE WHEN v_sub.frecuencia = 'mensual'
           THEN EXTRACT(DAY FROM v_sub.fecha_renovacion)::INT END,
      -- Si la fecha guardada ya venció, se adelanta a ciclos futuros hasta
      -- alcanzar hoy: la suscripción se siguió cobrando aunque la app no lo
      -- registrara, y no queremos disparar cobros retroactivos al migrar.
      CASE
        WHEN v_sub.fecha_renovacion IS NULL THEN NULL
        WHEN v_sub.fecha_renovacion >= CURRENT_DATE THEN v_sub.fecha_renovacion
        ELSE (
          WITH RECURSIVE ciclos(f) AS (
            SELECT v_sub.fecha_renovacion
            UNION ALL
            SELECT public.avanzar_ciclo(f, v_sub.frecuencia)
            FROM ciclos WHERE f < CURRENT_DATE AND f IS NOT NULL
          )
          SELECT MAX(f) FROM ciclos
        )
      END,
      TRUE,
      v_sub.color,
      v_sub.notas,
      v_sub.categoria
    );
  END LOOP;
END $$;

-- La tabla queda como respaldo hasta confirmar la migración en producción.
-- Para eliminarla después:  DROP TABLE public.subscriptions;
COMMENT ON TABLE public.subscriptions IS
  'OBSOLETA desde 031: migrada a fixed_expenses (es_suscripcion = TRUE). Conservada como respaldo.';


-- ────────────────────────────────────────────────────────────────────────────
-- 5. Ahorros programados: destino opcional
-- ────────────────────────────────────────────────────────────────────────────
-- NULL mantiene el comportamiento actual: va al Fondo General.

ALTER TABLE public.scheduled_savings
  ADD COLUMN IF NOT EXISTS savings_goal_id UUID
    REFERENCES public.savings_goals(id) ON DELETE SET NULL;


-- ────────────────────────────────────────────────────────────────────────────
-- 6. Cuánto apartar esta quincena por un gasto fijo
-- ────────────────────────────────────────────────────────────────────────────
-- Devuelve 0 cuando el fondo ya está completo: esa es la regla de "cuando esté
-- lleno no sacarlo otra vez".

CREATE OR REPLACE FUNCTION public.cuota_quincenal_gasto_fijo(
  p_fixed_expense_id UUID
) RETURNS NUMERIC AS $$
DECLARE
  v_fixed      RECORD;
  v_apartado   NUMERIC := 0;
  v_falta      NUMERIC;
  v_dias       INT;
  v_quincenas  INT;
BEGIN
  SELECT monto, frecuencia, proximo_pago, apartado_quincenal, savings_goal_id
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

  -- Fondo lleno (o de sobra): no se aparta nada más.
  IF v_falta <= 0.01 THEN
    RETURN 0;
  END IF;

  -- Monto fijo definido por el usuario, topado a lo que falte.
  IF v_fixed.apartado_quincenal IS NOT NULL THEN
    RETURN ROUND(LEAST(v_fixed.apartado_quincenal, v_falta), 2);
  END IF;

  -- Sin fecha de pago (variable): media cuota por quincena hasta llenar.
  IF v_fixed.proximo_pago IS NULL OR v_fixed.frecuencia = 'variable' THEN
    RETURN ROUND(LEAST(v_fixed.monto / 2, v_falta), 2);
  END IF;

  -- Con fecha: lo que falte repartido entre las quincenas que quedan.
  v_dias := GREATEST(v_fixed.proximo_pago - CURRENT_DATE, 0);
  v_quincenas := GREATEST(CEIL(v_dias / 15.0)::INT, 1);

  RETURN ROUND(v_falta / v_quincenas, 2);
END;
$$ LANGUAGE plpgsql STABLE SET search_path = public;


-- ────────────────────────────────────────────────────────────────────────────
-- 7. reservar_gasto_fijo: ahora acepta toda frecuencia no quincenal
-- ────────────────────────────────────────────────────────────────────────────

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
  IF v_fixed.frecuencia = 'quincenal' THEN
    RAISE EXCEPTION 'Los gastos fijos quincenales se pagan directo, no apartan dinero';
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

  UPDATE public.savings_goals SET monto_objetivo = v_fixed.monto WHERE id = v_goal_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ────────────────────────────────────────────────────────────────────────────
-- 8. Pagar un gasto fijo no quincenal
-- ────────────────────────────────────────────────────────────────────────────
-- Devuelve lo apartado al saldo, registra el gasto completo y avanza el ciclo.
-- El faltante (si el fondo no alcanzaba) sale del sobrante de la quincena de
-- forma natural: se devuelven L200 y se gastan L299 ⇒ L99 netos contra el
-- período actual.

CREATE OR REPLACE FUNCTION public.pagar_gasto_fijo(
  p_user_id UUID, p_fixed_expense_id UUID, p_fecha DATE DEFAULT CURRENT_DATE
) RETURNS JSONB AS $$
DECLARE
  v_fixed       RECORD;
  v_apartado    NUMERIC := 0;
  v_category_id UUID;
  v_siguiente   DATE;
BEGIN
  SELECT id, nombre, monto, category_id, savings_goal_id, frecuencia, proximo_pago
  INTO v_fixed
  FROM public.fixed_expenses
  WHERE id = p_fixed_expense_id AND user_id = p_user_id;

  IF v_fixed.id IS NULL THEN
    RAISE EXCEPTION 'Gasto fijo no encontrado';
  END IF;
  IF v_fixed.frecuencia = 'quincenal' THEN
    RAISE EXCEPTION 'Los gastos fijos quincenales se aplican con la quincena, no con este método';
  END IF;

  -- Categoría: la propia, o un fallback de tipo gasto (expenses.category_id es NOT NULL)
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

  -- Vaciar el fondo (el trigger de 028 recalcula monto_actual)
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

  INSERT INTO public.expenses (user_id, monto, category_id, descripcion, fecha, notas)
  VALUES (p_user_id, v_fixed.monto, v_category_id, v_fixed.nombre, p_fecha,
          CASE WHEN v_fixed.frecuencia = 'variable'
               THEN 'Gasto fijo variable' ELSE 'Gasto fijo ' || v_fixed.frecuencia END);

  -- Avanzar el ciclo desde la fecha programada, no desde hoy, para que un pago
  -- tardío no corra la fecha de todos los ciclos siguientes.
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

-- Compatibilidad: el nombre viejo sigue funcionando (lo usa la UI de gastos fijos).
CREATE OR REPLACE FUNCTION public.pagar_gasto_fijo_mensual(
  p_user_id UUID, p_fixed_expense_id UUID, p_fecha DATE DEFAULT CURRENT_DATE
) RETURNS void AS $$
BEGIN
  PERFORM public.pagar_gasto_fijo(p_user_id, p_fixed_expense_id, p_fecha);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ────────────────────────────────────────────────────────────────────────────
-- 9. Cobro automático de lo vencido
-- ────────────────────────────────────────────────────────────────────────────
-- Se llama al cargar el dashboard. Es idempotente: cada pago avanza
-- proximo_pago, así que un segundo llamado el mismo día no cobra de nuevo.
-- `variable` nunca entra aquí (proximo_pago NULL).

CREATE OR REPLACE FUNCTION public.procesar_pagos_vencidos(
  p_user_id UUID,
  p_fecha   DATE DEFAULT CURRENT_DATE
) RETURNS JSONB AS $$
DECLARE
  v_fixed    RECORD;
  v_pago     JSONB;
  v_pagos    JSONB := '[]'::JSONB;
  v_vueltas  INT;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  FOR v_fixed IN
    SELECT id FROM public.fixed_expenses
    WHERE user_id = p_user_id
      AND activo
      AND frecuencia NOT IN ('quincenal', 'variable')
      AND proximo_pago IS NOT NULL
      AND proximo_pago <= p_fecha
  LOOP
    -- Puede haber varios ciclos vencidos (la app estuvo sin abrirse). Se cobran
    -- todos, con tope para no colgarse si algo dejara la fecha sin avanzar.
    v_vueltas := 0;
    WHILE v_vueltas < 24 LOOP
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.fixed_expenses
        WHERE id = v_fixed.id AND proximo_pago IS NOT NULL AND proximo_pago <= p_fecha
      );

      v_pago := public.pagar_gasto_fijo(p_user_id, v_fixed.id, p_fecha);
      v_pagos := v_pagos || jsonb_build_array(v_pago);
      v_vueltas := v_vueltas + 1;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('pagos', v_pagos, 'total', jsonb_array_length(v_pagos));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ────────────────────────────────────────────────────────────────────────────
-- 10. Gastos fijos quincenales automáticos
-- ────────────────────────────────────────────────────────────────────────────
-- Mueve a la base la lógica que hacía a mano QuincenaCard: registra los que
-- falten desde la fecha del ingreso, sin duplicar.

CREATE OR REPLACE FUNCTION public.aplicar_gastos_fijos_quincenales(
  p_user_id   UUID,
  p_income_id UUID,
  p_fecha     DATE DEFAULT CURRENT_DATE
) RETURNS JSONB AS $$
DECLARE
  v_fixed        RECORD;
  v_income_fecha DATE;
  v_category_id  UUID;
  v_count        INT := 0;
  v_total        NUMERIC := 0;
BEGIN
  SELECT fecha INTO v_income_fecha
  FROM public.income_entries WHERE id = p_income_id AND user_id = p_user_id;

  IF v_income_fecha IS NULL THEN
    RETURN jsonb_build_object('count', 0, 'total', 0);
  END IF;

  FOR v_fixed IN
    SELECT id, nombre, monto, category_id
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

    INSERT INTO public.expenses (user_id, monto, category_id, descripcion, fecha, notas)
    VALUES (p_user_id, v_fixed.monto, v_category_id, v_fixed.nombre, p_fecha, 'Gasto fijo quincenal');

    v_count := v_count + 1;
    v_total := v_total + v_fixed.monto;
  END LOOP;

  RETURN jsonb_build_object('count', v_count, 'total', v_total);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ────────────────────────────────────────────────────────────────────────────
-- 11. Apartado automático para los no quincenales
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.apartar_gastos_fijos(
  p_user_id UUID,
  p_fecha   DATE DEFAULT CURRENT_DATE
) RETURNS JSONB AS $$
DECLARE
  v_fixed   RECORD;
  v_cuota   NUMERIC;
  v_count   INT := 0;
  v_total   NUMERIC := 0;
BEGIN
  FOR v_fixed IN
    SELECT id, nombre FROM public.fixed_expenses
    WHERE user_id = p_user_id AND activo AND frecuencia <> 'quincenal'
  LOOP
    v_cuota := public.cuota_quincenal_gasto_fijo(v_fixed.id);
    CONTINUE WHEN v_cuota IS NULL OR v_cuota <= 0;   -- fondo lleno ⇒ no aparta

    PERFORM public.reservar_gasto_fijo(p_user_id, v_fixed.id, v_cuota, p_fecha);
    v_count := v_count + 1;
    v_total := v_total + v_cuota;
  END LOOP;

  RETURN jsonb_build_object('count', v_count, 'total', v_total);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ────────────────────────────────────────────────────────────────────────────
-- 12. Ahorros programados automáticos
-- ────────────────────────────────────────────────────────────────────────────
-- Los de tipo 'fijo' se escalan a la quincena según su frecuencia declarada
-- (un ahorro diario de L50 son L750 por quincena). Los de 'porcentaje' se
-- calculan sobre el ingreso del período.

CREATE OR REPLACE FUNCTION public.aplicar_ahorros_programados(
  p_user_id   UUID,
  p_income_id UUID,
  p_fecha     DATE DEFAULT CURRENT_DATE
) RETURNS JSONB AS $$
DECLARE
  v_sched         RECORD;
  v_income_monto  NUMERIC;
  v_monto         NUMERIC;
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

  FOR v_sched IN
    SELECT id, nombre, tipo, valor, frecuencia, savings_goal_id
    FROM public.scheduled_savings
    WHERE user_id = p_user_id AND activo
  LOOP
    v_notas := 'Ahorro programado: ' || v_sched.nombre;

    -- Idempotencia: un ahorro programado se aplica una vez por ingreso.
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.savings_allocations
      WHERE user_id = p_user_id AND income_entry_id = p_income_id AND notas = v_notas
    );

    IF v_sched.tipo = 'porcentaje' THEN
      v_monto := ROUND(v_income_monto * v_sched.valor / 100, 2);
    ELSE
      v_monto := ROUND(v_sched.valor * CASE v_sched.frecuencia
        WHEN 'diario'    THEN 15
        WHEN 'semanal'   THEN 2
        WHEN 'quincenal' THEN 1
        WHEN 'mensual'   THEN 0.5
        ELSE 1 END, 2);
    END IF;

    CONTINUE WHEN v_monto IS NULL OR v_monto <= 0;

    -- Destino: la meta configurada, o el Fondo General
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


-- ────────────────────────────────────────────────────────────────────────────
-- 13. Orquestador: todo lo que pasa al fijar una quincena actual
-- ────────────────────────────────────────────────────────────────────────────
-- Orden deliberado: primero los gastos (bajan el disponible), luego el apartado
-- de los mensuales y por último los ahorros programados.

CREATE OR REPLACE FUNCTION public.procesar_quincena(
  p_user_id   UUID,
  p_income_id UUID,
  p_fecha     DATE DEFAULT CURRENT_DATE
) RETURNS JSONB AS $$
DECLARE
  v_fijos     JSONB;
  v_apartado  JSONB;
  v_ahorros   JSONB;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  v_fijos    := public.aplicar_gastos_fijos_quincenales(p_user_id, p_income_id, p_fecha);
  v_apartado := public.apartar_gastos_fijos(p_user_id, p_fecha);
  v_ahorros  := public.aplicar_ahorros_programados(p_user_id, p_income_id, p_fecha);

  RETURN jsonb_build_object(
    'gastos_fijos', v_fijos,
    'apartado',     v_apartado,
    'ahorros',      v_ahorros
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
