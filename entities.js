/*****************************************************
 * entities.js - Objetos flotantes, peligros, peces (3D)
 *****************************************************/

const LOOT_TABLES = {
  plank: { name: 'Tabla', icon: '🪵', wood: 2 },
  bottle: { name: 'Botella', icon: '🧴', plastic: 1, water: 0.15 },
  crate: { name: 'Caja', icon: '📦', wood: 1, food: 0.25, rope: 0.2 },
  barrel: { name: 'Bidón', icon: '🛢️', water: 0.4, plastic: 0.2 },
  net: { name: 'Red abandonada', icon: '🕸️', rope: 2, cloth: 1 },
  scrap: { name: 'Restos metálicos', icon: '⚙️', metal: 1 },
  fruit: { name: 'Fruta flotante', icon: '🥥', food: 1 },
  chest: { name: 'Cofre', icon: '💼', wood: 2, cloth: 1, metal: 1 },
  survivor: { name: 'Náufrago', icon: '🧑', survivor: true },
};

const FLOATING_TYPES = [
  { key: 'plank', weight: 30, color: 0x8d6e63, size: 0.7 },
  { key: 'bottle', weight: 22, color: 0x4fc3f7, size: 0.4 },
  { key: 'crate', weight: 16, color: 0xa1887f, size: 0.8 },
  { key: 'barrel', weight: 10, color: 0x5d4037, size: 0.9 },
  { key: 'net', weight: 8, color: 0x90a4ae, size: 0.75 },
  { key: 'scrap', weight: 10, color: 0x78909c, size: 0.5 },
  { key: 'fruit', weight: 8, color: 0x66bb6a, size: 0.45 },
  { key: 'chest', weight: 3, color: 0xffb300, size: 0.9 },
  { key: 'survivor', weight: 3, color: 0xffcc80, size: 0.8 },
];

// Modelo 3D de cada tipo de objeto flotante
function buildFloatingMesh(typeKey, size) {
  const g = new THREE.Group();
  switch (typeKey) {
    case 'plank':
      g.add(box(size * 2, 0.14, 0.5, 0x8d6e63, 0, 0, 0));
      break;
    case 'bottle': {
      const b = cyl(size * 0.5, size * 0.5, size * 1.4, 0x4fc3f7, 0, 0, 0, 8);
      b.rotation.z = Math.PI / 2;
      g.add(b);
      const neck = cyl(size * 0.18, size * 0.18, size * 0.4, 0x0288d1, size * 0.8, 0, 0, 6);
      neck.rotation.z = Math.PI / 2;
      g.add(neck);
      break;
    }
    case 'crate':
      g.add(box(size * 1.4, size * 1.0, size * 1.4, 0xa1887f, 0, 0, 0));
      g.add(box(size * 1.5, 0.1, 0.2, 0x6d4c41, 0, size * 0.3, 0));
      break;
    case 'barrel': {
      const b = cyl(size * 0.6, size * 0.6, size * 1.3, 0x5d4037, 0, 0, 0, 10);
      b.rotation.z = Math.PI / 2;
      g.add(b);
      break;
    }
    case 'net': {
      const geo = new THREE.PlaneGeometry(size * 2, size * 2, 4, 4);
      geo.rotateX(-Math.PI / 2);
      g.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xcfd8dc, wireframe: true })));
      break;
    }
    case 'scrap':
      g.add(box(size, size * 0.3, size * 0.7, 0x78909c, 0, 0, 0));
      g.add(box(size * 0.5, size * 0.5, size * 0.4, 0x546e7a, size * 0.3, size * 0.2, 0));
      break;
    case 'fruit': {
      const f = new THREE.Mesh(new THREE.SphereGeometry(size * 0.55, 8, 8), mat(0x66bb6a));
      f.castShadow = true;
      g.add(f);
      g.add(box(0.08, 0.15, 0.08, 0x3e2723, 0, size * 0.55, 0));
      break;
    }
    case 'chest':
      g.add(box(size * 1.3, size * 0.8, size * 0.9, 0xffb300, 0, 0, 0));
      g.add(box(size * 1.4, 0.12, 1.0, 0x6d4c41, 0, size * 0.35, 0));
      break;
    case 'survivor': {
      // Pequeño flotador circular con una persona
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.2, 6, 12), mat(0x3e2723));
      ring.rotation.x = Math.PI / 2;
      g.add(ring);
      const person = makeHumanoidMesh(0xff7043);
      person.scale.setScalar(0.8);
      person.position.y = 0.1;
      g.add(person);
      break;
    }
  }
  return g;
}

