# Cauce — contexto para continuar con otra IA

Documento de handoff del estado conocido de la aplicación. **No reemplaza al código ni a `AGENTS.md`.** Antes de editar, leer `AGENTS.md`, este documento y revisar `git status`.

## Instrucciones para la IA que continúe

- Preservar todos los cambios locales sin commit que ya existen. No usar `git checkout`, `reset`, `restore`, `clean` ni `git add .` para resolverlos.
- La app es una sola aplicación full-stack de Next.js. No reintroducir el antiguo backend independiente ni CORS o `NEXT_PUBLIC_API_BASE_URL`.
- Mantener Neon, Drizzle, secretos, proveedores de FX, sesiones y lógica financiera en servidor. Los módulos privados importan `server-only`.
- No leer, mostrar, copiar ni commitear valores de `.env.local`. Está ignorado por Git.
- Las transferencias y órdenes actuales son de demo/sandbox: no hay custodia ni payout real. Gemini solo prepara propuestas; no debe ejecutar movimientos.
- No aplicar migraciones a Neon sin verificar primero el estado y la rama/base de datos de destino.
- Antes de cambiar convenciones de Next, consultar `node_modules/next/dist/docs/` como pide `AGENTS.md`.

## Producto y objetivo

Cauce es una PWA mobile-first para Argentina. La consigna del hackatón es: **“Un agente que maneja tu plata: construís un agente de IA que paga, ahorra o invierte por el usuario con reglas que pone él, y que explica cada movimiento.”** El MVP muestra una experiencia financiera demostrativa, con cotizaciones reales de referencia y saldos/operaciones de prueba.

El concepto de seguridad acordado es: Gemini interpreta una instrucción y arma una propuesta; código determinista del servidor valida límites y datos; la persona revisa y confirma antes de cualquier ejecución. La app actual aún no ejecuta pagos reales.

## Arquitectura y stack

- Proyecto activo: `cauce - frontend`; repositorio Next.js App Router con UI, Route Handlers, dominio y Neon en un único deployment.
- Next.js `16.4.4`, React `19.3`, TypeScript estricto (target ES2020 por uso de `BigInt`), Tailwind CSS 4.
- TanStack Query para datos de servidor y polling; componentes propios; Lucide; PWA con manifest y sin service worker.
- Neon Postgres mediante `@neondatabase/serverless` + Drizzle ORM. La conexión de la app usa `DATABASE_URL`; las migraciones necesitan `DATABASE_URL_UNPOOLED` directa, sin pooler.
- Gemini por SDK oficial `@google/genai`; clave solo en servidor.
- Reglas visuales: mobile-first a 360 px, inputs de 16 px o más, áreas táctiles de al menos 44 px, fuente/hora/calidad junto a cotizaciones.
- Tipografías: Instrument Serif para titulares, Sora para interfaz, IBM Plex Mono para cifras.

## Pantallas

Las pantallas están en `components/screens.tsx`, se cargan por `app/[screen]` y son: `inicio`, `acceso`, `transferir`, `como-llega`, `costo`, `verificar`, `comprobante`, `comprobante-vista`, `nueva-orden`, `la-orden`, `ordenes` y `agente`.

- Inicio muestra saldo demo, accesos rápidos y mercado.
- Transferir permite elegir destino, revisar conversión/comisión y guardar una simulación demo.
- Nueva orden permite preparar una intención de compra de USDT con precio objetivo y vencimiento.
- Órdenes lista órdenes demo, incluidas dos muestras iniciales por sesión; se puede crear y borrar órdenes demo.
- Agente convierte una instrucción en una propuesta estructurada; la pantalla indica que requiere confirmación.
- El acceso funciona con magic link (Gmail, Resend o sandbox), passkeys y cierre de sesión. Transferencias y órdenes siguen siendo demo; payout, descargas y ejecución automática no están conectados.

## Route Handlers actuales

| Ruta | Método | Función |
|---|---|---|
| `/api/market` | `GET` | Devuelve cotizaciones con fuente, hora y calidad. |
| `/api/demo/state` | `GET` | Devuelve saldo demo e historial de simulaciones de la sesión anónima. |
| `/api/transfers/preview` | `GET`, `POST` | Destinos y estimación del recorrido de conversión. |
| `/api/transfers/simulate` | `POST` | Valida saldo demo y persiste el resultado como simulación; no hace payout. |
| `/api/orders/preview` | `POST` | Estima USDT con cotización y vencimiento seleccionados. |
| `/api/orders` | `GET`, `POST` | Lista/siembra muestras y crea órdenes demo con reserva de saldo. |
| `/api/orders/[id]` | `DELETE` | Borra una orden demo del usuario y devuelve saldo reservado si aplica. |
| `/api/agent/rules/interpret` | `POST` | Usa Gemini para producir propuesta; valida tamaño y aplica límite en memoria por instancia. |

## Persistencia y dominio

`db/schema.ts` define enums y tablas para:

- Identidad/sesión: `users`, `sessions`, `auth_tokens`.
- Autenticación adicional: `auth_challenges`, `passkey_credentials`.
- Catálogo: `countries`, `assets`, `corridors`.
- Precios/órdenes: `price_snapshots`, `quotes`, `orders`, `order_events`.
- Transferencias: `transfers`, `transfer_events`.
- Operación: `idempotency_keys`, `settings`.
- Demo persistente: `demo_transfers`, `demo_orders`.

