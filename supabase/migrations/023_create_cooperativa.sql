-- ── Cooperativa: cuentas de Aportaciones y Ahorro Retirable ──────────────────

CREATE TABLE IF NOT EXISTS public.cooperativa_cuentas (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tipo                          text NOT NULL CHECK (tipo IN ('aportaciones', 'retirable')),
  saldo                         numeric(14, 2) NOT NULL DEFAULT 0 CHECK (saldo >= 0),
  ultima_aplicacion_intereses   date NOT NULL DEFAULT (date_trunc('month', CURRENT_DATE)::date),
  created_at                    timestamptz NOT NULL DEFAULT now(),
  updated_at                    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, tipo)
);

CREATE TABLE IF NOT EXISTS public.cooperativa_movimientos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  cuenta_id       uuid NOT NULL REFERENCES public.cooperativa_cuentas(id) ON DELETE CASCADE,
  tipo            text NOT NULL CHECK (tipo IN ('deposito', 'retiro', 'interes', 'transferencia_quincena', 'ajuste')),
  monto           numeric(14, 2) NOT NULL,
  fecha           date NOT NULL DEFAULT CURRENT_DATE,
  descripcion     text,
  income_entry_id uuid REFERENCES public.income_entries(id) ON DELETE SET NULL,
  mes_aplicado    text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coop_mov_cuenta ON public.cooperativa_movimientos(cuenta_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_coop_mov_user ON public.cooperativa_movimientos(user_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_coop_mov_income ON public.cooperativa_movimientos(income_entry_id) WHERE income_entry_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_coop_interes_mes ON public.cooperativa_movimientos(cuenta_id, mes_aplicado)
  WHERE tipo = 'interes' AND mes_aplicado IS NOT NULL;

ALTER TABLE public.cooperativa_cuentas       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cooperativa_movimientos   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own cooperativa_cuentas"
  ON public.cooperativa_cuentas FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own cooperativa_movimientos"
  ON public.cooperativa_movimientos FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── Sincroniza el saldo de la cuenta con sus movimientos ─────────────────────
CREATE OR REPLACE FUNCTION public.sync_cooperativa_saldo()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.cooperativa_cuentas
       SET saldo = saldo + NEW.monto, updated_at = now()
     WHERE id = NEW.cuenta_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.cooperativa_cuentas
       SET saldo = saldo - OLD.monto, updated_at = now()
     WHERE id = OLD.cuenta_id;
  ELSE
    IF NEW.cuenta_id = OLD.cuenta_id THEN
      UPDATE public.cooperativa_cuentas
         SET saldo = saldo - OLD.monto + NEW.monto, updated_at = now()
       WHERE id = NEW.cuenta_id;
    ELSE
      UPDATE public.cooperativa_cuentas
         SET saldo = saldo - OLD.monto, updated_at = now()
       WHERE id = OLD.cuenta_id;
      UPDATE public.cooperativa_cuentas
         SET saldo = saldo + NEW.monto, updated_at = now()
       WHERE id = NEW.cuenta_id;
    END IF;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_sync_cooperativa_saldo
AFTER INSERT OR UPDATE OR DELETE ON public.cooperativa_movimientos
FOR EACH ROW EXECUTE FUNCTION public.sync_cooperativa_saldo();

-- ── Crear las dos cuentas automáticamente para cada perfil ───────────────────
CREATE OR REPLACE FUNCTION public.seed_cooperativa_accounts()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.cooperativa_cuentas (user_id, tipo) VALUES (NEW.id, 'aportaciones')
    ON CONFLICT (user_id, tipo) DO NOTHING;
  INSERT INTO public.cooperativa_cuentas (user_id, tipo) VALUES (NEW.id, 'retirable')
    ON CONFLICT (user_id, tipo) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_seed_cooperativa_accounts
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.seed_cooperativa_accounts();

-- Backfill para usuarios existentes
INSERT INTO public.cooperativa_cuentas (user_id, tipo)
SELECT id, 'aportaciones' FROM public.profiles
ON CONFLICT (user_id, tipo) DO NOTHING;

INSERT INTO public.cooperativa_cuentas (user_id, tipo)
SELECT id, 'retirable' FROM public.profiles
ON CONFLICT (user_id, tipo) DO NOTHING;

-- ── Calcular la tasa anual según rango ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cooperativa_tasa_anual(p_tipo text, p_saldo numeric)
RETURNS numeric AS $$
BEGIN
  IF p_tipo = 'aportaciones' THEN
    RETURN CASE
      WHEN p_saldo >= 1500000 THEN 0.0500
      WHEN p_saldo >= 500000  THEN 0.0450
      WHEN p_saldo >= 250000  THEN 0.0400
      WHEN p_saldo >= 50000   THEN 0.0350
      WHEN p_saldo >= 30      THEN 0.0300
      ELSE 0
    END;
  ELSE
    RETURN CASE
      WHEN p_saldo >= 1500000 THEN 0.0400
      WHEN p_saldo >= 500000  THEN 0.0300
      WHEN p_saldo >= 250000  THEN 0.0250
      WHEN p_saldo >= 50000   THEN 0.0200
      WHEN p_saldo >= 10000   THEN 0.0150
      WHEN p_saldo >= 100     THEN 0.0100
      ELSE 0
    END;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ── Aplicar intereses pendientes de meses ya cerrados ────────────────────────
-- Para cada cuenta: itera desde `ultima_aplicacion_intereses` hasta el inicio
-- del mes actual. Para cada mes cerrado calcula el saldo al cierre (último día
-- del mes) y aplica `saldo * tasa_anual / 12` como movimiento tipo 'interes'.
CREATE OR REPLACE FUNCTION public.cooperativa_aplicar_intereses_pendientes(p_user_id uuid)
RETURNS TABLE(cuenta_tipo text, mes_aplicado text, interes_aplicado numeric) AS $$
DECLARE
  v_cuenta      RECORD;
  v_iter_mes    date;
  v_mes_actual  date := date_trunc('month', CURRENT_DATE)::date;
  v_balance     numeric;
  v_rate        numeric;
  v_interes     numeric;
  v_mes_label   text;
  v_fecha_apl   date;
BEGIN
  FOR v_cuenta IN
    SELECT * FROM public.cooperativa_cuentas WHERE user_id = p_user_id
  LOOP
    v_iter_mes := date_trunc('month', v_cuenta.ultima_aplicacion_intereses)::date;

    WHILE v_iter_mes < v_mes_actual LOOP
      SELECT COALESCE(SUM(monto), 0) INTO v_balance
      FROM public.cooperativa_movimientos
      WHERE cuenta_id = v_cuenta.id
        AND fecha < (v_iter_mes + INTERVAL '1 month')::date;

      v_rate     := public.cooperativa_tasa_anual(v_cuenta.tipo, v_balance);
      v_interes  := ROUND(v_balance * v_rate / 12, 2);
      v_mes_label := to_char(v_iter_mes, 'YYYY-MM');
      v_fecha_apl := (v_iter_mes + INTERVAL '1 month' - INTERVAL '1 day')::date;

      IF v_interes > 0 THEN
        INSERT INTO public.cooperativa_movimientos
          (user_id, cuenta_id, tipo, monto, fecha, descripcion, mes_aplicado)
        VALUES
          (p_user_id, v_cuenta.id, 'interes', v_interes, v_fecha_apl,
           'Intereses ' || v_mes_label, v_mes_label)
        ON CONFLICT (cuenta_id, mes_aplicado)
          WHERE tipo = 'interes' AND mes_aplicado IS NOT NULL
        DO NOTHING;

        cuenta_tipo      := v_cuenta.tipo;
        mes_aplicado     := v_mes_label;
        interes_aplicado := v_interes;
        RETURN NEXT;
      END IF;

      v_iter_mes := (v_iter_mes + INTERVAL '1 month')::date;
    END LOOP;

    UPDATE public.cooperativa_cuentas
       SET ultima_aplicacion_intereses = v_mes_actual, updated_at = now()
     WHERE id = v_cuenta.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Transferir desde la quincena actual a una cuenta de cooperativa ──────────
CREATE OR REPLACE FUNCTION public.cooperativa_transferir_quincena(
  p_user_id    uuid,
  p_cuenta_id  uuid,
  p_income_id  uuid,
  p_monto      numeric,
  p_fecha      date  DEFAULT CURRENT_DATE,
  p_notas      text  DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_monto <= 0 THEN
    RAISE EXCEPTION 'El monto debe ser mayor a 0';
  END IF;

  INSERT INTO public.cooperativa_movimientos
    (user_id, cuenta_id, tipo, monto, fecha, descripcion, income_entry_id)
  VALUES
    (p_user_id, p_cuenta_id, 'transferencia_quincena', p_monto, p_fecha,
     COALESCE(p_notas, 'Transferencia desde quincena'), p_income_id)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
