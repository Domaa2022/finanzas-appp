CREATE TABLE public.savings_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  monto_objetivo NUMERIC(12,2) NOT NULL,
  monto_actual NUMERIC(12,2) DEFAULT 0,
  fecha_limite DATE,
  prioridad INT DEFAULT 1 CHECK (prioridad BETWEEN 1 AND 5),
  estado TEXT DEFAULT 'activa' CHECK (estado IN ('activa', 'completada', 'pausada')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_savings_user ON public.savings_goals(user_id);

ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own savings goals" ON public.savings_goals
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
