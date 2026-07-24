-- ════════════════════════════════════════════════════════════════════════════
-- 032 · Todo lo que tiene fondo vive en Suscripciones
-- ════════════════════════════════════════════════════════════════════════════
-- 031 dejó dos ejes para clasificar un gasto fijo y eso era un eje de más:
--
--   · `frecuencia` — decide el comportamiento real: `quincenal` se cobra directo
--     con la quincena, todo lo demás aparta a un fondo y se cobra solo.
--   · `es_suscripcion` — decidía en qué pantalla se veía.
--
-- Los dos siempre iban a coincidir, y cuando no coincidieran (un préstamo
-- mensual con es_suscripcion = false) el gasto quedaba huérfano: apartaba
-- dinero y se cobraba solo, pero sin pantalla donde verlo.
--
-- Ahora la pantalla se deriva del comportamiento y no hay bandera que mantener:
--
--   /gastos-fijos   → frecuencia = 'quincenal'   (sin fondo, cobro directo)
--   /suscripciones  → frecuencia <> 'quincenal'  (con fondo, cobro automático)
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.fixed_expenses
  DROP COLUMN IF EXISTS es_suscripcion;

COMMENT ON COLUMN public.fixed_expenses.frecuencia IS
  'quincenal se cobra directo con cada quincena y se administra en /gastos-fijos. '
  'El resto (semanal, mensual, trimestral, anual, variable) aparta dinero a un '
  'savings_goal propio, se cobra solo al llegar proximo_pago y se administra en '
  '/suscripciones.';
