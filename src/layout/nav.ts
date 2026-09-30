/** Secciones del panel. `key` es también el área de idioma de la pantalla y el nombre de su carpeta en `pages/`. */
export const NAV = [
  { key: 'resumen', path: '/resumen' },
  { key: 'ventas', path: '/ventas' },
  { key: 'fiados', path: '/fiados' },
  { key: 'gastos', path: '/gastos' },
  { key: 'inventario', path: '/inventario' },
  { key: 'cierres', path: '/cierres' },
  { key: 'reportes', path: '/reportes' },
  { key: 'equipo', path: '/equipo' },
  { key: 'avisos', path: '/avisos' },
  { key: 'ajustes', path: '/ajustes' },
  { key: 'ayuda', path: '/ayuda' },
] as const

export type NavKey = (typeof NAV)[number]['key']
