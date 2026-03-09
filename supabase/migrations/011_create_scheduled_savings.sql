CREATE TABLE public.scheduled_savings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('porcentaje', 'fijo')),
  valor NUMERIC(12,2) NOT NULL,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_scheduled_savings_user ON public.scheduled_savings(user_id);

ALTER TABLE public.scheduled_savings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own scheduled savings" ON public.scheduled_savings
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
