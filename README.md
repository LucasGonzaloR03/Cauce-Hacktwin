# Cauce — Frontend

Aplicación full-stack mobile-first de Cauce: una interfaz para consultar costos, crear y seguir órdenes, y revisar comprobantes. La UI, la API (Route Handlers), el dominio y el acceso a Neon se despliegan juntos como una sola app de Next.js.

## Stack

- Next.js App Router, React y TypeScript estricto
- Tailwind CSS 4 y componentes propios basados en shadcn/ui
- TanStack Query para estado del servidor y polling
- Lucide para iconos
- PWA con manifest; el MVP no agrega service worker
- Neon Postgres y Drizzle ORM para persistencia; lógica financiera y secretos solo en servidor

## Requisitos

- Node.js 20.9 o posterior
- pnpm 12.3.4

## Desarrollo local

```bash
pnpm install
pnpm dev
```

Abrir [http://localhost:3000](http://localhost:3000). Comandos adicionales: `pnpm lint`, `pnpm build` y `pnpm start`.

## Variables de entorno

Configurar en `.env.local` para desarrollo y en Vercel para el deployment:

| Variable | Uso |
|---|---|
| `NEXT_PUBLIC_APP_URL` | URL HTTPS pública de la PWA. |
| `DATABASE_URL` | Conexión Neon usada solo por código de servidor. Nunca debe llevar prefijo `NEXT_PUBLIC_`. |
| `DATABASE_URL_UNPOOLED` | Conexión directa requerida para ejecutar migraciones Drizzle. |
| `GEMINI_API_KEY` | Clave privada de Gemini, usada únicamente por el Route Handler del agente. |
| `GEMINI_MODEL` | Modelo Gemini opcional; por defecto `gemini-3-flash-preview`. |
| `DEMO_MODE`, `KILL_SWITCH` | Controles de demo leídos en servidor. |
| `AUTH_EMAIL_MODE` | `sandbox` (por defecto), `gmail` o `resend`. |
| `GMAIL_USER` | Gmail remitente, solo si `AUTH_EMAIL_MODE=gmail`. |
| `GMAIL_APP_PASSWORD` | Contraseña de aplicación de Google, solo si `AUTH_EMAIL_MODE=gmail`. |
| `RESEND_API_KEY` | Clave privada de Resend, solo si se usa `resend`. |
| `AUTH_EMAIL_FROM` | Remitente verificado en Resend. |
| `WEBAUTHN_RP_ID` | Dominio para passkeys; por defecto se deriva de `NEXT_PUBLIC_APP_URL`. |

Configurar las variables en `.env.local` para desarrollo y en el único proyecto de Vercel para el deployment. No agregar secretos al repositorio ni exponerlos con prefijo `NEXT_PUBLIC_`.

Para aplicar las migraciones existentes, configurar `DATABASE_URL` y `DATABASE_URL_UNPOOLED` en `.env.local` y ejecutar `pnpm run db:migrate`. La URL sin pooler se usa para la herramienta de migración; la app usa `DATABASE_URL`.

## Demo y cotizaciones

La aplicación presenta las doce vistas del mockup como una demo navegable. Inicio muestra un saldo de prueba de ARS 500.000, leído junto al historial desde `GET /api/demo/state` y asociado a una sesión anónima. En Transferir se puede simular un envío desde Argentina a destinos de Latinoamérica con monedas cotizadas por los proveedores disponibles, revisar una comisión de demo del 1% y seguir el recorrido ARS → USDT → moneda local. `POST /api/transfers/simulate` vuelve a validar el saldo en servidor, descuenta el monto y guarda el resultado como simulación demo en Neon dentro de una única sentencia atómica; no crea ni ejecuta una transferencia real. El saldo y las últimas simulaciones persisten al recargar. En Órdenes, `GET /api/orders` crea una sola vez dos muestras por sesión anónima y lista las órdenes guardadas; `POST /api/orders` valida la cotización, reserva el saldo demo e inserta la orden, y `DELETE /api/orders/:id` la elimina y devuelve el saldo reservado si corresponde. Estas órdenes son sandbox: no se ejecutan automáticamente ni envían fondos. El agente interpreta reglas mediante `POST /api/agent/rules/interpret` y devuelve una propuesta no ejecutable que requiere confirmación posterior; no crea órdenes ni persiste cambios. Su límite de consultas está en memoria por instancia y sirve para desarrollo/demo; el uso público requiere un limitador persistente compartido.

El mercado consume Route Handlers del mismo origen. Las cotizaciones se consultan en el servidor a DolarAPI, Bitso y ExchangeRate API; las respuestas incluyen precio, fuente, hora y calidad. Los datos antiguos o en caché se identifican en la interfaz y no deben presentarse como vigentes.

## Reglas de interfaz

- Diseñar primero para móvil y revisar a 360 px de ancho.
- Inputs de al menos 16 px, `inputmode="decimal"` para montos y áreas táctiles de 44 px.
- No pedir permisos al entrar ni exigir instalación o login para abrir el flujo del QR.
- Mostrar fuente y hora del precio y distinguir datos en caché de datos vigentes.
- El backend es la autoridad para cálculos, FX, autenticación y estados de órdenes.

## Diseño y arquitectura

El prototipo vigente de 12 pantallas está en `../cauce - docs/design/mockup-activos-digitales.html`. La especificación está en `../cauce - docs/docs/05-stack-y-mobile.md`; las instrucciones de trabajo, en [`AGENTS.md`](./AGENTS.md).

Este proyecto es la app activa y única de Cauce. El repositorio `cauce - backend` se conserva como archivo histórico, pero no forma parte del deploy activo. No se necesita URL de API externa ni CORS entre frontend y backend.

## Diseño y arquitectura

El prototipo vigente de 12 pantallas está en `../cauce - docs/design/mockup-activos-digitales.html`. La especificación está en `../cauce - docs/docs/05-stack-y-mobile.md`; las instrucciones de trabajo, en [`AGENTS.md`](./AGENTS.md).

Este proyecto es la app activa y única de Cauce. El repositorio `cauce - backend` se conserva como archivo histórico, pero no forma parte del deploy activo. No se necesita URL de API externa ni CORS entre frontend y backend.

### Usuarios y acceso

La demo crea una sesión anónima automáticamente. En `/acceso` se puede vincular un email con magic link (10 minutos, de un solo uso) y registrar una passkey para volver a entrar. Con `AUTH_EMAIL_MODE=sandbox` el enlace se muestra en pantalla para desarrollo. Para enviar desde un Gmail dedicado, configurar `AUTH_EMAIL_MODE=gmail`, `GMAIL_USER` y `GMAIL_APP_PASSWORD` (contraseña de aplicación de Google; requiere verificación en dos pasos). También está disponible Resend con `AUTH_EMAIL_MODE=resend`, `RESEND_API_KEY` y `AUTH_EMAIL_FROM`. `NEXT_PUBLIC_APP_URL` debe coincidir con el origen HTTPS público; es obligatorio en producción. `WEBAUTHN_RP_ID` es opcional y por defecto usa el hostname de esa URL. Aplicar las migraciones con `pnpm run db:migrate`.
