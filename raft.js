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
function mat(color, emissive = null, vertexColors = false) {
  const key = color + '|' + emissive + '|' + vertexColors;
  if (!MatLib[key]) {
    const m = new THREE.MeshLambertMaterial({ color, vertexColors });
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

// Agrupa geometría estática por material para conservar el rendimiento incluso
// con muchos tablones, amarres y construcciones.
function batchRaftParts(parts) {
  const group = new THREE.Group();
  const buckets = new Map();
  for (const part of parts) {
    part.updateMatrix();
    const geometry = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry.clone();
    geometry.applyMatrix4(part.matrix);
    const colors = new Float32Array(geometry.getAttribute('position').count * 3);
    const color = part.material.color;
    for (let i = 0; i < colors.length; i += 3) {
      colors[i] = color.r; colors[i + 1] = color.g; colors[i + 2] = color.b;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const batchMaterial = mat(0xffffff, null, true);
    if (!buckets.has(batchMaterial)) buckets.set(batchMaterial, []);
    buckets.get(batchMaterial).push(geometry);
    part.geometry.dispose();
  }
  for (const [material, geometries] of buckets) {
    const merged = new THREE.BufferGeometry();
    for (const name of ['position', 'normal', 'uv', 'color']) {
      const attributes = geometries.map(geometry => geometry.getAttribute(name));
      if (attributes.some(attribute => !attribute)) continue;
      const data = new Float32Array(attributes.reduce((length, attribute) => length + attribute.array.length, 0));
      let offset = 0;
      for (const attribute of attributes) {
        data.set(attribute.array, offset);
        offset += attribute.array.length;
      }
      merged.setAttribute(name, new THREE.BufferAttribute(data, attributes[0].itemSize));
    }
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    for (const geometry of geometries) geometry.dispose();
  }
  return group;
}

function raftBeam(from, to, radius = 0.025, color = 0xcfb889, segments = 6) {
  const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
  const delta = b.clone().sub(a);
  const mesh = cyl(radius, radius, delta.length(), color, 0, 0, 0, segments);
  mesh.position.copy(a.add(b).multiplyScalar(0.5));
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
  return mesh;
}

function raftRing(radius, thickness, color, x, y, z, horizontal = true) {
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, thickness, 4, 12), mat(color));
  mesh.position.set(x, y, z);
  if (horizontal) mesh.rotation.x = Math.PI / 2;
  return mesh;
}

function addCot(parts, y, z, color = 0x6e9eaa) {
  parts.push(box(1.5, 0.12, 0.74, 0x775337, 0, y, z));
  parts.push(box(1.39, 0.1, 0.65, 0xd7c9a6, 0, y + 0.11, z));
  parts.push(box(0.91, 0.075, 0.67, color, 0.22, y + 0.19, z));
  parts.push(box(0.29, 0.12, 0.49, 0xeee4c9, -0.5, y + 0.18, z));
  for (const x of [-0.66, 0.66]) {
    for (const dz of [-0.29, 0.29]) parts.push(box(0.07, y + 0.17, 0.07, 0x63472f, x, (y + 0.17) / 2, z + dz));
  }
  for (const x of [-0.12, 0.53]) parts.push(box(0.016, 0.008, 0.67, 0xc9d9ca, x, y + 0.233, z));
}

function curvedRaftSail(width, height, color) {
  const geometry = new THREE.BufferGeometry();
  const vertices = [], indices = [];
  const columns = 5, rows = 8;
  for (let y = 0; y <= rows; y++) {
    const v = y / rows;
    for (let x = 0; x <= columns; x++) {
      const u = x / columns;
      vertices.push(width * u * (1 - v * 0.9), height * v,
        Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * 0.25);
    }
  }
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      const i = y * (columns + 1) + x;
      indices.push(i, i + 1, i + columns + 1, i + 1, i + columns + 2, i + columns + 1);
    }
  }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const cloth = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }));
  cloth.castShadow = true;
  return cloth;
}

