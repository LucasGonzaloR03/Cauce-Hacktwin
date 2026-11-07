# Cauce — Frontend

Aplicación full-stack mobile-first para explorar Cauce en modo demo. Incluye acceso con email o passkey, cotizaciones de referencia, simulaciones de transferencias, órdenes de precio y un copiloto que interpreta reglas. La app no custodia fondos ni ejecuta transferencias reales.

**Deploy:** [cauce-front-private.vercel.app](https://cauce-front-private.vercel.app/)

## Funcionalidad actual

- **Acceso y sesión:** se crea una sesión anónima al entrar. En `/acceso` se puede vincular un email mediante magic link y registrar una passkey; el magic link se muestra en pantalla en modo `sandbox`.
- **Inicio (`/inicio`):** muestra el saldo demo persistido y las cotizaciones de referencia de mercado, con fuente, hora y estado del dato.
- **Transferir (`/transferir`):** permite elegir un destino, obtener una vista previa del recorrido ARS → USDT → moneda local y simular el envío. La simulación valida y descuenta el saldo demo y queda en el historial; no mueve dinero. La disponibilidad de destinos depende de las fuentes de cotización configuradas en el código.
- **Órdenes (`/nueva-orden`, `/ordenes`):** permite fijar un objetivo de precio para USDT con vencimiento de 1 hora, 24 horas, 7 días o hasta cancelar. Una orden puede quedar como alerta o autorizar una compra simulada automática. El monto se reserva en el saldo demo; el modo automático solo actúa con cotización en vivo y nunca compra activos reales. Las alertas se detectan mientras se consulta la pantalla de órdenes; el envío por email requiere una cuenta verificada y proveedor de correo configurado.
- **Copiloto (`/agente`):** Gemini transforma una instrucción en una propuesta para revisar. No crea órdenes ni ejecuta acciones.
- **Vistas ilustrativas:** `/como-llega`, `/costo`, `/verificar`, `/comprobante` y `/comprobante-vista` muestran el diseño previsto para una transferencia real, pero no tienen un flujo operativo ni generan comprobantes verificables.

El saldo inicial es de prueba. Las simulaciones, sesiones, órdenes y datos asociados se guardan en Neon. Los proveedores de FX se consultan desde el servidor; si un dato está en caché o es antiguo, se marca en la interfaz. Las cotizaciones son de referencia y no constituyen una oferta.

## Stack

- Next.js App Router, React y TypeScript estricto
- Tailwind CSS 4, componentes de interfaz propios y Lucide
- TanStack Query para estado del servidor y actualización periódica
- Neon Postgres y Drizzle ORM para persistencia
- PWA mediante manifest; no incluye service worker

La UI, los Route Handlers, el dominio y el acceso a datos forman una única aplicación Next.js, desplegada como un solo proyecto de Vercel.

## Requisitos

- Node.js 20.9 o posterior
- pnpm 12.3.4

## Desarrollo local

```bash
pnpm install
pnpm dev
```

Abrir [http://localhost:3000](http://localhost:3000). Comandos disponibles:

```bash
pnpm lint
pnpm build
pnpm start
pnpm run db:migrate
```

Para migrar la base de datos se necesitan `DATABASE_URL` y `DATABASE_URL_UNPOOLED`.

## Variables de entorno

Definir en `.env.local` para desarrollo y en la configuración del proyecto de Vercel para despliegue. Los secretos deben permanecer en el servidor y no llevar el prefijo `NEXT_PUBLIC_`.

| Variable | Uso |
|---|---|
| `DATABASE_URL` | Conexión de la app con Neon. |
| `DATABASE_URL_UNPOOLED` | Conexión directa usada por las migraciones Drizzle. |
| `NEXT_PUBLIC_APP_URL` | URL pública HTTPS; requerida en producción para enlaces de acceso y passkeys. |
| `AUTH_EMAIL_MODE` | Modo de envío: `sandbox` (por defecto), `gmail` o `resend`. `sandbox` no está permitido en producción. |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD` | Cuenta remitente y contraseña de aplicación cuando `AUTH_EMAIL_MODE=gmail`. |
| `RESEND_API_KEY`, `AUTH_EMAIL_FROM` | API key y remitente verificado cuando `AUTH_EMAIL_MODE=resend`. |
| `WEBAUTHN_RP_ID` | Dominio RP de passkeys; por defecto se deriva de `NEXT_PUBLIC_APP_URL`. |
| `GEMINI_API_KEY` | Clave del copiloto; necesaria para interpretar reglas. |
| `GEMINI_MODEL` | Modelo Gemini opcional; por defecto `gemini-3-flash-preview`. |
| `DEMO_MODE`, `KILL_SWITCH` | Controles de demo leídos en el servidor. |
| `CRON_SECRET` | Secreto opcional para proteger el endpoint de cron de órdenes; configurar al habilitar el cron en Vercel. |

## Persistencia y cron

Aplicar migraciones con `pnpm run db:migrate`. Vercel configura `/api/cron/orders` diariamente a las 03:00 UTC para procesar órdenes automáticas vencidas o elegibles. Las alertas de precio se revisan mientras la vista de órdenes está activa.

## Diseño y arquitectura

El prototipo de referencia está en [`mockup-activos-digitales.html`](./mockup-activos-digitales.html). Las decisiones de stack y experiencia móvil están documentadas en [`../cauce - docs/docs/05-stack-y-mobile.md`](../cauce%20-%20docs/docs/05-stack-y-mobile.md). Las convenciones para contribuir están en [`AGENTS.md`](./AGENTS.md).

Este frontend es la aplicación activa y el único deployment de Cauce. El repositorio histórico `cauce - backend` no forma parte del despliegue actual; no se necesita una URL de API externa ni CORS entre capas.
