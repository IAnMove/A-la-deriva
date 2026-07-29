/*****************************************************
 * player.js - Figura 3D del náufrago (la lógica de
 * movimiento vive en game.js, como en la versión 2D)
 *****************************************************/

const PlayerVis = {
  mesh: null,
  aimLine: null,
  walkTime: 0,

  init: (raftGroup) => {
    PlayerVis.mesh = makeHumanoidMesh(0x1565c0, { hair: 0x3e2723, pants: 0x4e342e });
    PlayerVis.mesh.position.set(1, 0.35, 1);
    raftGroup.add(PlayerVis.mesh);

    // Línea punteada de apuntado del gancho
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(), new THREE.Vector3()
    ]);
    PlayerVis.aimLine = new THREE.Line(geo, new THREE.LineDashedMaterial({
      color: 0xffffff, transparent: true, opacity: 0.35, dashSize: 0.25, gapSize: 0.2
    }));
    PlayerVis.aimLine.frustumCulled = false;
    raftGroup.add(PlayerVis.aimLine);
  },

  reset: () => {
    PlayerVis.walkTime = 0;
    if (PlayerVis.mesh) PlayerVis.mesh.position.set(1, 0.35, 1);
  },

  // Sincroniza la figura con el estado del jugador (con animación de extremidades)
  sync: (p, dt, time) => {
    const m = PlayerVis.mesh;
    if (!m) return;
    const parts = m.userData.parts;
    const moving = Math.abs(p.vx) > 0.01 || Math.abs(p.vz) > 0.01;

    if (moving) {
      PlayerVis.walkTime += dt * 9;
      m.rotation.y = Math.atan2(p.vx, p.vz);
    }
    const swing = moving ? Math.sin(PlayerVis.walkTime) : 0;
    // Rebote al caminar; respiración en reposo
    const bob = moving ? Math.abs(Math.sin(PlayerVis.walkTime)) * 0.08 : Math.sin(time * 2) * 0.015;
    m.position.set(p.x, 0.35 + bob, p.z);

    if (p.rowTarget) {
      // Postura de remo: inclinado hacia adelante, brazos al agua
      m.rotation.x = 0.3;
      const rowSwing = Math.sin(time * 8) * 0.35;
      parts.armL.rotation.x = -1.1 + rowSwing;
      parts.armR.rotation.x = -1.1 + rowSwing;
      parts.legL.rotation.x = 0;
      parts.legR.rotation.x = 0;
    } else if (p.hook && !p.hook.returning) {
      // Lanzando el gancho: brazo derecho en alto
      m.rotation.x = 0;
      parts.armR.rotation.x = -1.6;
      parts.armL.rotation.x = 0.2;
      parts.legL.rotation.x = 0;
      parts.legR.rotation.x = 0;
    } else {
      m.rotation.x = moving ? 0.08 : 0;
      parts.armL.rotation.x = moving ? swing * 0.7 : Math.sin(time * 2) * 0.05;
      parts.armR.rotation.x = moving ? -swing * 0.7 : Math.cos(time * 2) * 0.05;
      parts.legL.rotation.x = moving ? -swing * 0.6 : 0;
      parts.legR.rotation.x = moving ? swing * 0.6 : 0;
    }
    m.rotation.z = 0;
  },

  // Actualiza la línea de apuntado hacia el cursor del mundo
  updateAim: (p, target) => {
    if (!PlayerVis.aimLine) return;
    if (!target) { PlayerVis.aimLine.visible = false; return; }
    PlayerVis.aimLine.visible = true;
    const pos = PlayerVis.aimLine.geometry.attributes.position;
    const dx = target.x - p.x;
    const dz = target.z - p.z;
    const len = Math.hypot(dx, dz) || 1;
    const aimLen = Math.min(len, 2.2);
    pos.setXYZ(0, p.x, 1.0, p.z);
    pos.setXYZ(1, p.x + (dx / len) * aimLen, 1.0, p.z + (dz / len) * aimLen);
    pos.needsUpdate = true;
    PlayerVis.aimLine.computeLineDistances();
  }
};
