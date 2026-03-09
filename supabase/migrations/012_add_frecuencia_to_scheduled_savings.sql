ALTER TABLE public.scheduled_savings
  ADD COLUMN frecuencia TEXT NOT NULL DEFAULT 'quincenal'
  CHECK (frecuencia IN ('diario', 'semanal', 'quincenal', 'mensual'));
