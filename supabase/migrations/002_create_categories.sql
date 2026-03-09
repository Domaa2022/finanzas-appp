CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('gasto', 'ingreso')),
  icono TEXT DEFAULT 'tag',
  color TEXT DEFAULT '#6B7280',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_categories_user ON public.categories(user_id);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own categories" ON public.categories
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Función para insertar categorías por defecto al crear perfil
CREATE OR REPLACE FUNCTION public.seed_default_categories(p_user_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO public.categories (user_id, nombre, tipo, icono, color) VALUES
    (p_user_id, 'Alimentación', 'gasto', 'utensils', '#EF4444'),
    (p_user_id, 'Transporte', 'gasto', 'car', '#F97316'),
    (p_user_id, 'Vivienda', 'gasto', 'home', '#8B5CF6'),
    (p_user_id, 'Servicios', 'gasto', 'zap', '#06B6D4'),
    (p_user_id, 'Salud', 'gasto', 'heart', '#EC4899'),
    (p_user_id, 'Educación', 'gasto', 'book-open', '#3B82F6'),
    (p_user_id, 'Entretenimiento', 'gasto', 'tv', '#A855F7'),
    (p_user_id, 'Ropa', 'gasto', 'shirt', '#F59E0B'),
    (p_user_id, 'Otros Gastos', 'gasto', 'more-horizontal', '#6B7280'),
    (p_user_id, 'Salario', 'ingreso', 'briefcase', '#10B981'),
    (p_user_id, 'Freelance', 'ingreso', 'laptop', '#22C55E'),
    (p_user_id, 'Ventas', 'ingreso', 'shopping-bag', '#84CC16'),
    (p_user_id, 'Inversiones', 'ingreso', 'trending-up', '#14B8A6'),
    (p_user_id, 'Otros Ingresos', 'ingreso', 'plus-circle', '#6B7280');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
