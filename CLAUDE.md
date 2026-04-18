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

Tables: `profiles`, `categories`, `income_entries`, `expenses`, `savings_goals`, `savings_allocations`, `budgets`, `fixed_expenses`, `scheduled_savings`, `cash_entries`, `subscriptions`

Key domain concepts:
- **Quincena**: a pay period anchored to an income entry. The income marked `es_quincena_actual = true` (or the most recent one) defines the current quincena. Expenses, fixed-expense application, and savings disbursements are all calculated relative to that income's date.
- **Savings flow**: `savings_allocations` links an `income_entry_id` to a `savings_goal_id`. The `savings_goals` table has an `es_general = true` row acting as a catch-all general savings bucket. Several Postgres functions handle distribution logic (see migrations 008, 013, 014, 017, 018).
- **Fixed expenses** (`fixed_expenses`) are applied by creating `expenses` rows with `notas = 'Gasto fijo quincenal'` and `descripcion = f.nombre`.
- **Scheduled savings** (`scheduled_savings`) define recurring savings rules (porcentaje or fijo amount per income).

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
