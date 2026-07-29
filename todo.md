# A la Deriva — Versión 3D

Plan y guía de implementación para la siguiente sesión.

## Objetivo

Crear una versión 3D jugable de **A la Deriva** usando **Three.js** (por CDN), manteniendo la esencia del juego 2D original pero aprovechando el espacio y la estética 3D.

## Tecnología

- HTML5
- CSS
- JavaScript vanilla
- **Three.js 0.149.0** incluido en `vendor/`, con CDN fijada y SRI como respaldo.
- Sin backend ni build obligatorio; Playwright es opcional para las pruebas E2E.

## Estructura de archivos

```
a-la-deriva-3d/
├── index.html
├── style.css
├── main.js              # Punto de entrada: comprueba THREE y arranca el Game
├── game.js              # Estado y controlador compatible
├── game-simulation.js   # Reglas agregadas y orquestación de la simulación
├── game-ui.js           # Presentación DOM y HUD
├── game-renderer.js     # Presentación 3D, cámara y resaltados
├── world.js             # Escena, mar con espuma, cielo, iluminación, clima, cámara
├── raft.js              # Balsa 3D, construcción sobre cuadrícula, modelos de estructuras
├── player.js            # Figura 3D del náufrago y animaciones (la lógica está en game.js)
├── hook.js              # Visualización del gancho/cuerda (la lógica está en game.js)
├── entities.js          # Objetos flotantes, peligros, bancos de peces
├── survivor.js          # Sistema de supervivientes, tripulación y figuras humanoides
├── engine.js            # Utilidades, input, bucle, log, textos flotantes y partículas 3D
├── audio.js             # Sonido con Web Audio API
└── save.js              # localStorage
```

`game.js` conserva el estado y actúa como controlador. Simulación, UI y
renderizado tienen módulos propios con adaptadores compatibles.

## Fases de implementación

### Fase 1 — Esqueleto 3D

1. `index.html` con canvas, UI y Three.js local con respaldo CDN.
2. `main.js`:
   - Crear `Scene`, `PerspectiveCamera`, `WebGLRenderer`.
   - Añadir iluminación ambiental + direccional.
   - Cámara cenital/ligeramente isométrica que siga a la balsa.
3. `world.js`:
   - Plano de mar ondulado con material azul translúcido.
   - Cielo con gradiente o color según hora del día.
   - Niebla opcional para dar profundidad.

### Fase 2 — Balsa y construcción

1. `raft.js`:
   - Representar cada celda como un cubo/bloque de madera 3D.
   - Sistema de grid 2D interno (igual que en 2D) pero colocando meshes en 3D.
   - Módulos iniciales: suelo de madera, caja, red, recolector, vela, timón, radio, motor, etc.
   - Construcción: seleccionar pieza en UI, preview fantasma, clic para colocar.
   - Conexión con recursos y costes.

### Fase 3 — Personaje y movimiento

1. `player.js`:
   - Modelo simple del náufrago (cápsula o figura geométrica).
   - WASD para moverse sobre la balsa.
   - Animación de balanceo con el mar.

### Fase 4 — Gancho y recogida

1. `hook.js`:
   - Línea 3D desde el personaje al cursor del mundo.
   - Clic para lanzar; colisión con objetos flotantes.
   - Animación de recogida.

### Fase 5 — Objetos flotantes y entorno

1. `entities.js`:
   - Spawner de objetos 3D: tablas, cajas, bidones, redes, frutas, supervivientes.
   - Peligros: tiburón con aleta visible, bancos de peces.
   - Corriente: objetos flotan y la balsa los alcanza.

### Fase 6 — Supervivencia y día/noche

1. Portar de `survivor.js` y `game.js` del 2D:
   - Hambre, sed, salud, moral.
   - Consumo diario.
   - Rescate de supervivientes.
   - Eventos y fin de día.

### Fase 7 — Eventos y peligros 3D

1. Tormenta: lluvia de partículas, oscurecimiento, relámpagos.
2. Tiburón: aleta que rodea la balsa y golpea.
3. Ola gigante: pared de agua que avanza.
4. Calor, niebla, bancos de peces, barco a lo lejos.

### Fase 8 — Victoria y derrota

1. Condiciones de victoria: radio señal o llegada a isla.
2. Condiciones de derrota: muerte, destrucción, motín.
3. Pantallas de inicio/fin/pausa.

### Fase 9 — Sonido y guardado

1. Portar `audio.js` y `save.js` del 2D.
2. Efectos 3D espaciales simples (opcional).

### Fase 10 — Pulido

1. Sombras suaves.
2. Reflejos en el agua.
3. Animaciones de construcción y daño.
4. Optimización: LOD, frustum culling, pooling.

## Controles (iguales que 2D)

- **WASD / Flechas**: mover personaje.
- **Ratón**: apuntar gancho.
- **Clic izquierdo**: lanzar/recoger gancho.
- **E**: interactuar / demoler selección.
- **B**: menú de construcción.
- **Espacio**: pausar.
- **M**: silenciar sonido.
- **Móvil**: mando táctil, toque para actuar y pulsación larga para seleccionar.

