/*****************************************************
 * world.js - Escena, mar, cielo, iluminación, clima
 *****************************************************/

const World = {
  renderer: null,
  scene: null,
  camera: null,
  sea: null,
  seaGeo: null,
  sunLight: null,
  ambient: null,
  hemi: null,
  stars: null,
  rain: null,
  canvas: null,
  camOffset: new THREE.Vector3(0, 15, 12.5),
  camTarget: new THREE.Vector3(0, 0, 0),
  cameraYaw: 0,
  cameraYawTarget: 0,
  cameraZoom: 1,
  cameraZoomTarget: 1,
  cameraMaxZoomOut: 1,
  cameraDragging: false,
  cameraDragX: 0,
  CAMERA_MIN_ZOOM: 0.58,
  CAMERA_MAX_YAW: THREE.MathUtils.degToRad(35),
  waveAmp: 0.18,
  lightning: 0,

  // Paletas por franja horaria [cielo, niebla, agua, sol, intensidadSol, ambient]
  PHASES: {
    night:   { sky: 0x020c1b, water: 0x08243d, sun: 0x8899ff, sunI: 0.15, ambI: 0.25, fog: 55 },
    dawn:    { sky: 0x3a4a8a, water: 0x14507a, sun: 0xffbb88, sunI: 0.7,  ambI: 0.5,  fog: 70 },
    day:     { sky: 0x4a90d9, water: 0x1668a8, sun: 0xffffff, sunI: 1.15, ambI: 0.75, fog: 85 },
    dusk:    { sky: 0x5a3a7a, water: 0x1a4a72, sun: 0xff9966, sunI: 0.6,  ambI: 0.45, fog: 65 },
  },

  init: (canvas) => {
    World.canvas = canvas;
    World.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    World.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    World.renderer.setSize(window.innerWidth, window.innerHeight);
    World.renderer.shadowMap.enabled = true;
    World.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    World.scene = new THREE.Scene();
    World.scene.background = new THREE.Color(0x4a90d9);
    World.scene.fog = new THREE.Fog(0x4a90d9, 30, 85);

    World.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 300);
    World.camera.position.copy(World.camOffset);
    World.camera.lookAt(0, 0, 0);

    // Luces
    World.ambient = new THREE.AmbientLight(0xffffff, 0.75);
    World.scene.add(World.ambient);
    World.hemi = new THREE.HemisphereLight(0xbfe3ff, 0x0a2a4a, 0.35);
    World.scene.add(World.hemi);
    World.sunLight = new THREE.DirectionalLight(0xffffff, 1.1);
    World.sunLight.position.set(20, 30, 10);
    World.sunLight.castShadow = true;
    World.sunLight.shadow.mapSize.set(1024, 1024);
    World.sunLight.shadow.camera.left = -25;
    World.sunLight.shadow.camera.right = 25;
    World.sunLight.shadow.camera.top = 25;
    World.sunLight.shadow.camera.bottom = -25;
    World.scene.add(World.sunLight);

    // Mar: plano con vértices animados
    const SEG = 100, SIZE = 160;
    World.seaGeo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
    World.seaGeo.rotateX(-Math.PI / 2);
    // Colores por vértice: profundidad, crestas y espuma
    const vCount = World.seaGeo.attributes.position.count;
    const colors = new Float32Array(vCount * 3);
    World.seaGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const seaMat = new THREE.MeshPhongMaterial({
      color: 0xffffff,
      vertexColors: true,
      transparent: true,
      opacity: 0.96,
      shininess: 140,
      specular: 0xaaddff,
      flatShading: true,
    });
    World.sea = new THREE.Mesh(World.seaGeo, seaMat);
    World.sea.receiveShadow = true;
    World.scene.add(World.sea);

    // Estrellas (visibles de noche)
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(400 * 3);
    for (let i = 0; i < 400; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Util.rand(60, 120);
      starPos[i * 3] = Math.cos(a) * r;
      starPos[i * 3 + 1] = Util.rand(15, 80);
      starPos[i * 3 + 2] = Math.sin(a) * r;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    World.stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.35, transparent: true, opacity: 0 }));
    World.stars.frustumCulled = false;
    World.scene.add(World.stars);

    // Lluvia (puntos que caen, visible solo cuando llueve)
    const rainGeo = new THREE.BufferGeometry();
    const rainPos = new Float32Array(500 * 3);
    for (let i = 0; i < 500; i++) {
      rainPos[i * 3] = Util.rand(-25, 25);
      rainPos[i * 3 + 1] = Util.rand(0, 20);
      rainPos[i * 3 + 2] = Util.rand(-25, 25);
    }
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
    World.rain = new THREE.Points(rainGeo, new THREE.PointsMaterial({ color: 0xaed5ff, size: 0.12, transparent: true, opacity: 0.6 }));
    World.rain.visible = false;
    World.rain.frustumCulled = false;
    World.scene.add(World.rain);

    window.addEventListener('resize', World.resize);
    World.bindCameraControls(canvas);
  },

  bindCameraControls: (canvas) => {
    // La rueda solo acerca la cámara en una balsa pequeña. El límite de
    // alejamiento se amplía desde updateCamera cuando crece la balsa.
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const direction = Math.sign(e.deltaY);
      World.cameraZoomTarget = Util.clamp(
        World.cameraZoomTarget + direction * 0.1,
        World.CAMERA_MIN_ZOOM,
        World.cameraMaxZoomOut
      );
    }, { passive: false });

    // Botón central: giro horizontal limitado. No usa el botón derecho,
    // que queda libre para la selección/demolición del juego.
    canvas.addEventListener('mousedown', e => {
      if (e.button !== 1) return;
      e.preventDefault();
      World.cameraDragging = true;
      World.cameraDragX = e.clientX;
    });
    window.addEventListener('mousemove', e => {
      if (!World.cameraDragging) return;
      const dx = e.clientX - World.cameraDragX;
      World.cameraDragX = e.clientX;
      World.cameraYawTarget = Util.clamp(
        World.cameraYawTarget - dx * 0.006,
        -World.CAMERA_MAX_YAW,
        World.CAMERA_MAX_YAW
      );
    });
    window.addEventListener('mouseup', e => {
      if (e.button === 1) World.cameraDragging = false;
    });
    window.addEventListener('blur', () => {
      World.cameraDragging = false;
    });
    canvas.addEventListener('auxclick', e => {
      if (e.button === 1) e.preventDefault();
    });
  },

  resize: () => {
    World.camera.aspect = window.innerWidth / window.innerHeight;
    World.camera.updateProjectionMatrix();
    World.renderer.setSize(window.innerWidth, window.innerHeight);
  },

  // Altura de ola en una posición del mundo (para balanceo de balsa/objetos)
  waveHeight: (x, z, time, offsetX, offsetZ) => {
    const wx = x + offsetX, wz = z + offsetZ;
    return Math.sin(wx * 0.35 + time * 1.1) * 0.42 +
           Math.sin(wz * 0.28 + time * 0.9) * 0.33 +
           Math.sin((wx + wz) * 0.15 + time * 1.7) * 0.18 +
           Math.sin(wx * 0.9 - time * 1.4) * Math.sin(wz * 0.7 + time * 0.6) * 0.15 +
           Math.sin(wx * 1.3 + time * 2.3) * Math.sin(wz * 1.1 + time * 1.9) * 0.1;
  },

  // Colores del agua derivados de la hora del día (los fija updateDayNight)
  waterDeep: new THREE.Color(0x0a3a5e),
  waterLight: new THREE.Color(0x2a8ac8),
  foamColor: new THREE.Color(0xeaf6ff),

  updateSea: (time, offsetX, offsetZ, storm) => {
    const targetAmp = storm ? 0.8 : 0.35;
    World.waveAmp = Util.lerp(World.waveAmp, targetAmp, 0.02);
    const pos = World.seaGeo.attributes.position;
    const colAttr = World.seaGeo.attributes.color;
    const cam = World.camTarget;
    // El mar sigue a la cámara
    World.sea.position.set(cam.x, 0, cam.z);
    const deep = World.waterDeep, light = World.waterLight, foam = World.foamColor;
    const amp = World.waveAmp;
    const foamTh = 0.8; // umbral de cresta para espuma
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + cam.x;
      const z = pos.getZ(i) + cam.z;
      const h = World.waveHeight(x, z, time, offsetX, offsetZ); // ~[-1.1, 1.1]
      pos.setY(i, h * amp);
      // Gradiente valle -> cresta
      const t = Util.clamp((h + 1) * 0.5, 0, 1);
      let r = deep.r + (light.r - deep.r) * t;
      let g = deep.g + (light.g - deep.g) * t;
      let b = deep.b + (light.b - deep.b) * t;
      // Espuma en las crestas (modulada a alta frecuencia para que sean parches)
      if (h > foamTh) {
        const sparkle = 0.5 + 0.5 * Math.sin(x * 2.7 + time * 2.1) * Math.sin(z * 3.1 - time * 1.3);
        const f = Math.min(1, (h - foamTh) / 0.25) * sparkle * (storm ? 1 : 0.85);
        r += (foam.r - r) * f;
        g += (foam.g - g) * f;
        b += (foam.b - b) * f;
      }
      colAttr.setXYZ(i, r, g, b);
    }
    pos.needsUpdate = true;
    colAttr.needsUpdate = true;
    World.seaGeo.computeVertexNormals();
  },

  // Actualiza iluminación/cielo según la hora del día (0-24)
  updateDayNight: (hour, storm, fogActive, dt = 1 / 60) => {
    let a, b, t;
    if (hour < 5 || hour >= 21) { a = b = World.PHASES.night; t = 0; }
    else if (hour < 8) { a = World.PHASES.night; b = World.PHASES.dawn; t = (hour - 5) / 3; }
    else if (hour < 10) { a = World.PHASES.dawn; b = World.PHASES.day; t = (hour - 8) / 2; }
    else if (hour < 17) { a = b = World.PHASES.day; t = 0; }
    else if (hour < 19) { a = World.PHASES.day; b = World.PHASES.dusk; t = (hour - 17) / 2; }
    else { a = World.PHASES.dusk; b = World.PHASES.night; t = (hour - 19) / 2; }

    const sky = new THREE.Color(a.sky).lerp(new THREE.Color(b.sky), t);
    const water = new THREE.Color(a.water).lerp(new THREE.Color(b.water), t);
    const sunC = new THREE.Color(a.sun).lerp(new THREE.Color(b.sun), t);
    let sunI = Util.lerp(a.sunI, b.sunI, t);
    let ambI = Util.lerp(a.ambI, b.ambI, t);
    let fogFar = Util.lerp(a.fog, b.fog, t);

    if (storm) {
      sky.multiplyScalar(0.45);
      water.multiplyScalar(0.6);
      sunI *= 0.35;
      ambI *= 0.7;
      fogFar = Math.min(fogFar, 40);
    }

    // La distancia al centro de la balsa crece al alejar la cámara. La
    // niebla debe ocultar el horizonte, nunca el jugador que está en él.
    const viewDistance = World.camera
      ? World.camera.position.distanceTo(World.camTarget)
      : World.camOffset.length();
    let fogNear;
    if (fogActive) {
      fogNear = Math.max(10, viewDistance - 4);
      fogFar = Math.max(38, viewDistance + 18);
    } else if (storm) {
      fogNear = Math.max(14, viewDistance - 2);
      fogFar = Math.max(42, viewDistance + 20);
    } else {
      fogNear = Math.max(24, Math.min(34, viewDistance + 8));
      fogFar = Math.max(fogFar, viewDistance + 25);
    }
    // Three.Fog requiere near < far. Dejamos además una franja amplia para
    // evitar una pared opaca y suavizamos cualquier cambio meteorológico.
    fogFar = Math.max(fogFar, fogNear + 12);

    // Relámpagos durante la tormenta
    if (storm && Math.random() < 0.006) World.lightning = 1;
    if (World.lightning > 0) {
      World.lightning = Math.max(0, World.lightning - 0.06);
      ambI += World.lightning * 1.6;
      sky.lerp(new THREE.Color(0xffffff), World.lightning * 0.5);
    }

    World.scene.background.copy(sky);
    World.scene.fog.color.copy(sky);
    const fogBlend = 1 - Math.exp(-Math.max(0, dt) * 4);
    World.scene.fog.near = Util.lerp(World.scene.fog.near, fogNear, fogBlend);
    World.scene.fog.far = Util.lerp(World.scene.fog.far, fogFar, fogBlend);
    if (World.scene.fog.near >= World.scene.fog.far) {
      World.scene.fog.near = Math.max(0, World.scene.fog.far - 12);
    }
    // Colores del agua por vértice: profundo, cresta y espuma
    World.waterDeep.copy(water).multiplyScalar(0.45);
    World.waterLight.copy(water).multiplyScalar(1.35).lerp(sky, 0.1);
    World.foamColor.setHex(0xeaf6ff).lerp(sky, 0.25);
    World.sunLight.color.copy(sunC);
    World.sunLight.intensity = sunI;
    World.ambient.intensity = ambI;

    // Posición del sol según la hora
    const sunAngle = ((hour - 6) / 12) * Math.PI; // 6h sale, 18h se pone
    const sx = Math.cos(sunAngle) * 30;
    const sy = Math.max(4, Math.sin(sunAngle) * 30);
    World.sunLight.position.set(World.camTarget.x + sx, sy, World.camTarget.z + 12);

    // Estrellas de noche
    const night = (hour < 5.5 || hour > 20);
    World.stars.material.opacity = Util.lerp(World.stars.material.opacity, night && !storm ? 0.9 : 0, 0.05);
    World.stars.position.set(World.camTarget.x, 0, World.camTarget.z);
  },

  updateRain: (dt, active) => {
    World.rain.visible = active;
    if (!active) return;
    const pos = World.rain.geometry.attributes.position;
    const cam = World.camTarget;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i) - dt * 18;
      if (y < 0) {
        y = Util.rand(14, 20);
        pos.setX(i, cam.x + Util.rand(-25, 25));
        pos.setZ(i, cam.z + Util.rand(-25, 25));
      }
      pos.setY(i, y);
    }
    pos.needsUpdate = true;
  },

  // API principal de cámara.
  // center: { x, z }
  // bounds: { minX, maxX, minY, maxY } en coordenadas de la cuadrícula
  // cellSize: tamaño de una celda en unidades del mundo
  updateCamera: (center, bounds, dt, cellSize = 2) => {
    const safeDt = Math.max(0, Math.min(dt || 0, 0.1));
    const followBlend = 1 - Math.exp(-safeDt * 3);
    World.camTarget.x = Util.lerp(World.camTarget.x, center.x, followBlend);
    World.camTarget.z = Util.lerp(World.camTarget.z, center.z, followBlend);

    // El encuadre inicial es el máximo alejamiento para una balsa pequeña.
    // Al crecer su huella se amplía proporcionalmente, con un límite sensato.
    let maxZoomOut = 1;
    if (bounds) {
      const spanX = (Math.abs(bounds.maxX - bounds.minX) + 1) * cellSize;
      const spanZ = (Math.abs(bounds.maxY - bounds.minY) + 1) * cellSize;
      const diagonal = Math.hypot(spanX, spanZ);
      maxZoomOut = Math.max(1, spanX / 8, spanZ / 8, diagonal / 11);
    }
    World.cameraMaxZoomOut = Util.clamp(maxZoomOut, 1, 2.4);
    World.cameraZoomTarget = Util.clamp(
      World.cameraZoomTarget,
      World.CAMERA_MIN_ZOOM,
      World.cameraMaxZoomOut
    );

    // Q/R ofrecen una alternativa al ratón y mantienen el mismo límite.
    if (typeof Input !== 'undefined') {
      const keyboardTurn = 0.85 * safeDt;
      if (Input.isDown('KeyQ')) World.cameraYawTarget -= keyboardTurn;
      if (Input.isDown('KeyR')) World.cameraYawTarget += keyboardTurn;
      World.cameraYawTarget = Util.clamp(
        World.cameraYawTarget,
        -World.CAMERA_MAX_YAW,
        World.CAMERA_MAX_YAW
      );
    }

    const cameraBlend = 1 - Math.exp(-safeDt * 8);
    World.cameraZoom = Util.lerp(World.cameraZoom, World.cameraZoomTarget, cameraBlend);
    World.cameraYaw = Util.lerp(World.cameraYaw, World.cameraYawTarget, cameraBlend);

    const horizontal = World.camOffset.z * World.cameraZoom;
    const height = World.camOffset.y * World.cameraZoom;
    const offsetX = Math.sin(World.cameraYaw) * horizontal;
    const offsetZ = Math.cos(World.cameraYaw) * horizontal;
    const bob = Math.sin(performance.now() / 1400) * 0.25;
    World.camera.position.set(
      World.camTarget.x + offsetX,
      World.camTarget.y + height + bob,
      World.camTarget.z + offsetZ
    );
    World.camera.lookAt(World.camTarget.x, 0, World.camTarget.z);
  },

  // Compatibilidad con llamadas existentes y partidas/pruebas antiguas.
  followCamera: (cx, cz, dt) => {
    World.updateCamera({ x: cx, z: cz }, null, dt);
  },

  // Raycasting desde el ratón al plano del mar (y = 0)
  raycaster: new THREE.Raycaster(),
  seaPlane: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
  mouseToWorld: (mx, my) => {
    const width = World.canvas ? World.canvas.clientWidth : window.innerWidth;
    const height = World.canvas ? World.canvas.clientHeight : window.innerHeight;
    const ndc = new THREE.Vector2(
      (mx / width) * 2 - 1,
      -(my / height) * 2 + 1
    );
    World.raycaster.setFromCamera(ndc, World.camera);
    const out = new THREE.Vector3();
    World.raycaster.ray.intersectPlane(World.seaPlane, out);
    return out; // {x, 0, z}
  },

  render: () => {
    World.renderer.render(World.scene, World.camera);
  }
};
