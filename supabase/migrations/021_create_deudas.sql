-- Tabla principal: deudas y préstamos
CREATE TABLE deudas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('deuda', 'prestamo')),
  -- 'deuda'    = yo le debo a alguien
  -- 'prestamo' = alguien me debe a mí
  nombre_persona text NOT NULL,
  descripcion text,
  monto_total numeric(12,2) NOT NULL CHECK (monto_total > 0),
  monto_pagado numeric(12,2) NOT NULL DEFAULT 0 CHECK (monto_pagado >= 0),
  fecha_inicio date NOT NULL DEFAULT CURRENT_DATE,
  fecha_vencimiento date,
  estado text NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa', 'pagada', 'cancelada')),
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Historial de pagos / abonos
CREATE TABLE deuda_pagos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deuda_id uuid NOT NULL REFERENCES deudas(id) ON DELETE CASCADE,
  monto numeric(12,2) NOT NULL CHECK (monto > 0),
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE deudas ENABLE ROW LEVEL SECURITY;
ALTER TABLE deuda_pagos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own deudas" ON deudas
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage own deuda_pagos" ON deuda_pagos
  FOR ALL USING (auth.uid() = user_id);

-- Sincroniza monto_pagado y estado en deudas cada vez que se agrega/edita/elimina un pago
CREATE OR REPLACE FUNCTION sync_deuda_monto_pagado()
RETURNS TRIGGER AS $$
DECLARE
  v_deuda_id uuid;
  v_total numeric;
  v_monto_total numeric;
BEGIN
  v_deuda_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.deuda_id ELSE NEW.deuda_id END;

  SELECT COALESCE(SUM(monto), 0) INTO v_total
  FROM deuda_pagos WHERE deuda_id = v_deuda_id;

  SELECT monto_total INTO v_monto_total FROM deudas WHERE id = v_deuda_id;

  UPDATE deudas SET
    monto_pagado = v_total,
    estado = CASE WHEN v_total >= v_monto_total THEN 'pagada' ELSE 'activa' END,
    updated_at = now()
  WHERE id = v_deuda_id;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_sync_deuda_monto_pagado
AFTER INSERT OR UPDATE OR DELETE ON deuda_pagos
FOR EACH ROW EXECUTE FUNCTION sync_deuda_monto_pagado();
