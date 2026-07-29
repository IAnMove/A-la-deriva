/*****************************************************
 * raft.js - Balsa 3D, construcción, edificios
 *****************************************************/

const BUILDINGS = {
  floor: {
    key: 'floor', name: 'Suelo de madera', icon: '🪵', category: 'basic',
    cost: { wood: 2 },
    desc: 'Expande la superficie de la balsa.',
    weight: 0.5, health: 50, provides: { area: 1 }
  },
  storage: {
    key: 'storage', name: 'Caja de almacenamiento', icon: '📦', category: 'basic',
    cost: { wood: 4, rope: 2 },
    desc: 'Aumenta la capacidad de inventario.',
    weight: 0.8, health: 40, provides: { storage: 10 }
  },
  bed: {
    key: 'bed', name: 'Cama improvisada', icon: '🛏️', category: 'basic',
    cost: { wood: 3, cloth: 2 },
    desc: 'Mejora la recuperación de salud y moral.',
    weight: 0.6, health: 30, provides: { rest: 1 }
  },
  net: {
    key: 'net', name: 'Red de pesca', icon: '🕸️', category: 'basic',
    cost: { rope: 4, wood: 2 },
    desc: 'Captura 0,55 raciones de comida al día si está intacta.',
    weight: 0.7, health: 35, provides: { autoFood: 0.55 }
  },
  rain: {
    key: 'rain', name: 'Recolector de lluvia', icon: '🌧️', category: 'basic',
    cost: { plastic: 3, cloth: 2 },
    desc: 'Recoge hasta 1,1 de agua por día mientras llueve.',
    weight: 0.7, health: 30, provides: { rainWater: 1.1 }
  },
  crop: {
    key: 'crop', name: 'Pequeño cultivo', icon: '🌱', category: 'basic',
    cost: { wood: 2, cloth: 1 },
    desc: 'Cultiva 0,3 raciones de comida al día si está intacto.',
    weight: 0.5, health: 25, provides: { autoFood: 0.3 }
  },
  fire: {
    key: 'fire', name: 'Hoguera protegida', icon: '🔥', category: 'basic',
    cost: { wood: 4, metal: 1 },
    desc: 'Permite cocinar pescado para más valor.',
    weight: 0.9, health: 35, provides: { cook: 1 }
  },
  sail: {
    key: 'sail', name: 'Vela', icon: '⛵', category: 'basic',
    cost: { cloth: 5, wood: 4, rope: 3 },
    desc: 'Da propulsión y permite navegar con un timón operativo.',
    weight: 1.0, health: 40, provides: { sail: 1 }
  },
  rudder: {
    key: 'rudder', name: 'Timón', icon: '⚓', category: 'basic',
    cost: { wood: 5, metal: 2, rope: 2 },
    desc: 'Fija el rumbo lateral y mejora la eficacia de vela y remo.',
    weight: 1.0, health: 45, provides: { rudder: 1 }
  },
  purifier: {
    key: 'purifier', name: 'Purificador de agua', icon: '💧', category: 'advanced',
    cost: { metal: 4, plastic: 3, wood: 3 },
    desc: 'Purifica 0,8 de agua al día si está intacto.',
    weight: 1.2, health: 40, provides: { purifiedWater: 0.8 }
  },
  kitchen: {
    key: 'kitchen', name: 'Cocina', icon: '🍳', category: 'advanced',
    cost: { metal: 3, wood: 4, plastic: 2 },
    desc: 'Cocina raciones con más recuperación; no crea comida.',
    weight: 1.1, health: 45, provides: { cook: 2 }
  },
  medkit: {
    key: 'medkit', name: 'Botiquín', icon: '💊', category: 'advanced',
    cost: { cloth: 4, plastic: 2, metal: 2 },
    desc: 'Cura salud cada día.',
    weight: 0.6, health: 30, provides: { heal: 3 }
  },
  mast: {
    key: 'mast', name: 'Mástil', icon: '🏴', category: 'advanced',
    cost: { wood: 8, metal: 4, rope: 4 },
    desc: 'Permite construir una vela mayor.',
    weight: 1.5, health: 60, provides: { mast: 1 }
  },
  shelter: {
    key: 'shelter', name: 'Refugio', icon: '⛺', category: 'advanced',
    cost: { wood: 6, cloth: 6, rope: 3 },
    desc: 'Protege de tormentas y mejora moral.',
    weight: 1.8, health: 70, provides: { shelter: 1 }
  },
  radio: {
    key: 'radio', name: 'Radio', icon: '📻', category: 'advanced',
    cost: { metal: 6, plastic: 4, cloth: 2 },
    desc: 'Emite señal de socorro para victoria.',
    weight: 1.0, health: 35, provides: { radio: 1 }
  },
  motor: {
    key: 'motor', name: 'Motor improvisado', icon: '⚡', category: 'advanced',
    cost: { metal: 8, plastic: 5, wood: 4 },
    desc: 'Acelera la ruta a una isla; convierte plástico en combustible.',
    weight: 2.0, health: 50, provides: { motor: 1 }
  },
};

