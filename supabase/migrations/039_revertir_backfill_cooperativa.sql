-- ════════════════════════════════════════════════════════════════════════════
-- 039 · Revertir el backfill de cooperativa (dejaba el Principal en negativo)
-- ════════════════════════════════════════════════════════════════════════════
-- La 038 vinculó TODOS los movimientos históricos de cooperativa a la cuenta
-- Principal, asumiendo que esa plata había salido de ahí. Pero el saldo de
-- Principal solo refleja los ingresos que se registraron en la app; los aportes
-- a cooperativa suelen venir de dinero anterior a la app o no registrado como
-- ingreso. Restarlos todos de golpe dejó el Principal en negativo.
--
-- Se desvincula el historial: los movimientos viejos dejan de arrastrar el saldo.
-- La mecánica de la 038 se mantiene intacta — los movimientos NUEVOS creados
-- desde la UI sí registran su cuenta y mueven el dinero de verdad. Lo único que
-- se deshace es la atribución retroactiva.
--
-- La reconciliación correcta del saldo real se hace ajustando el saldo_inicial
-- de cada cuenta (ver nota al usuario), no arrastrando años de historial.
-- ════════════════════════════════════════════════════════════════════════════

-- Solo el historial previo a esta migración. Los movimientos que hayas hecho
-- desde la UI nueva (con cuenta elegida a mano) se conservan.
UPDATE public.cooperativa_movimientos
SET cuenta_bancaria_id = NULL
WHERE created_at < now();
