# Propuesta visual: Cauce en blanco y negro

- **Estado:** propuesta para debatir. No implementada.
- **Alcance:** tema visual de la app; no cambia flujos, contratos, datos ni reglas financieras.

## Dirección

Llevar la interfaz a una paleta monocromática de blancos, negros y grises, manteniendo la identidad editorial actual: titulares con Instrument Serif, controles en Sora y cifras en IBM Plex Mono. El resultado debería sentirse sobrio y financiero, con jerarquía basada en tipografía, espacio, líneas y composición; no en un color de acento.

La referencia de marca disponible en `../cauce - docs/design/Logotipo monocromatico aislado.jpg` muestra el símbolo en monocromo. Para una versión futura del tema, usar esa variante en negro sobre fondo claro y una variante blanca sobre fondo oscuro.

## Paleta propuesta

| Token | Valor sugerido | Uso |
|---|---|---|
| `--paper` | `#FFFFFF` | Fondo principal de la app. |
| `--surface` | `#F7F7F7` | Tarjetas, campos y superficies elevadas. |
| `--ink` | `#111111` | Texto principal, iconos y acciones primarias. |
| `--ink-soft` | `#595959` | Texto secundario y etiquetas. |
| `--line` | `#D6D6D6` | Bordes, divisores y separadores. |
| `--stamp` | `#111111` | Acción primaria, foco y elemento activo. |
| `--settled` | `#333333` | Estado completado; siempre acompañado por texto e icono. |
| Fondo exterior | `#EEEEEE` | Enmarcar el shell móvil en pantallas anchas. |

La escala evita depender de negro puro y reserva el contraste máximo para cifras, acciones y titulares. No sumar beige, terracota ni verde si la decisión del equipo es mantener el tema estrictamente monocromático.

## Aplicación por elemento

- **Fondo y contenedores:** shell blanco; tarjetas gris muy claro con borde gris fino. Mantener radios pequeños y sombras discretas para conservar el carácter actual.
- **Acción primaria:** fondo casi negro, texto blanco. Acción secundaria blanca, borde negro y texto negro. Los estados deshabilitados usan grises y texto explícito.
- **Navegación:** texto secundario para destinos inactivos; destino actual en negro con una línea superior más gruesa y `aria-current` como ya se usa.
- **Tipografía:** conservar Instrument Serif para los titulares grandes; Sora para controles, etiquetas y explicación; IBM Plex Mono para montos, tasas y datos tabulares. La jerarquía tipográfica debe reemplazar al color como guía de lectura.
- **Datos financieros:** mantener cifras alineadas y tabulares. Variación positiva/negativa se indica con signo, flecha y texto (“subió”, “bajó”, “ahorro”), no solo con tono o color.
- **Gráficos:** trazo negro para la serie principal; objetivo con línea discontinua; área de relleno gris claro. Si se comparan varias series, distinguirlas por patrón de línea, marcador y leyenda.
- **Logo e iconos:** usar la variante monocromática documentada. Iconos lineales negros, siempre con etiqueta cuando expresen estado o acción importante.
- **Campos:** fondo blanco o gris claro, borde visible y foco de alto contraste. Mantener tipografía de 16 px o más para evitar zoom en Safari móvil.

## Estados sin color semántico

La interfaz puede quedar en escala de grises sin perder información, pero cada estado necesita más de una señal:

| Estado | Tratamiento visual sugerido | Señal textual |
|---|---|---|
| Éxito / liquidado | Icono de tilde, borde sólido y tono oscuro | “Completada” o explicación del movimiento |
| En curso | Indicador de progreso y línea temporal | Estado actual y hora |
| Pendiente | Reloj o marcador vacío, borde discontinuo | “Pendiente” |
| Aviso | Icono de atención, fondo gris medio y borde izquierdo grueso | Explicación concreta y siguiente paso |
| Error | Icono de error, borde marcado y texto legible | Qué falló y cómo reintentar |
| Dato vencido o en caché | Etiqueta con reloj y estilo discontinuo | “Dato anterior” más hora de actualización |

No comunicar éxito, pérdida, vencimiento o riesgo solo mediante intensidad del gris. En particular, el usuario debe poder distinguir un dato vigente de uno en caché leyendo la etiqueta y su hora.

## Orden sugerido para una implementación futura

1. Acordar si “blanco y negro” admite grises neutros para superficies y jerarquía.
2. Cambiar los tokens globales en `app/globals.css` y revisar colores escritos directamente en reglas de componentes.
3. Aplicar la paleta al logo, favicon y `theme_color` del manifest.
4. Revisar acciones, tarjetas, inputs, foco, navegación y estados de carga/error.
5. Revisar dashboard, transferencias, órdenes, cotizaciones y agente para que signos, patrones y etiquetas sustituyan cualquier significado cromático.
6. Verificar las pantallas a 360 px y comprobar contraste legible, foco visible y controles táctiles de al menos 44 px.

## Criterios para debatir la propuesta

- ¿El tema debe ser monocromático también en el logo y el favicon?
- ¿Se prefiere blanco puro o un gris muy leve como fondo general?
- ¿El shell debe seguir siendo estrecho y editorial en escritorio o ocupar más ancho?
- ¿Las tarjetas necesitan sombra o alcanza con bordes y divisores?
- ¿La marca se siente suficientemente propia sin el terracota actual?

La guía técnica vigente mantiene mobile-first, tipografías Instrument Serif / Sora / IBM Plex Mono, foco visible, áreas táctiles de 44 px y datos de mercado acompañados por fuente y hora. Esta propuesta conserva esas decisiones y cambia solo su expresión cromática.