## Decisiones de diseño 3D

- **Estilo**: low-poly, colores planos, sombras suaves. Sin modelos externos; todo generado por código.
- **Perspectiva**: cámara cenital inclinada (~45°) que sigue suavemente a la balsa.
- **Mar**: plano con shader o geometría ondulada; reflejos falsos con mapa de entorno o specular.
- **Balsa**: bloques modulares encajados, cada uno un mesh independiente para poder destruir/reparar.
- **Personaje**: cápsula con detalles mínimos (cabeza esfera, cuerpo caja).
- **Objetos**: formas geométricas simples con colores distintivos.

## Criterios de éxito

- [x] El juego se sirve localmente y dispone de Three.js sin conexión.
- [ ] Ejecutar la suite E2E cuando haya una instancia de navegador conectada.
- [x] Se puede mover al personaje y lanzar el gancho.
- [x] Se pueden recoger objetos y construir la balsa (recogida solo con gancho; automática si el objeto toca la balsa).
- [x] Ciclo día/noche visible (cielo, sol, estrellas, iluminación).
- [x] Supervivencia: hambre/sed/salud/moral/stamina/cordura funcionan.
- [x] Eventos y peligros (tormenta con lluvia y relámpagos, tiburón, ola, niebla, calor, etc.).
- [x] Victoria y derrota (radio e isla; muerte, destrucción, motín).
- [x] Guardado en localStorage.
- [x] Sonido activable/desactivable.

## Cambios respecto al plan original

- Three.js **0.149.0 build UMD** local (no módulos ES), con respaldo CDN.
- Mar con colores por vértice: gradiente profundidad→cresta, espuma modulada a alta frecuencia y mayor amplitud de olas en tormenta.
- Personajes low-poly articulados (brazos/piernas con pivote, pelo, ojos) con animación de caminar, remar y lanzar el gancho.
- Clic derecho selecciona una celda para desmontarla con E (en el 2D la selección no llegó a implementarse).
- Corrección del 2D: los supervivientes rescatados se colocan sobre celdas ocupadas de la balsa (antes quedaban fuera).

## Pendiente / ideas de pulido

- Sombras y reflejos más elaborados en el agua.
- Modelo de isla visible al acercarse la victoria por isla; barco de rescate al ganar por radio.
- Animaciones de construcción y destrucción más vistosas.

## Notas

- Priorizar que todo funcione antes de pulir la estética.
- Mantener la arquitectura modular para facilitar cambios.
- Reutilizar la lógica de supervivencia, recursos y eventos del juego 2D siempre que sea posible.

## Revisión jugable — 29/07/2026

- Corregida la producción pasiva de comida y agua, que antes se redondeaba a cero por fotograma.
- Corregida la recogida de recursos fraccionarios y el cobro doble de objetos enganchados.
- Reequilibradas cocina, botiquín y radio para eliminar interacciones infinitas.
- La destrucción de la última celda ahora causa una derrota real; demoler ya no puede separar la balsa.
- Colisiones de restos y tiburones ajustadas a la forma real de la balsa.
- Clima persistente en vez de efectos aleatorios de un solo fotograma.
- Pausa con espacio reparada tanto al pausar como al reanudar.
- Habilidades de pescador, cocinero, mecánico y conflictivo conectadas a la lógica.
- Carga y almacenamiento afectan a la velocidad de deriva y al avance hacia la isla.
- Rutas de aparición ajustadas para que restos, peces y tiburones lleguen a la zona jugable.
- Guardados incompletos o antiguos se sanean al cargar sin romper la partida.
- Autoguardado al iniciar y al cerrar cada día.
- Los menús de construcción, tripulación y registro pausan la simulación.
- Radio, motor, cocina, botiquín y estructuras reforzadas pueden repararse.
- Rutas de radio e isla equilibradas y verificadas mediante simulación completa.
- Costes, recogidas y cantidades fraccionarias se muestran con nombres en español.
- Pruebas unitarias e integración: `npm run test:unit`.
- Suite completa de navegador preparada: `npm run test:e2e`.

## Revisión jugable — v1.5

- Mar reducido a 4.225 vértices, superficie a 30 Hz y normales/color a 10 Hz.
- Objetos flotantes y tiburones reutilizan plantillas GPU.
- Hambre y sed funcionan como reservas; cocinar cuenta como ración del día.
- Redes, cultivos y purificadores ya no cubren por sí solos a una persona.
- Toda prestación estructural escala con la salud; a cero queda inoperativa.
- Timón, remo, vela y motor participan en una navegación real con combustible.
- Guardado v2 con migración, saneado y autoguardado al ocultar o cerrar.
- Controles táctiles completos y Three.js local para jugar sin conexión.
- Simulación, HUD y render 3D separados del controlador `Game`.
