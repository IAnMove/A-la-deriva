/*****************************************************
 * player.js - Figura 3D del náufrago (la lógica de
 * movimiento vive en game.js, como en la versión 2D)
 *****************************************************/

const PlayerVis = {
  mesh: null,
  aimLine: null,
  rod: null,
  rodTip: null,
  walkTime: 0,
  castTime: 99,
  castDuration: 0.62,
  castTarget: null,
  lastHook: null,

  init: (raftGroup) => {
    PlayerVis.mesh = makeHumanoidMesh(0x1565c0, { hair: 0x3e2723, pants: 0x4e342e });
    PlayerVis.mesh.position.set(1, 0.35, 1);
    raftGroup.add(PlayerVis.mesh);

    // Caña low-poly unida a la mano derecha. El brazo actúa como pivote para
    // que la preparación y el latigazo del lanzamiento sean legibles.
    const armR = PlayerVis.mesh.userData.parts.armR;
    PlayerVis.rod = new THREE.Group();
    PlayerVis.rod.position.set(0, -0.34, 0);
    const handle = cyl(0.045, 0.05, 0.28, 0x5d4037, 0, -0.12, 0, 7);
    const shaft = cyl(0.022, 0.04, 0.95, 0x37474f, 0, -0.72, 0, 7);
    const guide = new THREE.Mesh(
      new THREE.TorusGeometry(0.055, 0.012, 5, 10),
      mat(0xb0bec5)
    );
    guide.position.y = -1.16;
    guide.rotation.x = Math.PI / 2;
    PlayerVis.rodTip = new THREE.Object3D();
    PlayerVis.rodTip.position.set(0, -1.22, 0);
    PlayerVis.rod.add(handle, shaft, guide, PlayerVis.rodTip);
    PlayerVis.rod.visible = false;
    armR.add(PlayerVis.rod);

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
    PlayerVis.castTime = 99;
    PlayerVis.castTarget = null;
    PlayerVis.lastHook = null;
    if (PlayerVis.rod) PlayerVis.rod.visible = false;
    if (PlayerVis.mesh) PlayerVis.mesh.position.set(1, 0.35, 1);
  },

  // Puede llamarse desde Game.castHook(target). sync() también detecta nuevos
  // ganchos para mantener compatibilidad si no se llama explícitamente.
  beginCast: (target) => {
    PlayerVis.castTime = 0;
    PlayerVis.castTarget = target
      ? { x: target.x, z: target.z }
      : null;
    if (PlayerVis.rod) PlayerVis.rod.visible = true;
  },

  getRodTipWorld: (out) => {
    if (!PlayerVis.rodTip || !PlayerVis.rod || !PlayerVis.rod.visible) return null;
    PlayerVis.mesh.updateMatrixWorld(true);
    return PlayerVis.rodTip.getWorldPosition(out || new THREE.Vector3());
  },

  // Sincroniza la figura con el estado del jugador (con animación de extremidades)
  sync: (p, dt, time) => {
    const m = PlayerVis.mesh;
    if (!m) return;
    const parts = m.userData.parts;
    const moving = Math.abs(p.vx) > 0.01 || Math.abs(p.vz) > 0.01;

    if (p.hook && p.hook !== PlayerVis.lastHook) {
      PlayerVis.lastHook = p.hook;
      PlayerVis.beginCast({ x: p.hook.x + p.hook.vx, z: p.hook.z + p.hook.vz });
    } else if (!p.hook) {
      PlayerVis.lastHook = null;
    }
    PlayerVis.castTime += dt;

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
      if (PlayerVis.rod) PlayerVis.rod.visible = false;
      const rowSwing = Math.sin(time * 8) * 0.35;
      parts.armL.rotation.x = -1.1 + rowSwing;
      parts.armR.rotation.x = -1.1 + rowSwing;
      parts.legL.rotation.x = 0;
      parts.legR.rotation.x = 0;
    } else if (p.hook) {
      const aimX = p.hook.x - p.x;
      const aimZ = p.hook.z - p.z;
      if (Math.hypot(aimX, aimZ) > 0.05) m.rotation.y = Math.atan2(aimX, aimZ);
      m.rotation.x = 0;
      if (PlayerVis.rod) PlayerVis.rod.visible = true;

      const castT = Math.min(1, PlayerVis.castTime / PlayerVis.castDuration);
      if (castT < 0.32) {
        // Preparación: lleva la caña detrás del hombro.
        const t = castT / 0.32;
        parts.armR.rotation.x = -0.75 + t * 1.5;
        parts.armL.rotation.x = 0.25;
        m.rotation.z = -0.08 * t;
      } else if (castT < 0.68) {
        // Latigazo de lanzamiento.
        const t = (castT - 0.32) / 0.36;
        const eased = 1 - Math.pow(1 - t, 3);
        parts.armR.rotation.x = 0.75 - eased * 2.45;
        parts.armL.rotation.x = 0.25 - eased * 0.45;
        m.rotation.z = -0.08 + eased * 0.13;
      } else if (p.hook.fishing) {
        // Mantiene tensión mientras el mundo está pausado por el minijuego.
        const struggle = Math.sin(time * 11);
        parts.armR.rotation.x = -1.05 + struggle * 0.22;
        parts.armL.rotation.x = -0.75 - struggle * 0.16;
        m.rotation.x = 0.08 + Math.max(0, struggle) * 0.05;
        m.rotation.z = struggle * 0.035;
      } else if (p.hook.returning) {
        // Pequeños tirones al recoger el sedal.
        parts.armR.rotation.x = -1.15 + Math.sin(time * 10) * 0.13;
        parts.armL.rotation.x = -0.55 + Math.cos(time * 10) * 0.1;
      } else {
        parts.armR.rotation.x = -1.35;
        parts.armL.rotation.x = -0.15;
      }
      parts.legL.rotation.x = 0;
      parts.legR.rotation.x = 0;
    } else {
      if (PlayerVis.rod) PlayerVis.rod.visible = PlayerVis.castTime < PlayerVis.castDuration;
      m.rotation.x = moving ? 0.08 : 0;
      parts.armL.rotation.x = moving ? swing * 0.7 : Math.sin(time * 2) * 0.05;
      parts.armR.rotation.x = moving ? -swing * 0.7 : Math.cos(time * 2) * 0.05;
      parts.legL.rotation.x = moving ? -swing * 0.6 : 0;
      parts.legR.rotation.x = moving ? swing * 0.6 : 0;
    }
    if (!p.hook || PlayerVis.castTime >= PlayerVis.castDuration) m.rotation.z = 0;
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
