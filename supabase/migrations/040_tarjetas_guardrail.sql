-- ════════════════════════════════════════════════════════════════════════════
-- 040 · Tarjetas de crédito: guardrail  (Fase 3)
-- ════════════════════════════════════════════════════════════════════════════
-- Una tarjeta es una cuenta de tipo 'tarjeta'. Su saldo derivado es NEGATIVO:
-- representa deuda (gastar la aumenta, pagar la reduce). La maquinaria de saldo
-- (get_saldos_cuentas) ya lo maneja sin cambios:
--   · gasto con tarjeta = expense con cuenta_id = tarjeta → resta → más deuda
--   · pago de tarjeta   = transferencia hacia la tarjeta  → suma → menos deuda
--
-- Lo único que hay que garantizar es que una deuda NUNCA se cuele como dinero
-- disponible ni sea la cuenta por defecto de ingresos/gastos. Este trigger lo
-- fuerza a nivel de base, pase lo que pase en la UI.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.normalizar_cuenta_tarjeta()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tipo = 'tarjeta' THEN
    NEW.es_disponible := FALSE;  -- su saldo (deuda) no es dinero gastable
    NEW.es_principal  := FALSE;  -- no puede ser la cuenta por defecto
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_normalizar_cuenta_tarjeta ON public.cuentas;
CREATE TRIGGER trg_normalizar_cuenta_tarjeta
BEFORE INSERT OR UPDATE OF tipo, es_disponible, es_principal ON public.cuentas
FOR EACH ROW EXECUTE FUNCTION public.normalizar_cuenta_tarjeta();

-- Normalizar cualquier tarjeta que ya existiera mal marcada.
UPDATE public.cuentas
SET es_disponible = FALSE, es_principal = FALSE
WHERE tipo = 'tarjeta' AND (es_disponible OR es_principal);
