-- ── 1. Trasladar del Fondo General a la quincena actual ──────────────────────
-- Registra la salida del fondo general y genera una allocation negativa
-- vinculada al income de la quincena para que el sobrante aumente.
CREATE OR REPLACE FUNCTION public.transfer_general_to_quincena(
  p_user_id   UUID,
  p_income_id UUID,    -- income_entry_id de la quincena actual
  p_amount    NUMERIC,
  p_fecha     DATE DEFAULT CURRENT_DATE
) RETURNS void AS $$
DECLARE
  v_general_id  UUID;
  v_general_bal NUMERIC;
BEGIN
  SELECT id, monto_actual INTO v_general_id, v_general_bal
  FROM public.savings_goals
  WHERE user_id = p_user_id AND es_general = TRUE
  LIMIT 1;

  IF v_general_id IS NULL THEN
    RAISE EXCEPTION 'No existe un Fondo General';
  END IF;

  IF v_general_bal < p_amount THEN
    RAISE EXCEPTION 'Saldo insuficiente en el Fondo General (disponible: %)', v_general_bal;
  END IF;

  -- Reducir saldo del fondo general
  UPDATE public.savings_goals
  SET monto_actual = monto_actual - p_amount, updated_at = now()
  WHERE id = v_general_id;

  -- Allocation negativa vinculada a la quincena:
  -- aparece en el historial del fondo general Y reduce ahorrosYaAplicados
  -- de esa quincena, por lo tanto aumenta el sobrante disponible.
  INSERT INTO public.savings_allocations
    (user_id, income_entry_id, savings_goal_id, monto, fecha, notas)
  VALUES
    (p_user_id, p_income_id, v_general_id, -p_amount, p_fecha, 'Apoyo desde Fondo General');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ── 2. Tabla de efectivo ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cash_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tipo        TEXT NOT NULL CHECK (tipo IN ('entrada', 'salida')),
  monto       NUMERIC(12, 2) NOT NULL CHECK (monto > 0),
  descripcion TEXT NOT NULL,
  fecha       DATE NOT NULL DEFAULT CURRENT_DATE,
  notas       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cash_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own cash"
  ON public.cash_entries FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
