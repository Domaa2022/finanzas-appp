-- Tabla de suscripciones a aplicaciones
create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  nombre text not null,
  monto numeric(12, 2) not null default 0,
  frecuencia text not null default 'mensual'
    check (frecuencia in ('semanal', 'mensual', 'trimestral', 'anual')),
  fecha_renovacion date,
  categoria text not null default 'otro'
    check (categoria in ('entretenimiento', 'software', 'educacion', 'productividad', 'gaming', 'otro')),
  estado text not null default 'activa'
    check (estado in ('activa', 'pausada', 'cancelada')),
  notas text,
  color text,
  created_at timestamptz not null default now()
);

-- RLS
alter table subscriptions enable row level security;

create policy "Users manage own subscriptions"
  on subscriptions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