// Los objetos aparecen y desaparecen continuamente. Clonar una plantilla
// conserva geometrías y materiales en GPU, en lugar de crear y borrar buffers
// nuevos por cada tabla, botella o caja.
const FloatingMeshTemplates = Object.create(null);

function makeFloatingMesh(typeKey, size) {
  if (!FloatingMeshTemplates[typeKey]) {
    const template = buildFloatingMesh(typeKey, size);
    // La figura del náufrago guarda referencias articuladas en userData que
    // no son necesarias para un modelo flotante y dificultan el clonado.
    template.traverse(o => {
      if (o.userData?.parts) delete o.userData.parts;
      if (o.geometry || o.material) o.userData.sharedEntityResource = true;
    });
    FloatingMeshTemplates[typeKey] = template;
  }
  return FloatingMeshTemplates[typeKey].clone(true);
}

class FloatingObject {
  constructor(x, z, typeKey, scene) {
    this.x = x;
    this.z = z;
    this.typeKey = typeKey;
    const def = FLOATING_TYPES.find(t => t.key === typeKey);
    this.def = def;
    this.loot = LOOT_TABLES[typeKey];
    this.radius = def.size;
    this.vx = Util.rand(-0.75, -0.4);
    this.vz = Util.rand(-0.2, 0.2);
    this.bobOffset = Math.random() * Math.PI * 2;
    this.rotSpeed = Util.rand(-0.4, 0.4);
    this.marked = false;
    this.collected = false;
    this.pendingDecision = false;
    this.mesh = makeFloatingMesh(typeKey, def.size);
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = Math.random() * Math.PI * 2;
    scene.add(this.mesh);
  }

  update(dt, currentSpeed, currentSpeedZ, time) {
    this.x += (this.vx - currentSpeed) * dt;
    this.z += (this.vz - currentSpeedZ) * dt;
    this.bobOffset += dt * 2;
    this.mesh.position.x = this.x;
    this.mesh.position.z = this.z;
    this.mesh.position.y = World.waveHeight(this.x, this.z, time, Game.worldOffset, Game.worldOffsetZ) * World.waveAmp + 0.1;
    this.mesh.rotation.y += this.rotSpeed * dt;
    this.mesh.rotation.x = Math.sin(this.bobOffset * 0.7) * 0.12;
    this.mesh.rotation.z = Math.cos(this.bobOffset * 0.5) * 0.1;
  }

  dispose(scene) {
    scene.remove(this.mesh);
  }
}

let DangerMeshTemplate = null;

function makeDangerMesh() {
  if (!DangerMeshTemplate) {
    DangerMeshTemplate = new THREE.Group();
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.9, 4), mat(0x455a64));
    fin.scale.z = 0.35;
    fin.position.y = 0.35;
    DangerMeshTemplate.add(fin);
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 6, 5), mat(0x546e7a));
    body.scale.set(1.6, 0.4, 0.8);
    body.position.y = 0.05;
    DangerMeshTemplate.add(body);
    DangerMeshTemplate.traverse(o => {
      if (o.geometry || o.material) o.userData.sharedEntityResource = true;
    });
  }
  return DangerMeshTemplate.clone(true);
}

class Danger {
  constructor(x, z, type, scene) {
    this.x = x;
    this.z = z;
    this.type = type; // 'shark'
    this.radius = 0.9;
    this.vx = Util.rand(-2, -1);
    this.vz = Util.rand(-0.4, 0.4);
    this.life = 30;
    this.active = true;
    // Aleta de tiburón
    this.mesh = makeDangerMesh();
    this.mesh.position.set(x, 0, z);
    scene.add(this.mesh);
  }