// Modelos de salvamento: soportes, piezas recuperadas y detalles legibles
// desde la cámara de juego. Origen y=0 en la superficie de la cubierta.
function buildStructureMesh(key) {
  const g = new THREE.Group(), parts = [];
  const wood = 0x986940, dark = 0x5f4432, rope = 0xd1b582;
  const metal = 0x526c70, brass = 0xc1a46d, canvas = 0xe5d9b7;
  const B = (...args) => parts.push(box(...args));
  const C = (...args) => parts.push(cyl(...args));
  const beam = (...args) => parts.push(raftBeam(...args));
  const ring = (...args) => parts.push(raftRing(...args));
  const legs = (w, d, h) => {
    for (const x of [-w / 2, w / 2]) for (const z of [-d / 2, d / 2])
      B(0.09, h, 0.09, dark, x, h / 2, z);
  };
  const crate = (w, d, h, y = 0) => {
    B(w - 0.1, 0.1, d - 0.1, dark, 0, y + 0.06, 0);
    for (let i = 0; i < 3; i++) {
      const cy = y + (i + 0.5) * h / 3;
      for (const z of [-d / 2, d / 2]) B(w, h / 3 - 0.015, 0.075, i % 2 ? 0xa67b4e : wood, 0, cy, z);
      for (const x of [-w / 2, w / 2]) B(0.075, h / 3 - 0.015, d, i % 2 ? wood : 0xa67b4e, x, cy, 0);
    }
    for (const x of [-w * 0.38, w * 0.38]) {
      for (const z of [-d / 2 - 0.01, d / 2 + 0.01]) B(0.07, h + 0.05, 0.04, dark, x, y + h / 2, z);
    }
  };

  switch (key) {
    case 'storage':
      crate(1.1, 0.85, 0.65, 0.04);
      for (let i = 0; i < 4; i++) B(1.18, 0.09, 0.22, i % 2 ? 0xb08755 : wood, 0, 0.73, (i - 1.5) * 0.235);
      for (const x of [-0.38, 0.38]) B(0.075, 0.022, 0.94, metal, x, 0.787, 0);
      B(0.15, 0.21, 0.06, brass, 0, 0.65, 0.49);
      ring(0.07, 0.02, dark, 0, 0.63, 0.53, false);
      break;
    case 'bed':
      addCot(parts, 0.21, 0);
      break;
    case 'net': {
      for (const z of [-0.73, 0.73]) beam([-0.8, 0.14, z], [0.8, 0.14, z], 0.055, wood);
      for (const x of [-0.78, 0.78]) beam([x, 0.14, -0.74], [x, 0.14, 0.74], 0.045, dark);
      const geo = new THREE.PlaneGeometry(1.48, 1.38, 8, 8);
      geo.rotateX(-Math.PI / 2);
      const positions = geo.getAttribute('position');
      for (let i = 0; i < positions.count; i++)
        positions.setY(i, 0.13 - 0.07 * Math.sin((positions.getX(i) / 1.48 + 0.5) * Math.PI) * Math.sin((positions.getZ(i) / 1.38 + 0.5) * Math.PI));
      geo.computeVertexNormals();
      const net = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xc3b88d, wireframe: true }));
      net.name = 'fishing-net';
      g.add(net);
      for (const x of [-0.63, 0.63]) for (const z of [-0.62, 0.62]) C(0.075, 0.075, 0.12, 0xe0b777, x, 0.18, z, 6);
      break;
    }
    case 'rain': {
      C(0.34, 0.29, 0.47, 0x487d87, 0, 0.28, 0, 10);
      ring(0.34, 0.03, metal, 0, 0.51, 0);
      for (const x of [-0.54, 0.54]) for (const z of [-0.54, 0.54])
        beam([x, 0.04, z], [x, 1.0, z], 0.035, dark);
      const funnel = new THREE.Mesh(new THREE.CylinderGeometry(0.76, 0.09, 0.3, 4, 1, true),
        new THREE.MeshLambertMaterial({ color: 0x83b8bd, side: THREE.DoubleSide }));
      funnel.rotation.y = Math.PI / 4;
      funnel.position.y = 0.87;
      g.add(funnel);
      for (const z of [-0.54, 0.54]) beam([-0.54, 1.02, z], [0.54, 1.02, z], 0.022, rope);
      for (const x of [-0.54, 0.54]) beam([x, 1.02, -0.54], [x, 1.02, 0.54], 0.022, rope);
      C(0.29, 0.29, 0.018, 0x75c5c8, 0, 0.47, 0, 10);
      break;
    }
    case 'crop':
      crate(1.3, 1.15, 0.26);
      B(1.22, 0.06, 1.06, 0x483c2c, 0, 0.235, 0);
      for (let i = 0; i < 5; i++) {
        const x = ((i % 3) - 1) * 0.36, z = i < 3 ? -0.25 : 0.27;
        C(0.016, 0.021, 0.27, 0x74994c, x, 0.4, z);
        for (const sign of [-1, 1]) {
          const leaf = cone(0.15, 0.32, i % 2 ? 0x8bb95a : 0x5d9757, x + sign * 0.08, 0.46, z);
          leaf.scale.z = 0.36; leaf.rotation.z = sign * 0.9; parts.push(leaf);
        }
      }
      break;
    case 'fire': {
      B(1.04, 0.06, 1.04, metal, 0, 0.03, 0);
      for (let i = 0; i < 8; i++) {
        const angle = i * Math.PI / 4;
        C(0.12, 0.15, 0.18, i % 2 ? 0x7d8580 : 0x64716f, Math.cos(angle) * 0.42, 0.14, Math.sin(angle) * 0.42, 5);
      }
      beam([-0.3, 0.17, -0.2], [0.3, 0.17, 0.2], 0.085, dark);
      beam([0.28, 0.2, -0.24], [-0.28, 0.2, 0.24], 0.08, 0x67402d);
      const flame = new THREE.Group(); flame.name = 'flame'; flame.position.y = 0.22;
      flame.add(cone(0.24, 0.56, 0xf99443, 0, 0.25, 0));
      flame.add(cone(0.12, 0.37, 0xffdd76, 0.025, 0.2, 0.025));
      g.add(flame);
      break;
    }
    case 'sail': {
      C(0.055, 0.085, 2.4, dark, -0.34, 1.2, 0);
      B(0.37, 0.12, 0.35, wood, -0.34, 0.08, 0);
      beam([-0.34, 0.39, 0], [0.9, 0.43, 0], 0.035, wood);
      for (const z of [-0.63, 0.63]) beam([-0.34, 2.15, 0], [-0.63, 0.06, z], 0.013, rope);
      for (const y of [0.2, 0.27, 0.34]) ring(0.087, 0.018, rope, -0.34, y, 0);
      const clothGroup = new THREE.Group(); clothGroup.name = 'sail-cloth'; clothGroup.position.set(-0.29, 0.45, 0);
      clothGroup.add(curvedRaftSail(1.14, 1.8, canvas));
      clothGroup.add(raftBeam([0, 0, 0.01], [1.14, 0, 0.01], 0.014, rope));
      clothGroup.add(raftBeam([1.14, 0, 0], [0.114, 1.8, 0], 0.014, rope));
      const patch = box(0.2, 0.25, 0.014, 0xbfa783, 0.4, 0.48, 0.23);
      patch.rotation.z = -0.15; clothGroup.add(patch); g.add(clothGroup);
      const pennant = new THREE.Group(); pennant.name = 'wind-pennant'; pennant.position.set(-0.34, 2.36, 0);
      pennant.add(curvedRaftSail(0.42, 0.16, 0xc57554)); g.add(pennant);
      break;
    }
    case 'rudder': {
      B(0.8, 0.12, 0.62, wood, 0, 0.07, 0);
      for (const x of [-0.3, 0.3]) B(0.09, 0.62, 0.1, dark, x, 0.35, 0.12);
      C(0.07, 0.08, 1.07, dark, 0, 0.5, 0.14);
      const tiller = new THREE.Group(); tiller.name = 'rudder-handle'; tiller.position.y = 0.83;
      tiller.add(raftBeam([0, 0, 0.13], [0, 0.06, -0.64], 0.065, wood));
      tiller.add(box(0.66, 0.095, 0.1, 0xbb925d, 0, 0.06, -0.6)); g.add(tiller);
      B(0.15, 0.52, 0.57, wood, 0, 0.15, 0.39);
      for (const y of [0.42, 0.69]) ring(0.095, 0.025, metal, 0, y, 0.14);
      break;
    }
    case 'lookout': {
      for (const x of [-0.47, 0.47]) for (const z of [-0.43, 0.43]) {
        beam([x, 0, z], [x * 0.78, 1.93, z * 0.78], 0.046, dark);
      }
      for (let i = 0; i < 5; i++) B(1.13, 0.07, 0.21, i % 2 ? wood : 0xae8656, 0, 1.88, (i - 2) * 0.225);
      for (const z of [-0.5, 0.5]) {
        B(1.15, 0.07, 0.06, dark, 0, 2.29, z);
        for (const x of [-0.5, 0.5]) B(0.055, 0.39, 0.055, wood, x, 2.08, z);
      }
      for (let i = 0; i < 6; i++) beam([-0.26, 0.22 + i * 0.28, -0.51], [0.26, 0.22 + i * 0.28, -0.51], 0.025, wood);
      beam([-0.26, 0.08, -0.51], [-0.26, 1.87, -0.51], 0.03, dark);
      beam([0.26, 0.08, -0.51], [0.26, 1.87, -0.51], 0.03, dark);
      beam([-0.07, 2.17, 0], [0.42, 2.35, 0], 0.09, brass);
      break;
    }
    case 'smokehouse':
      crate(1.12, 0.92, 1.05);
      B(1.28, 0.1, 1.08, metal, 0, 1.08, 0);
      C(0.1, 0.13, 0.63, metal, 0.3, 1.37, -0.2);
      C(0.18, 0.18, 0.05, dark, 0.3, 1.71, -0.2);
      B(0.47, 0.69, 0.065, dark, 0, 0.52, 0.5);
      B(0.055, 0.19, 0.07, brass, 0.13, 0.53, 0.56);
      for (let i = 0; i < 3; i++) B(0.34, 0.028, 0.02, 0x241f1c, 0, 0.75 + i * 0.075, 0.543);
      break;
    case 'armor':
      for (const z of [-0.79, 0.79]) {
        B(1.75, 0.43, 0.12, metal, 0, 0.2, z);
        for (const x of [-0.63, 0, 0.63]) {
          B(0.13, 0.58, 0.1, wood, x, 0.3, z);
          for (const y of [0.16, 0.4]) B(0.046, 0.046, 0.12, brass, x, y, z + Math.sign(z) * 0.04);
        }
      }
      for (const x of [-0.8, 0.8]) B(0.12, 0.43, 1.46, 0x658083, x, 0.2, 0);
      break;
    case 'anchor': {
      B(0.86, 0.13, 0.7, wood, 0, 0.08, 0);
      for (const x of [-0.34, 0.34]) B(0.1, 0.67, 0.13, dark, x, 0.38, 0);
      beam([-0.47, 0.62, 0], [0.47, 0.62, 0], 0.09, dark);
      for (let i = 0; i < 6; i++) {
        const winding = raftRing(0.16, 0.029, rope, (i - 2.5) * 0.058, 0.62, 0, false);
        winding.rotation.y = Math.PI / 2; parts.push(winding);
      }
      beam([0.42, 0.62, 0], [0.42, 0.81, 0], 0.035, metal);
      beam([0.42, 0.81, 0], [0.61, 0.81, 0], 0.035, wood);
      const anchor = new THREE.Group(); anchor.name = 'anchor-head'; anchor.position.set(0, 0.03, 0.49);
      anchor.add(raftBeam([0, 0.05, 0], [0, 0.63, 0], 0.045, metal));
      anchor.add(raftBeam([-0.26, 0.2, 0], [0, 0.05, 0], 0.047, metal));
      anchor.add(raftBeam([0.26, 0.2, 0], [0, 0.05, 0], 0.047, metal));
      anchor.add(raftRing(0.07, 0.022, metal, 0, 0.69, 0, false)); g.add(anchor);
      const cable = raftBeam([0, 0.57, 0.05], [0, 0.08, 0.57], 0.019, rope);
      cable.name = 'anchor-rope'; g.add(cable);
      break;
    }
    case 'bunk':
      addCot(parts, 0.19, 0, 0x769aa1);
      addCot(parts, 0.98, 0, 0xa49277);
      for (const x of [-0.71, 0.71]) B(0.06, 0.24, 0.8, dark, x, 1.24, 0);
      break;
    case 'purifier':
      legs(0.93, 0.65, 0.43);
      B(1.08, 0.09, 0.78, wood, 0, 0.44, 0);
      C(0.31, 0.34, 0.6, metal, -0.23, 0.78, 0, 10);
      ring(0.31, 0.024, brass, -0.23, 1.08, 0);
      C(0.32, 0.23, 0.08, 0x91a7a0, -0.23, 1.11, 0, 10);
      beam([-0.23, 1.16, 0], [-0.23, 1.36, 0], 0.03, brass);
      beam([-0.23, 1.36, 0], [0.37, 1.12, 0], 0.03, brass);
      C(0.2, 0.18, 0.43, 0x88bec4, 0.35, 0.69, 0, 8);
      C(0.19, 0.19, 0.025, 0x539baa, 0.35, 0.87, 0, 8);
      break;
    case 'kitchen':
      legs(0.94, 0.68, 0.72);
      B(1.21, 0.12, 0.93, wood, 0, 0.76, 0);
      B(1.02, 0.08, 0.71, dark, 0, 0.28, 0);
      C(0.25, 0.21, 0.25, metal, -0.24, 0.95, 0.02, 10);
      ring(0.25, 0.025, 0x899691, -0.24, 1.08, 0.02);
      beam([-0.23, 0.96, 0.2], [-0.24, 0.97, 0.51], 0.035, dark);
      B(0.4, 0.035, 0.53, 0xc29c66, 0.35, 0.845, 0);
      B(0.04, 0.018, 0.25, 0xb2bdac, 0.35, 0.875, 0.06);
      C(0.10, 0.10, 0.66, metal, -0.43, 1.13, -0.32);
      break;
    case 'medkit':
      B(0.81, 0.48, 0.61, canvas, 0, 0.3, 0);
      B(0.86, 0.08, 0.65, 0xc9c3aa, 0, 0.58, 0);
      for (const x of [-0.28, 0.28]) B(0.06, 0.51, 0.635, metal, x, 0.31, 0);
      B(0.38, 0.025, 0.11, 0xca6050, 0, 0.633, 0);
      B(0.11, 0.025, 0.38, 0xca6050, 0, 0.633, 0);
      break;
    case 'mast': {
      C(0.06, 0.11, 2.85, dark, 0, 1.42, 0);
      for (const x of [-0.62, 0.62]) for (const z of [-0.6, 0.6]) beam([0, 2.29, 0], [x, 0.04, z], 0.014, rope);
      const flag = new THREE.Group(); flag.name = 'sail-cloth'; flag.position.set(0.07, 2.3, 0);
      flag.userData.isPennant = true;
      flag.add(curvedRaftSail(0.69, 0.43, 0xc57554)); g.add(flag);
      for (let i = 0; i < 4; i++) ring(0.11, 0.016, rope, 0, 0.2 + i * 0.06, 0);
      break;
    }
    case 'shelter': {
      for (const x of [-0.76, 0.76]) beam([x, 0.03, 0], [x, 1.39, 0], 0.04, dark);
      beam([-0.84, 1.4, 0], [0.84, 1.4, 0], 0.044, wood);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute([
        -0.84, 0.1, -0.8, 0.84, 0.1, -0.8, -0.84, 1.39, 0,
        0.84, 0.1, -0.8, 0.84, 1.39, 0, -0.84, 1.39, 0,
        -0.84, 1.39, 0, 0.84, 1.39, 0, -0.84, 0.1, 0.8,
        0.84, 1.39, 0, 0.84, 0.1, 0.8, -0.84, 0.1, 0.8
      ], 3));
      geometry.computeVertexNormals();
      const tent = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ color: canvas, side: THREE.DoubleSide }));
      tent.castShadow = true; g.add(tent);
      for (const x of [-0.82, 0.82]) for (const z of [-0.8, 0.8]) {
        beam([x, 0.1, z], [x * 1.1, 0.02, z * 1.1], 0.016, rope);
        B(0.06, 0.11, 0.06, dark, x * 1.1, 0.055, z * 1.1);
      }
      B(1.32, 0.045, 1.22, 0x7d948c, 0, 0.04, 0);
      break;
    }
    case 'radio':
      legs(0.73, 0.45, 0.43);
      B(1.0, 0.09, 0.68, wood, 0, 0.45, 0);
      B(0.81, 0.48, 0.51, metal, 0, 0.75, 0);
      B(0.28, 0.15, 0.024, 0xc0d7ab, 0.16, 0.85, 0.267);
      for (let i = 0; i < 5; i++) B(0.024, 0.29, 0.026, dark, -0.28 + i * 0.044, 0.75, 0.268);
      for (const x of [0.09, 0.27]) {
        const dial = cyl(0.045, 0.045, 0.035, brass, x, 0.65, 0.28); dial.rotation.x = Math.PI / 2; parts.push(dial);
      }
      beam([0.3, 0.98, -0.12], [0.43, 1.94, -0.12], 0.014, 0xc1d0c6);
      B(0.42, 0.035, 0.045, dark, 0, 1.05, 0);
      break;
    case 'motor': {
      B(1.13, 0.13, 0.86, dark, 0, 0.12, 0);
      B(0.7, 0.57, 0.64, 0x718a83, -0.13, 0.47, 0);
      for (let i = 0; i < 5; i++) B(0.045, 0.36, 0.035, metal, -0.36 + i * 0.11, 0.47, 0.34);
      C(0.07, 0.07, 0.56, metal, -0.34, 0.83, -0.19);
      C(0.08, 0.08, 0.045, brass, 0.1, 0.78, 0.1);
      beam([0.12, 0.35, 0], [0.65, 0.17, 0], 0.055, metal);
      const prop = new THREE.Group(); prop.name = 'prop'; prop.position.set(0.65, 0.17, 0);
      prop.add(box(0.08, 0.68, 0.115, brass)); prop.add(box(0.08, 0.115, 0.68, brass)); g.add(prop);
      break;
    }
    case 'harpoon':
      B(0.95, 0.12, 0.87, wood, 0, 0.06, 0);
      C(0.14, 0.24, 0.6, metal, 0, 0.37, 0);
      beam([0, 0.72, 0.53], [0, 0.82, -0.72], 0.065, dark);
      beam([-0.48, 0.81, -0.33], [0.48, 0.81, -0.33], 0.035, wood);
      beam([-0.48, 0.81, -0.33], [0, 0.78, 0.23], 0.013, rope);
      beam([0.48, 0.81, -0.33], [0, 0.78, 0.23], 0.013, rope);
      beam([0, 0.83, 0.36], [0, 0.92, -0.82], 0.021, metal);
      { const tip = cone(0.085, 0.26, 0xc5d1bd, 0, 0.93, -0.91); tip.rotation.x = -Math.PI / 2; parts.push(tip); }
      ring(0.2, 0.04, rope, 0.33, 0.13, 0.12);
      break;
    case 'infirmary':
      addCot(parts, 0.27, 0, 0xdddcc4);
      B(0.37, 0.02, 0.1, 0xc7685a, 0.3, 0.504, 0);
      B(0.1, 0.02, 0.37, 0xc7685a, 0.3, 0.504, 0);
      C(0.02, 0.02, 1.21, metal, -0.65, 0.63, -0.48);
      B(0.14, 0.22, 0.07, 0x9bc8c0, -0.65, 1.1, -0.48);
      beam([-0.65, 0.99, -0.48], [-0.38, 0.51, -0.16], 0.009, canvas);
      break;
    case 'chart':
      legs(1.09, 0.75, 0.7);
      for (let i = 0; i < 4; i++) B(1.45, 0.1, 0.27, i % 2 ? wood : 0xae8455, 0, 0.73, (i - 1.5) * 0.28);
      B(1.16, 0.024, 0.84, canvas, 0, 0.8, 0);
      for (const x of [-0.56, 0.56]) beam([x, 0.83, -0.42], [x, 0.83, 0.42], 0.033, 0xcabb94);
      for (let i = 0; i < 4; i++) {
        const route = box(0.14, 0.007, 0.015, 0x9b7660, -0.27 + i * 0.18, 0.818, Math.sin(i * 1.5) * 0.12);
        route.rotation.y = Math.cos(i * 1.5) * 0.4; parts.push(route);
      }
      ring(0.1, 0.018, brass, 0.39, 0.848, 0.24);
      B(0.014, 0.014, 0.15, 0xc26852, 0.39, 0.85, 0.24);
      break;
    case 'beacon': {
      C(0.15, 0.28, 1.17, metal, 0, 0.62, 0, 8);
      C(0.35, 0.35, 0.065, dark, 0, 1.21, 0);
      C(0.27, 0.27, 0.4, 0xc7ae72, 0, 1.44, 0, 8);
      for (let i = 0; i < 4; i++) {
        const angle = Math.PI / 4 + i * Math.PI / 2;
        C(0.018, 0.018, 0.47, metal, Math.cos(angle) * 0.28, 1.45, Math.sin(angle) * 0.28, 5);
      }
      parts.push(cone(0.37, 0.24, 0xb75f4d, 0, 1.78, 0, 8));
      const light = cyl(0.285, 0.285, 0.28, 0xffd576, 0, 1.44, 0, 8);
      light.material = new THREE.MeshBasicMaterial({ color: 0xffda85 });
      light.name = 'beacon-light'; light.visible = false; g.add(light);
      break;
    }
    case 'containment':
      for (const x of [-0.69, 0.69]) for (const z of [-0.62, 0.62]) B(0.095, 1.33, 0.095, dark, x, 0.67, z);
      for (let i = 0; i < 5; i++) {
        const x = -0.6 + i * 0.3;
        for (const z of [-0.62, 0.62]) C(0.022, 0.022, 1.2, metal, x, 0.66, z, 5);
      }
      for (const x of [-0.69, 0.69]) for (const z of [-0.3, 0, 0.3]) C(0.022, 0.022, 1.2, metal, x, 0.66, z, 5);
      for (const y of [0.12, 1.28]) {
        for (const z of [-0.62, 0.62]) B(1.45, 0.08, 0.08, metal, 0, y, z);
        for (const x of [-0.69, 0.69]) B(0.08, 0.08, 1.3, metal, x, y, 0);
      }
      B(0.11, 0.14, 0.075, brass, 0.28, 0.63, 0.68);
      break;
  }
  if (parts.length) g.add(batchRaftParts(parts));
  return g;
}

