/**
 * ¿La ruta actual corresponde a este link de navegación?
 *
 * No alcanza con `pathname.startsWith(href)`: `/gastos-fijos` empieza con
 * `/gastos` y encendería los dos íconos a la vez. Se exige que coincida exacto
 * o que siga una barra, para que el corte caiga en un límite de segmento.
 */
export function isActiveRoute(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + '/')
}
