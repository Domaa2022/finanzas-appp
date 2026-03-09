CREATE TABLE public.income_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  monto NUMERIC(12,2) NOT NULL,
  fuente TEXT NOT NULL,
  frecuencia TEXT NOT NULL CHECK (frecuencia IN ('diario', 'quincenal', 'mensual')),
  fecha DATE NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  ahorro_tipo TEXT CHECK (ahorro_tipo IN ('porcentaje', 'fijo', 'ninguno')) DEFAULT 'porcentaje',
  ahorro_valor NUMERIC(12,2) DEFAULT 0,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_income_user_fecha ON public.income_entries(user_id, fecha DESC);

ALTER TABLE public.income_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own income" ON public.income_entries
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