class Raft {
  constructor() {
    this.cellSize = 2; // unidades de mundo por celda
    this.deckHeight = 0.35;
    this.draft = 0.15;
    this.visualRevision = 0;
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
    this.visualRevision++;
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
    this.visualRevision++;
    return true;
  }

  buildCellMesh(gx, gy, cell) {
    if (!this.group) return;
    if (cell.mesh) this.disposeMesh(cell);
    const cs = this.cellSize;
    const cg = new THREE.Group();
    cg.name = 'raft-cell';
    cg.position.set((gx + 0.5) * cs, 0, (gy + 0.5) * cs);
    cg.userData.gridX = gx;
    cg.userData.gridY = gy;
    const seed = Math.abs((gx * 73856093) ^ (gy * 19349663));
    const palette = [0xb58a53, 0xa67947, 0xc3975e];
    const planks = [];
    for (let i = 0; i < 6; i++) {
      const plank = box(cs - 0.085, 0.14, (cs - 0.11) / 6 - 0.016,
        palette[(i + seed) % palette.length], 0, this.deckHeight - 0.07,
        (i - 2.5) * ((cs - 0.11) / 6));
      plank.rotation.y = (((seed + i * 7) % 5) - 2) * 0.002;
      planks.push(plank);
    }
    const deck = batchRaftParts(planks);
    deck.name = 'deck';
    deck.children[0].name = 'base';
    for (const surface of deck.children) surface.userData.intactColor = surface.material.color.getHex();
    cg.userData.damageSurfaces = deck.children.slice();
    cg.add(deck);

    const foundation = [], details = [];
    for (const x of [-0.62, 0.62]) foundation.push(box(0.12, 0.14, cs - 0.05, 0x654a32, x, 0.15, 0));
    for (const z of [-0.62, 0.62]) {
      const log = cyl(0.165, 0.18, cs - 0.025, 0x80633f, 0, 0.025, z, 7);
      log.rotation.z = Math.PI / 2; foundation.push(log);
      for (const sign of [-1, 1]) {
        const end = cyl(0.132, 0.132, 0.016, 0xae8753, sign * (cs / 2 - 0.014), 0.025, z, 7);
        end.rotation.z = Math.PI / 2; foundation.push(end);
      }
      for (const x of [-0.65, 0.65]) {
        const lashing = raftRing(0.185, 0.025, 0xceaf79, x, 0.045, z, false);
        lashing.rotation.y = Math.PI / 2; details.push(lashing);
      }
    }
    for (const x of [-0.65, 0.65]) {
      details.push(box(0.029, 0.017, cs - 0.085, 0xceaf79, x, this.deckHeight + 0.011, 0));
      for (let i = 0; i < 6; i++) details.push(cyl(0.017, 0.017, 0.007, 0x665d48,
        x + 0.095, this.deckHeight + 0.004, (i - 2.5) * ((cs - 0.11) / 6), 5));
    }
    const undercarriage = batchRaftParts(foundation);
    undercarriage.name = 'flotation';
    cg.add(undercarriage, batchRaftParts(details));

    // Los refuerzos de borde desaparecen al unir dos módulos: no atraviesan
    // pasillos ni forman una cuadrícula de barandillas sobre la cubierta.
    cg.userData.edges = [];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const edgeParts = [];
      const horizontal = dx === 0;
      edgeParts.push(box(horizontal ? cs - 0.02 : 0.08, 0.13,
        horizontal ? 0.08 : cs - 0.02, 0x775337, dx * 0.962, 0.175, dy * 0.962));
      const from = horizontal ? [-0.94, 0.264, dy * 0.97] : [dx * 0.97, 0.264, -0.94];
      const to = horizontal ? [0.94, 0.264, dy * 0.97] : [dx * 0.97, 0.264, 0.94];
      edgeParts.push(raftBeam(from, to, 0.022, 0xc9aa72));
      const edge = batchRaftParts(edgeParts);
      edge.name = 'edge-' + dx + '-' + dy;
      edge.visible = !this.has(gx + dx, gy + dy);
      cg.userData.edges.push({ dx, dy, mesh: edge });
      cg.add(edge);
    }