// ---- Constructores de modelos 3D (low-poly, primitivas) ----
const MatLib = {};
function mat(color, emissive = null) {
  const key = color + '|' + emissive;
  if (!MatLib[key]) {
    const m = new THREE.MeshLambertMaterial({ color });
    if (emissive) m.emissive = new THREE.Color(emissive);
    m.userData.sharedRaftMaterial = true;
    MatLib[key] = m;
  }
  return MatLib[key];
}
function box(w, h, d, color, x = 0, y = 0, z = 0, emissive = null) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, emissive));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}
function cyl(rt, rb, h, color, x = 0, y = 0, z = 0, seg = 8) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}
function cone(r, h, color, x = 0, y = 0, z = 0, seg = 6) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}
function triSail(w, h, color, x = 0, y = 0, z = 0) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(w, h * 0.15);
  shape.lineTo(0, h);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: false });
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

// Modelo 3D de cada estructura (sin el suelo base). Origen en el centro de la celda, y=0 = superficie del suelo.
function buildStructureMesh(key) {
  const g = new THREE.Group();
  switch (key) {
    case 'storage':
      g.add(box(1.1, 0.7, 1.1, 0xa1887f, 0, 0.35, 0));
      g.add(box(1.2, 0.12, 1.2, 0x8d6e63, 0, 0.76, 0));
      break;
    case 'bed':
      g.add(box(1.5, 0.22, 1.0, 0xb0bec5, 0, 0.11, 0));
      g.add(box(0.4, 0.16, 0.8, 0xeceff1, -0.5, 0.3, 0));
      break;
    case 'net': {
      const geo = new THREE.PlaneGeometry(1.6, 1.6, 4, 4);
      geo.rotateX(-Math.PI / 2);
      const netMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xcfd8dc, wireframe: true }));
      netMesh.position.y = 0.06;
      g.add(netMesh);
      g.add(cyl(0.05, 0.05, 1.6, 0x5d4037, 0, 0.05, -0.8));
      g.add(cyl(0.05, 0.05, 1.6, 0x5d4037, 0, 0.05, 0.8));
      break;
    }
    case 'rain':
      g.add(cyl(0.6, 0.35, 0.7, 0x4fc3f7, 0, 0.55, 0, 10));
      g.add(cyl(0.05, 0.05, 0.4, 0x78909c, -0.3, 0.2, -0.3));
      g.add(cyl(0.05, 0.05, 0.4, 0x78909c, 0.3, 0.2, 0.3));
      break;
    case 'crop':
      g.add(box(1.3, 0.25, 1.3, 0x4e342e, 0, 0.12, 0));
      g.add(cone(0.16, 0.45, 0x66bb6a, -0.35, 0.45, -0.3));
      g.add(cone(0.16, 0.55, 0x81c784, 0.3, 0.5, 0.25));
      g.add(cone(0.14, 0.4, 0x4caf50, 0.1, 0.42, -0.35));
      break;
    case 'fire': {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.13, 6, 10), mat(0x78909c));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.1;
      g.add(ring);
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.7, 6), new THREE.MeshBasicMaterial({ color: 0xff7043 }));
      flame.position.y = 0.5;
      flame.name = 'flame';
      g.add(flame);
      break;
    }
    case 'sail':
      g.add(cyl(0.07, 0.09, 2.2, 0x5d4037, 0, 1.1, 0));
      g.add(triSail(1.1, 1.5, 0xe3f2fd, 0.05, 0.4, 0));
      break;
    case 'rudder': {
      g.add(box(0.14, 0.9, 0.65, 0x3e2723, 0, 0.45, 0));
      const handle = cyl(0.05, 0.05, 0.9, 0x5d4037, 0, 0.95, 0);
      handle.rotation.z = Math.PI / 2;
      g.add(handle);
      break;
    }
    case 'purifier':
      g.add(cyl(0.45, 0.5, 0.9, 0x90a4ae, 0, 0.45, 0, 10));
      g.add(cyl(0.25, 0.25, 0.5, 0x4fc3f7, 0, 1.1, 0, 8));
      g.add(box(0.7, 0.1, 0.7, 0x607d8b, 0, 0.02, 0));
      break;
    case 'kitchen':
      g.add(box(1.2, 0.8, 0.9, 0x8d6e63, 0, 0.4, 0));
      g.add(cyl(0.12, 0.12, 0.7, 0x546e7a, 0.35, 1.1, -0.2));
      g.add(box(0.5, 0.1, 0.5, 0x263238, -0.25, 0.85, 0.1));
      break;
    case 'medkit':
      g.add(box(0.85, 0.55, 0.85, 0xeceff1, 0, 0.28, 0));
      g.add(box(0.5, 0.1, 0.16, 0xe53935, 0, 0.58, 0));
      g.add(box(0.16, 0.1, 0.5, 0xe53935, 0, 0.58, 0));
      break;
    case 'mast':
      g.add(cyl(0.09, 0.12, 2.8, 0x5d4037, 0, 1.4, 0));
      g.add(triSail(0.7, 0.5, 0x263238, 0.08, 2.3, 0));
      break;
    case 'shelter': {
      const tent = new THREE.Mesh(new THREE.ConeGeometry(1.0, 1.2, 4), mat(0xd7ccc8));
      tent.rotation.y = Math.PI / 4;
      tent.position.y = 0.6;
      tent.castShadow = true;
      g.add(tent);
      g.add(box(0.4, 0.5, 0.05, 0x4e342e, 0, 0.25, 0.62));
      break;
    }
    case 'radio':
      g.add(box(0.9, 0.55, 0.6, 0x455a64, 0, 0.28, 0));
      g.add(cyl(0.025, 0.025, 1.3, 0xcfd8dc, 0.3, 1.1, 0));
      g.add(cone(0.09, 0.15, 0xe53935, 0.3, 1.8, 0));
      g.add(cyl(0.12, 0.12, 0.06, 0x263238, -0.2, 0.3, 0.31));
      break;
    case 'motor': {
      g.add(box(0.95, 0.6, 0.7, 0x607d8b, 0, 0.35, 0));
      const prop = box(0.08, 0.7, 0.12, 0x263238, 0.55, 0.15, 0);
      prop.name = 'prop';
      g.add(prop);
      const shaft = cyl(0.06, 0.06, 0.5, 0x37474f, 0.35, 0.2, 0);
      shaft.rotation.z = Math.PI / 2;
      g.add(shaft);
      break;
    }
  }
  return g;
}

