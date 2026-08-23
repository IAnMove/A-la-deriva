/*****************************************************
 * player.js - Modelo y animación del jugador.
 *
 * La simulación sigue viviendo fuera de este archivo. Aquí solo se traducen
 * velocidad, remo y estado del anzuelo a poses legibles.
 *****************************************************/

const PlayerVis = {
  mesh: null,
  aimLine: null,
  rod: null,
  rodTip: null,
  reel: null,
  reelCrank: null,
  rodSegments: [],
  walkTime: 0,
  castTime: 99,
  castDuration: 0.9,
  castTarget: null,
  lastHook: null,
  tugTime: 0,
  tugSuccess: true,
  pose: 'idle',
  glbRig: null,

  // Ajuste de posición de la caña respecto al hueso RightHand del rig GLB.
  rodGripOffset: null,

  ease: t => {
    const safe = Math.max(0, Math.min(1, t));
    return safe * safe * (3 - 2 * safe);
  },

  mix: (a, b, t) => a + (b - a) * PlayerVis.ease(t),

  addPlayerDetails: parts => {
    // Chaleco salvavidas: da identidad al protagonista y mantiene una silueta
    // naranja reconocible incluso con lluvia, noche o niebla.
    const vest = new THREE.Group();
    vest.name = 'player-life-vest';
    vest.add(
      box(0.17, 0.39, 0.045, 0xff8f00, -0.115, 0.64, 0.155),
      box(0.17, 0.39, 0.045, 0xff8f00, 0.115, 0.64, 0.155),
      box(0.045, 0.37, 0.05, 0xffca28, 0, 0.63, 0.18),
      box(0.43, 0.055, 0.05, 0xffca28, 0, 0.48, 0.18)
    );
    PlayerVis.mesh.add(vest);

    // Gorra de marinero low-poly.
    const crown = cyl(0.17, 0.19, 0.12, 0xe3f2fd, 0, 0.2, 0, 8);
    const brim = box(0.28, 0.025, 0.2, 0x1565c0, 0, 0.145, 0.1);
    parts.head.add(crown, brim);

    // Pequeña bolsa de herramientas a la espalda.
    const pouch = box(0.27, 0.28, 0.12, 0x6d4c41, -0.16, 0.58, -0.19);
    pouch.rotation.z = 0.08;
    PlayerVis.mesh.add(pouch);
  },

  makeRod: hand => {
    const rod = new THREE.Group();
    rod.name = 'fishing-rod';
    rod.position.set(0, -0.015, 0.015);
    rod.rotation.z = -0.08;

    const handle = cyl(0.045, 0.052, 0.3, 0x5d4037, 0, -0.13, 0, 8);
    const gripTop = cyl(0.052, 0.052, 0.05, 0x263238, 0, 0.025, 0, 8);
    rod.add(handle, gripTop);

    const reel = new THREE.Group();
    reel.name = 'fishing-reel';
    reel.position.set(-0.095, -0.24, 0.015);
    const spool = new THREE.Mesh(
      new THREE.CylinderGeometry(0.085, 0.085, 0.1, 10),
      mat(0xb0bec5)
    );
    spool.rotation.z = Math.PI / 2;
    spool.castShadow = true;
    const reelCore = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.13, 8),
      mat(0x455a64)
    );
    reelCore.rotation.z = Math.PI / 2;
    reel.add(spool, reelCore);
    rod.add(reel);

    const crank = new THREE.Group();
    crank.position.set(-0.16, -0.24, 0.015);
    crank.add(
      box(0.035, 0.17, 0.035, 0x37474f, 0, -0.065, 0),
      cyl(0.035, 0.035, 0.08, 0x5d4037, 0, -0.17, 0, 7)
    );
    rod.add(crank);

    // Tres tramos anidados permiten flexionar la caña sin regenerar geometría.
    const lengths = [0.38, 0.36, 0.34];
    const radii = [
      [0.025, 0.035],
      [0.017, 0.026],
      [0.009, 0.018]
    ];
    const segments = [];
    let parent = rod;
    let offset = -0.28;
    lengths.forEach((length, index) => {
      const pivot = new THREE.Group();
      pivot.position.y = offset;
      pivot.name = `rod-segment-${index + 1}`;
      const shaft = cyl(
        radii[index][0],
        radii[index][1],
        length,
        index === 2 ? 0x263238 : 0x37474f,
        0,
        -length * 0.5,
        0,
        7
      );
      const guide = new THREE.Mesh(
        new THREE.TorusGeometry(0.042 - index * 0.008, 0.009, 5, 9),
        mat(0xcfd8dc)
      );
      guide.position.y = -length;
      guide.rotation.x = Math.PI / 2;
      guide.castShadow = true;
      pivot.add(shaft, guide);
      parent.add(pivot);
      segments.push(pivot);
      parent = pivot;
      offset = -length;
    });

    const tip = new THREE.Object3D();
    tip.name = 'rod-tip';
    tip.position.y = -lengths[lengths.length - 1];
    parent.add(tip);

    hand.add(rod);
    PlayerVis.rod = rod;
    PlayerVis.rodTip = tip;
    PlayerVis.reel = reel;
    PlayerVis.reelCrank = crank;
    PlayerVis.rodSegments = segments;
    rod.visible = false;
  },

  init: raftGroup => {
    PlayerVis.mesh = makeHumanoidMesh(0x1565c0, {
      hair: 0x3e2723,
      pants: 0x4e342e
    });
    PlayerVis.mesh.name = 'player';
    PlayerVis.mesh.position.set(1, 0.35, 1);
    PlayerVis.mesh.scale.setScalar(1.08);
    raftGroup.add(PlayerVis.mesh);

    const parts = PlayerVis.mesh.userData.parts;
    PlayerVis.addPlayerDetails(parts);
    PlayerVis.makeRod(parts.handR || parts.armR);

    const positions = new Float32Array(6);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.LineDashedMaterial({
      color: 0xe3f2fd,
      transparent: true,
      opacity: 0.48,
      dashSize: 0.24,
      gapSize: 0.17,
      depthWrite: false
    });
    PlayerVis.aimLine = new THREE.Line(geometry, material);
    PlayerVis.aimLine.frustumCulled = false;
    PlayerVis.aimLine.visible = false;
    raftGroup.add(PlayerVis.aimLine);
    PlayerVis.reset();

    // Si el náufrago generado (Meshy GLB) está disponible, sustituye al
    // humanoide de cajas. El procedural queda como reserva y para los tests.
    if (typeof NaufragoGLB !== 'undefined' && NaufragoGLB.load) {
      NaufragoGLB.load().then(gltf => {
        if (gltf) PlayerVis.adoptGlb(gltf);
      });
      // La biblioteca de la tripulación carga en segundo plano.
      if (NaufragoGLB.loadCrew) NaufragoGLB.loadCrew();
    }
  },

  adoptGlb: gltf => {
    const group = gltf.scene || (gltf.scenes && gltf.scenes[0]);
    if (!group || !PlayerVis.mesh) return;
    group.name = 'player-glb';
    const bounds = new THREE.Box3().setFromObject(group);
    const height = Math.max(0.01, bounds.max.y - bounds.min.y);
    const scale = 1.24 / height; // misma altura que el humanoide de cajas
    group.scale.setScalar(scale);
    group.position.y = -bounds.min.y * scale;
    group.traverse(obj => {
      if (obj.isMesh || obj.isSkinnedMesh) {
        obj.castShadow = true;
        obj.frustumCulled = false;
      }
    });
    PlayerVis.mesh.add(group);
    PlayerVis.mesh.children.forEach(child => {
      if (child !== group) child.visible = false;
    });

    PlayerVis.glbRig = NaufragoGLB.createRig(group, gltf.animations || []);
    PlayerVis.glbRig.play('Idle');
    PlayerVis.rodGripOffset = new THREE.Vector3(0, -0.02, 0.03);

    // La caña deja el brazo procedural y pasa a seguir el hueso de la mano.
    if (PlayerVis.rod && PlayerVis.rod.parent) {
      PlayerVis.rod.parent.remove(PlayerVis.rod);
      PlayerVis.mesh.add(PlayerVis.rod);
    }
  },

  syncGlb: (p, dt, time, moving, casting) => {
    const rig = PlayerVis.glbRig;
    const rowing = (p.rowAnim || 0) > 0;
    const tug = PlayerVis.tugTime > 0;

    if (rowing) {
      PlayerVis.pose = 'rowing';
      rig.play('Crouch', { timeScale: 0.5 });
    } else if (casting) {
      PlayerVis.pose = 'cast';
      const clip = rig.actions.Cast ? rig.actions.Cast.getClip() : null;
      rig.play('Cast', {
        once: true,
        timeScale: clip ? clip.duration / PlayerVis.castDuration : 1
      });
    } else if (p.hook?.fishing) {
      PlayerVis.pose = tug
        ? (PlayerVis.tugSuccess ? 'fishing-pull' : 'fishing-slip')
        : 'fishing-tension';
      rig.play('Reel', { timeScale: tug ? 1.8 : 0.9 });
    } else if (p.hook?.returning) {
      PlayerVis.pose = 'reeling';
      rig.play('Reel', { timeScale: 1.5 });
    } else if (p.hook) {
      PlayerVis.pose = 'line-out';
      rig.play('Idle');
    } else if (moving) {
      PlayerVis.pose = 'walking';
      rig.play('Walk');
    } else {
      PlayerVis.pose = 'idle';
      rig.play('Idle');
    }
    rig.update(dt);

    // En primera persona la cabeza queda oculta; el mezclador puede
    // sobrescribir la escala del hueso, así que se reaplica cada frame.
    if (PlayerVis.fpMode) {
      const head = rig.bone('Head');
      if (head) head.scale.setScalar(0.0001);
    }

    if (rowing) {
      // Remar con la mano: sobre la base agachada, el brazo derecho palea.
      const swing = Math.sin(time * 8);
      const arm = rig.bone('RightArm');
      const forearm = rig.bone('RightForeArm');
      if (arm) arm.rotation.x += swing * 0.55;
      if (forearm) forearm.rotation.x += swing * 0.35 - 0.25;
    }

    if (p.hook && (p.hook.fishing || p.hook.returning)) {
      if (PlayerVis.reel) PlayerVis.reel.rotation.x += dt * 18;
      if (PlayerVis.reelCrank) PlayerVis.reelCrank.rotation.x += dt * 18;
    }

    // Caña como viewmodel: en primera persona con el sedal fuera, la caña se
    // cuelga de la cámara (abajo a la derecha, punta al frente) con balanceo,
    // tensión del pez y sacudida al tirar. Al volver a tercera persona se
    // devuelve a la malla y la mano la recoloca.
    const rod = PlayerVis.rod;
    const fpRod = rod && rod.visible && p.hook &&
      typeof World !== 'undefined' && World.firstPerson && World.camera;
    if (fpRod) {
      if (rod.parent !== World.camera) World.camera.add(rod);
      const tugLift = PlayerVis.tugTime > 0 ? PlayerVis.tugTime / 0.38 : 0;
      const swayY = Math.sin(time * 1.6) * 0.012;
      const swayX = Math.cos(time * 1.15) * 0.01;
      // Más pequeña que en mano y apuntando al centro, donde cae la boya.
      rod.scale.setScalar(0.6);
      rod.position.set(0.36 + swayX, -0.38 + swayY + tugLift * 0.08, -0.55);
      if (!PlayerVis.rodViewDir) {
        PlayerVis.rodViewDir = new THREE.Vector3();
        PlayerVis.rodViewAxis = new THREE.Vector3(0, -1, 0);
      }
      const viewDir = PlayerVis.rodViewDir
        .set(-0.38, 0.5 + tugLift * 0.45, -1)
        .normalize();
      rod.quaternion.setFromUnitVectors(PlayerVis.rodViewAxis, viewDir);
      const struggle = p.hook.fishing
        ? 0.3 + Math.sin(time * 5.2) * 0.18 + Math.sin(time * 9.1) * 0.12
        : 0.12;
      PlayerVis.setRodFlex(struggle + tugLift * 0.55);
    } else {
      if (rod && typeof World !== 'undefined' && World.camera &&
          rod.parent === World.camera) {
        PlayerVis.mesh.add(rod);
        rod.scale.setScalar(1);
        PlayerVis.setRodFlex(0);
      }

      // La caña sigue la posición de la mano, pero su orientación se decide
      // aquí: la punta (-Y local) apunta al anzuelo u objetivo de lance.
      // Copiar el quaternion del hueso dejaba la caña en ángulos imposibles.
      const hand = rig.bone('RightHand');
      if (hand && PlayerVis.rod) {
        PlayerVis.mesh.updateMatrixWorld(true);
        const handPos = hand.getWorldPosition(new THREE.Vector3());
        PlayerVis.rod.position.copy(PlayerVis.mesh.worldToLocal(handPos));
        if (PlayerVis.rodGripOffset) {
          PlayerVis.rod.position.add(PlayerVis.rodGripOffset);
        }

        const target = p.hook || PlayerVis.castTarget;
        let dirLocal;
        if (target) {
          // Dirección mundo de la mano al agua, llevada al espacio de la malla.
          const targetWorld = new THREE.Vector3(target.x, 0.3, target.z);
          if (PlayerVis.mesh.parent) {
            PlayerVis.mesh.parent.localToWorld(targetWorld);
          }
          const dirWorld = targetWorld.sub(handPos).normalize();
          const invQuat = PlayerVis.mesh
            .getWorldQuaternion(new THREE.Quaternion())
            .invert();
          dirLocal = dirWorld.applyQuaternion(invQuat);
        } else {
          dirLocal = new THREE.Vector3(0, -0.3, 1); // descanso: adelante y caída
        }
        PlayerVis.rod.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, -1, 0),
          dirLocal
        );
      }
    }
  },

  reset: () => {
    PlayerVis.walkTime = 0;
    PlayerVis.castTime = 99;
    PlayerVis.castTarget = null;
    PlayerVis.lastHook = null;
    PlayerVis.tugTime = 0;
    PlayerVis.tugSuccess = true;
    PlayerVis.pose = 'idle';
    if (PlayerVis.glbRig) PlayerVis.glbRig.play('Idle');
    if (PlayerVis.rod) PlayerVis.rod.visible = false;
    if (PlayerVis.mesh) PlayerVis.mesh.position.set(1, 0.35, 1);
    if (PlayerVis.aimLine) PlayerVis.aimLine.visible = false;
  },

  beginCast: target => {
    PlayerVis.castTime = 0;
    PlayerVis.castTarget = target
      ? { x: target.x, z: target.z }
      : null;
    if (PlayerVis.rod) PlayerVis.rod.visible = true;
  },

  pulseTug: success => {
    PlayerVis.tugTime = 0.38;
    PlayerVis.tugSuccess = success !== false;
  },

  // El GLB de Meshy llega en DoubleSide: en FP el near plane recortaría el
  // chaleco y se vería el interior naranja. FrontSide deja las piernas/cubierta.
  setGlbFrontSide: active => {
    if (typeof THREE === 'undefined') return;
    const root = PlayerVis.mesh && PlayerVis.mesh.getObjectByName('player-glb');
    if (!root) return;
    root.traverse(obj => {
      if (!obj.isMesh && !obj.isSkinnedMesh) return;
      const mats = [].concat(obj.material || []);
      mats.forEach(mat => {
        if (!mat) return;
        if (mat.userData._fpSide == null) mat.userData._fpSide = mat.side;
        mat.side = active ? THREE.FrontSide : mat.userData._fpSide;
        mat.needsUpdate = true;
      });
    });
  },

  // Primera persona: se ve el cuerpo pero no la cabeza (escala mínima en el
  // hueso; el mezclador puede sobrescribirla y syncGlb la reaplica). Devuelve
  // false si no hay nada que ocultar y el llamador debe esconder la malla.
  setFirstPerson: active => {
    PlayerVis.fpMode = active;
    PlayerVis.setGlbFrontSide(active);
    if (PlayerVis.glbRig) {
      const head = PlayerVis.glbRig.bone('Head');
      if (head) {
        head.scale.setScalar(active ? 0.0001 : 1);
        return true;
      }
    }
    const parts = PlayerVis.mesh && PlayerVis.mesh.userData.parts;
    if (parts && parts.head) {
      parts.head.visible = !active;
      return true;
    }
    return false;
  },

  getRodTipWorld: out => {
    if (!PlayerVis.rodTip || !PlayerVis.rod || !PlayerVis.rod.visible) return null;
    PlayerVis.mesh.updateMatrixWorld(true);
    return PlayerVis.rodTip.getWorldPosition(out || new THREE.Vector3());
  },

  resetJoints: parts => {
    const joints = [
      parts.armL, parts.armR, parts.forearmL, parts.forearmR,
      parts.legL, parts.legR, parts.head
    ];
    joints.forEach(joint => {
      if (joint) joint.rotation.set(0, 0, 0);
    });
    if (parts.body) {
      parts.body.rotation.set(0, 0, 0);
      parts.body.scale.set(1, 1, 1);
    }
    if (PlayerVis.rod) PlayerVis.rod.rotation.set(0, 0, -0.08);
    PlayerVis.rodSegments.forEach(segment => segment.rotation.set(0, 0, 0));
  },

  setRodFlex: amount => {
    const flex = Math.max(-1, Math.min(1, amount));
    PlayerVis.rodSegments.forEach((segment, index) => {
      segment.rotation.x = flex * (0.05 + index * 0.035);
    });
  },

  poseCast: (parts, normalized) => {
    if (normalized < 0.3) {
      PlayerVis.pose = 'cast-anticipation';
      const t = normalized / 0.3;
      parts.armR.rotation.x = PlayerVis.mix(-0.2, 0.9, t);
      parts.armR.rotation.z = PlayerVis.mix(0, -0.18, t);
      parts.forearmR.rotation.x = PlayerVis.mix(-0.2, -0.82, t);
      parts.armL.rotation.x = PlayerVis.mix(-0.1, -0.55, t);
      parts.forearmL.rotation.x = PlayerVis.mix(0, -0.7, t);
      PlayerVis.mesh.rotation.x = PlayerVis.mix(0, -0.08, t);
      PlayerVis.mesh.rotation.z = PlayerVis.mix(0, -0.1, t);
      PlayerVis.setRodFlex(-0.35 * t);
      return;
    }
    if (normalized < 0.62) {
      PlayerVis.pose = 'cast-release';
      const t = (normalized - 0.3) / 0.32;
      parts.armR.rotation.x = PlayerVis.mix(0.9, -1.62, t);
      parts.armR.rotation.z = PlayerVis.mix(-0.18, 0.05, t);
      parts.forearmR.rotation.x = PlayerVis.mix(-0.82, -0.15, t);
      parts.armL.rotation.x = PlayerVis.mix(-0.55, -1.05, t);
      parts.forearmL.rotation.x = PlayerVis.mix(-0.7, -1.15, t);
      PlayerVis.mesh.rotation.x = PlayerVis.mix(-0.08, 0.1, t);
      PlayerVis.mesh.rotation.z = PlayerVis.mix(-0.1, 0.06, t);
      PlayerVis.setRodFlex(Math.sin(t * Math.PI) * 0.95);
      return;
    }

    PlayerVis.pose = 'cast-follow-through';
    const t = (normalized - 0.62) / 0.38;
    parts.armR.rotation.x = PlayerVis.mix(-1.62, -1.28, t);
    parts.armR.rotation.z = PlayerVis.mix(0.05, 0, t);
    parts.forearmR.rotation.x = PlayerVis.mix(-0.15, -0.42, t);
    parts.armL.rotation.x = PlayerVis.mix(-1.05, -0.7, t);
    parts.forearmL.rotation.x = PlayerVis.mix(-1.15, -0.8, t);
    PlayerVis.mesh.rotation.x = PlayerVis.mix(0.1, 0.02, t);
    PlayerVis.mesh.rotation.z = PlayerVis.mix(0.06, 0, t);
    PlayerVis.setRodFlex(PlayerVis.mix(0.45, 0.08, t));
  },

  poseFishing: (parts, time) => {
    const pulseProgress = PlayerVis.tugTime > 0
      ? 1 - PlayerVis.tugTime / 0.38
      : 1;
    const tug = PlayerVis.tugTime > 0
      ? Math.sin(pulseProgress * Math.PI)
      : 0;
    const struggle = Math.sin(time * 9.5) * 0.08;
    const pull = tug * (PlayerVis.tugSuccess ? 0.48 : -0.2);

    PlayerVis.pose = tug > 0.05
      ? (PlayerVis.tugSuccess ? 'fishing-pull' : 'fishing-slip')
      : 'fishing-tension';
    parts.armR.rotation.x = -1.05 + struggle - pull;
    parts.forearmR.rotation.x = -0.62 - pull * 0.45;
    parts.armL.rotation.x = -0.88 - struggle * 0.7 - pull * 0.55;
    parts.forearmL.rotation.x = -1.12 + struggle;
    parts.head.rotation.x = -0.12 - tug * 0.08;
    PlayerVis.mesh.rotation.x = 0.07 + tug * 0.09;
    PlayerVis.mesh.rotation.z = struggle * 0.18;
    PlayerVis.setRodFlex(0.72 + Math.abs(struggle) + tug * 0.4);
    if (PlayerVis.reel) PlayerVis.reel.rotation.x += 0.025;
    if (PlayerVis.reelCrank) PlayerVis.reelCrank.rotation.x += 0.045;
  },

  poseReturn: (parts, time, dt) => {
    const reelCycle = time * 11;
    PlayerVis.pose = 'reeling';
    parts.armR.rotation.x = -1.18 + Math.sin(reelCycle) * 0.1;
    parts.forearmR.rotation.x = -0.48 + Math.cos(reelCycle) * 0.13;
    parts.armL.rotation.x = -0.8 + Math.cos(reelCycle) * 0.18;
    parts.forearmL.rotation.x = -1.1 + Math.sin(reelCycle) * 0.25;
    PlayerVis.mesh.rotation.x = 0.055;
    PlayerVis.mesh.rotation.z = Math.sin(reelCycle * 0.5) * 0.025;
    PlayerVis.setRodFlex(0.5 + Math.sin(reelCycle) * 0.08);
    if (PlayerVis.reel) PlayerVis.reel.rotation.x += dt * 18;
    if (PlayerVis.reelCrank) PlayerVis.reelCrank.rotation.x += dt * 18;
  },

  sync: (p, dt, time) => {
    const m = PlayerVis.mesh;
    if (!m || !p) return;
    const safeDt = Math.max(0, Math.min(Number(dt) || 0, 0.1));
    const visualTime = Number(time) || 0;
    const parts = m.userData.parts;
    const moving = Math.abs(p.vx || 0) > 0.01 || Math.abs(p.vz || 0) > 0.01;

    if (p.hook && p.hook !== PlayerVis.lastHook) {
      PlayerVis.lastHook = p.hook;
      if (PlayerVis.castTime >= PlayerVis.castDuration) {
        PlayerVis.beginCast({
          x: p.hook.x + (p.hook.vx || 0),
          z: p.hook.z + (p.hook.vz || 0)
        });
      }
    } else if (!p.hook) {
      PlayerVis.lastHook = null;
    }

    PlayerVis.castTime += safeDt;
    PlayerVis.tugTime = Math.max(0, PlayerVis.tugTime - safeDt);
    if (moving) PlayerVis.walkTime += safeDt * 9;
    PlayerVis.resetJoints(parts);

    const swing = moving ? Math.sin(PlayerVis.walkTime) : 0;
    const bob = moving
      ? Math.abs(Math.sin(PlayerVis.walkTime)) * 0.075
      : Math.sin(visualTime * 1.8) * 0.012;
    m.position.set(p.x, 0.35 + bob, p.z);
    m.rotation.x = 0;
    m.rotation.z = 0;

    if (PlayerVis.fpMode && !p.hook &&
        typeof World !== 'undefined' && World.firstPerson) {
      // En primera persona el cuerpo acompaña la vista: al mirar abajo se
      // ve el torso y las piernas donde deben estar.
      m.rotation.y = World.fpYaw;
    } else if (p.hook) {
      const aimX = p.hook.x - p.x;
      const aimZ = p.hook.z - p.z;
      if (Math.hypot(aimX, aimZ) > 0.05) m.rotation.y = Math.atan2(aimX, aimZ);
    } else if (moving) {
      m.rotation.y = Math.atan2(p.vx, p.vz);
    }

    const casting = !!p.hook && PlayerVis.castTime < PlayerVis.castDuration;
    if (PlayerVis.rod) PlayerVis.rod.visible = !!p.hook || casting;

    // Con el GLB activo los clips del esqueleto sustituyen a las poses por
    // articulaciones; el resto de la lógica de arriba (posición, giro, caña)
    // sigue siendo la misma.
    if (PlayerVis.glbRig) {
      PlayerVis.syncGlb(p, safeDt, visualTime, moving, casting);
      return;
    }

    if ((p.rowAnim || 0) > 0) {
      PlayerVis.pose = 'rowing';
      if (PlayerVis.rod) PlayerVis.rod.visible = false;
      const rowSwing = Math.sin(visualTime * 8) * 0.35;
      parts.armL.rotation.x = -1.1 + rowSwing;
      parts.armR.rotation.x = -1.1 + rowSwing;
      parts.forearmL.rotation.x = -0.45;
      parts.forearmR.rotation.x = -0.45;
      m.rotation.x = 0.28;
    } else if (casting) {
      PlayerVis.poseCast(parts, PlayerVis.castTime / PlayerVis.castDuration);
    } else if (p.hook?.fishing) {
      PlayerVis.poseFishing(parts, visualTime);
    } else if (p.hook?.returning) {
      PlayerVis.poseReturn(parts, visualTime, safeDt);
    } else if (p.hook) {
      PlayerVis.pose = 'line-out';
      parts.armR.rotation.x = -1.28;
      parts.forearmR.rotation.x = -0.42;
      parts.armL.rotation.x = -0.7;
      parts.forearmL.rotation.x = -0.8;
      parts.head.rotation.x = -0.08;
      PlayerVis.setRodFlex(0.08 + Math.sin(visualTime * 2.2) * 0.025);
    } else if (moving) {
      PlayerVis.pose = 'walking';
      m.rotation.x = 0.06;
      m.rotation.z = Math.cos(PlayerVis.walkTime) * 0.018;
      parts.armL.rotation.x = swing * 0.72;
      parts.armR.rotation.x = -swing * 0.72;
      parts.forearmL.rotation.x = -0.12 - Math.max(0, swing) * 0.18;
      parts.forearmR.rotation.x = -0.12 + Math.min(0, swing) * 0.18;
      parts.legL.rotation.x = -swing * 0.62;
      parts.legR.rotation.x = swing * 0.62;
      parts.head.rotation.y = -swing * 0.06;
    } else {
      PlayerVis.pose = 'idle';
      const breath = Math.sin(visualTime * 1.8);
      parts.body.scale.y = 1 + breath * 0.012;
      parts.armL.rotation.x = breath * 0.035;
      parts.armR.rotation.x = -breath * 0.035;
      parts.forearmL.rotation.x = -0.08;
      parts.forearmR.rotation.x = -0.08;
      parts.head.rotation.y = Math.sin(visualTime * 0.55) * 0.08;
    }
  },

  updateAim: (p, target) => {
    if (!PlayerVis.aimLine) return;
    if (!target || p.hook) {
      PlayerVis.aimLine.visible = false;
      return;
    }
    PlayerVis.aimLine.visible = true;
    const positions = PlayerVis.aimLine.geometry.attributes.position;
    const dx = target.x - p.x;
    const dz = target.z - p.z;
    const length = Math.hypot(dx, dz) || 1;
    const aimLength = Math.min(length, 2.4);
    positions.setXYZ(0, p.x, 0.95, p.z);
    positions.setXYZ(
      1,
      p.x + dx / length * aimLength,
      0.32,
      p.z + dz / length * aimLength
    );
    positions.needsUpdate = true;
    PlayerVis.aimLine.computeLineDistances();
  }
};
