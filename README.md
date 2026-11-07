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
| `DATABASE_URL_UNPOOLED` | Conexión directa opcional para tareas de migración manual. |
| `GEMINI_API_KEY` | Clave privada de Gemini, usada únicamente por el Route Handler del agente. |
| `GEMINI_MODEL` | Modelo Gemini opcional; por defecto `gemini-3-flash-preview`. |
| `DEMO_MODE`, `KILL_SWITCH` | Controles de demo leídos en servidor. |

Configurar las variables en `.env.local` para desarrollo y en el único proyecto de Vercel para el deployment. No agregar secretos al repositorio ni exponerlos con prefijo `NEXT_PUBLIC_`.

## Demo y cotizaciones

La aplicación presenta las doce vistas del mockup como una demo navegable. Inicio muestra un saldo de prueba de ARS 500.000. En Transferir se puede simular un envío desde Argentina a destinos de Latinoamérica con monedas cotizadas por los proveedores disponibles, revisar una comisión de demo del 1% y seguir el recorrido ARS → USDT → moneda local. La simulación actualiza el saldo mientras la app sigue abierta y no crea ni ejecuta una transferencia real; al recargar, el saldo vuelve al valor inicial. El agente interpreta reglas mediante `POST /api/agent/rules/interpret` y devuelve una propuesta no ejecutable que requiere confirmación posterior; no crea órdenes ni persiste cambios. Su límite de consultas está en memoria por instancia y sirve para desarrollo/demo; el uso público requiere un limitador persistente compartido. Los envíos, las órdenes y las descargas siguen sin conectarse a servicios reales.

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
