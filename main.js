/*****************************************************
 * main.js - Punto de entrada
 *****************************************************/

window.addEventListener('load', () => {
  if (typeof THREE === 'undefined') {
    document.body.innerHTML = '<div style="color:#fff;font-family:sans-serif;padding:40px;text-align:center">' +
      '<h1>A la Deriva 3D</h1><p>No se pudo cargar el motor 3D local ni su copia de respaldo.<br>' +
      'Recarga la página o comprueba que la carpeta <code>vendor</code> esté completa.</p></div>';
    return;
  }
  Game.init();
  Save.bindAutosave(
    () => Game.getSaveData(),
    () => Game.state === 'playing' || Game.state === 'paused'
  );
});
