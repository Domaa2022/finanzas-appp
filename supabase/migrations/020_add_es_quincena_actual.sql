-- Marca qué ingreso es la quincena principal activa.
-- Solo uno puede tener TRUE a la vez.
ALTER TABLE public.income_entries
ADD COLUMN IF NOT EXISTS es_quincena_actual BOOLEAN DEFAULT FALSE;
