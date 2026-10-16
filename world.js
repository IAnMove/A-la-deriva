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
  cameraDragY: 0,
  CAMERA_MIN_ZOOM: 0.58,
  // Primera persona: se entra acercando la rueda más allá del zoom mínimo y
  // se sale alejando. El arrastre gira la vista libremente (360° de yaw).
  firstPerson: false,
  fpYaw: 0,
  fpPitch: -0.1,
  fpPlayerCache: null,
  fpPointerLocked: false,
  fpBlend: 0,
  fpBodyVisible: false,
  fpTmp: new THREE.Vector3(),
  FP_EYE_HEIGHT: 1.26,
  FP_FORWARD: 0.03,
  // Al mirar abajo la cámara sube por encima del chaleco: se ve el torso y
  // el brazo por fuera, no el interior naranja.
  FP_LOOKDOWN_LIFT: 0.28,
  // Near más corto que el viewmodel de la caña (~0.76) y que el brazo.
  FP_NEAR: 0.2,
  // FOV más abierto en primera persona: inmersión y más cuerpo al mirar abajo.
  FP_FOV: 74,
  // La superficie no necesita la misma frecuencia que el render. Separar
  // geometria, color y normales evita trabajo cuando el juego esta pausado.
  SEA_SEGMENTS: 128,
  SEA_SURFACE_INTERVAL: 1 / 30,
  SEA_DETAIL_INTERVAL: 1 / 10,
  seaLastSurfaceTime: -Infinity,
  seaLastDetailTime: -Infinity,
  seaLastStorm: null,
  seaLastFootprint: null,
  waveAmp: 0.18,
  lightning: 0,
  hullFoam: null,
  hullFoamRect: { hx: -1, hz: -1, signature: null },
  seaUniforms: null,

  // Paletas por franja horaria [cielo, niebla, agua, sol, intensidadSol, ambient]
  PHASES: {
    night:   { sky: 0x020c1b, water: 0x08243d, sun: 0x8899ff, sunI: 0.15, ambI: 0.25, fog: 55 },
    dawn:    { sky: 0x687faa, water: 0x27627c, sun: 0xffc797, sunI: 0.72, ambI: 0.45,  fog: 70 },
    day:     { sky: 0x69a5cf, water: 0x236b83, sun: 0xfff3df, sunI: 0.82, ambI: 0.42, fog: 85 },
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
    // La cámara vive en el grafo para poder colgarle el viewmodel de la caña
    // en primera persona.
    World.scene.add(World.camera);

    // Luces
    World.ambient = new THREE.AmbientLight(0xffffff, 0.42);
    World.scene.add(World.ambient);
    World.hemi = new THREE.HemisphereLight(0xbfe3ff, 0x0a2a4a, 0.23);
    World.scene.add(World.hemi);
    World.sunLight = new THREE.DirectionalLight(0xfff3df, 0.82);
    World.sunLight.position.set(20, 30, 10);
    World.sunLight.castShadow = true;
    World.sunLight.shadow.mapSize.set(1024, 1024);
    World.sunLight.shadow.camera.left = -25;
    World.sunLight.shadow.camera.right = 25;
    World.sunLight.shadow.camera.top = 25;
    World.sunLight.shadow.camera.bottom = -25;
    World.scene.add(World.sunLight);

    // Mar: plano con vértices animados
    const SEG = World.SEA_SEGMENTS, SIZE = 160;
    World.seaGeo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
    World.seaGeo.rotateX(-Math.PI / 2);
    // Colores por vértice: profundidad, crestas y espuma
    const vCount = World.seaGeo.attributes.position.count;
    const colors = new Float32Array(vCount * 3);
    World.seaGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const seaMat = World.createSeaMaterial();
    World.sea = new THREE.Mesh(World.seaGeo, seaMat);
    World.sea.receiveShadow = true;
    World.scene.add(World.sea);
    World.seaLastSurfaceTime = -Infinity;
    World.seaLastDetailTime = -Infinity;
    World.seaLastStorm = null;
    World.seaLastFootprint = null;

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
    // La rueda acerca/aleja la cámara (el alejamiento máximo lo amplía
    // updateCamera cuando crece la balsa). Al acercar más allá del mínimo se
    // entra en primera persona; alejando con la rueda se vuelve a tercera.
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const direction = Math.sign(e.deltaY);
      if (World.firstPerson) {
        if (direction > 0) World.exitFirstPerson();
        return;
      }
      const next = World.cameraZoomTarget + direction * 0.1;
      if (direction < 0 && next < World.CAMERA_MIN_ZOOM &&
          World.findPlayerObject()) {
        World.enterFirstPerson();
        return;
      }
      World.cameraZoomTarget = Util.clamp(
        next,
        World.CAMERA_MIN_ZOOM,
        World.cameraMaxZoomOut
      );
    }, { passive: false });

    // Botón central: giro de cámara. En tercera persona orbita libremente
    // (360°); en primera persona mueve la vista (yaw completo y pitch
    // acotado). No usa el botón derecho, que queda libre para la
    // selección/demolición del juego.
    canvas.addEventListener('mousedown', e => {
      // En primera persona, cualquier clic (re)activa el pointer lock si el
      // navegador lo soltó (Escape) o si se entró sin gesto (picada de pez).
      if (World.firstPerson) World.lockPointer();
      if (e.button !== 1) return;
      e.preventDefault();
      World.cameraDragging = true;
      World.cameraDragX = e.clientX;
      World.cameraDragY = e.clientY;
    });
    window.addEventListener('mousemove', e => {
      // Vista libre con pointer lock: el ratón mira, sin botones.
      if (World.firstPerson && World.fpPointerLocked) {
        World.fpYaw -= (e.movementX || 0) * 0.0024;
        World.fpPitch = Util.clamp(
          World.fpPitch - (e.movementY || 0) * 0.0024,
          -1.15,
          1.15
        );
        return;
      }
      if (!World.cameraDragging) return;
      const dx = e.clientX - World.cameraDragX;
      const dy = e.clientY - World.cameraDragY;
      World.cameraDragX = e.clientX;
      World.cameraDragY = e.clientY;
      if (World.firstPerson) {
        World.fpYaw -= dx * 0.0045;
        World.fpPitch = Util.clamp(World.fpPitch - dy * 0.0045, -1.15, 1.15);
        return;
      }
      // Tercera persona: giro orbital libre, 360° alrededor de la balsa.
      World.cameraYawTarget -= dx * 0.006;
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
    document.addEventListener('pointerlockchange', () => {
      World.fpPointerLocked = document.pointerLockElement === World.canvas;
    });
  },

  // Pointer lock para mirar con el ratón en primera persona. Fuera de un
  // gesto de usuario el navegador puede rechazarlo; se reintenta al clicar.
  lockPointer: () => {
    if (!World.canvas || World.fpPointerLocked ||
        typeof World.canvas.requestPointerLock !== 'function') return;
    try {
      const request = World.canvas.requestPointerLock();
      if (request && typeof request.catch === 'function') {
        request.catch(() => {});
      }
    } catch (err) { /* sin gesto de usuario */ }
  },

  resize: () => {
    World.camera.aspect = window.innerWidth / window.innerHeight;
    World.camera.updateProjectionMatrix();
    World.renderer.setSize(window.innerWidth, window.innerHeight);
  },

  // Las ondas grandes conservan su malla económica; el rizado y el reflejo
  // rasante se resuelven por fragmento, sin texturas ni otra pasada de escena.
  createSeaMaterial: () => {
    const uniforms = World.seaUniforms = {
      seaTime: { value: 0 },
      seaStorm: { value: 0 },
      seaOffset: { value: new THREE.Vector2() },
      seaSky: { value: new THREE.Color(0x4a90d9) },
    };
    const material = new THREE.MeshPhongMaterial({
      color: 0xffffff,
      vertexColors: true,
      shininess: 175,
      specular: 0x405564,
      flatShading: false,
    });
    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vSeaWorld;')
        .replace('#include <worldpos_vertex>',
          '#include <worldpos_vertex>\nvSeaWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
          varying vec3 vSeaWorld;
          uniform float seaTime;
          uniform float seaStorm;
          uniform vec2 seaOffset;
          uniform vec3 seaSky;
        `)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          vec2 ocean = vSeaWorld.xz + seaOffset;
          // Trenes oblicuos: el patrón viaja con las mismas corrientes que
          // las ondas grandes, sin cuadrícula de ruido ni textura repetida.
          float rippleA = cos(dot(ocean, vec2(4.1, 1.7)) + seaTime * 2.8);
          float rippleB = cos(dot(ocean, vec2(-2.3, 5.2)) + seaTime * 3.9);
          float rippleC = cos(dot(ocean, vec2(8.2, -3.1)) - seaTime * 4.2);
          float distanceFade = 1.0 - smoothstep(14.0, 65.0, length(vViewPosition));
          vec2 ripple = (vec2(0.09, 0.038) * rippleA +
            vec2(-0.042, 0.088) * rippleB + vec2(0.018, -0.012) * rippleC)
            * distanceFade * (1.0 + seaStorm * 0.4);
          normal = normalize(normal + mat3(viewMatrix) * vec3(-ripple.x, 0.0, -ripple.y));
        `)
        .replace('#include <envmap_fragment>', `#include <envmap_fragment>
          float facing = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
          float fresnel = 0.035 + 0.46 * pow(1.0 - facing, 3.0);
          outgoingLight = mix(outgoingLight, seaSky * 0.82, fresnel);
        `);
    };
    material.customProgramCacheKey = () => 'ocean-ripples-fresnel-v1';
    return material;
  },

  // Altura de ola en una posición del mundo (para balanceo de balsa/objetos).
  // Son trenes de olas direccionales que viajan (longitudes de 17/11/7/4,5 u,
  // varias olas visibles a la vez desde la cámara), todos muestreables por la
  // malla (vértice cada 1,25 u). Nada de productos de senos de alta
  // frecuencia: con la rejilla aliasaban y dibujaban patrones rectangulares.
  waveHeight: (x, z, time, offsetX, offsetZ) => {
    const wx = x + offsetX, wz = z + offsetZ;
    return Math.sin(wx * 0.34 + wz * 0.1 + time * 1.15) * 0.42 +
           Math.sin(wx * -0.22 + wz * 0.52 + time * 1.5) * 0.28 +
           Math.sin(wx * 0.75 - wz * 0.55 + time * 2.1) * 0.16 +
           Math.sin(wx * 1.25 + wz * 0.9 + time * 2.9) * 0.08;
  },

  // Colores del agua derivados de la hora del día (los fija updateDayNight)
  waterDeep: new THREE.Color(0x0a3a5e),
  waterLight: new THREE.Color(0x2a8ac8),
  foamColor: new THREE.Color(0xeaf6ff),
  phaseSky: new THREE.Color(0),
  phaseSkyTarget: new THREE.Color(0),
  phaseWater: new THREE.Color(0),
  phaseWaterTarget: new THREE.Color(0),
  phaseSun: new THREE.Color(0),
  phaseSunTarget: new THREE.Color(0),
  lightningColor: new THREE.Color(0xffffff),

  // La huella real evita espuma en celdas vacías de una balsa en L.
  // visualRevision permite reutilizarla también cuando sólo cambia un edificio.
  footprintSignature: raftRect => {
    if (!raftRect) return '';
    const raft = raftRect.raft;
    if (!raft || !raft.grid) return raftRect.hx + ':' + raftRect.hz;
    const revision = Number.isFinite(raft.visualRevision)
      ? raft.visualRevision : Array.from(raft.grid.keys()).join('|');
    return raft.cellSize + ':' + revision;
  },

  // Altura visual compartida por mar y espuma. La cubierta desplaza el agua:
  // se suaviza una celda de la malla alrededor para que ningún triángulo
  // interpolado atraviese los tablones al cabecear o en una tormenta.
  seaSurfaceHeight: (x, z, time, offsetX, offsetZ, storm, raftRect, rawHeight) => {
    const h = rawHeight === undefined
      ? World.waveHeight(x, z, time, offsetX, offsetZ) : rawHeight;
    const crest = Math.max(0, h - (storm ? 0.5 : 0.38));
    let y = (h + crest * crest * (storm ? 0.9 : 0.65)) * World.waveAmp;
    if (!raftRect) return y;
    const margin = 1.85;
    if (Math.abs(x - raftRect.cx) > raftRect.hx + margin ||
        Math.abs(z - raftRect.cz) > raftRect.hz + margin) return y;
    const raft = raftRect.raft;
    let distance = Infinity;
    if (raft && raft.grid) {
      const cs = raft.cellSize;
      const gx = Math.floor(x / cs), gz = Math.floor(z / cs);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          const cx = gx + dx, cz = gz + dz;
          if (!raft.grid.has(cx + ',' + cz)) continue;
          const qx = Math.max(cx * cs - x, 0, x - (cx + 1) * cs);
          const qz = Math.max(cz * cs - z, 0, z - (cz + 1) * cs);
          distance = Math.min(distance, Math.hypot(qx, qz));
        }
      }
    } else {
      distance = Math.hypot(
        Math.max(0, Math.abs(x - raftRect.cx) - raftRect.hx),
        Math.max(0, Math.abs(z - raftRect.cz) - raftRect.hz)
      );
    }
    if (distance > margin) return y;
    const group = raft && raft.group;
    const rx = group ? group.rotation.x : Math.sin(time * 0.9) * 0.015 * (storm ? 2.2 : 1);
    const rz = group ? group.rotation.z : Math.cos(time * 0.7) * 0.018 * (storm ? 2.2 : 1);
    const bob = group ? group.position.y :
      World.waveHeight(raftRect.cx, raftRect.cz, time, offsetX, offsetZ) * World.waveAmp * 0.6;
    const deck = raft && Number.isFinite(raft.deckHeight) ? raft.deckHeight : 0.35;
    const px = group ? group.position.x : 0, pz = group ? group.position.z : 0;
    const normalY = Math.cos(rx) * Math.cos(rz);
    const ceiling = bob + (deck - 0.2 + Math.sin(rz) * (x - px) -
      Math.sin(rx) * Math.cos(rz) * (z - pz)) / normalY;
    // Un borde amplio y continuo oculta la transición bajo los flotadores.
    const release = Math.max(0, (distance - 0.85) / (margin - 0.85));
    return Math.min(y, ceiling + release * release * 1.7);
  },

  // La espuma usa el triángulo que realmente dibuja la GPU; evaluar una
  // onda analítica entre vértices la haría flotar o hundirse en las crestas.
  sampleSeaMeshHeight: (x, z) => {
    const geometry = World.seaGeo;
    const parameters = geometry && geometry.parameters;
    if (!parameters || !World.sea) return null;
    const nx = parameters.widthSegments, nz = parameters.heightSegments;
    const width = parameters.width, depth = parameters.height;
    const fx = (x - World.sea.position.x + width * 0.5) / width * nx;
    const fz = (z - World.sea.position.z + depth * 0.5) / depth * nz;
    if (fx < 0 || fz < 0 || fx > nx || fz > nz) return null;
    const ix = Math.min(nx - 1, Math.floor(fx));
    const iz = Math.min(nz - 1, Math.floor(fz));
    const tx = fx - ix, tz = fz - iz;
    const positions = geometry.attributes.position;
    const a = iz * (nx + 1) + ix;
    const h00 = positions.getY(a), h10 = positions.getY(a + 1);
    const h01 = positions.getY(a + nx + 1), h11 = positions.getY(a + nx + 2);
    return tx + tz <= 1
      ? h00 + (h10 - h00) * tx + (h01 - h00) * tz
      : h11 + (h01 - h11) * (1 - tx) + (h10 - h11) * (1 - tz);
  },

  // Parches cortos separados y afinados en los extremos: espuma de contacto,
  // nunca una sábana rectangular. Cada parche parte de una arista expuesta.
  buildHullFoam: (hx, hz, raft = null) => {
    const edges = [];
    const addEdges = (x0, z0, x1, z1, occupied) => {
      if (!occupied(0, -1)) edges.push([x0, z0, x1, z0, 0, -1]);
      if (!occupied(1, 0)) edges.push([x1, z0, x1, z1, 1, 0]);
      if (!occupied(0, 1)) edges.push([x1, z1, x0, z1, 0, 1]);
      if (!occupied(-1, 0)) edges.push([x0, z1, x0, z0, -1, 0]);
    };
    if (raft && raft.grid) {
      const cs = raft.cellSize;
      for (const key of raft.grid.keys()) {
        const [gx, gz] = key.split(',').map(Number);
        addEdges(gx * cs, gz * cs, (gx + 1) * cs, (gz + 1) * cs,
          (dx, dz) => raft.grid.has((gx + dx) + ',' + (gz + dz)));
      }
    } else {
      addEdges(-hx, -hz, hx, hz, () => false);
    }
    const positions = [], colors = [], metadata = [], indices = [];
    const rings = [0.035, 0.14, 0.34, 0.58];
    const across = [-0.5, -0.18, 0.18, 0.5];
    for (const edge of edges) {
      const [x0, z0, x1, z1, nx, nz] = edge;
      const length = Math.hypot(x1 - x0, z1 - z0);
      const segments = Math.max(1, Math.ceil(length / 0.9));
      for (let segment = 0; segment < segments; segment++) {
        const start = positions.length / 3;
        const phase = x0 * 2.17 + z0 * 1.39 + segment * 2.51 + nx * 0.8;
        const width = length / segments * (0.7 + 0.08 * Math.sin(phase));
        const midpoint = (segment + 0.5) / segments;
        for (let column = 0; column < across.length; column++) {
          const along = midpoint + across[column] * width / length;
          for (let row = 0; row < rings.length; row++) {
            const distance = rings[row] * (0.85 + 0.15 * Math.cos(phase));
            const px = x0 + (x1 - x0) * along + nx * distance;
            const pz = z0 + (z1 - z0) * along + nz * distance;
            positions.push(px, 0, pz);
            colors.push(1, 1, 1, 0);
            metadata.push(px, pz, nx, nz, phase, row, column);
          }
        }
        for (let column = 0; column < 3; column++) {
          for (let row = 0; row < 3; row++) {
            const a = start + column * 4 + row, b = a + 4;
            indices.push(a, b, a + 1, b, b + 1, a + 1);
          }
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 4));
    geometry.setIndex(indices);
    geometry.userData.meta = new Float32Array(metadata);
    geometry.userData.edgeCount = edges.length;
    const material = new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = 2;
    mesh.frustumCulled = false;
    return mesh;
  },

  updateHullFoam: (raftRect, time, offsetX, offsetZ, storm, refreshDetail) => {
    if (!raftRect) {
      if (World.hullFoam) World.hullFoam.visible = false;
      return;
    }
    const signature = World.footprintSignature(raftRect);
    const cached = World.hullFoamRect;
    let rebuilt = false;
    if (!World.hullFoam || cached.signature !== signature || cached.raft !== raftRect.raft) {
      if (World.hullFoam) {
        World.scene.remove(World.hullFoam);
        World.hullFoam.geometry.dispose();
        World.hullFoam.material.dispose();
      }
      World.hullFoam = World.buildHullFoam(raftRect.hx, raftRect.hz, raftRect.raft);
      World.scene.add(World.hullFoam);
      cached.signature = signature;
      cached.raft = raftRect.raft;
      rebuilt = true;
    }
    const mesh = World.hullFoam;
    mesh.visible = true;
    const raft = raftRect.raft;
    const group = raft && raft.group;
    if (group) group.updateMatrixWorld(true);
    const matrix = group && group.matrixWorld.elements;
    const positions = mesh.geometry.attributes.position;
    const colors = mesh.geometry.attributes.color;
    const meta = mesh.geometry.userData.meta;
    for (let i = 0; i < positions.count; i++) {
      const index = i * 7;
      const phase = meta[index + 4];
      const row = meta[index + 5], column = meta[index + 6];
      const spread = Math.sin(time * 1.5 + phase) * 0.035 * row;
      const lx = meta[index] + meta[index + 2] * spread;
      const lz = meta[index + 1] + meta[index + 3] * spread;
      const x = matrix ? matrix[0] * lx + matrix[8] * lz + matrix[12] : lx + (raft ? 0 : raftRect.cx);
      const z = matrix ? matrix[2] * lx + matrix[10] * lz + matrix[14] : lz + (raft ? 0 : raftRect.cz);
      const h = World.waveHeight(x, z, time, offsetX, offsetZ);
      const renderedHeight = World.sampleSeaMeshHeight(x, z);
      const y = renderedHeight === null
        ? World.seaSurfaceHeight(x, z, time, offsetX, offsetZ, storm, raftRect, h)
        : renderedHeight;
      positions.setXYZ(i, x, y + 0.026, z);
      if (!refreshDetail && !rebuilt) continue;
      const endFade = column === 0 || column === 3 ? 0 : 1;
      const edgeFade = row === 1 ? 1 : row === 2 ? 0.32 : 0;
      const pulse = Util.clamp(Math.sin(time * 1.45 + phase) * 0.55 + h * 0.4 + 0.2, 0, 1);
      const alpha = endFade * edgeFade * pulse * (storm ? 0.52 : 0.32);
      colors.setXYZW(i, World.foamColor.r, World.foamColor.g, World.foamColor.b, alpha);
    }
    positions.needsUpdate = true;
    if (refreshDetail || rebuilt) colors.needsUpdate = true;
  },

  updateSea: (time, offsetX, offsetZ, storm, raftRect = null) => {
    const cam = World.camTarget;
    if (World.seaUniforms) {
      World.seaUniforms.seaTime.value = time;
      World.seaUniforms.seaStorm.value = storm ? 1 : 0;
      World.seaUniforms.seaOffset.value.set(offsetX, offsetZ);
    }
    const footprint = World.footprintSignature(raftRect);
    const hullChanged = World.seaLastFootprint !== footprint ||
      World.seaLastRaft !== (raftRect && raftRect.raft);
    // El mar sigue a la cámara
    World.sea.position.set(cam.x, 0, cam.z);

    // Game.elapsed se detiene en menus/pausa. En ese estado basta con mover
    // el plano: no hay una ola nueva que recalcular ni subir a la GPU.
    const surfaceElapsed = time - World.seaLastSurfaceTime;
    const timeReset = !Number.isFinite(surfaceElapsed) || surfaceElapsed < 0;
    const stormChanged = World.seaLastStorm !== storm;
    if (!timeReset && !stormChanged && !hullChanged && surfaceElapsed < World.SEA_SURFACE_INTERVAL) return;
    World.seaLastFootprint = footprint;
    World.seaLastRaft = raftRect && raftRect.raft;
    World.seaLastSurfaceTime = time;

    const targetAmp = storm ? 0.8 : 0.55;
    const surfaceStep = timeReset || surfaceElapsed <= 0
      ? World.SEA_SURFACE_INTERVAL
      : Math.min(surfaceElapsed, 0.1);
    // Equivalente al lerp histórico de 0,02 a 60 FPS, pero independiente
    // del framerate y completamente detenido cuando el reloj no avanza.
    const amplitudeBlend = 1 - Math.exp(-surfaceStep * 1.212);
    World.waveAmp = Util.lerp(World.waveAmp, targetAmp, amplitudeBlend);

    const detailElapsed = time - World.seaLastDetailTime;
    const refreshDetail = timeReset || stormChanged || hullChanged ||
      !Number.isFinite(detailElapsed) || detailElapsed < 0 ||
      detailElapsed >= World.SEA_DETAIL_INTERVAL;
    if (refreshDetail) {
      World.seaLastDetailTime = time;
      World.seaLastStorm = storm;
    }

    const pos = World.seaGeo.attributes.position;
    const colAttr = World.seaGeo.attributes.color;
    const deep = World.waterDeep, light = World.waterLight, foam = World.foamColor;
    const foamTh = storm ? 0.6 : 0.78;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + cam.x;
      const z = pos.getZ(i) + cam.z;
      const h = World.waveHeight(x, z, time, offsetX, offsetZ);
      pos.setY(i, World.seaSurfaceHeight(x, z, time, offsetX, offsetZ, storm, raftRect, h));

      if (!refreshDetail) continue;
      // Gradiente valle -> cresta, estirado para dar contraste: los valles
      // caen al color profundo y las crestas llegan al claro (con el rango
      // lineal anterior casi todo quedaba en el tono medio y el mar se
      // lavaba, sobre todo a mediodía).
      const t = Util.clamp((h + 0.6) * 0.75, 0, 1);
      let r = deep.r + (light.r - deep.r) * t;
      let g = deep.g + (light.g - deep.g) * t;
      let b = deep.b + (light.b - deep.b) * t;
      // Espuma en las crestas (vetas direccionales para que sean parches)
      if (h > foamTh) {
        const sparkle = 0.5 + 0.5 * Math.sin(
          (x + offsetX) * 0.62 - (z + offsetZ) * 0.38 + time * 1.1
        );
        const f = Math.min(1, (h - foamTh) / 0.2) * sparkle * (storm ? 0.75 : 0.4);
        r += (foam.r - r) * f;
        g += (foam.g - g) * f;
        b += (foam.b - b) * f;
      }
      colAttr.setXYZ(i, r, g, b);
    }
    pos.needsUpdate = true;
    if (refreshDetail) {
      colAttr.needsUpdate = true;
      World.seaGeo.computeVertexNormals();
    }

    World.updateHullFoam(raftRect, time, offsetX, offsetZ, storm, refreshDetail);
  },

  // Actualiza iluminación/cielo según la hora del día (0-24)
  updateDayNight: (hour, storm, fogActive, dt = 1 / 60) => {
    const safeDt = Math.max(0, Math.min(Number(dt) || 0, 0.1));
    let a, b, t;
    if (hour < 5 || hour >= 21) { a = b = World.PHASES.night; t = 0; }
    else if (hour < 7) { a = World.PHASES.night; b = World.PHASES.dawn; t = (hour - 5) / 2; }
    else if (hour < 9) { a = World.PHASES.dawn; b = World.PHASES.day; t = (hour - 7) / 2; }
    else if (hour < 17) { a = b = World.PHASES.day; t = 0; }
    else if (hour < 19) { a = World.PHASES.day; b = World.PHASES.dusk; t = (hour - 17) / 2; }
    else { a = World.PHASES.dusk; b = World.PHASES.night; t = (hour - 19) / 2; }

    // Reutilizar colores temporales evita varias asignaciones y pausas de GC
    // por fotograma durante el ciclo dia/noche.
    const sky = World.phaseSky.setHex(a.sky)
      .lerp(World.phaseSkyTarget.setHex(b.sky), t);
    const water = World.phaseWater.setHex(a.water)
      .lerp(World.phaseWaterTarget.setHex(b.water), t);
    const sunC = World.phaseSun.setHex(a.sun)
      .lerp(World.phaseSunTarget.setHex(b.sun), t);
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
    if (storm && safeDt > 0 &&
        Math.random() < 1 - Math.exp(-safeDt / 2.77)) {
      World.lightning = 1;
    }
    if (World.lightning > 0) {
      World.lightning = Math.max(0, World.lightning - safeDt * 3.6);
      ambI += World.lightning * 1.6;
      sky.lerp(World.lightningColor, World.lightning * 0.5);
    }

    World.scene.background.copy(sky);
    World.scene.fog.color.copy(sky);
    const fogBlend = 1 - Math.exp(-safeDt * 4);
    World.scene.fog.near = Util.lerp(World.scene.fog.near, fogNear, fogBlend);
    World.scene.fog.far = Util.lerp(World.scene.fog.far, fogFar, fogBlend);
    if (World.scene.fog.near >= World.scene.fog.far) {
      World.scene.fog.near = Math.max(0, World.scene.fog.far - 12);
    }
    // Colores del agua por vértice: profundo, cresta y espuma
    World.waterDeep.copy(water).multiplyScalar(0.52);
    World.waterLight.copy(water).multiplyScalar(0.95).lerp(sky, 0.07);
    World.foamColor.setHex(0xeaf6ff).lerp(sky, 0.25);
    if (World.seaUniforms) World.seaUniforms.seaSky.value.copy(sky);
    World.sunLight.color.copy(sunC);
    World.sunLight.intensity = sunI;
    World.ambient.intensity = ambI;

    // Posición del sol según la hora. Se limita el cenit para que a
    // mediodía la luz siga entrando con ángulo y el agua no se lave.
    const sunAngle = ((hour - 6) / 12) * Math.PI; // 6h sale, 18h se pone
    const sx = Math.cos(sunAngle) * 30;
    const sy = Math.max(4, Math.sin(sunAngle) * 21);
    World.sunLight.position.set(World.camTarget.x + sx, sy, World.camTarget.z + 12);

    // Estrellas de noche
    const night = (hour < 5.5 || hour > 20);
    const starBlend = 1 - Math.exp(-safeDt * 3.08);
    World.stars.material.opacity = Util.lerp(
      World.stars.material.opacity,
      night && !storm ? 0.9 : 0,
      starBlend
    );
    World.stars.position.set(World.camTarget.x, 0, World.camTarget.z);
  },

  updateRain: (dt, active) => {
    World.rain.visible = active;
    if (!active || dt <= 0) return;
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

  // Malla del protagonista (nombrada 'player' por PlayerVis). Cacheada; se
  // rebusca si desaparece del grafo (por ejemplo al reiniciar partida).
  findPlayerObject: () => {
    if (World.fpPlayerCache && World.fpPlayerCache.parent) {
      return World.fpPlayerCache;
    }
    World.fpPlayerCache =
      World.scene && typeof World.scene.getObjectByName === 'function'
        ? World.scene.getObjectByName('player')
        : null;
    return World.fpPlayerCache;
  },

  enterFirstPerson: () => {
    World.firstPerson = true;
    // Mirar hacia donde miraba la cámara orbital (sentido contrario al offset).
    World.fpYaw = World.cameraYaw + Math.PI;
    World.fpPitch = -0.1;
    // Se ve el cuerpo y se oculta solo la cabeza; si no hay rig, se esconde
    // la malla entera como antes.
    World.fpBodyVisible = typeof PlayerVis !== 'undefined' &&
      PlayerVis.setFirstPerson ? PlayerVis.setFirstPerson(true) : false;
    if (!World.fpBodyVisible) {
      const playerObj = World.findPlayerObject();
      if (playerObj) playerObj.visible = false;
    }
    World.lockPointer();
    World.toggleCrosshair(true);
    // La interfaz adapta los mensajes al modo inmersivo (ver style.css).
    World.setFirstPersonUI(true);
  },

  exitFirstPerson: () => {
    World.firstPerson = false;
    World.cameraZoomTarget = World.CAMERA_MIN_ZOOM;
    if (World.fpBodyVisible) {
      if (typeof PlayerVis !== 'undefined' && PlayerVis.setFirstPerson) {
        PlayerVis.setFirstPerson(false);
      }
    } else {
      const playerObj = World.findPlayerObject();
      if (playerObj) playerObj.visible = true;
    }
    World.fpBodyVisible = false;
    if (World.fpPointerLocked && typeof document !== 'undefined' &&
        document.exitPointerLock) {
      document.exitPointerLock();
    }
    World.toggleCrosshair(false);
    World.setFirstPersonUI(false);
  },

  setFirstPersonUI: active => {
    if (typeof document === 'undefined') return;
    const ui = document.getElementById('ui');
    if (ui) ui.classList.toggle('first-person', active);
  },

  toggleCrosshair: show => {
    if (typeof document === 'undefined') return;
    const crosshair = document.getElementById('fp-crosshair');
    if (crosshair) crosshair.classList.toggle('hidden', !show);
  },

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

    // Q/R ofrecen una alternativa al ratón: en tercera orbitan libremente;
    // en primera persona giran la vista.
    if (typeof Input !== 'undefined') {
      const keyboardTurn = 0.85 * safeDt;
      if (World.firstPerson) {
        if (Input.isDown('KeyQ')) World.fpYaw += keyboardTurn;
        if (Input.isDown('KeyR')) World.fpYaw -= keyboardTurn;
      } else {
        if (Input.isDown('KeyQ')) World.cameraYawTarget -= keyboardTurn;
        if (Input.isDown('KeyR')) World.cameraYawTarget += keyboardTurn;
      }
    }

    const cameraBlend = 1 - Math.exp(-safeDt * 8);
    World.cameraZoom = Util.lerp(World.cameraZoom, World.cameraZoomTarget, cameraBlend);
    World.cameraYaw = Util.lerp(World.cameraYaw, World.cameraYawTarget, cameraBlend);

    // Posición orbital de tercera persona (también es la base de la
    // transición al entrar o salir de primera persona).
    const horizontal = World.camOffset.z * World.cameraZoom;
    const height = World.camOffset.y * World.cameraZoom;
    const offsetX = Math.sin(World.cameraYaw) * horizontal;
    const offsetZ = Math.cos(World.cameraYaw) * horizontal;
    const bob = Math.sin(performance.now() / 1400) * 0.25;
    let camX = World.camTarget.x + offsetX;
    let camY = World.camTarget.y + height + bob;
    let camZ = World.camTarget.z + offsetZ;
    let lookX = World.camTarget.x, lookY = 0, lookZ = World.camTarget.z;
    let roll = 0;

    // Primera persona: la cámara va a los ojos del protagonista, un paso
    // adelante para no ver el cuello por dentro. fpBlend funde órbita y
    // vista; la balsa aporta un leve cabeceo (roll) con las olas.
    const fpTarget = World.firstPerson ? 1 : 0;
    World.fpBlend += (fpTarget - World.fpBlend) * (1 - Math.exp(-safeDt * 5));
    const blend = World.fpBlend * World.fpBlend * (3 - 2 * World.fpBlend);
    // Near/FOV dinámicos: en FP abre el campo; en órbita vuelven a 0.1 / 50.
    const nearTarget = 0.1 + (World.FP_NEAR - 0.1) * blend;
    const fovTarget = 50 + (World.FP_FOV - 50) * blend;
    const nearChanged = typeof World.camera.near === 'number' &&
      Math.abs(World.camera.near - nearTarget) > 0.004;
    const fovChanged = typeof World.camera.fov === 'number' &&
      Math.abs(World.camera.fov - fovTarget) > 0.1;
    if (nearChanged) World.camera.near = nearTarget;
    if (fovChanged) World.camera.fov = fovTarget;
    if ((nearChanged || fovChanged) &&
        typeof World.camera.updateProjectionMatrix === 'function') {
      World.camera.updateProjectionMatrix();
    }
    if (World.fpBlend > 0.002) {
      const playerObj = World.findPlayerObject();
      if (!playerObj || typeof playerObj.getWorldPosition !== 'function') {
        World.exitFirstPerson();
        World.fpBlend = 0;
      } else {
        const head = playerObj.getWorldPosition(World.fpTmp);
        const lookDown = Math.max(0, -World.fpPitch);
        head.y += World.FP_EYE_HEIGHT + lookDown * World.FP_LOOKDOWN_LIFT;
        // Offset corto: si se adelanta más, el cuerpo queda detrás de la cámara.
        const fpForward = World.FP_FORWARD;
        const cosPitch = Math.cos(World.fpPitch);
        const dirX = Math.sin(World.fpYaw) * cosPitch;
        const dirY = Math.sin(World.fpPitch);
        const dirZ = Math.cos(World.fpYaw) * cosPitch;
        const fpX = head.x + Math.sin(World.fpYaw) * fpForward;
        const fpY = head.y;
        const fpZ = head.z + Math.cos(World.fpYaw) * fpForward;
        camX += (fpX - camX) * blend;
        camY += (fpY - camY) * blend;
        camZ += (fpZ - camZ) * blend;
        lookX += (fpX + dirX - lookX) * blend;
        lookY += (fpY + dirY - lookY) * blend;
        lookZ += (fpZ + dirZ - lookZ) * blend;
        const raft = playerObj.parent;
        roll = (raft && raft.rotation ? Number(raft.rotation.z) || 0 : 0) *
          blend;
      }
    }

    // El cabeceo inclina el "arriba" de la cámara alrededor de la vista.
    if (World.camera.up && typeof World.camera.up.set === 'function') {
      World.camera.up.set(
        -Math.cos(World.fpYaw) * Math.sin(roll),
        1,
        Math.sin(World.fpYaw) * Math.sin(roll)
      );
    }
    World.camera.position.set(camX, camY, camZ);
    World.camera.lookAt(lookX, lookY, lookZ);
  },

  // Compatibilidad con llamadas existentes y partidas/pruebas antiguas.
  followCamera: (cx, cz, dt) => {
    World.updateCamera({ x: cx, z: cz }, null, dt);
  },

  // Raycasting desde el ratón al plano del mar (y = 0). En primera persona
  // se apunta con el centro de la vista, no con el cursor.
  raycaster: new THREE.Raycaster(),
  seaPlane: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
  mouseToWorld: (mx, my) => {
    const width = World.canvas ? World.canvas.clientWidth : window.innerWidth;
    const height = World.canvas ? World.canvas.clientHeight : window.innerHeight;
    const aimX = World.firstPerson ? width * 0.5 : mx;
    const aimY = World.firstPerson ? height * 0.5 : my;
    const ndc = new THREE.Vector2(
      (aimX / width) * 2 - 1,
      -(aimY / height) * 2 + 1
    );
    World.raycaster.setFromCamera(ndc, World.camera);
    const out = new THREE.Vector3();
    const hit = World.raycaster.ray.intersectPlane(World.seaPlane, out);
    if (!hit && World.firstPerson) {
      // Mirando al horizonte o al cielo: apuntar a una distancia fija delante.
      out.copy(World.camera.position)
        .addScaledVector(World.raycaster.ray.direction, 6);
      out.y = 0;
    }
    return out; // {x, 0, z}
  },

  render: () => {
    World.renderer.render(World.scene, World.camera);
  }
};
