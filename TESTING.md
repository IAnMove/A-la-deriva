# Pruebas

Las pruebas de lógica y contratos de plataforma no requieren instalar paquetes:

```powershell
npm run test:unit
```

La suite E2E abre el juego real, bloquea las peticiones externas para comprobar
la copia local de Three.js y prueba partida nueva, migración de guardados,
autoguardado y controles táctiles:

```powershell
npm install
npx playwright install chromium
npm run test:e2e
```

Para ejecutar toda la validación en una sola orden:

```powershell
npm run test:all
```

El servidor de pruebas también puede iniciarse manualmente con `npm run serve`.

Si ya tienes Chrome instalado, puedes ejecutar las pruebas sin descargar otro navegador:

```powershell
$env:PLAYWRIGHT_CHANNEL = "chrome"
npm run test:all
```

Las pruebas incluyen acciones de tripulación, conversación diaria y guardado, raciones, reparación, bebida, movimiento y pausa; también huella del agua, espuma, modelos de balsa y rutas de los náufragos.
