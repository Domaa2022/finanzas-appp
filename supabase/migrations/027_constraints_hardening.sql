-- ─── 027: Endurecimiento de constraints (sin cambios de lógica) ──────────────
-- Solo integridad de datos:
--   1. deudas / deuda_pagos referencian profiles en vez de auth.users
--   2. Garantizar una sola quincena actual por usuario
--   3. CHECK de monto > 0 en expenses e income_entries

-- ── 1. Reapuntar las FK de deudas a profiles ─────────────────────────────────
-- profiles.id ES el mismo UUID que auth.users.id, así que los datos no cambian:
-- solo cambia a qué tabla apunta la llave (consistencia + permite joins a profiles).
ALTER TABLE public.deudas
  DROP CONSTRAINT IF EXISTS deudas_user_id_fkey,
  ADD CONSTRAINT deudas_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.deuda_pagos
  DROP CONSTRAINT IF EXISTS deuda_pagos_user_id_fkey,
  ADD CONSTRAINT deuda_pagos_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- ── 2. Una sola quincena actual por usuario ──────────────────────────────────
-- Primero limpiar datos: si hay más de un ingreso marcado como actual para un
-- mismo usuario, conservar solo el más reciente.
UPDATE public.income_entries i
SET es_quincena_actual = FALSE
WHERE i.es_quincena_actual = TRUE
  AND i.id <> (
    SELECT i2.id
    FROM public.income_entries i2
    WHERE i2.user_id = i.user_id
      AND i2.es_quincena_actual = TRUE
    ORDER BY i2.fecha DESC, i2.created_at DESC
    LIMIT 1
  );

-- Índice parcial: a lo sumo una fila con es_quincena_actual = TRUE por usuario.
CREATE UNIQUE INDEX IF NOT EXISTS uq_income_quincena_actual
  ON public.income_entries(user_id)
  WHERE es_quincena_actual;

-- ── 3. Montos positivos en movimientos ───────────────────────────────────────
-- NOT VALID: aplica a filas nuevas sin fallar si hubiera datos antiguos inválidos.
ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_monto_positivo CHECK (monto > 0) NOT VALID;

ALTER TABLE public.income_entries
  ADD CONSTRAINT income_entries_monto_positivo CHECK (monto > 0) NOT VALID;

-- Validar contra los datos existentes (si alguna fila falla, revisar esos datos
-- y reejecutar). Se puede comentar si se prefiere no validar el histórico.
ALTER TABLE public.expenses        VALIDATE CONSTRAINT expenses_monto_positivo;
ALTER TABLE public.income_entries  VALIDATE CONSTRAINT income_entries_monto_positivo;
