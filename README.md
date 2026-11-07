# Cauce — Frontend

PWA mobile-first de Cauce: una interfaz para consultar costos, crear y seguir órdenes, y revisar comprobantes. El frontend se despliega por separado y consume la API del backend de Cauce por HTTPS.

## Stack

- Next.js App Router, React y TypeScript estricto
- Tailwind CSS 4 y componentes propios basados en shadcn/ui
- TanStack Query para estado del servidor y polling
- Lucide para iconos
- PWA con manifest; el MVP no agrega service worker

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
| `NEXT_PUBLIC_API_BASE_URL` | URL HTTPS pública de la API del backend. Debe coincidir con el origen permitido en `FRONTEND_ORIGIN` del backend. |

Estas variables forman parte del contrato de integración. El backend todavía no está disponible y la interfaz no realiza llamadas a proveedores ni a una API de precios. No agregar secretos al frontend ni exponerlos con prefijo `NEXT_PUBLIC_`.

## Demo y cotizaciones

La aplicación presenta las doce vistas del mockup como una demo navegable. Las transferencias, órdenes, descargas y consultas al agente aún no están implementadas: los controles correspondientes permanecen deshabilitados y las vistas de comprobante y seguimiento son solo ejemplos.

El mercado muestra MEP, dólar tarjeta, USDT y BTC/ARS sin precio mientras no haya un backend. La integración pendiente debe consumir la API de Cauce mediante `NEXT_PUBLIC_API_BASE_URL`, no consultar DolarAPI desde el navegador. El backend deberá definir el contrato de precios, consultar las fuentes apropiadas (DolarAPI para las referencias disponibles y otra fuente para los activos que no cubra), formatear importes y fechas y devolver fuente, hora y calidad de cada dato. No se debe mostrar un precio sin esos metadatos ni presentar datos en caché como vigentes.

## Reglas de interfaz

- Diseñar primero para móvil y revisar a 360 px de ancho.
- Inputs de al menos 16 px, `inputmode="decimal"` para montos y áreas táctiles de 44 px.
- No pedir permisos al entrar ni exigir instalación o login para abrir el flujo del QR.
- Mostrar fuente y hora del precio y distinguir datos en caché de datos vigentes.
- El backend es la autoridad para cálculos, FX, autenticación y estados de órdenes.

## Diseño y arquitectura

El prototipo vigente de 12 pantallas está en `../cauce - docs/design/mockup-activos-digitales.html`. La especificación está en `../cauce - docs/docs/05-stack-y-mobile.md`; las instrucciones de trabajo, en [`AGENTS.md`](./AGENTS.md).

Este proyecto comparte el producto con `cauce - backend`, pero tiene su propio deployment. El backend conserva secretos y reglas de negocio; el frontend se comunica con él por HTTPS y requiere CORS configurado con su origen exacto.
