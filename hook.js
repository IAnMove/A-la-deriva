/*****************************************************
 * hook.js - Sedal, flotador, anzuelo y captura.
 *
 * Usa un buffer fijo: la curva cambia cada fotograma, pero no se crean
 * geometrías nuevas durante el lanzamiento o la recogida.
 *****************************************************/

const HookVis = {
  scene: null,
  line: null,
  tip: null,
  hookMetal: null,
  catchMesh: null,
  struggleFish: null,
  splash: null,
  outerRipple: null,
  lineOrigin: null,
  lineSegments: 16,
  lastState: 'hidden',
  leapingCatches: [],
  lastLeapPeak: 0,

  makeFallbackFish: () => {
    if (typeof makeFishMesh === 'function') {
      return makeFishMesh(0.56, Math.floor(Math.random() * 3));
    }
    const fish = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.26, 8, 6),
      mat(0x29b6f6)
    );
    body.scale.set(0.45, 0.36, 0.92);
    const tailPivot = new THREE.Group();
    tailPivot.name = 'fish-tail';
    tailPivot.position.z = -0.2;
    const tail = new THREE.Mesh(
      new THREE.ConeGeometry(0.14, 0.24, 3),
      mat(0x0277bd)
    );
    tail.rotation.x = Math.PI / 2;
    tail.position.z = -0.1;
    tailPivot.add(tail);
    fish.add(body, tailPivot);
    fish.userData.tail = tailPivot;
    return fish;
  },

  init: scene => {
    HookVis.scene = scene;
    HookVis.leapingCatches = [];
    const positions = new Float32Array(HookVis.lineSegments * 3);
    const geometry = new THREE.BufferGeometry();
    const attribute = new THREE.BufferAttribute(positions, 3);
    if (attribute.setUsage && THREE.DynamicDrawUsage) {
      attribute.setUsage(THREE.DynamicDrawUsage);
    }
    geometry.setAttribute('position', attribute);
    HookVis.line = new THREE.Line(
      geometry,
      new THREE.LineBasicMaterial({
        color: 0xeceff1,
        transparent: true,
        opacity: 0.86,
        depthWrite: false
      })
    );
    HookVis.line.frustumCulled = false;
    HookVis.line.visible = false;
    scene.add(HookVis.line);

    HookVis.tip = new THREE.Group();
    HookVis.tip.name = 'hook-and-float';
    const floatTop = new THREE.Mesh(
      new THREE.SphereGeometry(0.095, 7, 5),
      mat(0xef5350)
    );
    floatTop.scale.y = 1.25;
    floatTop.position.y = 0.045;
    const floatBottom = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 7, 5),
      mat(0xf5f5f5)
    );
    floatBottom.scale.y = 0.8;
    floatBottom.position.y = -0.045;
    const stem = cyl(0.018, 0.018, 0.22, 0x263238, 0, -0.12, 0, 6);
    HookVis.hookMetal = new THREE.Mesh(
      new THREE.TorusGeometry(0.09, 0.023, 5, 10, Math.PI * 1.55),
      mat(0x78909c)
    );
    HookVis.hookMetal.rotation.z = -0.35;
    HookVis.hookMetal.position.set(0.04, -0.29, 0);
    const barb = new THREE.Mesh(
      new THREE.ConeGeometry(0.032, 0.1, 5),
      mat(0x78909c)
    );
    barb.position.set(-0.035, -0.29, 0);
    barb.rotation.z = -0.65;

    HookVis.struggleFish = HookVis.makeFallbackFish();
    HookVis.struggleFish.name = 'struggle-fish';
    HookVis.struggleFish.position.set(0, -0.18, 0);
    HookVis.struggleFish.visible = false;

    HookVis.tip.add(floatTop, floatBottom, stem, HookVis.hookMetal, barb, HookVis.struggleFish);
    HookVis.tip.visible = false;
    scene.add(HookVis.tip);

    HookVis.splash = new THREE.Mesh(
      new THREE.RingGeometry(0.13, 0.22, 16),
      new THREE.MeshBasicMaterial({
        color: 0xb3e5fc,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );
    HookVis.splash.rotation.x = -Math.PI / 2;
    HookVis.splash.visible = false;
    scene.add(HookVis.splash);

    HookVis.outerRipple = new THREE.Mesh(
      new THREE.RingGeometry(0.26, 0.36, 18),
      new THREE.MeshBasicMaterial({
        color: 0xe1f5fe,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );
    HookVis.outerRipple.rotation.x = -Math.PI / 2;
    HookVis.outerRipple.visible = false;
    scene.add(HookVis.outerRipple);

    HookVis.lineOrigin = new THREE.Vector3();
  },

  getState: hook => {
    if (hook?.fishing) return 'fishing';
    if (hook?.returning) return 'returning';
    return 'casting';
  },

  getEndpointHeight: hook => {
    const state = HookVis.getState(hook);
    if (state !== 'casting') return 0.38;
    const range = Math.max(0.001, Number(hook?.maxRange) || 1);
    const progress = Math.max(
      0,
      Math.min(1, (Number(hook?.distance) || 0) / range)
    );
    return 0.38 + Math.sin(progress * Math.PI) * 1.15;
  },

  show: (px, pz, hx, hz, hook = null, waterTime = null) => {
    if (!HookVis.line || !HookVis.tip) return;
    HookVis.line.visible = true;
    HookVis.tip.visible = true;
    const state = HookVis.getState(hook);
    HookVis.lastState = state;
    const now = (
      typeof performance !== 'undefined' ? performance.now() : Date.now()
    ) * 0.001;
    const rodTip = typeof PlayerVis !== 'undefined'
      ? PlayerVis.getRodTipWorld(HookVis.lineOrigin)
      : null;
    const originX = rodTip ? rodTip.x : px;
    const originY = rodTip ? rodTip.y : 1.0;
    const originZ = rodTip ? rodTip.z : pz;

    // El pez tira de la boya durante el minijuego: la arrastra alrededor del
    // punto de caída y la hunde con cada tirón (y con cada tirón del pescador).
    const fishing = typeof Game !== 'undefined' && Game.fishing?.active &&
      hook?.fishing ? Game.fishing : null;
    let displayX = hx, displayZ = hz, dive = 0;
    if (fishing) {
      const seed = fishing.hits * 2.39 + fishing.misses * 1.31;
      const pull = 0.55 + 0.45 * Math.sin(now * 0.6 + seed);
      const radius = 0.3 + 0.55 * pull;
      displayX += Math.sin(now * 1.7 + seed) * Math.sin(now * 0.43 + 1.2) *
        radius;
      displayZ += Math.cos(now * 1.3 + seed * 2) * Math.sin(now * 0.51 + 0.4) *
        radius;
      const recentPull = fishing.feedbackTimer > 0
        ? fishing.feedbackTimer / 0.38
        : 0;
      const nibble = Math.pow(Math.max(0, Math.sin(now * 2.1 + seed)), 3) *
        0.14;
      dive = recentPull * 0.45 + nibble * (0.4 + 0.6 * pull);
    }

    // La boya cabalga la ola real del punto donde cayó.
    let waveY = 0;
    if (typeof World !== 'undefined' && World.waveHeight &&
        typeof waterTime === 'number') {
      const offX = typeof Game !== 'undefined' ? Game.worldOffset || 0 : 0;
      const offZ = typeof Game !== 'undefined' ? Game.worldOffsetZ || 0 : 0;
      waveY = World.waveHeight(displayX, displayZ, waterTime, offX, offZ) *
        (World.waveAmp || 0.5);
    }
    let endpointY = HookVis.getEndpointHeight(hook);
    if (fishing) endpointY = waveY + 0.12 - dive;

    const horizontalDistance = Math.hypot(hx - originX, hz - originZ);
    const hasCaughtFish = state === 'returning' && !!(HookVis.catchMesh || hook?.hasCatch);
    if (hasCaughtFish) {
      const startDist = Math.max(1.2, Number(hook?.catchStartDist) || 5);
      const reelProgress = 1 - Math.max(0, Math.min(1, horizontalDistance / startDist));
      const leapArc = Math.sin(reelProgress * Math.PI) * 1.18 + reelProgress * 0.42;
      endpointY = Math.max(0.38, waveY + 0.32 + leapArc);
      HookVis.lastLeapPeak = Math.max(HookVis.lastLeapPeak, endpointY);
    }

    const sag = state === 'returning'
      ? (hasCaughtFish ? -0.08 : Math.min(0.34, horizontalDistance * 0.055))
      : state === 'fishing'
        ? 0.035
        : -0.1;
    const tensionWave = state === 'fishing'
      ? Math.sin(now * 13) * (0.025 + dive * 0.08)
      : 0;
    const positions = HookVis.line.geometry.attributes.position;

    for (let index = 0; index < HookVis.lineSegments; index++) {
      const t = index / (HookVis.lineSegments - 1);
      const arc = Math.sin(t * Math.PI);
      positions.setXYZ(
        index,
        originX + (displayX - originX) * t,
        originY + (endpointY - originY) * t - arc * sag +
          arc * tensionWave,
        originZ + (displayZ - originZ) * t
      );
    }
    positions.needsUpdate = true;

    const waterBob = state === 'casting' || fishing || hasCaughtFish
      ? 0
      : Math.sin(now * 5.5) * 0.025;
    HookVis.tip.position.set(displayX, endpointY + waterBob, displayZ);
    HookVis.tip.rotation.y = Math.atan2(
      Number(hook?.vx) || hx - px,
      Number(hook?.vz) || hz - pz
    );
    HookVis.tip.rotation.z = state === 'casting'
      ? now * 8
      : Math.sin(now * 4) * (0.08 + dive * 0.6);

    if (HookVis.struggleFish) {
      HookVis.struggleFish.visible = state === 'fishing';
      if (state === 'fishing') {
        HookVis.struggleFish.position.set(
          Math.sin(now * 6.5) * 0.12,
          -0.14 + Math.sin(now * 9.0) * 0.06,
          Math.cos(now * 5.2) * 0.12
        );
        HookVis.struggleFish.rotation.set(
          Math.sin(now * 8) * 0.28,
          now * 4.5 + Math.sin(now * 11) * 0.5,
          Math.cos(now * 7) * 0.22
        );
        const sTail = HookVis.struggleFish.userData?.tail;
        if (sTail) sTail.rotation.y = Math.sin(now * 22) * 0.7;
      }
    }

    if (HookVis.splash) {
      const atWater = endpointY < 0.65;
      HookVis.splash.visible = atWater;
      if (atWater) {
        const pulse = 0.85 + (Math.sin(now * 7) + 1) * 0.18 + dive * 0.9;
        HookVis.splash.position.set(
          displayX,
          fishing ? waveY + 0.06 : 0.24,
          displayZ
        );
        HookVis.splash.scale.setScalar(pulse);
        HookVis.splash.material.opacity = state === 'fishing'
          ? Math.min(0.92, 0.65 + dive)
          : 0.35;
      }
    }

    if (HookVis.outerRipple) {
      HookVis.outerRipple.visible = state === 'fishing';
      if (state === 'fishing') {
        const ripplePhase = (now * 1.8) % 1;
        HookVis.outerRipple.position.set(displayX, waveY + 0.05, displayZ);
        HookVis.outerRipple.scale.setScalar(0.8 + ripplePhase * 1.9 + dive * 0.8);
        HookVis.outerRipple.material.opacity = (1 - ripplePhase) * 0.55;
      }
    }

    if (HookVis.catchMesh) {
      HookVis.catchMesh.rotation.z =
        Math.PI / 2 + Math.sin(now * 14) * 0.28;
      HookVis.catchMesh.rotation.x = Math.cos(now * 11) * 0.22;
      const tail = HookVis.catchMesh.userData.tail;
      if (tail) tail.rotation.y = Math.sin(now * 24) * 0.72;
    }
  },

  attachCatch: mesh => {
    if (!mesh || !HookVis.tip) return null;
    HookVis.clearCatch();
    HookVis.tip.add(mesh);
    mesh.visible = true;
    mesh.position.set(0, -0.14, 0);
    mesh.rotation.set(0, 0, Math.PI / 2);
    mesh.scale.multiplyScalar(1.38);
    HookVis.catchMesh = mesh;
    if (HookVis.hookMetal) HookVis.hookMetal.visible = false;
    return mesh;
  },

  launchLeapingFish: (startX, startZ, targetX, targetZ) => {
    if (!HookVis.scene) return null;
    const mesh = HookVis.makeFallbackFish();
    mesh.scale.multiplyScalar(1.45);
    mesh.position.set(startX, 0.35, startZ);
    HookVis.scene.add(mesh);
    const entry = {
      mesh,
      startX,
      startZ,
      targetX,
      targetZ,
      elapsed: 0,
      duration: 0.88,
      peakY: 1.85,
      dropTimer: 0
    };
    HookVis.leapingCatches.push(entry);
    HookVis.lastLeapPeak = Math.max(HookVis.lastLeapPeak, entry.peakY);
    if (typeof Particles !== 'undefined' && Particles.emit) {
      Particles.emit(startX, 0.35, startZ, '#b3e5fc', 16, 3.8);
    }
    return entry;
  },

  updateLeapingCatches: (dt, player = null) => {
    if (!HookVis.leapingCatches || HookVis.leapingCatches.length === 0) return;
    const safeDt = Math.max(0, Math.min(Number(dt) || 0, 1.0));
    for (let i = HookVis.leapingCatches.length - 1; i >= 0; i--) {
      const item = HookVis.leapingCatches[i];
      item.elapsed += safeDt;
      const t = Math.min(1, item.elapsed / item.duration);
      const endX = player ? player.x : item.targetX;
      const endZ = player ? player.z : item.targetZ;
      const x = item.startX + (endX - item.startX) * t;
      const z = item.startZ + (endZ - item.startZ) * t;
      const baseHeight = 0.35 + (1.05 - 0.35) * t;
      const arc = Math.sin(t * Math.PI) * (item.peakY - 0.55);
      const y = baseHeight + arc;
      item.mesh.position.set(x, y, z);
      const heading = Math.atan2(endX - item.startX, endZ - item.startZ);
      item.mesh.rotation.set(
        (0.5 - t) * 1.4,
        heading + Math.sin(item.elapsed * 16) * 0.22,
        Math.sin(item.elapsed * 20) * 0.35
      );
      const tail = item.mesh.userData?.tail;
      if (tail) tail.rotation.y = Math.sin(item.elapsed * 28) * 0.8;
      item.dropTimer += safeDt;
      if (item.dropTimer >= 0.12 && t < 0.85 &&
          typeof Particles !== 'undefined' && Particles.emit) {
        item.dropTimer = 0;
        Particles.emit(x, y, z, '#e1f5fe', 3, 1.2);
      }
      if (t >= 1) {
        if (typeof Particles !== 'undefined' && Particles.emit) {
          Particles.emit(endX, 1.05, endZ, '#80deea', 8, 2.2);
        }
        item.mesh.removeFromParent();
        HookVis.leapingCatches.splice(i, 1);
      }
    }
  },

  clearCatch: () => {
    if (HookVis.catchMesh) {
      HookVis.catchMesh.removeFromParent();
      HookVis.catchMesh.visible = false;
      HookVis.catchMesh = null;
    }
    if (HookVis.hookMetal) HookVis.hookMetal.visible = true;
  },

  hide: () => {
    if (HookVis.line) HookVis.line.visible = false;
    if (HookVis.tip) HookVis.tip.visible = false;
    if (HookVis.splash) HookVis.splash.visible = false;
    if (HookVis.outerRipple) HookVis.outerRipple.visible = false;
    if (HookVis.struggleFish) HookVis.struggleFish.visible = false;
    HookVis.lastState = 'hidden';
    HookVis.clearCatch();
  }
};
