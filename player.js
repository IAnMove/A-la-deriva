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
  paddle: null,

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
    rod.rotation.z = -0.06;

    // Mango de corcho/madera: el origen (0,0,0) coincide con el agarre de la
    // mano derecha; la culata sobresale hacia +Y (bajo el antebrazo) y el
    // asiento del carrete queda delante de la mano (-Y).
    const handle = cyl(0.021, 0.025, 0.28, 0x6d4c41, 0, 0.03, 0, 8);
    const buttCap = cyl(0.025, 0.023, 0.035, 0x263238, 0, 0.175, 0, 8);
    const foreGrip = cyl(0.019, 0.023, 0.06, 0x263238, 0, -0.11, 0, 8);
    rod.add(handle, buttCap, foreGrip);

    const reel = new THREE.Group();
    reel.name = 'fishing-reel';
    reel.position.set(0, -0.085, -0.038);
    const spool = new THREE.Mesh(
      new THREE.CylinderGeometry(0.042, 0.042, 0.055, 10),
      mat(0xb0bec5)
    );
    spool.rotation.z = Math.PI / 2;
    spool.castShadow = true;
    const reelCore = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.022, 0.075, 8),
      mat(0x455a64)
    );
    reelCore.rotation.z = Math.PI / 2;
    const reelFoot = box(0.016, 0.045, 0.03, 0x37474f, 0, 0, 0.022);
    reel.add(spool, reelCore, reelFoot);
    rod.add(reel);

    const crank = new THREE.Group();
    crank.position.set(0.052, -0.085, -0.038);
    crank.add(
      box(0.018, 0.09, 0.018, 0x37474f, 0, -0.035, 0),
      cyl(0.016, 0.016, 0.045, 0x5d4037, 0.018, -0.08, 0, 7)
    );
    rod.add(crank);

    // Tres tramos anidados permiten flexionar la caña sin regenerar geometría.
    const lengths = [0.42, 0.4, 0.38];
    const radii = [
      [0.014, 0.02],
      [0.009, 0.014],
      [0.005, 0.009]
    ];
    const segments = [];
    let parent = rod;
    let offset = -0.14;
    lengths.forEach((length, index) => {
      const pivot = new THREE.Group();
      pivot.position.y = offset;
      pivot.name = `rod-segment-${index + 1}`;
      const shaft = cyl(
        radii[index][0],
        radii[index][1],
        length,
        index === 2 ? 0xd7ccc8 : 0x37474f,
        0,
        -length * 0.5,
        0,
        7
      );
      const guideRadius = 0.022 - index * 0.004;
      const guide = new THREE.Mesh(
        new THREE.TorusGeometry(guideRadius, 0.0038, 5, 9),
        mat(0xcfd8dc)
      );
      guide.position.set(0, -length, -guideRadius * 0.65);
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
    PlayerVis.makePaddle();

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

  makePaddle: () => {
    const paddle = new THREE.Group();
    paddle.name = 'player-paddle';
    paddle.add(
      cyl(0.025, 0.032, 1.2, 0x9a7549, 0, -0.26, 0, 7),
      box(0.24, 0.055, 0.055, 0xc8a66d, 0, 0.34, 0),
      box(0.2, 0.43, 0.045, 0xb99055, 0, -0.97, 0),
      box(0.027, 0.37, 0.055, 0x705236, 0, -0.97, 0)
    );
    paddle.visible = false;
    PlayerVis.mesh.add(paddle);
    PlayerVis.paddle = paddle;
    PlayerVis.paddleHand = new THREE.Vector3();
    PlayerVis.paddleDirection = new THREE.Vector3();
    PlayerVis.paddleAxis = new THREE.Vector3(0, -1, 0);
  },

  poseGlbLocomotion: (p, time, moving, casting = false) => {
    if (PlayerVis.fpMode || typeof CrewManager === 'undefined' || !CrewManager.aimLimb) return;
    const mesh = PlayerVis.mesh, rig = PlayerVis.glbRig;
    rig.resetUpperBody?.();
    const aim = (name, x, y, z, roll = 0) => CrewManager.aimLimb(mesh, rig, name, x, y, z, roll);
    const rowing = (p.rowAnim || 0) > 0;
    aim('Neck', 0, 0.99, 0.08);
    const headBone = rig.bone('Head');
    if (headBone?.userData?.bindQuat) {
      headBone.quaternion.copy(headBone.userData.bindQuat);
      headBone.rotateX(-0.08);
      if (!moving && !p.hook && !rowing) {
        headBone.rotateY(Math.sin(time * 0.65) * 0.06);
      }
    } else {
      aim('Head', 0, 0.98, 0.15);
    }

    if (rowing) {
      // Un ciclo por impulso: alcanzar, palear y recuperar por encima del agua.
      const phase = (1 - Util.clamp(p.rowAnim / 0.65, 0, 1)) * Math.PI * 2;
      const reach = Math.cos(phase), recovery = Math.max(0, -Math.sin(phase));
      mesh.rotation.x = 0.14 + (1 - reach) * 0.055;
      aim('RightArm', -0.26, -0.66 + recovery * 0.18, 0.7 + reach * 0.32);
      aim('RightForeArm', -0.16, -0.48 + recovery * 0.32, 0.78 + reach * 0.28, 0.45);
      aim('LeftArm', 0.1, -0.36 + recovery * 0.12, 0.76 + reach * 0.18);
      aim('LeftForeArm', -0.18, 0.04 + recovery * 0.16, 0.88 + reach * 0.18, -0.45);
      const hand = rig.bone('RightHand');
      const leftHand = rig.bone('LeftHand');
      if (hand && PlayerVis.paddle) {
        mesh.updateMatrixWorld(true);
        hand.getWorldPosition(PlayerVis.paddleHand);
        mesh.worldToLocal(PlayerVis.paddleHand);
        PlayerVis.paddle.position.copy(PlayerVis.paddleHand);
        if (leftHand) {
          leftHand.getWorldPosition(PlayerVis.paddleDirection);
          mesh.worldToLocal(PlayerVis.paddleDirection);
          PlayerVis.paddleDirection.sub(PlayerVis.paddleHand).negate().normalize();
        } else {
          PlayerVis.paddleDirection.set(
            PlayerVis.paddleHand.x - 0.18,
            -0.38 + recovery * 0.35,
            0.92 + reach * 0.34
          ).sub(PlayerVis.paddleHand).normalize();
        }
        PlayerVis.paddle.quaternion.setFromUnitVectors(PlayerVis.paddleAxis, PlayerVis.paddleDirection);
        PlayerVis.paddle.visible = true;
      }
      return;
    }

    if (casting) {
      const normalized = Util.clamp(PlayerVis.castTime / PlayerVis.castDuration, 0, 1);
      if (normalized < 0.3) {
        PlayerVis.pose = 'cast-anticipation';
        const t = normalized / 0.3;
        mesh.rotation.x = PlayerVis.mix(0, -0.08, t);
        mesh.rotation.z = PlayerVis.mix(0, -0.05, t);
        aim('RightArm', -0.22, PlayerVis.mix(-0.68, 0.08, t), PlayerVis.mix(0.65, 0.72, t));
        aim('RightForeArm', -0.08, PlayerVis.mix(-0.15, 0.72, t), PlayerVis.mix(0.92, 0.55, t), 0.35);
        aim('LeftArm', 0.1, PlayerVis.mix(-0.68, -0.24, t), 0.74);
        aim('LeftForeArm', -0.34, PlayerVis.mix(-0.18, 0.38, t), 0.86, -0.45);
        PlayerVis.rodPitch = PlayerVis.mix(0.38, 1.18, t);
        PlayerVis.setRodFlex(-0.38 * t);
      } else if (normalized < 0.62) {
        PlayerVis.pose = 'cast-release';
        const t = (normalized - 0.3) / 0.32;
        mesh.rotation.x = PlayerVis.mix(-0.08, 0.09, t);
        mesh.rotation.z = PlayerVis.mix(-0.05, 0.04, t);
        aim('RightArm', -0.18, PlayerVis.mix(0.08, -0.56, t), PlayerVis.mix(0.72, 0.82, t));
        aim('RightForeArm', -0.05, PlayerVis.mix(0.72, -0.16, t), PlayerVis.mix(0.55, 0.96, t), 0.35);
        aim('LeftArm', 0.1, PlayerVis.mix(-0.24, -0.62, t), 0.76);
        aim('LeftForeArm', -0.34, PlayerVis.mix(0.38, -0.18, t), 0.88, -0.45);
        PlayerVis.rodPitch = PlayerVis.mix(1.18, 0.2, t);
        PlayerVis.setRodFlex(Math.sin(t * Math.PI) * 0.92);
      } else {
        PlayerVis.pose = 'cast-follow-through';
        const t = (normalized - 0.62) / 0.38;
        mesh.rotation.x = PlayerVis.mix(0.09, 0.02, t);
        mesh.rotation.z = PlayerVis.mix(0.04, 0, t);
        aim('RightArm', -0.17, PlayerVis.mix(-0.56, -0.7, t), PlayerVis.mix(0.82, 0.68, t));
        aim('RightForeArm', -0.05, PlayerVis.mix(-0.16, -0.18, t), 0.96, 0.35);
        aim('LeftArm', 0.1, -0.64, 0.74);
        aim('LeftForeArm', -0.34, -0.18, 0.88, -0.45);
        PlayerVis.rodPitch = PlayerVis.mix(0.2, 0.38, t);
        PlayerVis.setRodFlex(PlayerVis.mix(0.42, 0.1, t));
      }
      return;
    }

    if (p.hook?.fishing) {
      const pulseProgress = PlayerVis.tugTime > 0 ? 1 - PlayerVis.tugTime / 0.38 : 1;
      const tug = PlayerVis.tugTime > 0 ? Math.sin(pulseProgress * Math.PI) : 0;
      const struggle = Math.sin(time * 9.5) * 0.07;
      const pull = tug * (PlayerVis.tugSuccess ? 0.36 : -0.16);
      mesh.rotation.x = 0.04 - pull * 0.15;
      mesh.rotation.z = struggle * 0.12;
      aim('RightArm', -0.17, -0.58 + pull * 0.32 - struggle * 0.35, 0.78);
      aim('RightForeArm', -0.05, 0.04 + pull * 0.42 - struggle * 0.45, 0.95, 0.35);
      aim('LeftArm', 0.1, -0.52 + pull * 0.28 - struggle * 0.25, 0.82);
      aim('LeftForeArm', -0.35, 0.02 + pull * 0.38 + Math.cos(time * 12) * 0.08, 0.88, -0.45);
      PlayerVis.rodPitch = 0.56 + pull * 0.42 - struggle * 0.3;
      PlayerVis.setRodFlex(0.72 + Math.abs(struggle) + tug * 0.42);
      return;
    }

    if (p.hook?.returning) {
      const reelCycle = time * 11;
      mesh.rotation.x = 0.04;
      mesh.rotation.z = Math.sin(reelCycle * 0.5) * 0.02;
      aim('RightArm', -0.17, -0.66 + Math.sin(reelCycle) * 0.04, 0.72);
      aim('RightForeArm', -0.05, -0.12 + Math.sin(reelCycle) * 0.06, 0.96, 0.35);
      aim('LeftArm', 0.1, -0.6 + Math.cos(reelCycle) * 0.06, 0.78);
      aim('LeftForeArm', -0.35 + Math.sin(reelCycle) * 0.04, -0.12 + Math.cos(reelCycle) * 0.1, 0.88, -0.45);
      PlayerVis.rodPitch = 0.42 + Math.sin(reelCycle) * 0.04;
      PlayerVis.setRodFlex(0.45 + Math.sin(reelCycle) * 0.08);
      return;
    }

    if (p.hook) {
      const sway = Math.sin(time * 2.0) * 0.025;
      aim('RightArm', -0.17, -0.72, 0.66);
      aim('RightForeArm', -0.05, -0.18 + sway, 0.96, 0.35);
      aim('LeftArm', 0.1, -0.66, 0.74);
      aim('LeftForeArm', -0.35, -0.18 + sway, 0.88, -0.45);
      PlayerVis.rodPitch = 0.38 + sway;
      PlayerVis.setRodFlex(0.1 + Math.sin(time * 2.2) * 0.025);
      return;
    }

    const swing = moving ? Math.sin(PlayerVis.walkTime) * 0.38 : Math.sin(time * 1.8) * 0.018;
    const armY = moving ? -0.96 : -0.985;
    const foreY = moving ? -0.92 : -0.975;
    const foreZ = moving ? 0.22 : 0.16;
    aim('RightArm', -0.14, armY, 0.04 - swing);
    aim('LeftArm', 0.14, armY, 0.04 + swing);
    aim('RightForeArm', -0.08, foreY, foreZ - swing * 0.85, 0.38);
    aim('LeftForeArm', 0.08, foreY, foreZ + swing * 0.85, -0.38);
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
      rig.play('Idle', { timeScale: 0.7 });
    } else if (p.hook?.fishing) {
      PlayerVis.pose = tug
        ? (PlayerVis.tugSuccess ? 'fishing-pull' : 'fishing-slip')
        : 'fishing-tension';
      rig.play('Idle', { timeScale: 0.95 });
    } else if (p.hook?.returning) {
      PlayerVis.pose = 'reeling';
      rig.play('Idle', { timeScale: 0.85 });
    } else if (p.hook) {
      PlayerVis.pose = 'line-out';
      rig.play('Idle', { timeScale: 0.75 });
    } else if (moving) {
      PlayerVis.pose = 'walking';
      rig.play('Walk');
    } else {
      PlayerVis.pose = 'idle';
      rig.play('Idle');
    }
    rig.update(dt);
    if (PlayerVis.paddle) PlayerVis.paddle.visible = false;
    PlayerVis.poseGlbLocomotion(p, time, moving, casting);

    // En primera persona la cabeza queda oculta; el mezclador puede
    // sobrescribir la escala del hueso, así que se reaplica cada frame.
    if (PlayerVis.fpMode) {
      const head = rig.bone('Head');
      if (head) head.scale.setScalar(0.0001);
    }

    if (rowing && PlayerVis.fpMode) {
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

      // La caña sigue la posición de la mano derecha y apunta hacia delante y
      // arriba con el ángulo de lance/pesca (PlayerVis.rodPitch), evitando el
      // giro invertido de setFromUnitVectors y dejando el carrete debajo.
      const hand = rig.bone('RightHand');
      if (hand && PlayerVis.rod) {
        PlayerVis.mesh.updateMatrixWorld(true);
        const handPos = hand.getWorldPosition(new THREE.Vector3());
        PlayerVis.rod.position.copy(PlayerVis.mesh.worldToLocal(handPos));
        if (PlayerVis.rodGripOffset) {
          PlayerVis.rod.position.add(PlayerVis.rodGripOffset);
        }

        const target = p.hook || PlayerVis.castTarget;
        let yaw = 0.05;
        if (target) {
          const targetWorld = new THREE.Vector3(target.x, 0.3, target.z);
          if (PlayerVis.mesh.parent) {
            PlayerVis.mesh.parent.localToWorld(targetWorld);
          }
          const dirWorld = targetWorld.sub(handPos).normalize();
          const invQuat = PlayerVis.mesh
            .getWorldQuaternion(new THREE.Quaternion())
            .invert();
          const dirLocal = dirWorld.applyQuaternion(invQuat);
          yaw = Util.clamp(Math.atan2(dirLocal.x, Math.max(0.2, dirLocal.z)), -0.45, 0.45);
        }
        const pitch = typeof PlayerVis.rodPitch === 'number' ? PlayerVis.rodPitch : 0.38;
        PlayerVis.rod.rotation.set(-(Math.PI * 0.5 + pitch), yaw, -0.06, 'YXZ');
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
    if (PlayerVis.paddle) PlayerVis.paddle.visible = false;
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
    if (PlayerVis.paddle) PlayerVis.paddle.visible = false;
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
