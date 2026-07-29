/*****************************************************
 * hook.js - Visualización 3D del gancho/cuerda
 * (la lógica de lanzamiento y colisión vive en game.js)
 *****************************************************/

const HookVis = {
  line: null,
  tip: null,
  catchMesh: null,
  lineOrigin: null,

  init: (scene) => {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(), new THREE.Vector3()
    ]);
    HookVis.line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xd7ccc8 }));
    HookVis.line.frustumCulled = false;
    HookVis.line.visible = false;
    scene.add(HookVis.line);

    HookVis.tip = new THREE.Group();
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 6), mat(0x78909c));
    HookVis.tip.add(ball);
    const claw = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 4), mat(0x546e7a));
    claw.rotation.x = Math.PI;
    claw.position.y = -0.18;
    HookVis.tip.add(claw);
    HookVis.tip.visible = false;
    scene.add(HookVis.tip);
    HookVis.lineOrigin = new THREE.Vector3();
  },

  show: (px, pz, hx, hz) => {
    HookVis.line.visible = true;
    HookVis.tip.visible = true;
    const pos = HookVis.line.geometry.attributes.position;
    const rodTip = typeof PlayerVis !== 'undefined'
      ? PlayerVis.getRodTipWorld(HookVis.lineOrigin)
      : null;
    if (rodTip) pos.setXYZ(0, rodTip.x, rodTip.y, rodTip.z);
    else pos.setXYZ(0, px, 1.0, pz);
    pos.setXYZ(1, hx, 0.35, hz);
    pos.needsUpdate = true;
    HookVis.tip.position.set(hx, 0.35, hz);

    if (HookVis.catchMesh) {
      const now = (typeof performance !== 'undefined' ? performance.now() : Date.now()) * 0.001;
      HookVis.catchMesh.rotation.z = Math.PI / 2 + Math.sin(now * 10) * 0.16;
      const tail = HookVis.catchMesh.userData.tail;
      if (tail) tail.rotation.y = Math.sin(now * 15) * 0.55;
    }
  },

  // Conecta al anzuelo cualquier modelo extraído. Para peces:
  // HookVis.attachCatch(bank.takeFishVisual()).
  attachCatch: (mesh) => {
    if (!mesh || !HookVis.tip) return null;
    HookVis.clearCatch();
    HookVis.tip.add(mesh);
    mesh.visible = true;
    mesh.position.set(0, -0.34, 0);
    mesh.rotation.set(0, 0, Math.PI / 2);
    mesh.scale.multiplyScalar(1.2);
    HookVis.catchMesh = mesh;
    return mesh;
  },

  clearCatch: () => {
    if (!HookVis.catchMesh) return;
    HookVis.catchMesh.removeFromParent();
    HookVis.catchMesh.visible = false;
    HookVis.catchMesh = null;
  },

  hide: () => {
    if (HookVis.line) HookVis.line.visible = false;
    if (HookVis.tip) HookVis.tip.visible = false;
    HookVis.clearCatch();
  }
};