  update(dt, currentSpeed, currentSpeedZ, time) {
    this.x += (this.vx - currentSpeed) * dt;
    this.z += (this.vz - currentSpeedZ) * dt;
    this.life -= dt;
    if (this.life <= 0) this.active = false;
    this.mesh.position.x = this.x;
    this.mesh.position.z = this.z;
    this.mesh.position.y = World.waveHeight(this.x, this.z, time, Game.worldOffset, Game.worldOffsetZ) * World.waveAmp;
    this.mesh.rotation.y = Math.atan2(this.vx, this.vz);
  }

  dispose(scene) {
    scene.remove(this.mesh);
  }
}

// Los bancos clonan estas plantillas: las geometrías y materiales se comparten
// entre peces para que un banco grande no multiplique el coste en GPU.
const FISH_PALETTES = [
  { body: 0x29b6f6, fins: 0x0277bd, belly: 0xb3e5fc },
  { body: 0xffb74d, fins: 0xef6c00, belly: 0xffe0b2 },
  { body: 0x80cbc4, fins: 0x00897b, belly: 0xb2dfdb },
];
const FishModelTemplates = [];

function fishPart(geometry, material) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.userData.sharedFishResource = true;
  return mesh;
}

function buildFishTemplate(paletteIndex = 0) {
  const palette = FISH_PALETTES[paletteIndex % FISH_PALETTES.length];
  const fish = new THREE.Group();

  const body = fishPart(
    new THREE.SphereGeometry(0.5, 8, 6),
    mat(palette.body)
  );
  body.scale.set(0.42, 0.34, 0.9);
  fish.add(body);

  // Cola triangular con pivote propio para poder aletear.
  const tailPivot = new THREE.Group();
  tailPivot.name = 'fish-tail';
  tailPivot.position.z = -0.38;
  const tail = fishPart(
    new THREE.ConeGeometry(0.24, 0.42, 3),
    mat(palette.fins)
  );
  tail.rotation.x = Math.PI / 2;
  tail.position.z = -0.18;
  tail.scale.x = 0.55;
  tailPivot.add(tail);
  fish.add(tailPivot);

  const dorsal = fishPart(
    new THREE.ConeGeometry(0.12, 0.27, 3),
    mat(palette.fins)
  );
  dorsal.position.set(0, 0.23, -0.05);
  dorsal.rotation.z = Math.PI;
  fish.add(dorsal);

  const finL = fishPart(
    new THREE.ConeGeometry(0.08, 0.23, 3),
    mat(palette.belly)
  );
  finL.position.set(-0.2, -0.04, -0.02);
  finL.rotation.z = -Math.PI / 2;
  finL.rotation.y = 0.35;
  fish.add(finL);
  const finR = finL.clone();
  finR.position.x = 0.2;
  finR.rotation.z = Math.PI / 2;
  fish.add(finR);

  const eyeGeometry = new THREE.SphereGeometry(0.045, 6, 4);
  const eyeL = fishPart(eyeGeometry, mat(0x102027));
  eyeL.position.set(-0.16, 0.1, 0.35);
  fish.add(eyeL);
  const eyeR = fishPart(eyeGeometry, mat(0x102027));
  eyeR.position.set(0.16, 0.1, 0.35);
  fish.add(eyeR);

  fish.userData.isLowPolyFish = true;
  return fish;
}

function makeFishMesh(scale = 1, paletteIndex = 0) {
  const index = Math.abs(paletteIndex) % FISH_PALETTES.length;
  if (!FishModelTemplates[index]) FishModelTemplates[index] = buildFishTemplate(index);
  const fish = FishModelTemplates[index].clone(true);
  fish.scale.setScalar(scale);
  fish.userData.tail = fish.getObjectByName('fish-tail');
  fish.userData.swimOffset = Math.random() * Math.PI * 2;
  return fish;
}

