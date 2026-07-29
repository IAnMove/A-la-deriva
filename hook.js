/*****************************************************
 * hook.js - Visualización 3D del gancho/cuerda
 * (la lógica de lanzamiento y colisión vive en game.js)
 *****************************************************/

const HookVis = {
  line: null,
  tip: null,

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
  },

  show: (px, pz, hx, hz) => {
    HookVis.line.visible = true;
    HookVis.tip.visible = true;
    const pos = HookVis.line.geometry.attributes.position;
    pos.setXYZ(0, px, 1.0, pz);
    pos.setXYZ(1, hx, 0.35, hz);
    pos.needsUpdate = true;
    HookVis.tip.position.set(hx, 0.35, hz);
  },

  hide: () => {
    if (HookVis.line) HookVis.line.visible = false;
    if (HookVis.tip) HookVis.tip.visible = false;
  }
};
