-- Fix: el output parameter "mes_aplicado" colisionaba con la columna del mismo
-- nombre en cooperativa_movimientos, causando error de ambigüedad en el
-- ON CONFLICT ... WHERE mes_aplicado IS NOT NULL.
-- Solución: renombrar el output parameter a "mes".
CREATE OR REPLACE FUNCTION public.cooperativa_aplicar_intereses_pendientes(p_user_id uuid)
RETURNS TABLE(cuenta_tipo text, mes text, interes_aplicado numeric) AS $$
DECLARE
  v_cuenta      RECORD;
  v_iter_mes    date;
  v_mes_actual  date := date_trunc('month', CURRENT_DATE)::date;
  v_balance     numeric;
  v_rate        numeric;
  v_interes     numeric;
  v_mes_label   text;
  v_fecha_apl   date;
BEGIN
  FOR v_cuenta IN
    SELECT * FROM public.cooperativa_cuentas WHERE user_id = p_user_id
  LOOP
    v_iter_mes := date_trunc('month', v_cuenta.ultima_aplicacion_intereses)::date;

    WHILE v_iter_mes < v_mes_actual LOOP
      SELECT COALESCE(SUM(monto), 0) INTO v_balance
      FROM public.cooperativa_movimientos
      WHERE cuenta_id = v_cuenta.id
        AND fecha < (v_iter_mes + INTERVAL '1 month')::date;

      v_rate      := public.cooperativa_tasa_anual(v_cuenta.tipo, v_balance);
      v_interes   := ROUND(v_balance * v_rate / 12, 2);
      v_mes_label := to_char(v_iter_mes, 'YYYY-MM');
      v_fecha_apl := (v_iter_mes + INTERVAL '1 month' - INTERVAL '1 day')::date;

      IF v_interes > 0 THEN
        INSERT INTO public.cooperativa_movimientos
          (user_id, cuenta_id, tipo, monto, fecha, descripcion, mes_aplicado)
        VALUES
          (p_user_id, v_cuenta.id, 'interes', v_interes, v_fecha_apl,
           'Intereses ' || v_mes_label, v_mes_label)
        ON CONFLICT (cuenta_id, mes_aplicado)
          WHERE tipo = 'interes' AND mes_aplicado IS NOT NULL
        DO NOTHING;

        cuenta_tipo      := v_cuenta.tipo;
        mes              := v_mes_label;
        interes_aplicado := v_interes;
        RETURN NEXT;
      END IF;

      v_iter_mes := (v_iter_mes + INTERVAL '1 month')::date;
    END LOOP;

    UPDATE public.cooperativa_cuentas
       SET ultima_aplicacion_intereses = v_mes_actual, updated_at = now()
     WHERE id = v_cuenta.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
