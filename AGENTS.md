# Cauce — Frontend

## Stack base
- PWA mobile-first con Next.js App Router, React y TypeScript estricto.
- Tailwind CSS para estilos y componentes de shadcn/ui copiados al repositorio; Lucide para iconos.
- TanStack Query para estado del servidor y polling (2 s en el monitor, 30 s en el resto). Usar `useState` y un contexto pequeño para estado local; no agregar Redux o Zustand sin una necesidad concreta.
- Gráfico principal de precio en SVG propio, con hasta 60 puntos. Recharts solo está permitido para el gráfico de barras de comparación de rieles.
- Cauce es un producto con frontend y backend separados y un deployment Vercel para cada proyecto. Este frontend consume la API del backend por HTTPS.

## Reglas de interfaz
- Diseñar primero para móvil y verificar el layout a 360 px. Inputs de al menos 16 px, `inputmode="decimal"` para montos, áreas táctiles de 44 px, `100dvh` y `env(safe-area-inset-bottom)` cuando corresponda.
- No pedir permisos al entrar ni exigir instalación o login para abrir el flujo del QR.
- No agregar service worker al MVP. El manifest PWA basta; los avisos se muestran en la interfaz.
- El servidor calcula y formatea números y fechas con `Intl`; la interfaz consume strings formateados para evitar diferencias de hidratación.
- Mostrar de forma visible fuente y hora de los precios; representar datos en caché o estados de error sin inventar valores.
- El cliente no llama proveedores de FX ni contiene secretos. Leer y mutar datos mediante la API del backend, usando `NEXT_PUBLIC_API_BASE_URL` como URL pública de API.
- Mantener sincronizados los contratos HTTP y el origen permitido de CORS en el backend. No importar código interno del backend al frontend.
- Seguir tokens y layouts de `../docs/docs/04-figma-setup.md` y las decisiones de `../docs/docs/05-stack-y-mobile.md`; respetar guardrails en `../docs/docs/10-guardrails-y-demo-controller.md`.
- Antes de modificar APIs o convenciones de Next.js, consultar la guía correspondiente bajo `node_modules/next/dist/docs/` del proyecto y respetar las instrucciones Next.js del `AGENTS.md` del backend.