Los montos se guardan en unidades menores enteras (por ejemplo, centavos) y las tasas como decimales/string; evitar floats para nuevas reglas de dinero. `lib/money.ts` contiene conversiones y formateo; `lib/quote.ts` prepara cotizaciones; `lib/engine.ts` contiene transiciones de estado con concurrencia optimista. Las rutas de demo no equivalen a ejecución real.

Migraciones Drizzle:

- `0000_misty_shooting_star.sql`, `0001_brave_sugar_man.sql`: esquema base.
- `0002_demo_transfer_persistence.sql`: saldo demo y simulaciones persistentes.
- `0003_demo_orders.sql`: órdenes demo persistentes.
- `0004_user_authentication.sql`: unicidad del email verificado, desafíos y passkeys.

Las migraciones `0002` a `0004` forman parte del estado actual del proyecto y se aplicaron en la base Neon de desarrollo durante esta implementación. Antes de ejecutar migraciones en otro entorno, verificar la base y el historial remoto. La herramienta se configura en `drizzle.config.ts`; el script es `pnpm run db:migrate`.

## Cotizaciones

`lib/fx.ts` consulta proveedores desde servidor: DolarAPI para referencias argentinas, Bitso para pares cripto/FX disponibles y ExchangeRate API para otros pares. Usa cache en memoria y persistencia opcional de snapshots; las respuestas exponen `live`, `cached` o `frozen`, fuente y hora. No inventar un precio si la fuente falla ni presentar datos antiguos como vigentes.

## Agente Gemini

- Variable requerida: `GEMINI_API_KEY`; opcional `GEMINI_MODEL` (por defecto configurado como `gemini-3-flash-preview`). En `.env.local` se verificó la presencia de la clave, nunca se comparte el valor.
- `lib/agent/gemini.ts` es server-only y solicita salida JSON con esquema para `PAY`, `SAVE`, `INVEST` o `UNSUPPORTED`, activo, monto como texto, moneda, condición, explicación y faltantes.
- `app/api/agent/rules/interpret/route.ts` recibe `{ instruction }` (5–500 caracteres), limita el cuerpo y devuelve `{ proposal, requiresConfirmation: true }`. El límite actual es local a cada proceso/instancia y no es suficiente para uso público a escala.
- La propuesta no se persiste ni crea una orden. Mantener esta frontera; cualquier ejecución futura requiere validación determinista, autorización y confirmación explícita.

## Variables de entorno

Nombres esperados: `NEXT_PUBLIC_APP_URL`, `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `GEMINI_API_KEY`, opcional `GEMINI_MODEL`, `DEMO_MODE`, `KILL_SWITCH`, `AUTH_EMAIL_MODE`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `RESEND_API_KEY`, `AUTH_EMAIL_FROM` y `WEBAUTHN_RP_ID`. No documentar valores. `.env.local` está cubierto por `.gitignore`.

La presencia de URLs no prueba que la conexión Neon funcione ni que el schema remoto esté migrado. Comprobar el entorno explícitamente antes de ejecutar migraciones.

## Diseño y assets

- El mockup de 12 pantallas vive en `../cauce - docs/design/mockup-activos-digitales.html`.
- Logos documentados en `../cauce - docs/design/`; el favicon actual usa el símbolo terracota en `app/icon.png` y el manifest lo referencia.
- `docs/propuesta-visual-blanco-y-negro.md` documenta la dirección de tema claro/oscuro, implementada con el selector de tema.
- No hay una presentación Svelte implementada; solo se conversó que podría servir para una demo interactiva.

## Git y estado de entrega

- PR [#1](https://github.com/LucasGonzaloR03/cauce-front-private/pull/1), de `primerosCambios` a `main`, integró la base full-stack. Consultar el remoto y `git status --short` antes de nuevas operaciones Git.
- `package.json` tenía un bloque duplicado al final que provocaba `trailing characters at line 37 column 5`; se eliminó ese bloque. El archivo vuelve a ser JSON válido. Sigue habiendo otros cambios locales, incluido el retiro del script `db:generate`; no restaurarlo sin revisar la intención.
- Next 16 agregó el bloque `nextjs-agent-rules` a `AGENTS.md` al ejecutar `next dev`; es una modificación generada.

## Validación conocida y límites

- Última validación del conjunto actual: `pnpm exec tsc --noEmit` y `pnpm build` pasan; `pnpm lint` no tiene errores y mantiene siete warnings de variables sin uso en archivos de agente, transferencia y cotización.
- No hay suite de tests configurada en `package.json`.
- Después de corregir `package.json`, `node node_modules/next/dist/bin/next dev` llegó a `Ready`. `pnpm run dev` ya no mostró el error JSON pero quedó esperando la verificación de políticas del lockfile en este entorno; no confundir ese bloqueo de pnpm con un error de compilación de Next.
- El envío SMTP Gmail se autenticó correctamente desde el entorno de desarrollo; esa verificación no envió un correo. Las rutas de demo y órdenes se probaron anteriormente contra Neon. Las passkeys requieren navegador compatible y origen HTTPS (o localhost).