class FishBank {
  constructor(x, z, scene) {
    this.x = x;
    this.z = z;
    this.scene = scene;
    this.radius = 1.8;
    this.vx = Util.rand(-0.6, -0.3);
    this.vz = Util.rand(-0.1, 0.1);
    this.life = 18;
    this.active = true;
    this.fishCount = Util.randInt(4, 8);
    this.mesh = new THREE.Group();
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(this.radius, 16),
      new THREE.MeshBasicMaterial({ color: 0x4fc3f7, transparent: true, opacity: 0.18 })
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.05;
    this.mesh.add(disc);
    this.fish = [];
    for (let i = 0; i < this.fishCount; i++) {
      const f = makeFishMesh(Util.rand(0.42, 0.58), i);
      f.userData.orbitOffset = Math.random() * 0.25;
      this.mesh.add(f);
      this.fish.push(f);
    }
    this.mesh.position.set(x, 0, z);
    scene.add(this.mesh);
  }

  // Extrae un pez real del banco, conserva su posición mundial y reduce el
  // contador. El llamador puede pasarlo a HookVis.attachCatch().
  takeFishVisual() {
    if (this.fishCount <= 0 || this.fish.length === 0) return null;
    this.fishCount--;
    const fish = this.fish.pop();
    this.mesh.updateMatrixWorld(true);
    this.scene.attach(fish);
    fish.userData.caught = true;
    if (this.fishCount <= 0) this.active = false;
    return fish;
  }

  // Mantiene compatible cualquier lógica antigua que todavía reduzca
  // fishCount directamente: el cambio también se refleja visualmente.
  syncVisualCount() {
    const target = Math.max(0, Math.floor(this.fishCount));
    while (this.fish.length > target) {
      const fish = this.fish.pop();
      this.mesh.remove(fish);
      fish.visible = false;
    }
  }

  update(dt, currentSpeed, currentSpeedZ, time) {
    this.x += (this.vx - currentSpeed) * dt;
    this.z += (this.vz - currentSpeedZ) * dt;
    this.life -= dt;
    if (this.life <= 0) this.active = false;
    this.mesh.position.x = this.x;
    this.mesh.position.z = this.z;
    this.mesh.position.y = World.waveHeight(this.x, this.z, time, Game.worldOffset, Game.worldOffsetZ) * World.waveAmp;
    this.syncVisualCount();
    for (let i = 0; i < this.fish.length; i++) {
      const fish = this.fish[i];
      const a = (i / Math.max(1, this.fish.length)) * Math.PI * 2
        + time * 1.5 + fish.userData.orbitOffset;
      fish.position.set(
        Math.cos(a) * this.radius * 0.55,
        -0.08 + Math.sin(time * 3 + i) * 0.08,
        Math.sin(a) * this.radius * 0.35
      );
      // La nariz (+Z local) sigue la tangente de la órbita.
      const dx = -Math.sin(a) * this.radius * 0.55;
      const dz = Math.cos(a) * this.radius * 0.35;
      fish.rotation.y = Math.atan2(dx, dz);
      if (fish.userData.tail) {
        fish.userData.tail.rotation.y =
          Math.sin(time * 9 + fish.userData.swimOffset) * 0.42;
      }
    }
  }

  dispose(scene) {
    scene.remove(this.mesh);
    // Los peces usan recursos compartidos; solo el indicador del banco es
    // propiedad exclusiva de esta instancia.
    this.mesh.traverse(o => {
      if (o.geometry && !o.userData.sharedFishResource) o.geometry.dispose();
      if (o.material && !o.userData.sharedFishResource && o.material.dispose) {
        o.material.dispose();
      }
    });
  }
}

