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
  lookout: {
    key: 'lookout', name: 'Torre de vigía', icon: '🔭', category: 'basic',
    cost: { wood: 5, rope: 2, cloth: 1 },
    desc: 'Alarga el aviso de los tiburones y permite anticipar peligros en varios eventos.',
    drawback: 'Es alta y recibe más daño durante incendios y tormentas.',
    weight: 1.1, health: 38, provides: { lookout: 1 }
  },
  smokehouse: {
    key: 'smokehouse', name: 'Ahumadero', icon: '🥓', category: 'basic',
    cost: { wood: 5, metal: 1, rope: 1 },
    desc: 'Reduce el deterioro de la comida y permite ahumar una ración para aprovecharla mejor.',
    drawback: 'Su olor aumenta ligeramente la posibilidad de atraer tiburones.',
    weight: 1.0, health: 38, provides: { preserve: 1, sharkScent: 1 }
  },
  armor: {
    key: 'armor', name: 'Blindaje lateral', icon: '🛡️', category: 'basic',
    cost: { wood: 4, metal: 3, rope: 2 },
    desc: 'Reduce el daño causado por corales, tiburones y golpes contra la balsa.',
    drawback: 'Es muy pesado y ralentiza la navegación.',
    weight: 2.8, health: 80, provides: { armor: 1 }
  },
  anchor: {
    key: 'anchor', name: 'Ancla improvisada', icon: '🪝', category: 'basic',
    cost: { metal: 3, rope: 4, wood: 2 },
    desc: 'Se puede desplegar para detener la deriva y resistir corrientes mientras recoges recursos.',
    drawback: 'Desplegada impide avanzar y puede tensar la balsa durante una tormenta.',
    weight: 1.8, health: 55, provides: { anchor: 1 }
  },
  bunk: {
    key: 'bunk', name: 'Camarote común', icon: '🛌', category: 'basic',
    cost: { wood: 5, cloth: 4, rope: 2 },
    desc: 'Da descanso a dos tripulantes y reduce estrés, alucinaciones y conflictos.',
    drawback: 'Si no hay plazas para todos aparecen celos y baja la moral.',
    weight: 1.3, health: 45, provides: { bunk: 2, rest: 0.5 }
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
    desc: 'Amplifica la señal de una radio operativa; sin radio no tiene efecto.',
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
  harpoon: {
    key: 'harpoon', name: 'Arponera', icon: '🔱', category: 'advanced',
    cost: { metal: 6, rope: 4, wood: 4 },
    desc: 'Permite disparar contra un tiburón cercano para ahuyentarlo y recuperar algo de comida.',
    drawback: 'Cada disparo daña el mecanismo y exige acercarse a la arponera.',
    weight: 1.7, health: 55, provides: { harpoon: 1 }
  },
  infirmary: {
    key: 'infirmary', name: 'Enfermería', icon: '🏥', category: 'advanced',
    cost: { cloth: 6, plastic: 4, metal: 3, wood: 3 },
    desc: 'Cura heridas, acorta infecciones y mejora mucho el trabajo de médicos.',
    drawback: 'Necesita tela y agua para resolver brotes graves.',
    weight: 1.4, health: 48, provides: { infirmary: 1, heal: 2 }
  },
  chart: {
    key: 'chart', name: 'Mesa de navegación', icon: '🗺️', category: 'advanced',
    cost: { wood: 5, cloth: 3, plastic: 2 },
    desc: 'Mejora decisiones de ruta, permite leer corrientes y acelera el viaje a la isla.',
    drawback: 'Rinde poco sin timón operativo o sin un navegante.',
    weight: 1.0, health: 40, provides: { forecast: 1, navigation: 1 }
  },
  beacon: {
    key: 'beacon', name: 'Faro de señales', icon: '🚨', category: 'advanced',
    cost: { metal: 5, plastic: 5, cloth: 2 },
    desc: 'Se puede encender para generar señal de rescate incluso sin radio.',
    drawback: 'Consume combustible cada día y su luz atrae amenazas.',
    weight: 1.4, health: 42, provides: { beacon: 1 }
  },
  containment: {
    key: 'containment', name: 'Celda de contención', icon: '🔒', category: 'advanced',
    cost: { metal: 7, wood: 5, rope: 3 },
    desc: 'Ayuda a reducir NPC hostiles y ofrece una salida segura durante motines o brotes.',
    drawback: 'Tenerla a bordo reduce confianza y moral si nadie está en crisis.',
    weight: 2.0, health: 70, provides: { containment: 1 }
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
    case 'lookout':
      g.add(cyl(0.09, 0.12, 2.4, 0x5d4037, 0, 1.2, 0));
      g.add(box(1.25, 0.12, 1.25, 0x8d6e63, 0, 2.1, 0));
      g.add(cyl(0.13, 0.16, 0.65, 0x263238, 0.18, 2.38, 0));
      break;
    case 'smokehouse': {
      g.add(box(1.25, 1.0, 1.1, 0x6d4c41, 0, 0.5, 0));
      const smokePipe = cyl(0.13, 0.16, 0.9, 0x455a64, 0.35, 1.35, 0);
      g.add(smokePipe);
      g.add(box(0.42, 0.55, 0.04, 0x3e2723, 0, 0.48, 0.57));
      break;
    }
    case 'armor':
      g.add(box(1.72, 0.72, 0.16, 0x607d8b, 0, 0.36, -0.78));
      g.add(box(1.72, 0.72, 0.16, 0x607d8b, 0, 0.36, 0.78));
      g.add(box(0.16, 0.72, 1.4, 0x455a64, -0.78, 0.36, 0));
      g.add(box(0.16, 0.72, 1.4, 0x455a64, 0.78, 0.36, 0));
      break;
    case 'anchor': {
      g.add(cyl(0.09, 0.09, 1.2, 0x37474f, 0, 0.35, 0));
      const cross = box(1.0, 0.12, 0.12, 0x37474f, 0, 0.12, 0);
      g.add(cross);
      g.add(new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.07, 6, 10), mat(0x455a64)));
      break;
    }
    case 'bunk':
      g.add(box(1.55, 0.14, 0.72, 0x8d6e63, 0, 0.25, -0.38));
      g.add(box(1.55, 0.14, 0.72, 0x8d6e63, 0, 0.95, 0.38));
      g.add(box(1.42, 0.1, 0.62, 0x90caf9, 0, 0.36, -0.38));
      g.add(box(1.42, 0.1, 0.62, 0x90caf9, 0, 1.06, 0.38));
      break;
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
    case 'harpoon': {
      g.add(cyl(0.18, 0.24, 0.7, 0x546e7a, 0, 0.35, 0));
      const launcher = cyl(0.09, 0.09, 1.45, 0x37474f, 0, 0.82, 0);
      launcher.rotation.x = Math.PI / 2;
      g.add(launcher);
      const tip = cone(0.16, 0.42, 0xcfd8dc, 0, 0.82, -0.9);
      tip.rotation.x = Math.PI / 2;
      g.add(tip);
      break;
    }
    case 'infirmary':
      g.add(box(1.5, 0.28, 0.8, 0xeceff1, 0, 0.22, 0));
      g.add(box(0.35, 0.16, 0.68, 0x90caf9, -0.48, 0.45, 0));
      g.add(box(0.52, 0.12, 0.16, 0xe53935, 0.42, 0.44, 0));
      g.add(box(0.16, 0.12, 0.52, 0xe53935, 0.42, 0.44, 0));
      break;
    case 'chart':
      g.add(box(1.45, 0.16, 1.1, 0x8d6e63, 0, 0.72, 0));
      g.add(box(1.2, 0.03, 0.85, 0xfff3c4, 0, 0.82, 0));
      for (const x of [-0.55, 0.55]) {
        for (const z of [-0.38, 0.38]) g.add(cyl(0.05, 0.06, 0.7, 0x5d4037, x, 0.35, z));
      }
      break;
    case 'beacon':
      g.add(cyl(0.28, 0.4, 1.15, 0x455a64, 0, 0.58, 0));
      g.add(cyl(0.32, 0.32, 0.42, 0xffca28, 0, 1.35, 0, 10));
      g.add(cone(0.38, 0.22, 0xe53935, 0, 1.68, 0, 10));
      break;
    case 'containment':
      for (const x of [-0.72, -0.24, 0.24, 0.72]) {
        g.add(cyl(0.035, 0.035, 1.25, 0x78909c, x, 0.63, -0.62));
        g.add(cyl(0.035, 0.035, 1.25, 0x78909c, x, 0.63, 0.62));
      }
      g.add(box(1.55, 0.08, 1.35, 0x546e7a, 0, 1.25, 0));
      break;
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

  // Ruta más corta entre dos celdas ocupadas, moviéndose solo en los cuatro
  // ejes cardinales. Incluye tanto la celda inicial como la celda de destino.
  findPath(startGx, startGy, targetGx, targetGy) {
    if (![startGx, startGy, targetGx, targetGy].every(Number.isInteger)) return null;

    const startKey = this.key(startGx, startGy);
    const targetKey = this.key(targetGx, targetGy);
    if (!this.grid.has(startKey) || !this.grid.has(targetKey)) return null;
    if (startKey === targetKey) return [{ gx: startGx, gy: startGy }];

    const pending = [startKey];
    const cameFrom = new Map([[startKey, null]]);
    let pendingIndex = 0;

    while (pendingIndex < pending.length) {
      const currentKey = pending[pendingIndex++];
      const [gx, gy] = currentKey.split(',').map(Number);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nextKey = this.key(gx + dx, gy + dy);
        if (!this.grid.has(nextKey) || cameFrom.has(nextKey)) continue;

        cameFrom.set(nextKey, currentKey);
        if (nextKey === targetKey) {
          const path = [];
          let pathKey = targetKey;
          while (pathKey !== null) {
            const [pathGx, pathGy] = pathKey.split(',').map(Number);
            path.push({ gx: pathGx, gy: pathGy });
            pathKey = cameFrom.get(pathKey);
          }
          path.reverse();
          return path;
        }
        pending.push(nextKey);
      }
    }

    return null;
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

  takeDamage(amount, impactX = null, impactZ = null, damageType = 'generic') {
    const shelter = this.totalShelter();
    if (shelter > 0) amount *= Math.max(0.3, 1 - shelter * 0.25);
    const armor = this.countProvides('armor');
    if (armor > 0 && damageType !== 'fire') {
      const protectionPerModule =
        damageType === 'reef' ? 0.24 :
          damageType === 'shark' ? 0.18 : 0.1;
      const maxProtection =
        damageType === 'reef' ? 0.65 :
          damageType === 'shark' ? 0.5 : 0.32;
      amount *= 1 - Math.min(maxProtection, armor * protectionPerModule);
    }
    const cells = Array.from(this.grid.entries());
    if (!cells.length) return 0;

    let target;
    if (Number.isFinite(impactX) && Number.isFinite(impactZ)) {
      const cs = this.cellSize;
      let closestDistanceSq = Infinity;
      for (const entry of cells) {
        const [gx, gy] = entry[0].split(',').map(Number);
        const nearestX = Util.clamp(impactX, gx * cs, (gx + 1) * cs);
        const nearestZ = Util.clamp(impactZ, gy * cs, (gy + 1) * cs);
        const dx = impactX - nearestX;
        const dz = impactZ - nearestZ;
        const distanceSq = dx * dx + dz * dz;
        if (distanceSq < closestDistanceSq) {
          closestDistanceSq = distanceSq;
          target = entry;
        }
      }
    } else {
      target = Util.choice(cells);
    }

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
          <div class="build-desc">${b.desc}</div>
          ${b.drawback
            ? `<div class="build-risk">⚠ ${b.drawback}</div>`
            : ''}
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
      ${b.drawback ? `<span class="build-drawback">Contrapartida: ${b.drawback}</span><br>` : ''}
      <span style="color:${affordable ? 'var(--success)' : 'var(--danger)'}">
        Coste: ${Object.entries(cost).map(([k, v]) => `${Util.resourceName(k)}: ${Util.formatAmount(v, 2)}`).join(', ')}
      </span><br>
      <em style="color:var(--muted);font-size:0.8rem">Clic en una celda válida para colocar. Escape cancela.</em>
    `;
  }
};