class Raft {
  constructor() {
    this.cellSize = 2; // unidades de mundo por celda
    this.grid = new Map(); // "gx,gy" => { buildingKey, health, mesh }
    this.damage = 0;
    this.lastDetached = 0;
    this.selected = null;
    this.group = null; // THREE.Group con todos los bloques
  }

  init(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
  }

  reset() {
    if (this.group) {
      for (const cell of this.grid.values()) this.disposeMesh(cell);
    }
    this.grid.clear();
    this.damage = 0;
    this.lastDetached = 0;
    this.selected = null;
    this.placeAt(0, 0, 'floor', true);
  }

  disposeMesh(cell) {
    if (!cell.mesh) return;
    this.group.remove(cell.mesh);
    cell.mesh.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      const materials = Array.isArray(o.material) ? o.material : [o.material];
      for (const material of materials) {
        if (material?.dispose && !material.userData?.sharedRaftMaterial) {
          material.dispose();
        }
      }
    });
    cell.mesh = null;
  }

  key(gx, gy) { return `${gx},${gy}`; }
  get(gx, gy) { return this.grid.get(this.key(gx, gy)); }
  has(gx, gy) { return this.grid.has(this.key(gx, gy)); }

  placeAt(gx, gy, buildingKey, free = false, durabilityBonus = 0) {
    const b = BUILDINGS[buildingKey];
    if (!b) return false;
    if (this.has(gx, gy)) return false;
    const maxHealth = Math.round(b.health * (b.category === 'advanced' ? 1 + durabilityBonus : 1));
    const cell = { buildingKey, health: maxHealth, maxHealth, mesh: null };
    this.grid.set(this.key(gx, gy), cell);
    this.buildCellMesh(gx, gy, cell);
    return true;
  }

  buildCellMesh(gx, gy, cell) {
    if (!this.group) return;
    const cs = this.cellSize;
    const cg = new THREE.Group();
    cg.position.set((gx + 0.5) * cs, 0, (gy + 0.5) * cs);

    // Bloque base de madera (tablones)
    const base = box(cs - 0.08, 0.4, cs - 0.08, 0x8d6e63, 0, 0.15, 0);
    base.receiveShadow = true;
    base.name = 'base';
    cg.add(base);
    // Listones oscuros entre tablones
    cg.add(box(cs - 0.08, 0.42, 0.06, 0x5d4037, 0, 0.15, 0));

    // Estructura encima
    if (cell.buildingKey !== 'floor') {
      const s = buildStructureMesh(cell.buildingKey);
      s.position.y = 0.35;
      s.name = 'structure';
      cg.add(s);
    }

    cell.mesh = cg;
    this.group.add(cg);
  }

  removeAt(gx, gy) {
    const k = this.key(gx, gy);
    if (!this.grid.has(k)) return false;
    if (this.grid.size <= 1) return false;
    if (!this.isConnectedWithout(k)) return false;
    this.disposeMesh(this.grid.get(k));
    this.grid.delete(k);
    return true;
  }

  isConnectedWithout(excludedKey = null) {
    const remaining = Array.from(this.grid.keys()).filter(k => k !== excludedKey);
    if (remaining.length <= 1) return true;
    const pending = [remaining[0]];
    const visited = new Set(pending);
    while (pending.length) {
      const k = pending.pop();
      const [gx, gy] = k.split(',').map(Number);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nk = this.key(gx + dx, gy + dy);
        if (nk !== excludedKey && this.grid.has(nk) && !visited.has(nk)) {
          visited.add(nk);
          pending.push(nk);
        }
      }
    }
    return visited.size === remaining.length;
  }

  removeDetachedCells() {
    if (this.grid.size <= 1) return 0;
    const unvisited = new Set(this.grid.keys());
    const components = [];
    while (unvisited.size) {
      const first = unvisited.values().next().value;
      const component = [];
      const pending = [first];
      unvisited.delete(first);
      while (pending.length) {
        const k = pending.pop();
        component.push(k);
        const [gx, gy] = k.split(',').map(Number);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nk = this.key(gx + dx, gy + dy);
          if (unvisited.has(nk)) {
            unvisited.delete(nk);
            pending.push(nk);
          }
        }
      }
      components.push(component);
    }
    if (components.length <= 1) return 0;
    const core = components.find(c => c.includes('0,0')) ||
      components.reduce((largest, c) => c.length > largest.length ? c : largest, []);
    const keep = new Set(core);
    let removed = 0;
    for (const [k, cell] of Array.from(this.grid.entries())) {
      if (keep.has(k)) continue;
      this.disposeMesh(cell);
      this.grid.delete(k);
      removed++;
    }
    return removed;
  }

  isConnected(gx, gy) {
    if (gx === 0 && gy === 0) return true;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (this.has(gx + dx, gy + dy)) return true;
    }
    return false;
  }

  getBounds() {
    if (this.grid.size === 0) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    const keys = this.grid.keys();
    const first = keys.next().value;
    let [minX, minY] = first.split(',').map(Number);
    let maxX = minX, maxY = minY;
    for (const k of keys) {
      const [gx, gy] = k.split(',').map(Number);
      minX = Math.min(minX, gx); maxX = Math.max(maxX, gx);
      minY = Math.min(minY, gy); maxY = Math.max(maxY, gy);
    }
    return { minX, maxX, minY, maxY };
  }

  getCellWorldPos(gx, gy) {
    return { x: gx * this.cellSize, z: gy * this.cellSize };
  }

  getCenter() {
    const b = this.getBounds();
    const cx = (b.minX + b.maxX + 1) * this.cellSize * 0.5;
    const cz = (b.minY + b.maxY + 1) * this.cellSize * 0.5;
    return { x: cx, z: cz };
  }

  totalArea() { return this.grid.size; }

  totalWeight() {
    let w = 0;
    for (const v of this.grid.values()) w += BUILDINGS[v.buildingKey].weight;
    return w;
  }

  maxWeight() {
    return Math.max(4, this.totalArea() * 2.5 + this.countProvides('storage'));
  }

  cellEfficiency(cell) {
    if (!cell || cell.health <= 0) return 0;
    const building = BUILDINGS[cell.buildingKey];
    if (!building) return 0;
    const maxHealth = Math.max(1, Number(cell.maxHealth) || building.health);
    return Util.clamp(cell.health / maxHealth, 0, 1);
  }

  isOperational(cell) {
    return this.cellEfficiency(cell) > 0;
  }

  countProvides(key) {
    let n = 0;
    for (const v of this.grid.values()) {
      const p = BUILDINGS[v.buildingKey].provides;
      if (p && p[key]) n += p[key] * this.cellEfficiency(v);
    }
    return n;
  }

  totalAutoFood() { return this.countProvides('autoFood'); }
  totalAutoWater() { return this.countProvides('rainWater') + this.countProvides('purifiedWater'); }
  totalShelter() { return this.countProvides('shelter'); }

  takeDamage(amount) {
    const shelter = this.totalShelter();
    if (shelter > 0) amount *= Math.max(0.3, 1 - shelter * 0.25);
    const cells = Array.from(this.grid.entries());
    if (!cells.length) return 0;
    const target = Util.choice(cells);
    this.lastDetached = 0;
    target[1].health -= amount;
    this.tintDamaged(target[1]);
    if (target[1].health <= 0) {
      this.disposeMesh(target[1]);
      this.grid.delete(target[0]);
      this.lastDetached = this.removeDetachedCells();
    }
    this.damage = amount;
    return amount;
  }

  // Oscurece el bloque según el daño sufrido
  tintDamaged(cell) {
    if (!cell.mesh) return;
    const b = BUILDINGS[cell.buildingKey];
    const pct = cell.health / (cell.maxHealth || b.health);
    const base = cell.mesh.getObjectByName('base');
    if (base) {
      if (pct < 0.7) {
        const f = pct < 0.3 ? 0.45 : 0.7;
        const damagedColor = new THREE.Color(0x8d6e63)
          .multiplyScalar(f)
          .getHex();
        base.material = mat(damagedColor);
      } else {
        base.material = mat(0x8d6e63);
      }
    }
  }

  repairAt(gx, gy, amount) {
    const cell = this.get(gx, gy);
    if (!cell) return false;
    const max = cell.maxHealth || BUILDINGS[cell.buildingKey].health;
    if (cell.health >= max) return false;
    cell.health = Math.min(max, cell.health + amount);
    this.tintDamaged(cell);
    return true;
  }

  worldToGrid(wx, wz) {
    return {
      gx: Math.floor(wx / this.cellSize),
      gy: Math.floor(wz / this.cellSize)
    };
  }

  intersectsCircle(wx, wz, radius = 0) {
    const cs = this.cellSize;
    for (const k of this.grid.keys()) {
      const [gx, gy] = k.split(',').map(Number);
      const minX = gx * cs;
      const maxX = (gx + 1) * cs;
      const minZ = gy * cs;
      const maxZ = (gy + 1) * cs;
      const nearestX = Util.clamp(wx, minX, maxX);
      const nearestZ = Util.clamp(wz, minZ, maxZ);
      if (Math.hypot(wx - nearestX, wz - nearestZ) <= radius) return true;
    }
    return false;
  }
}

