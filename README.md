# Cuadra — panel web del negocio

Panel para **dueños y administradores** (React 19 + TypeScript + Vite). Los cajeros trabajan en la app del teléfono y no entran aquí.

## Cómo se corre

```bash
npm install
npm run dev          # http://localhost:5173 ; /api se reenvía a la API local (localhost:8086)
npm run typecheck && npm test && npm run lint && npm run build
```

La API local se levanta con `../infra/dev-run.sh` desde la raíz del repositorio.

### Iniciar sesión

- **Plataforma**: en la pantalla de entrada, el enlace discreto "Acceso de plataforma" muestra usuario y contraseña (`POST /api/auth/platform`; 5 fallos bloquean 15 min) y entra a `/console`. La contraseña no se guarda ni se registra.
- **Real**: botón de Google (Google Identity Services). Necesita `VITE_GOOGLE_CLIENT_ID` (ID de cliente "Web" de Google Cloud); sin él la pantalla lo dice.
- **Solo en desarrollo** (`npm run dev`, nunca en el build de producción): pegar un token de sesión de la API en la pantalla de entrada, o abrir `http://localhost:5173/?devToken=<token>`.

## El cliente de la API se genera

`../docs/openapi.json` es el contrato de la API; **lo escribe una prueba del servidor** (`OpenApiTest`), no se edita a mano. De ahí sale `src/api/schema.d.ts`:

```bash
npm run gen:api      # tras cambiar la API: (cd ../backend && mvn test -Dtest=OpenApiTest) y luego esto
```

Si la API cambia y no se regenera, el panel deja de compilar en vez de fallar en producción. `src/api/http.ts` es el único punto que llama a la API (`client` tipado, `call()` que convierte errores en `ApiError` con su `code`, `downloadFile()` para CSV con sesión).

En el contrato los campos de las respuestas que nunca son nulos (los `long`, `int`, `boolean` del servidor y los `id`) son obligatorios; el resto es opcional (`?`).

## Estructura

```
src/
  api/          cliente tipado (http.ts), tipos generados (schema.d.ts) y alias (types.ts)
  auth/         sesión (session.ts), contexto (context.ts), proveedor (AuthProvider.tsx), botón de Google
  layout/       marco del panel (AppShell) y lista de secciones (nav.ts)
  components/   piezas compartidas: ui.tsx (Page, Card, Kpi, Tag, Button, Field…), DataTable, Modal, RangePicker
  plan/         plan del negocio: PlanProvider/usePlan (se carga una vez por negocio; si falla NO bloquea nada), lógica pura (logic.ts), SectionGuard/ProGate (secciones fuera del plan, también por URL directa) y SuspendedNotice
  hooks/        useAsync (carga con recarga y sin respuestas viejas), useFormat (dinero, fechas y cantidades del negocio)
  lib/          money.ts, dates.ts (jornada del negocio con hora de corte), errors.ts
  i18n/         index.ts + locales/<idioma>/<área>.json
  pages/<área>/ una carpeta por sección del menú (resumen, ventas, fiados, gastos, inventario, cierres, reportes, equipo, avisos, ajustes, ayuda) y `consola/` (consola de la plataforma, ver abajo)
  styles/       tokens.css (color, una sola fuente) y app.css (marco y componentes)
```

### Planes y límites

`GET /plan` manda los límites; el panel solo los muestra y cierra las secciones que `limits.webSections` no incluye (Resumen, Ajustes, Ayuda y Plan nunca se cierran). Los errores `PLAN_LIMIT` (con `feature` y `limit`, disponibles en `ApiError`) y `BUSINESS_SUSPENDED` se explican en `errorText`/`ErrorNotice`. Los botones de CSV se marcan "Pro" si el plan no exporta. Ajustes tiene la pestaña Actividad (`/ajustes/actividad`, solo dueño).

### Equipo (`/equipo`)

Sin invitaciones: solo el dueño usa Google. El dueño agrega personas con **nombre (su usuario) y PIN de exactamente 5 números**; cada una entra desde su teléfono con el **código del negocio** (5 dígitos, `PUT/POST /api/b/{id}/access-code`: el dueño puede elegir el suyo o renovarlo al azar), su usuario y su PIN. La validación del PIN y del código vive en `src/pages/equipo/lib.ts` (mismas reglas que el servidor: `INVALID_PIN`, `INVALID_ACCESS_CODE`, `ACCESS_CODE_TAKEN`).

### Consola de la plataforma (`/console/*`)

`src/pages/consola/` (área de idioma `consola`): métricas, negocios (con acciones y "Ver como"), usuarios, teléfonos, tickets, configuración remota, anuncios y auditoría. Tiene su propio marco (no necesita un negocio). Solo entra quien tiene `me.platformAdmin`; para los demás la ruta se ve como "no encontrada" (la API contesta 404). Toda acción que cambia algo usa `ReasonDialog` con motivo de al menos 5 letras. Los códigos de error de la consola y `VIEW_AS_READ_ONLY` están en `consola.json` (`errors.*`); `lib/errors.ts` los busca ahí.

**Ver como**: `auth/session.ts` aparta el token del admin y activa el de solo lectura (30 min); `layout/ViewAsBar.tsx` muestra la franja fija con la cuenta atrás y "Salir". Al salir, vencer el tiempo o recibir 401 se restaura la sesión del admin y se vuelve a `/console`.