    const damageParts = [];
    for (let i = 0; i < 5; i++) {
      const crack = box(0.21 + (i % 3) * 0.12, 0.008, 0.018, 0x4a3528,
        ((seed + i * 3) % 7 - 3) * 0.15, this.deckHeight + 0.006, (i - 2) * 0.315);
      crack.rotation.y = (i % 2 ? 1 : -1) * 0.21; damageParts.push(crack);
    }
    const damageDetails = batchRaftParts(damageParts);
    damageDetails.name = 'damage-cracks';
    damageDetails.visible = false;
    cg.add(damageDetails);
    cg.userData.damageDetails = damageDetails;
    cg.userData.deck = deck;

    if (cell.buildingKey !== 'floor') {
      const structure = buildStructureMesh(cell.buildingKey);
      structure.position.y = this.deckHeight;
      structure.name = 'structure';
      cg.add(structure);
      cg.userData.structure = structure;
      cg.userData.animations = {
        flame: structure.getObjectByName('flame'),
        sail: structure.getObjectByName('sail-cloth'),
        pennant: structure.getObjectByName('wind-pennant'),
        prop: structure.getObjectByName('prop'),
        anchor: structure.getObjectByName('anchor-head'),
        cable: structure.getObjectByName('anchor-rope'),
        light: structure.getObjectByName('beacon-light'),
        rudder: structure.getObjectByName('rudder-handle')
      };
    }
    cell.mesh = cg;
    this.group.add(cg);
    this.tintDamaged(cell);
    this.refreshEdgesAround(gx, gy);
  }

  refreshEdgesAround(gx, gy) {
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = gx + dx, y = gy + dy;
      const cell = this.get(x, y);
      if (!cell?.mesh) continue;
      for (const edge of cell.mesh.userData.edges || []) {
        edge.mesh.visible = !this.has(x + edge.dx, y + edge.dy);
      }
    }
  }

  refreshAllEdges() {
    for (const [key, cell] of this.grid) {
      if (!cell.mesh) continue;
      const [gx, gy] = key.split(',').map(Number);
      for (const edge of cell.mesh.userData.edges || []) {
        edge.mesh.visible = !this.has(gx + edge.dx, gy + edge.dy);
      }
    }
    if (this.selected && !this.has(this.selected.gx, this.selected.gy)) this.selected = null;
  }

  // Tiempo en segundos; sólo mueve piezas de los modelos, nunca la raíz.
  // La flotación del conjunto y las coordenadas físicas las controla World.
  updateVisuals(time = 0, dt = 0, options = {}) {
    const wind = Util.clamp(Number(options.wind) || 0.5, 0, 2);
    const hasWindVec = Number.isFinite(options.windX) || Number.isFinite(options.windZ);
    const windAngle = Number.isFinite(options.windAngle)
      ? Number(options.windAngle)
      : hasWindVec
        ? Math.atan2(Number(options.windZ) || 0, Number(options.windX) || 1)
        : 0;
    const heading = Util.clamp(Number(options.heading) || 0, -1, 1);
    const delta = Util.clamp(Number(dt) || 0, 0, 0.1);
    for (const cell of this.grid.values()) {
      const animation = cell.mesh?.userData.animations;
      if (!animation) continue;
      const efficiency = this.cellEfficiency(cell);
      if (animation.flame) {
        animation.flame.scale.set(0.92 + Math.sin(time * 9) * 0.08,
          0.87 + Math.sin(time * 12.7) * 0.15, 0.94 + Math.cos(time * 10.1) * 0.06);
        animation.flame.rotation.y = time * 0.4;
        animation.flame.rotation.z = -Math.cos(windAngle) * 0.16 * wind;
        animation.flame.rotation.x = Math.sin(windAngle) * 0.16 * wind;
      }
      if (animation.sail) {
        if (animation.sail.userData?.isPennant || cell.buildingKey === 'mast') {
          animation.sail.rotation.y =
            -windAngle + Math.sin(time * (4.2 + wind * 1.8)) * 0.11 * wind;
          animation.sail.scale.z =
            0.74 + (0.18 + Math.sin(time * 5.1) * 0.14) * wind;
        } else {
          const trimAngle = Util.clamp(
            -windAngle * 0.58 + heading * 0.24,
            -0.68,
            0.68
          );
          animation.sail.rotation.y =
            trimAngle + Math.sin(time * 1.7) * 0.045 * wind;
          const rel = Math.abs(windAngle - heading * 0.48);
          const fill = Util.clamp(0.75 + Math.cos(rel) * 0.25, 0.45, 1.1);
          animation.sail.scale.z =
            0.74 + (0.22 * fill + Math.sin(time * 2.3) * 0.12) * wind;
        }
      }
      if (animation.pennant) {
        animation.pennant.rotation.y =
          -windAngle + Math.sin(time * (5.2 + wind * 2.1)) * 0.14 * wind;
        animation.pennant.scale.z =
          0.7 + (0.2 + Math.cos(time * 6.1) * 0.15) * wind;
      }
      if (animation.prop) animation.prop.rotation.x += delta * (options.motorActive ? 19 : 1.4) * efficiency;
      if (animation.rudder) animation.rudder.rotation.y +=
        ((heading * 0.5) - animation.rudder.rotation.y) * Math.min(1, delta * 4);
      if (animation.anchor) {
        const targetY = options.anchorDeployed ? -0.85 : 0.03;
        animation.anchor.position.y += (targetY - animation.anchor.position.y) * Math.min(1, delta * 4);
        animation.cable.scale.y = 1 + Math.max(0, 0.03 - animation.anchor.position.y) * 1.9;
      }
      if (animation.light) {
        animation.light.visible = !!options.beaconLit && efficiency > 0;
        animation.light.scale.setScalar(0.98 + Math.sin(time * 3) * 0.02);
      }
    }
  }

  removeAt(gx, gy) {
    const k = this.key(gx, gy);
    if (!this.grid.has(k)) return false;
    if (this.grid.size <= 1) return false;
    if (!this.isConnectedWithout(k)) return false;
    this.disposeMesh(this.grid.get(k));
    this.grid.delete(k);
    this.visualRevision++;
    this.refreshEdgesAround(gx, gy);
    if (this.selected?.gx === gx && this.selected?.gy === gy) this.selected = null;
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
    if (removed > 0) {
      this.visualRevision++;
      this.refreshAllEdges();
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

  // Crecimiento por anillos cuadrados alrededor de la celda origen (0,0),
  // para que la balsa no salga en forma de "palo". Una celda de borde solo
  // se puede construir cuando el lateral del anillo anterior que la
  // respalda está completo; una esquina exige las dos celdas de borde
  // adyacentes de su propio anillo. Solo limita construir: la carga de
  // partidas y placeAt directo no pasan por aquí.
  canExpandTo(gx, gy) {
    if (!this.isConnected(gx, gy)) return false;
    const ax = Math.abs(gx);
    const ay = Math.abs(gy);
    const ring = Math.max(ax, ay);
    if (ring === 0) return true;
    if (ax === ay) {
      // Esquina del anillo: necesita los dos bordes adyacentes de ese anillo.
      return this.has(gx - Math.sign(gx), gy) && this.has(gx, gy - Math.sign(gy));
    }
    // Celda de borde: exige completo el lateral del anillo anterior.
    const inner = ring - 1;
    for (let i = -inner; i <= inner; i++) {
      const cx = ay > ax ? i : Math.sign(gx) * inner;
      const cy = ay > ax ? Math.sign(gy) * inner : i;
      if (!this.has(cx, cy)) return false;
    }
    return true;
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
    if (!Number.isFinite(amount) || amount <= 0) return 0;
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
      this.visualRevision++;
      this.refreshAllEdges();
      this.lastDetached = this.removeDetachedCells();
    }
    this.damage = amount;
    return amount;
  }

  // Tres estados de material compartido: sin asignaciones GPU por fotograma.
  // Las grietas y la ligera torsión se revierten al reparar la celda.
  tintDamaged(cell) {
    if (!cell.mesh) return;
    const pct = this.cellEfficiency(cell);
    const level = pct < 0.3 ? 2 : pct < 0.7 ? 1 : 0;
    const data = cell.mesh.userData;
    if (data.damageLevel === level) return;
    data.damageLevel = level;
    const factor = [1, 0.78, 0.57][level];
    for (const surface of data.damageSurfaces || []) {
      surface.material = mat(new THREE.Color(surface.userData.intactColor).multiplyScalar(factor).getHex(), null, true);
    }
    if (data.damageDetails) data.damageDetails.visible = level > 0;
    if (data.deck) data.deck.rotation.x = level === 2 ? 0.015 : 0;
    if (data.structure) data.structure.rotation.z = level === 2 ? 0.018 : 0;
  }

  repairAt(gx, gy, amount) {
    if (!Number.isFinite(amount) || amount <= 0) return false;
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
