/*****************************************************
 * hook.js - Sedal, flotador, anzuelo y captura.
 *
 * Usa un buffer fijo: la curva cambia cada fotograma, pero no se crean
 * geometrías nuevas durante el lanzamiento o la recogida.
 *****************************************************/

const HookVis = {
  line: null,
  tip: null,
  hookMetal: null,
  catchMesh: null,
  splash: null,
  lineOrigin: null,
  lineSegments: 16,
  lastState: 'hidden',

  init: scene => {
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
    HookVis.tip.add(floatTop, floatBottom, stem, HookVis.hookMetal, barb);
    HookVis.tip.visible = false;
    scene.add(HookVis.tip);

    HookVis.splash = new THREE.Mesh(
      new THREE.RingGeometry(0.13, 0.2, 14),
      new THREE.MeshBasicMaterial({
        color: 0xb3e5fc,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );
    HookVis.splash.rotation.x = -Math.PI / 2;
    HookVis.splash.visible = false;
    scene.add(HookVis.splash);
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

  show: (px, pz, hx, hz, hook = null) => {
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
    const endpointY = HookVis.getEndpointHeight(hook);
    const horizontalDistance = Math.hypot(hx - originX, hz - originZ);
    const sag = state === 'returning'
      ? Math.min(0.34, horizontalDistance * 0.055)
      : state === 'fishing'
        ? 0.035
        : -0.1;
    const tensionWave = state === 'fishing' ? Math.sin(now * 13) * 0.025 : 0;
    const positions = HookVis.line.geometry.attributes.position;

    for (let index = 0; index < HookVis.lineSegments; index++) {
      const t = index / (HookVis.lineSegments - 1);
      const arc = Math.sin(t * Math.PI);
      positions.setXYZ(
        index,
        originX + (hx - originX) * t,
        originY + (endpointY - originY) * t - arc * sag +
          arc * tensionWave,
        originZ + (hz - originZ) * t
      );
    }
    positions.needsUpdate = true;

    const waterBob = state === 'casting' ? 0 : Math.sin(now * 5.5) * 0.025;
    HookVis.tip.position.set(hx, endpointY + waterBob, hz);
    HookVis.tip.rotation.y = Math.atan2(
      Number(hook?.vx) || hx - px,
      Number(hook?.vz) || hz - pz
    );
    HookVis.tip.rotation.z = state === 'casting'
      ? now * 8
      : Math.sin(now * 4) * 0.08;

    if (HookVis.splash) {
      const atWater = endpointY < 0.5;
      HookVis.splash.visible = atWater;
      if (atWater) {
        const pulse = 0.85 + (Math.sin(now * 7) + 1) * 0.18;
        HookVis.splash.position.set(hx, 0.24, hz);
        HookVis.splash.scale.setScalar(pulse);
        HookVis.splash.material.opacity = state === 'fishing' ? 0.62 : 0.35;
      }
    }

    if (HookVis.catchMesh) {
      HookVis.catchMesh.rotation.z =
        Math.PI / 2 + Math.sin(now * 10) * 0.16;
      const tail = HookVis.catchMesh.userData.tail;
      if (tail) tail.rotation.y = Math.sin(now * 15) * 0.55;
    }
  },

  attachCatch: mesh => {
    if (!mesh || !HookVis.tip) return null;
    HookVis.clearCatch();
    HookVis.tip.add(mesh);
    mesh.visible = true;
    mesh.position.set(0, -0.37, 0);
    mesh.rotation.set(0, 0, Math.PI / 2);
    mesh.scale.multiplyScalar(1.2);
    HookVis.catchMesh = mesh;
    if (HookVis.hookMetal) HookVis.hookMetal.visible = false;
    return mesh;
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
    HookVis.lastState = 'hidden';
    HookVis.clearCatch();
  }
};
