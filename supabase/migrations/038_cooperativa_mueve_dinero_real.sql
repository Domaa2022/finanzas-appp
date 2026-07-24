-- ════════════════════════════════════════════════════════════════════════════
-- 038 · Los movimientos de cooperativa mueven dinero real
-- ════════════════════════════════════════════════════════════════════════════
-- Hasta ahora un depósito a cooperativa solo escribía en cooperativa_movimientos:
-- subía el saldo de la cooperativa pero NO bajaba ninguna cuenta. El dinero
-- aparecía de la nada, y el saldo de la cuenta bancaria quedaba inflado por todo
-- lo aportado históricamente. El retiro tenía el problema inverso: salía de la
-- cooperativa y no entraba a ninguna cuenta.
--
-- Es el mismo patrón que ya se corrigió con «usar meta» (mig. 037): un
-- movimiento de dinero real que no quedaba registrado en la cuenta de origen.
--
-- Solución: cada movimiento puede apuntar a la cuenta bancaria de contrapartida.
-- Como `monto` ya viene con signo (depósito +, retiro −), el efecto sobre la
-- cuenta es exactamente el opuesto: basta con RESTAR la suma de los montos.
--   · depósito  +1000 → cuenta −1000  ✓
--   · retiro     −500 → cuenta  +500  ✓
--
-- `interes` y `ajuste` NO llevan contrapartida: el interés lo genera la
-- cooperativa y el ajuste es una corrección contable, no un movimiento de plata.
-- ════════════════════════════════════════════════════════════════════════════


-- ────────────────────────────────────────────────────────────────────────────
-- 1. Contrapartida bancaria en los movimientos
-- ────────────────────────────────────────────────────────────────────────────
-- Se llama cuenta_bancaria_id para no confundirla con `cuenta_id`, que en esta
-- tabla es la cuenta DE COOPERATIVA (aportaciones / retirable).
ALTER TABLE public.cooperativa_movimientos
  ADD COLUMN IF NOT EXISTS cuenta_bancaria_id UUID
    REFERENCES public.cuentas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_coop_mov_cuenta_bancaria
  ON public.cooperativa_movimientos(cuenta_bancaria_id)
  WHERE cuenta_bancaria_id IS NOT NULL;


-- ────────────────────────────────────────────────────────────────────────────
-- 2. Backfill del historial
-- ────────────────────────────────────────────────────────────────────────────
-- Los aportes que ya hiciste salieron de tu dinero bancario, y en la migración
-- 033 todo el historial bancario quedó en la cuenta «Principal». Vincularlos ahí
-- corrige la inflación acumulada de ese saldo.
--
-- Solo se vinculan los movimientos que SÍ fueron plata entrando o saliendo:
-- depósitos, retiros y transferencias desde quincena. Los intereses y ajustes
-- quedan sin contrapartida a propósito.
--
-- Para revertir este backfill:
--   UPDATE public.cooperativa_movimientos SET cuenta_bancaria_id = NULL;
UPDATE public.cooperativa_movimientos cm
SET cuenta_bancaria_id = c.id
FROM public.cuentas c
WHERE c.user_id = cm.user_id
  AND c.es_principal
  AND cm.cuenta_bancaria_id IS NULL
  AND cm.tipo IN ('deposito', 'retiro', 'transferencia_quincena');


-- ────────────────────────────────────────────────────────────────────────────
-- 3. El saldo de cada cuenta refleja los movimientos de cooperativa
-- ────────────────────────────────────────────────────────────────────────────
-- Mismo tipo de retorno que en 034 ⇒ alcanza con CREATE OR REPLACE.
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
      -- Cooperativa: el monto ya trae signo, así que restarlo da el efecto correcto
      -- en la cuenta (depósito baja el saldo, retiro lo sube).
      - COALESCE((SELECT SUM(monto) FROM public.cooperativa_movimientos cm
                  WHERE cm.cuenta_bancaria_id = c.id), 0)
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
-- 4. Registrar un movimiento con su contrapartida
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cooperativa_registrar_movimiento(
  p_user_id            UUID,
  p_cuenta_id          UUID,      -- cuenta de cooperativa
  p_tipo               TEXT,
  p_monto              NUMERIC,   -- con signo: depósito +, retiro −
  p_fecha              DATE DEFAULT CURRENT_DATE,
  p_descripcion        TEXT DEFAULT NULL,
  p_cuenta_bancaria_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_id     UUID;
  v_cuenta UUID;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  IF p_monto = 0 THEN
    RAISE EXCEPTION 'El monto no puede ser 0';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.cooperativa_cuentas
                 WHERE id = p_cuenta_id AND user_id = p_user_id) THEN
    RAISE EXCEPTION 'Cuenta de cooperativa no encontrada';
  END IF;

  -- Intereses y ajustes no mueven plata de ninguna cuenta.
  v_cuenta := CASE WHEN p_tipo IN ('interes', 'ajuste') THEN NULL
                   ELSE p_cuenta_bancaria_id END;

  IF v_cuenta IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.cuentas WHERE id = v_cuenta AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Cuenta bancaria no encontrada';
  END IF;

  INSERT INTO public.cooperativa_movimientos
    (user_id, cuenta_id, tipo, monto, fecha, descripcion, cuenta_bancaria_id)
  VALUES
    (p_user_id, p_cuenta_id, p_tipo, p_monto, p_fecha, p_descripcion, v_cuenta)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ────────────────────────────────────────────────────────────────────────────
-- 5. Transferir desde la quincena, ahora indicando de qué cuenta sale
-- ────────────────────────────────────────────────────────────────────────────
-- Se suelta la versión anterior: agregar un parámetro crearía una sobrecarga y
-- PostgREST no sabría cuál elegir.
DROP FUNCTION IF EXISTS public.cooperativa_transferir_quincena(uuid, uuid, uuid, numeric, date, text);

CREATE OR REPLACE FUNCTION public.cooperativa_transferir_quincena(
  p_user_id            uuid,
  p_cuenta_id          uuid,
  p_income_id          uuid,
  p_monto              numeric,
  p_fecha              date  DEFAULT CURRENT_DATE,
  p_notas              text  DEFAULT NULL,
  p_cuenta_bancaria_id uuid  DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_monto <= 0 THEN
    RAISE EXCEPTION 'El monto debe ser mayor a 0';
  END IF;

  IF p_cuenta_bancaria_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.cuentas WHERE id = p_cuenta_bancaria_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Cuenta bancaria no encontrada';
  END IF;

  INSERT INTO public.cooperativa_movimientos
    (user_id, cuenta_id, tipo, monto, fecha, descripcion, income_entry_id, cuenta_bancaria_id)
  VALUES
    (p_user_id, p_cuenta_id, 'transferencia_quincena', p_monto, p_fecha,
     COALESCE(p_notas, 'Transferencia desde quincena'), p_income_id, p_cuenta_bancaria_id)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
