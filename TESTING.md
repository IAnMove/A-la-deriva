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
