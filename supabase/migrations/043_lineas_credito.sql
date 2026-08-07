-- ════════════════════════════════════════════════════════════════════════════
-- 043 · Líneas de crédito compartidas entre tarjetas
-- ════════════════════════════════════════════════════════════════════════════
-- Algunas tarjetas comparten un mismo cupo: p.ej. dos tarjetas con un límite
-- global. El crédito disponible no es por tarjeta, sino de la línea entera:
--   disponible_linea = limite − (deuda tarjeta A + deuda tarjeta B + …)
--
-- Se modela con una "línea de crédito" que tiene el límite, y las tarjetas
-- pertenecen a ella (linea_credito_id). Una tarjeta sin línea sigue usando su
-- propio `cupo` como antes.
--
-- Todo en lempiras (el límite en USD se convierte a HNL al cargarlo).
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.lineas_credito (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  nombre     TEXT NOT NULL,
  limite     NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (limite >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lineas_credito_user ON public.lineas_credito(user_id);

ALTER TABLE public.lineas_credito ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own lineas_credito"
  ON public.lineas_credito FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_lineas_credito_updated_at ON public.lineas_credito;
CREATE TRIGGER trg_lineas_credito_updated_at BEFORE UPDATE ON public.lineas_credito
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Una tarjeta puede pertenecer a una línea compartida. Al borrarse la línea, la
-- tarjeta queda sin línea (vuelve a su cupo propio, si tiene).
ALTER TABLE public.cuentas
  ADD COLUMN IF NOT EXISTS linea_credito_id UUID
    REFERENCES public.lineas_credito(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cuentas_linea
  ON public.cuentas(linea_credito_id) WHERE linea_credito_id IS NOT NULL;


-- ────────────────────────────────────────────────────────────────────────────
-- Saldo de cada línea: límite, deuda total de sus tarjetas y disponible
-- ────────────────────────────────────────────────────────────────────────────
-- La deuda de cada tarjeta se toma de get_saldos_cuentas (saldo negativo = deuda).
CREATE OR REPLACE FUNCTION public.get_lineas_credito(p_user_id UUID)
RETURNS TABLE (
  id         UUID,
  nombre     TEXT,
  limite     NUMERIC,
  deuda      NUMERIC,
  disponible NUMERIC
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  WITH deudas AS (
    SELECT c.linea_credito_id AS lc_id,
           SUM(GREATEST(-s.saldo, 0)) AS deuda
    FROM public.get_saldos_cuentas(p_user_id) s
    JOIN public.cuentas c ON c.id = s.id
    WHERE c.linea_credito_id IS NOT NULL
    GROUP BY c.linea_credito_id
  )
  SELECT
    lc.id, lc.nombre, lc.limite,
    COALESCE(d.deuda, 0) AS deuda,
    lc.limite - COALESCE(d.deuda, 0) AS disponible
  FROM public.lineas_credito lc
  LEFT JOIN deudas d ON d.lc_id = lc.id
  WHERE lc.user_id = p_user_id
  ORDER BY lc.nombre;
$$;
