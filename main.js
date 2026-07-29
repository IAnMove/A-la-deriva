/*****************************************************
 * main.js - Punto de entrada
 *****************************************************/

window.addEventListener('load', () => {
  if (typeof THREE === 'undefined') {
    document.body.innerHTML = '<div style="color:#fff;font-family:sans-serif;padding:40px;text-align:center">' +
      '<h1>A la Deriva 3D</h1><p>No se pudo cargar Three.js desde la CDN.<br>' +
      'Comprueba tu conexión a internet y recarga la página.</p></div>';
    return;
  }
  Game.init();
});
