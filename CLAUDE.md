# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server at http://localhost:3000
npm run build    # Production build
npm run start    # Run production build
```

No lint or test scripts are configured.

## Architecture

### Route structure

- `app/(app)/` — authenticated pages (dashboard, gastos, ingresos, ahorros, presupuestos, reportes, quincena, gastos-fijos, ahorro-programado, suscripciones, efectivo, categorias, configuracion)
- `app/(auth)/` — login, registro
- Each route follows the same pattern: a server component `page.tsx` that fetches data from Supabase and passes it down to a `*ClientPage.tsx` client component for interactivity

### Data layer

- `proxy.ts` — Next.js 16 proxy (equivalente a middleware). Controla rutas públicas vía `publicRoutes[]`. Agregar ahí cualquier ruta que deba ser accesible sin sesión.
- `lib/supabase/server.ts` — server-side Supabase client (used in `page.tsx` server components and layout)
- `lib/supabase/client.ts` — browser-side Supabase client (used inside `*ClientPage.tsx` for mutations)
- `lib/types/database.ts` — all TypeScript types for DB rows (source of truth for types)
- `lib/utils/` — `dates.ts`, `currency.ts`, `calculations.ts`
- All DB queries use `user_id` equality filter; auth is checked in `app/(app)/layout.tsx`, which redirects unauthenticated users to `/login`

### Database schema (via `supabase/migrations/`)

Tables: `profiles`, `categories`, `income_entries`, `expenses`, `savings_goals`, `savings_allocations`, `budgets`, `fixed_expenses`, `scheduled_savings`, `cash_entries`, `cuentas`, `transferencias`

**Cuentas** (migraciones 033–034): `cuentas` es la entidad de dinero de primera clase. `income_entries`, `expenses`, `cash_entries` y `fixed_expenses` tienen `cuenta_id`. El saldo NUNCA se guarda: se deriva con `get_saldos_cuentas(user)` (cuentas reales por sus movimientos + `transferencias`, más la cooperativa proyectada de solo lectura desde `cooperativa_cuentas`). El saldo **disponible** = Σ cuentas con `es_disponible` − ahorros apartados (lo devuelve `get_dashboard_totales.saldo_disponible`). `transferencias` mueve dinero entre cuentas sin ser ingreso ni gasto (función `registrar_transferencia`). Los formularios cliente leen las cuentas con el hook `lib/cuentas/useCuentas.ts` (no se hace threading desde los server components). Pantalla: `/cuentas`. Tarjetas de crédito = Fase 3 (columnas `cupo`/`dia_corte`/`dia_pago` en `cuentas` y `transferencias.tipo = 'pago_tarjeta'` ya reservadas).

`subscriptions` is obsolete since migration 031 — subscriptions are now `fixed_expenses` rows. The table is kept only as a migration backup.

Key domain concepts:
- **Quincena**: a pay period anchored to an income entry. The income marked `es_quincena_actual = true` (or the most recent one) defines the current quincena. Expenses, fixed-expense application, and savings disbursements are all calculated relative to that income's date.
- **Savings flow**: `savings_allocations` links an `income_entry_id` to a `savings_goal_id`. The `savings_goals` table has an `es_general = true` row acting as a catch-all general savings bucket. Several Postgres functions handle distribution logic (see migrations 008, 013, 014, 017, 018). Since 028, `savings_goals.monto_actual` is derived by trigger from the sum of allocations — **never update it manually**.
- **Tarjetas de crédito** (migración 040): una `cuenta` de `tipo='tarjeta'`. Su saldo derivado es NEGATIVO = deuda. Gastar con tarjeta es un `expense` con `cuenta_id` = la tarjeta (resta → más deuda, y como no es líquida no toca el disponible); pagarla es una `transferencia` `tipo='pago_tarjeta'` desde una cuenta líquida (suma → menos deuda). Crédito disponible = `cupo − deuda`. Un trigger fuerza `es_disponible=false` y `es_principal=false` en las tarjetas. En los resúmenes, las tarjetas se excluyen de "En ahorro" y se muestran como deuda aparte.
- **Usar meta** (migración 037): `usar_meta` registra el gasto real al cumplir una meta y vacía el fondo, para que el saldo de la cuenta refleje la realidad. La marca de `completada` va DESPUÉS del insert de la allocation (el trigger reescribiría el estado si no).
- **Cooperativa** (migración 038): los movimientos llevan `cuenta_bancaria_id` (contrapartida real). Como `monto` trae signo, el saldo de la cuenta se calcula restando `SUM(monto)` de los movimientos vinculados. Intereses y ajustes no llevan contrapartida.
- **Fixed expenses** (`fixed_expenses`) come in two shapes, split by `frecuencia`. Since migration 032 that split *is* the routing — there is no separate flag, so a row's behavior and the screen it appears on can never disagree:
  - `quincenal` — charged directly with each quincena, no fund. Creates an `expenses` row with `notas = 'Gasto fijo quincenal'` and `descripcion = f.nombre`. Managed in `/gastos-fijos`.
  - `semanal | mensual | trimestral | anual | variable` — each has a dedicated `savings_goal` (`es_gasto_fijo = true`) that accumulates money every quincena. On `proximo_pago` the charge is taken from that fund. `variable` has no date: it fills its fund and stops, and is paid manually. Managed in `/suscripciones`.
- **Automation** (migration 031):
  - `procesar_quincena(user, income)` runs when an income is pinned as the current quincena (`IncomeForm.tsx`): applies quincenal fixed expenses, tops up the funds of the non-quincenal ones, and applies scheduled savings. All three steps are idempotent.
  - `procesar_pagos_vencidos(user)` runs on dashboard load and charges anything whose `proximo_pago` has arrived, advancing it one cycle. This is the substitute for a cron job — there is no scheduler.
  - Amount set aside per quincena = *remaining to fill* ÷ *quincenas left until the pay date*, so a full fund sets aside nothing.
- **Scheduled savings** (`scheduled_savings`) define recurring savings rules (porcentaje or fijo amount per income); `savings_goal_id` picks the destination, NULL means the general fund.

### UI conventions

- `components/ui/` — shared primitives: Button, Card, Input, Modal, Select, Badge, ProgressBar
- Forms use `react-hook-form` + `zod`
- Charts use `recharts`
- Toasts use `sonner`
- Styling: Tailwind v4 (PostCSS-based, no `tailwind.config` file — config lives in `app/globals.css`)
- Icons: `lucide-react`

### Environment variables required

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```
