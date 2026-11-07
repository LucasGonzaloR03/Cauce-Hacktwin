# Hyperframes Composition Brief: Cauce

## Objective
Crear un video brag de lanzamiento breve, en español, para Cauce.

## Output
- Composition: `composition/`
- Render: `brag.mp4`
- Formato: landscape — 1920x1080
- Duración: 25 segundos

## Source Material
- Raíz del proyecto: `C:\Users\rustt\Desktop\Proyectos-Propios\Hacktwin\cauce - frontend`
- Fuentes revisadas: `README.md`, `app/globals.css`, `components/screens.tsx`, `components/transfer-flow.tsx`, `docs/pitch-cauce.md`
- Producto: Cauce
- Frase de marca: «El dinero corre por donde vos decidís. Al precio que vos fijás.»
- UI a recrear: flujo Transferir; formulario de precio objetivo/vencimiento para órdenes; tarjeta de instrucción y propuesta del copiloto.
- Texto literal: «Saldo para probar», «Comisión demo (1%)», «Precio objetivo · ejemplo», «Propuesta · Ahorrar», «No ejecuta ni crea una orden. Requiere confirmación».

## Dirección creativa
- Preset: polished
- Dirección: película de producto sobria, táctil y transparente
- Ángulo: mostrar tres decisiones del producto: transferencia, orden condicional y propuesta del agente; distinguir siempre demo, ejemplo y confirmación.
- Gancho: «¿Cuánto llega del otro lado?» sobre una vista real de producto.
- Cierre: frase de marca más aclaración demo.
- Evitar: lenguaje SaaS genérico, cotizaciones actuales inventadas, datos personales, sugerir transferencia de fondos real, patrones abstractos de relleno.

## Identidad visual
- Fondo #ffffff, exterior #eeeeee; texto #111111, secundario #595959; acento #111111.
- Instrument Serif para display, Sora para cuerpo, IBM Plex Mono para cifras. Si no se pueden cargar fuentes externas durante render, usar Georgia, system sans y Courier New.
- Referencias: tarjetas finas, bordes cuadrados, tinta monocroma, etiquetas tipo sello, timeline vertical móvil.

## Storyboard
Usar `brag-plan.md` como contrato creativo. Escenas: gancho (2.5 s), transferencia (5 s), orden condicional (6 s), propuesta del agente (6.5 s), marca (5 s).

## Audio
- Rol: cama cálida con acentos de interfaz discretos.
- Track: `happy-beats-business-moves-vol-12-by-ende-dot-app.mp3`, volumen contenido, fade final.
- Cues: preset de la skill brag `happy-beats-business-moves-vol-12-by-ende-dot-app.music-cues.json`; candidatos 8.74, 13.11, 18.56 s, orientativos.
- Reactividad sutil en la presencia de tarjetas, nunca onda visual.
- SFX de tap y reveals seleccionados según la animación; 2–3 acentos.
- Copiar assets a `composition/assets/` antes del render.

## Hyperframes Instructions
Seguir el contrato y convenciones oficiales de Hyperframes para composición, timing, movimiento, look, registry y CLI. No crear SPEC.md. Mostrar UI de producto real; mantener textos legibles y duración de 20 s. Ejecutar `npx hyperframes check` antes del render. Crear, revisar y renderizar localmente; no publicar.