const BuildManager = {
  active: false,
  placing: false,
  selected: null,

  toggle: () => {
    BuildManager.active = !BuildManager.active;
    BuildManager.placing = false;
    BuildManager.selected = null;
  },
  close: () => {
    BuildManager.active = false;
    BuildManager.placing = false;
    BuildManager.selected = null;
  },
  startPlacing: (key) => {
    BuildManager.selected = key;
    BuildManager.active = false;
    BuildManager.placing = true;
  },
  stopPlacing: () => {
    BuildManager.placing = false;
    BuildManager.selected = null;
  },

  canAfford: (buildingKey, resources) => {
    const c = BUILDINGS[buildingKey].cost;
    for (const [k, v] of Object.entries(c)) {
      if ((resources[k] || 0) < v) return false;
    }
    return true;
  },

  payCost: (cost, resources) => {
    for (const [k, v] of Object.entries(cost)) {
      resources[k] = (resources[k] || 0) - v;
      if (resources[k] < 0) resources[k] = 0;
    }
  },

  realCost: (buildingKey, carpenterBonus = 0) => {
    const c = BUILDINGS[buildingKey].cost;
    const out = {};
    for (const [k, v] of Object.entries(c)) {
      let val = v;
      if (k === 'wood' && carpenterBonus) {
        val = Math.max(0.25, Math.round(val * (1 + carpenterBonus) * 100) / 100);
      }
      out[k] = val;
    }
    return out;
  },

  canAffordCustom: (cost, resources) => {
    for (const [k, v] of Object.entries(cost)) {
      if ((resources[k] || 0) < v) return false;
    }
    return true;
  },

  renderMenu: (container, resources, carpenterBonus = 0) => {
    container.innerHTML = '';
    const activeTab = document.querySelector('#build-tabs .tab.active')?.dataset.tab || 'basic';
    for (const [key, b] of Object.entries(BUILDINGS)) {
      if (b.category !== activeTab) continue;
      const cost = BuildManager.realCost(key, carpenterBonus);
      const affordable = BuildManager.canAffordCustom(cost, resources);
      const div = document.createElement('div');
      div.className = `build-item ${BuildManager.selected === key ? 'selected' : ''}`;
      div.dataset.key = key;
      div.innerHTML = `
        <div class="build-icon">${b.icon}</div>
        <div class="build-info">
          <div class="build-name">${b.name}</div>
          <div class="build-cost">${Object.entries(cost).map(([k, v]) => `${Util.resourceName(k)}: ${Util.formatAmount(v, 2)}`).join(', ')}</div>
        </div>
        <div style="color:${affordable ? 'var(--success)' : 'var(--danger)'};font-size:0.75rem">${affordable ? '✓' : '✗'}</div>
      `;
      div.onclick = () => {
        BuildManager.startPlacing(key);
        if (typeof Game !== 'undefined' && Game.updateBuildMenu) Game.updateBuildMenu();
      };
      container.appendChild(div);
    }
  },

  renderInfo: (container, key, resources, carpenterBonus = 0) => {
    const b = BUILDINGS[key];
    const cost = BuildManager.realCost(key, carpenterBonus);
    const affordable = BuildManager.canAffordCustom(cost, resources);
    container.innerHTML = `
      <strong>${b.name}</strong><br>
      ${b.desc}<br>
      <span style="color:${affordable ? 'var(--success)' : 'var(--danger)'}">
        Coste: ${Object.entries(cost).map(([k, v]) => `${Util.resourceName(k)}: ${Util.formatAmount(v, 2)}`).join(', ')}
      </span><br>
      <em style="color:var(--muted);font-size:0.8rem">Clic en una celda válida para colocar. Escape cancela.</em>
    `;
  }
};
