-- ─── 050: Eliminar la propia cuenta ──────────────────────────────────────────
-- Permite que un usuario autenticado borre su perfil, todos sus datos y su
-- usuario de auth. Se llama desde la app con supabase.rpc('eliminar_mi_cuenta').
--
-- Primero se borran los movimientos que apuntan a cuentas/categorías con
-- ON DELETE RESTRICT (gastos, ingresos, efectivo, transferencias), para que la
-- cascada desde auth.users no choque con esas restricciones. El resto de tablas
-- se elimina por ON DELETE CASCADE (auth.users -> profiles -> ...).

CREATE OR REPLACE FUNCTION public.eliminar_mi_cuenta()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  DELETE FROM public.transferencias          WHERE user_id = v_uid;
  DELETE FROM public.deuda_pagos             WHERE user_id = v_uid;
  DELETE FROM public.cooperativa_movimientos WHERE user_id = v_uid;
  DELETE FROM public.savings_allocations     WHERE user_id = v_uid;
  DELETE FROM public.expenses                WHERE user_id = v_uid;
  DELETE FROM public.income_entries          WHERE user_id = v_uid;
  DELETE FROM public.cash_entries            WHERE user_id = v_uid;

  -- La foto de perfil (bucket avatars) se borra desde la app con la Storage
  -- API antes de llamar a esta función: Supabase no permite DELETE directo
  -- sobre storage.objects.

  -- Borra el usuario; profiles y demás tablas caen por ON DELETE CASCADE
  DELETE FROM auth.users WHERE id = v_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.eliminar_mi_cuenta() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.eliminar_mi_cuenta() TO authenticated;
