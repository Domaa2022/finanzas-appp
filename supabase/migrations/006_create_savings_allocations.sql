CREATE TABLE public.savings_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  income_entry_id UUID NOT NULL REFERENCES public.income_entries(id) ON DELETE CASCADE,
  savings_goal_id UUID NOT NULL REFERENCES public.savings_goals(id) ON DELETE CASCADE,
  monto NUMERIC(12,2) NOT NULL,
  fecha DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_allocations_goal ON public.savings_allocations(savings_goal_id);
CREATE INDEX idx_allocations_income ON public.savings_allocations(income_entry_id);
CREATE INDEX idx_allocations_user ON public.savings_allocations(user_id, fecha DESC);

ALTER TABLE public.savings_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own allocations" ON public.savings_allocations
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
