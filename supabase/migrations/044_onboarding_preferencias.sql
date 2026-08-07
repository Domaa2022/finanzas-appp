-- ════════════════════════════════════════════════════════════════════════════
-- 044 · Onboarding y preferencias de módulos por usuario
-- ════════════════════════════════════════════════════════════════════════════
-- La app tiene muchos conceptos (quincena, cooperativa, fondos, metas…) que son
-- muy útiles pero abruman a alguien nuevo. Para que un amigo pueda probarla sin
-- ahogarse, cada usuario elige qué módulos ver; el resto queda oculto hasta que
-- lo active.
--
--   · onboarding_completo → si ya pasó por la bienvenida.
--   · preferencias        → { cobro, modulos: { <modulo>: bool } }.
--
-- Módulos opcionales (los básicos —cuentas, ingresos, gastos, reportes— siempre
-- se ven): gastos_fijos, suscripciones, deudas, ahorros, ahorro_programado,
-- cooperativa, quincena, efectivo, presupuestos, categorias.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completo BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS preferencias JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Usuarios que YA existen tienen todo configurado: no los mandes a la bienvenida
-- y dejales todos los módulos visibles (así tu app no cambia en nada).
UPDATE public.profiles
SET onboarding_completo = TRUE,
    preferencias = jsonb_build_object(
      'cobro', 'quincenal',
      'modulos', jsonb_build_object(
        'gastos_fijos',      TRUE,
        'suscripciones',     TRUE,
        'deudas',            TRUE,
        'ahorros',           TRUE,
        'ahorro_programado', TRUE,
        'cooperativa',       TRUE,
        'quincena',          TRUE,
        'efectivo',          TRUE,
        'presupuestos',      TRUE,
        'categorias',        TRUE
      )
    )
WHERE onboarding_completo = FALSE;
