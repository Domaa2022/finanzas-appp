-- ════════════════════════════════════════════════════════════════════════════
-- 033 · Cuenta como entidad de primera clase  (Fase 1)
-- ════════════════════════════════════════════════════════════════════════════
-- Hasta ahora el saldo se calculaba de tres formas incompatibles:
--   · Cuenta principal → no existía; era la resta ingresos − gastos − ahorros.
--   · Efectivo         → SUM(entrada − salida) sobre cash_entries.
--   · Cooperativa      → columna `saldo` desnormalizada por trigger.
--
-- Esta migración le da a «cuenta» una identidad propia y un único motor de saldo
-- (`get_saldos_cuentas`), SIN cambiar todavía nada visible: cada movimiento
-- existente se reasigna a una cuenta «Principal» o «Efectivo», y las funciones
-- del dashboard siguen devolviendo los mismos valores de antes.
--
-- Decisiones de producto que implementa (ver documento de diseño):
--   · Saldo disponible = Σ de cuentas líquidas (es_disponible = TRUE).
--   · La cooperativa se REPRESENTA en la lista de cuentas, pero conserva su
--     propio almacenamiento y su motor de intereses — no se duplica el saldo.
--   · Sobrante de la quincena: intacto. Se calcula de flujos, no de saldos, así
--     que multicuenta no lo toca.
-- ════════════════════════════════════════════════════════════════════════════


