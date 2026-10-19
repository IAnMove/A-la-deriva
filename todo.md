# Hoja de Ruta de Mejoras — A la Deriva 3D

## En curso / Completadas en esta iteración
- [x] **Mejora visual y de fluidez de las olas del mar + olas que suben a la balsa (`world.js`)**
  - Ondas orgánicas con *domain-warping* (sin patrón de cuadrícula ni interferencia ortogonal) manteniendo `SEA_SEGMENTS = 128` y optimizando el bucle CPU (descarte por *bounding box* de la balsa y eliminación de trigonometría por vértice en el pase de color).
  - Normales analíticas continuas a 60 FPS en el *fragment shader*, eliminando el facetado de la malla de 1,25 m y el halo cuadrado bajo la balsa.
  - Dispersión subsuperficial (SSS) turquesa, encaje de espuma por fragmento y filamentos de corriente curvados con bordes desvanecidos.
  - Lenguas de agua y espuma (`World.deckWash`) que trepan por la borda expuesta y bañan los tablones de la cubierta cuando arrecia el oleaje o hay tormenta.
- [x] **3. Viento direccional visible en vela, humo y banderola (`game-simulation.js`, `raft.js`, `engine.js`, `game-renderer.js`, `world.js`, `game-ui.js`)**
  - Campo de viento direccional acoplado al clima y a las células de tormenta de la carta náutica.
  - Orientación e hinchado dinámico de la vela (`sail`) y banderolas (`mast` / catavientos) según el ángulo real del viento y el rumbo del timón.
  - Columnas de humo con flotabilidad y deriva por viento en hoguera (`fire`), ahumadero (`smokehouse`), cocina (`kitchen`) y faro (`beacon`), además de lluvia inclinada por el viento.
  - Efecto del ángulo viento-vela sobre la velocidad de navegación en la carta náutica e indicador de viento en el HUD.
- [x] **Mejora de animaciones GLB del protagonista, tripulación y caña de pescar (`character-glb.js`, `player.js`, `survivor.js`)**
  - Captura de `bindQuat` real del esqueleto y limpieza por fotograma (`resetUpperBody`) de columna, hombros, cuello, cabeza y muñecas para eliminar las poses retorcidas de los clips exportados.
  - Corrección del signo lateral y pronación de antebrazos en reposo, marcha y tareas de tripulación.
  - Rediseño de proporciones y punto de agarre de la caña (`makeRod`), ciclo completo de lance/espera/recogida/lucha a dos manos con flexión por tramos (`setRodFlex`) y alineación del remo entre ambas manos.

## Próximas mejoras planificadas
- [ ] **1. Carta náutica visual e interactiva en la mesa de navegación (`chart`)**
  - Modal de carta en `<canvas>` 2D estilo papel náutico al interactuar con la mesa `chart`.
  - Dibujo de la estela recorrida desde `(0, 0)`, regiones descubiertas/visitadas, vectores de corriente locales y cono de incertidumbre hacia la isla.
  - Selección de rumbo objetivo desde la carta para ajustar el timón.
- [ ] **2. Pecios y boyas explorables como puntos fijos de región**
  - Puntos de interés visibles en el horizonte dentro de regiones `debris` y `ship` (pecios semihundidos, boyas meteorológicas).
  - Exploración por fases al echar el ancla cerca, con relación riesgo/recompensa (piezas únicas de radio, metal, combustible, pistas de navegación).
- [ ] **4. Vida a bordo y reacciones contextuales de la tripulación**
  - Vigía en la torre (`lookout`) señalando físicamente hacia el rumbo de arrecifes, tiburones o la isla.
  - Sinergias de puesto en tiempo real (navegante en timón, mecánico en motor).
  - Bocadillos breves de reacción en cubierta al entrar en biomas o avistar tierra sin interrumpir con modales.
- [ ] **5. Audio procedural WebAudio ambiental y espacial**
  - Romper de olas graves cerca de arrecifes o costa, crujido de madera con el ancla tensa en tormenta y estática/morse en la radio según cercanía a la ruta de barcos.
