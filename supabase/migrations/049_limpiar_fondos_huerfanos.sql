-- ════════════════════════════════════════════════════════════════════════════
-- 049 · Liberar fondos de gasto fijo huérfanos
-- ════════════════════════════════════════════════════════════════════════════
-- Antes, borrar una suscripción no borraba su fondo (savings_goal con
-- es_gasto_fijo = TRUE): quedaba huérfano restando del disponible para siempre.
-- Ya se arregló el borrado, pero los fondos huérfanos que quedaron de borrados
-- previos siguen ahí. Un fondo de gasto fijo SIEMPRE debería estar referenciado
-- por un fixed_expenses; si no lo está, es huérfano y su plata debe volver al
-- disponible.
--
-- Al borrar el goal, sus allocations se eliminan en cascada y el monto deja de
-- restar del disponible.
-- ════════════════════════════════════════════════════════════════════════════

DELETE FROM public.savings_goals g
WHERE g.es_gasto_fijo = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM public.fixed_expenses f WHERE f.savings_goal_id = g.id
  );