-- ────────────────────────────────────────────────────────────────────────────
-- 1. Tabla cuentas
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cuentas (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  nombre         TEXT NOT NULL,
  tipo           TEXT NOT NULL DEFAULT 'corriente'
                   CHECK (tipo IN ('corriente', 'ahorro', 'efectivo', 'cooperativa', 'tarjeta')),
  banco          TEXT,
  saldo_inicial  NUMERIC(14,2) NOT NULL DEFAULT 0,
  -- Cuenta preseleccionada en los formularios. A lo sumo una por usuario.
  es_principal   BOOLEAN NOT NULL DEFAULT FALSE,
  -- Cuenta líquida: su saldo suma al «disponible». Ahorro/cooperativa/tarjeta = FALSE.
  es_disponible  BOOLEAN NOT NULL DEFAULT TRUE,
  color          TEXT,
  orden          INT NOT NULL DEFAULT 0,
  activo         BOOLEAN NOT NULL DEFAULT TRUE,
  -- Campos exclusivos de tarjeta de crédito (Fase 3). NULL para el resto.
  cupo           NUMERIC(14,2) CHECK (cupo IS NULL OR cupo >= 0),
  dia_corte      INT CHECK (dia_corte IS NULL OR dia_corte BETWEEN 1 AND 31),
  dia_pago       INT CHECK (dia_pago IS NULL OR dia_pago BETWEEN 1 AND 31),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cuentas_user ON public.cuentas(user_id, orden);
-- Una sola cuenta principal por usuario.
CREATE UNIQUE INDEX IF NOT EXISTS uq_cuentas_principal
  ON public.cuentas(user_id) WHERE es_principal;

ALTER TABLE public.cuentas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own cuentas"
  ON public.cuentas FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_cuentas_updated_at ON public.cuentas;
CREATE TRIGGER trg_cuentas_updated_at BEFORE UPDATE ON public.cuentas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ────────────────────────────────────────────────────────────────────────────
-- 2. cuenta_id en los movimientos reales
-- ────────────────────────────────────────────────────────────────────────────
-- Nullable por ahora: se vuelve obligatorio en la Fase 2, cuando los formularios
-- ya envíen la cuenta. ON DELETE RESTRICT: no se puede borrar una cuenta con
-- movimientos sin reasignarlos antes.
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS cuenta_id UUID REFERENCES public.cuentas(id) ON DELETE RESTRICT;
ALTER TABLE public.income_entries
  ADD COLUMN IF NOT EXISTS cuenta_id UUID REFERENCES public.cuentas(id) ON DELETE RESTRICT;
ALTER TABLE public.cash_entries
  ADD COLUMN IF NOT EXISTS cuenta_id UUID REFERENCES public.cuentas(id) ON DELETE RESTRICT;
-- En fixed_expenses indica de qué cuenta se cobra el pago automático.
ALTER TABLE public.fixed_expenses
  ADD COLUMN IF NOT EXISTS cuenta_id UUID REFERENCES public.cuentas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_cuenta       ON public.expenses(cuenta_id)       WHERE cuenta_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_income_cuenta         ON public.income_entries(cuenta_id) WHERE cuenta_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cash_cuenta           ON public.cash_entries(cuenta_id)   WHERE cuenta_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fixed_cuenta          ON public.fixed_expenses(cuenta_id) WHERE cuenta_id IS NOT NULL;


-- ────────────────────────────────────────────────────────────────────────────
-- 3. Seed de cuentas por perfil (para nuevos usuarios)
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.seed_cuentas()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.cuentas (user_id, nombre, tipo, es_principal, es_disponible, orden)
  VALUES
    (NEW.id, 'Principal', 'corriente', TRUE,  TRUE, 0),
    (NEW.id, 'Efectivo',  'efectivo',  FALSE, TRUE, 1)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_seed_cuentas ON public.profiles;
CREATE TRIGGER trg_seed_cuentas AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.seed_cuentas();


-- ────────────────────────────────────────────────────────────────────────────
-- 4. Migración de datos: crear cuentas y reasignar los movimientos existentes
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_profile     RECORD;
  v_principal   UUID;
  v_efectivo    UUID;
BEGIN
  FOR v_profile IN SELECT id FROM public.profiles LOOP
    -- Principal (solo si el usuario aún no tiene una)
    SELECT id INTO v_principal
    FROM public.cuentas WHERE user_id = v_profile.id AND es_principal LIMIT 1;

    IF v_principal IS NULL THEN
      INSERT INTO public.cuentas (user_id, nombre, tipo, es_principal, es_disponible, orden)
      VALUES (v_profile.id, 'Principal', 'corriente', TRUE, TRUE, 0)
      RETURNING id INTO v_principal;
    END IF;

    -- Efectivo
    SELECT id INTO v_efectivo
    FROM public.cuentas WHERE user_id = v_profile.id AND tipo = 'efectivo' LIMIT 1;

    IF v_efectivo IS NULL THEN
      INSERT INTO public.cuentas (user_id, nombre, tipo, es_principal, es_disponible, orden)
      VALUES (v_profile.id, 'Efectivo', 'efectivo', FALSE, TRUE, 1)
      RETURNING id INTO v_efectivo;
    END IF;

    -- Backfill: todo lo bancario a Principal, el efectivo a Efectivo.
    UPDATE public.income_entries SET cuenta_id = v_principal
      WHERE user_id = v_profile.id AND cuenta_id IS NULL;
    UPDATE public.expenses SET cuenta_id = v_principal
      WHERE user_id = v_profile.id AND cuenta_id IS NULL;
    UPDATE public.fixed_expenses SET cuenta_id = v_principal
      WHERE user_id = v_profile.id AND cuenta_id IS NULL;
    UPDATE public.cash_entries SET cuenta_id = v_efectivo
      WHERE user_id = v_profile.id AND cuenta_id IS NULL;
  END LOOP;
END $$;


-- ────────────────────────────────────────────────────────────────────────────
-- 5. Motor único de saldo por cuenta
-- ────────────────────────────────────────────────────────────────────────────
-- Devuelve una fila por cuenta con su saldo derivado. Las cuentas reales se
-- calculan desde sus movimientos; la cooperativa se PROYECTA desde su propio
-- almacenamiento (cooperativa_cuentas.saldo) — un solo dueño del dato.
-- SECURITY INVOKER: respeta RLS igual que cualquier query del usuario.
CREATE OR REPLACE FUNCTION public.get_saldos_cuentas(p_user_id UUID)
RETURNS TABLE (
  id            UUID,
  nombre        TEXT,
  tipo          TEXT,
  es_disponible BOOLEAN,
  es_principal  BOOLEAN,
  color         TEXT,
  orden         INT,
  origen        TEXT,   -- 'cuenta' | 'cooperativa'
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
      AS saldo
  FROM public.cuentas c
  WHERE c.user_id = p_user_id AND c.activo

  UNION ALL

  -- Cooperativa: proyección de solo lectura. No es cuenta líquida.
  SELECT
    cc.id,
    CASE cc.tipo WHEN 'aportaciones' THEN 'Cooperativa · Aportaciones'
                 ELSE 'Cooperativa · Ahorro retirable' END,
    'cooperativa'::TEXT,
    FALSE,                       -- es_disponible: no es dinero de acceso inmediato
    FALSE,                       -- es_principal
    NULL::TEXT,                  -- color
    100 + (CASE cc.tipo WHEN 'aportaciones' THEN 0 ELSE 1 END),  -- orden: al final
    'cooperativa'::TEXT,
    cc.saldo
  FROM public.cooperativa_cuentas cc
  WHERE cc.user_id = p_user_id

  ORDER BY orden;
$$;


-- ────────────────────────────────────────────────────────────────────────────
-- 6. Totales del dashboard: mismos valores de antes + saldo_disponible
-- ────────────────────────────────────────────────────────────────────────────
-- Se AGREGA la columna saldo_disponible sin tocar las demás, para no romper el
-- dashboard actual. Disponible = Σ cuentas líquidas − ahorros aún reservados.
-- Los ahorros (savings_allocations) siguen físicamente en las cuentas líquidas,
-- así que se restan para que el «disponible» no incluya lo ya apartado.
--
-- Agregar una columna cambia el tipo de retorno, y CREATE OR REPLACE no puede
-- con eso: hay que soltar la función primero.
DROP FUNCTION IF EXISTS public.get_dashboard_totales(UUID);

CREATE OR REPLACE FUNCTION public.get_dashboard_totales(p_user_id UUID)
RETURNS TABLE (
  total_ingresos   NUMERIC,
  total_gastos     NUMERIC,
  total_ahorros    NUMERIC,
  cash_balance     NUMERIC,
  saldo_disponible NUMERIC
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    COALESCE((SELECT SUM(monto) FROM public.income_entries WHERE user_id = p_user_id), 0),
    COALESCE((SELECT SUM(monto) FROM public.expenses WHERE user_id = p_user_id), 0),
    COALESCE((SELECT SUM(monto) FROM public.savings_allocations WHERE user_id = p_user_id), 0),
    COALESCE((SELECT SUM(CASE WHEN tipo = 'entrada' THEN monto ELSE -monto END)
              FROM public.cash_entries WHERE user_id = p_user_id), 0),
    -- Disponible: saldo de cuentas líquidas menos lo apartado en ahorros.
    COALESCE((SELECT SUM(s.saldo) FROM public.get_saldos_cuentas(p_user_id) s
              WHERE s.es_disponible), 0)
      - COALESCE((SELECT SUM(monto) FROM public.savings_allocations WHERE user_id = p_user_id), 0);
$$;
