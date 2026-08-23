/*****************************************************
 * character-glb.js - Carga del náufrago generado (Meshy GLB).
 *
 * El GLB empaquetado en assets/characters/ lleva el esqueleto y los clips
 * Idle, Walk, Crouch, Cast y Reel. Este módulo solo carga y crea el rig de
 * animación; player.js decide qué clip suena en cada estado del juego.
 *****************************************************/

const NaufragoGLB = {
  url: 'assets/characters/naufrago_prota.glb',
  crewUrls: [
    'assets/characters/naufraga_marta.glb',
    'assets/characters/naufrago_viejo.glb',
    'assets/characters/naufrago_joven.glb',
    'assets/characters/naufrago_grueso.glb'
  ],
  crewGltfs: null,
  crewLoading: null,
  loading: null,

  load: () => {
    if (NaufragoGLB.loading) return NaufragoGLB.loading;
    if (typeof THREE === 'undefined' || !THREE.GLTFLoader) {
      NaufragoGLB.loading = Promise.resolve(null);
      return NaufragoGLB.loading;
    }
    const loader = new THREE.GLTFLoader();
    NaufragoGLB.loading = new Promise(resolve => {
      loader.load(
        NaufragoGLB.url,
        gltf => resolve(gltf),
        undefined,
        error => {
          if (typeof console !== 'undefined' && console.warn) {
            console.warn('No se pudo cargar el náufrago GLB:', error);
          }
          resolve(null);
        }
      );
    });
    return NaufragoGLB.loading;
  },

  // Crea el mezclador y un selector de clips con fundidos suaves.
  createRig: (root, animations) => {
    const mixer = new THREE.AnimationMixer(root);
    const actions = {};
    animations.forEach(clip => {
      actions[clip.name] = mixer.clipAction(clip);
    });
    const rig = {
      mixer,
      actions,
      currentName: null,
      play: (name, opts = {}) => {
        const next = actions[name];
        if (!next) return;
        const fade = opts.fade ?? 0.18;
        const once = !!opts.once;
        next.timeScale = opts.timeScale ?? 1;
        // Con once no se reinicia un clip que aún se está reproduciendo.
        if (rig.currentName === name && (!once || next.isRunning())) return;
        next.reset();
        next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
        next.clampWhenFinished = once;
        const previous = rig.currentName ? actions[rig.currentName] : null;
        if (previous && previous !== next) {
          next.crossFadeFrom(previous, fade, false);
        }
        next.play();
        rig.currentName = name;
      },
      update: dt => mixer.update(dt),
      bone: name => root.getObjectByName(name)
    };
    return rig;
  },

  crewReady: () => !!(NaufragoGLB.crewGltfs && NaufragoGLB.crewGltfs.length),

  loadCrew: () => {
    if (NaufragoGLB.crewLoading) return NaufragoGLB.crewLoading;
    if (typeof THREE === 'undefined' || !THREE.GLTFLoader) {
      NaufragoGLB.crewLoading = Promise.resolve([]);
      return NaufragoGLB.crewLoading;
    }
    const loader = new THREE.GLTFLoader();
    NaufragoGLB.crewLoading = Promise.all(
      NaufragoGLB.crewUrls.map(url => new Promise(resolve => {
        loader.load(url, gltf => resolve(gltf), undefined, () => resolve(null));
      }))
    ).then(list => {
      NaufragoGLB.crewGltfs = list.filter(gltf => gltf);
      return NaufragoGLB.crewGltfs;
    });
    return NaufragoGLB.crewLoading;
  },

  // Clona uno de los náufragos de la biblioteca para un miembro de la
  // tripulación. Las geometrías y texturas se comparten entre clones.
  createCrewMember: index => {
    if (!NaufragoGLB.crewReady() || !THREE.SkeletonUtils) return null;
    const gltf = NaufragoGLB.crewGltfs[index % NaufragoGLB.crewGltfs.length];
    const source = gltf.scene || (gltf.scenes && gltf.scenes[0]);
    if (!source) return null;
    const inner = THREE.SkeletonUtils.clone(source);
    // Misma escala que el protagonista (1.24 unidades para 1.75 m).
    inner.scale.setScalar(1.24 / 1.75);
    inner.traverse(obj => {
      if (obj.isMesh || obj.isSkinnedMesh) {
        obj.castShadow = true;
        obj.frustumCulled = false;
      }
    });
    const group = new THREE.Group();
    group.add(inner);
    const rig = NaufragoGLB.createRig(inner, gltf.animations || []);
    rig.play('Idle');
    const idle = rig.actions.Idle;
    if (idle) idle.time = Math.random() * idle.getClip().duration;
    group.userData.glbRig = rig;
    group.userData.glbCrew = true;
    return group;
  }
};