### Idioma

Español e inglés. Cada área tiene su archivo por idioma: `src/i18n/locales/es/<área>.json` y `en/<área>.json` (`common.json` para lo compartido) y se usa con `useTranslation('<área>')`. Una prueba revisa que cada área tenga las mismas claves y los mismos `{{parámetros}}` en los dos idiomas.

### Reglas de la interfaz

- **Dinero** siempre con `useFormat().money(minor)`: la moneda y el país son del negocio, no del idioma de quien mira. Montos en unidad menor (enteros); nada de `toFixed` a mano.
- **Fechas** son jornadas del negocio (`YYYY-MM-DD`, con su hora de corte y su zona horaria): `useFormat().today()`, `presets()`. No se usa la fecha del navegador para decidir qué jornada es.
- Errores de la API por su `code` estable (`errors.<CODE>`), nunca el texto del servidor.
- Debe verse bien a **360 px**: la página nunca se desborda; las tablas se desplazan dentro de su caja.
- Etiquetas visibles en los campos, foco visible, teclado en todo.

## Revisar una pantalla con datos reales

```bash
node scripts/shots.mjs http://127.0.0.1:5173 <token> /tmp/shots /resumen /ventas   # captura a 360 y a 1280 px
SHOT_LANG=en node scripts/shots.mjs …                                              # en inglés
```

Además de las capturas imprime los errores de la consola, las llamadas a la API que fallaron y si la página se desborda (sale con código 1 si hay algo). Usa el Chrome del sistema (`CHROME=/ruta/al/chrome` para otro).

## Publicar el panel (seguridad)

- El build de producción trae una **política de contenido** (`<meta http-equiv="Content-Security-Policy">`, definida en `vite.config.ts`): solo sus propios scripts, Google Identity Services, las tipografías de Google y la API en el **mismo origen**. Sin `unsafe-eval` ni scripts en línea. Si defines `VITE_API_URL` (panel en otro dominio que la API), el origen de la API se añade solo a `connect-src` al construir; sin ella la API es el mismo origen. En ese caso la API necesita CORS (`CUADRA_CORS_ORIGINS`, ver abajo).
- Lo que una etiqueta `<meta>` no puede expresar va en **cabeceras HTTP** del servidor que sirva los archivos estáticos: `Strict-Transport-Security: max-age=31536000; includeSubDomains`, `Content-Security-Policy` con `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
- `?devToken=` y el modo de pegar un token **no existen** en el build de producción.
- El token de sesión vive en `localStorage` (sesión web de 14 días, revocable). Con la CSP estricta el riesgo es un XSS; el panel no usa `dangerouslySetInnerHTML` ni `eval`. Cambiar a cookie `HttpOnly` exigiría CSRF y un dominio común con la API; queda como mejora (ver `PENDIENTES.md`).

## Publicar en GitHub Pages

El panel se puede publicar como sitio estático en otro dominio y sub-ruta (`https://<usuario>.github.io/<repo>/`) con la API en su propio dominio. El flujo `.github/workflows/web-pages.yml` construye y despliega `web/` en cada push a `main` que toque `web/**` (o a mano con "Run workflow").

Variables de build (todas opcionales en local):

| Variable | Para qué | Por defecto |
|---|---|---|
| `VITE_API_URL` | URL de la API (sin barra final); la usan el cliente, las descargas CSV y la CSP (`connect-src`) | mismo origen (proxy de `npm run dev`) |
| `VITE_BASE` | sub-ruta de publicación, p. ej. `/cuadra/` | `/` |
| `VITE_GOOGLE_CLIENT_ID` | ID de cliente Web de Google | sin acceso con Google |

Pasos:

1. En el repositorio, **Settings > Secrets and variables > Actions > Variables**: crea `API_URL` (p. ej. `https://api.midominio.com`) y `GOOGLE_CLIENT_ID`. El flujo pone `VITE_BASE=/<nombre del repo>/` solo.
2. **Settings > Pages > Source: GitHub Actions**.
3. En la **API**: `CUADRA_CORS_ORIGINS=https://<usuario>.github.io` (solo el origen, sin ruta ni barra final).
4. En **Google Cloud > Credenciales** del cliente OAuth Web: agrega `https://<usuario>.github.io` a "Orígenes autorizados de JavaScript".

Detalles del build: se copia `dist/index.html` a `dist/404.html` (GitHub Pages no tiene fallback de SPA: un enlace directo como `/<repo>/resumen` sirve el 404.html, que es la propia app, y el router resuelve la ruta) y se crea `dist/.nojekyll`. El router usa `basename` = `VITE_BASE`.

**Limitación de seguridad**: GitHub Pages no permite cabeceras HTTP, así que ahí **no hay `frame-ancestors`** (protección contra clickjacking), ni HSTS propio, ni el resto de las cabeceras de la sección anterior; la CSP viaja en `<meta>`. Como mitigación parcial, `src/lib/frameGuard.ts` oculta la app y muestra un aviso si la página se carga dentro de un marco. No sustituye a la cabecera: si necesitas protección completa, sirve el panel desde un host que envíe cabeceras (Cloudflare Pages, Netlify, nginx).