const EntityManager = {
  objects: [],
  dangers: [],
  fishBanks: [],
  spawnTimer: 0,
  dangerTimer: 0,
  fishTimer: 0,
  scene: null,

  init: (scene) => { EntityManager.scene = scene; },

  reset: () => {
    for (const o of EntityManager.objects) o.dispose(EntityManager.scene);
    for (const d of EntityManager.dangers) d.dispose(EntityManager.scene);
    for (const f of EntityManager.fishBanks) f.dispose(EntityManager.scene);
    EntityManager.objects = [];
    EntityManager.dangers = [];
    EntityManager.fishBanks = [];
    EntityManager.spawnTimer = 0;
    EntityManager.dangerTimer = 0;
    EntityManager.fishTimer = 0;
  },

  pickType: (zone) => {
    let table = FLOATING_TYPES.map(t => ({ ...t }));
    if (zone === 'debris') {
      const plank = table.find(t => t.key === 'plank'); if (plank) plank.weight += 10;
      const scrap = table.find(t => t.key === 'scrap'); if (scrap) scrap.weight += 6;
    }
    if (zone === 'polluted') {
      const barrel = table.find(t => t.key === 'barrel'); if (barrel) barrel.weight += 8;
    }
    if (zone === 'calm') {
      const fruit = table.find(t => t.key === 'fruit'); if (fruit) fruit.weight += 4;
    }
    const total = table.reduce((s, t) => s + t.weight, 0);
    let r = Math.random() * total;
    for (const t of table) {
      r -= t.weight;
      if (r <= 0) return t.key;
    }
    return table[0].key;
  },

  spawn: (center, zone) => {
    const x = center.x + Util.rand(16, 24);
    const z = center.z + Util.rand(-8, 8);
    const type = EntityManager.pickType(zone);
    const obj = new FloatingObject(x, z, type, EntityManager.scene);
    // Los restos aparecen por delante y derivan más despacio que la balsa.
    obj.vx = Util.rand(-0.15, 0.45);
    obj.vz = Util.rand(-0.15, 0.15);
    EntityManager.objects.push(obj);
  },

  spawnDanger: (center, zone) => {
    const x = center.x + 18;
    const z = center.z + Util.rand(-14, 14);
    if (zone === 'sharks' || Math.random() < 0.4) {
      const d = new Danger(x, z, 'shark', EntityManager.scene);
      d.vx = Util.rand(-0.25, 0.3);
      EntityManager.dangers.push(d);
    }
  },

  spawnFishBank: (center) => {
    const x = center.x + 14;
    const z = center.z + Util.rand(-9, 9);
    const f = new FishBank(x, z, EntityManager.scene);
    f.vx = Util.rand(-0.1, 0.25);
    EntityManager.fishBanks.push(f);
  },

  update: (dt, center, zone, day, currentSpeed, currentSpeedZ, time) => {
    EntityManager.spawnTimer -= dt;
    if (EntityManager.spawnTimer <= 0) {
      const base = Math.max(0.8, 2.5 - day * 0.08);
      EntityManager.spawnTimer = Util.rand(base, base + 1.5);
      EntityManager.spawn(center, zone);
    }
    EntityManager.dangerTimer -= dt;
    if (EntityManager.dangerTimer <= 0) {
      const base = zone === 'sharks' ? 10 : (zone === 'storm' ? 6 : 14);
      EntityManager.dangerTimer = Util.rand(base, base * 1.8);
      EntityManager.spawnDanger(center, zone);
    }
    EntityManager.fishTimer -= dt;
    if (EntityManager.fishTimer <= 0) {
      EntityManager.fishTimer = Util.rand(15, 35);
      if (zone === 'fish' || Math.random() < 0.4) EntityManager.spawnFishBank(center);
    }

    for (let i = EntityManager.objects.length - 1; i >= 0; i--) {
      const o = EntityManager.objects[i];
      if (!o.marked && !o.pendingDecision) o.update(dt, currentSpeed, currentSpeedZ, time);
      if (Math.abs(o.x - center.x) > 45 || Math.abs(o.z - center.z) > 30) {
        o.dispose(EntityManager.scene);
        EntityManager.objects.splice(i, 1);
      }
    }
    for (let i = EntityManager.dangers.length - 1; i >= 0; i--) {
      const d = EntityManager.dangers[i];
      d.update(dt, currentSpeed, currentSpeedZ, time);
      if (!d.active || d.x < center.x - 30) {
        d.dispose(EntityManager.scene);
        EntityManager.dangers.splice(i, 1);
      }
    }
    for (let i = EntityManager.fishBanks.length - 1; i >= 0; i--) {
      const f = EntityManager.fishBanks[i];
      f.update(dt, currentSpeed, currentSpeedZ, time);
      if (!f.active || f.x < center.x - 30) {
        f.dispose(EntityManager.scene);
        EntityManager.fishBanks.splice(i, 1);
      }
    }
  }
};
