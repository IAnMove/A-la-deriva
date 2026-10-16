const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class Vector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }
  length() {
    return Math.hypot(this.x, this.y, this.z);
  }
}

class Color {
  constructor(value = 0) {
    this.setHex(value);
  }
  setHex(value) {
    this.r = ((value >> 16) & 255) / 255;
    this.g = ((value >> 8) & 255) / 255;
    this.b = (value & 255) / 255;
    return this;
  }
  copy(other) {
    this.r = other.r;
    this.g = other.g;
    this.b = other.b;
    return this;
  }
  lerp(other, amount) {
    this.r += (other.r - this.r) * amount;
    this.g += (other.g - this.g) * amount;
    this.b += (other.b - this.b) * amount;
    return this;
  }
  multiplyScalar(amount) {
    this.r *= amount;
    this.g *= amount;
    this.b *= amount;
    return this;
  }
}

const sandbox = {
  console,
  Util: {
    clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
    lerp: (a, b, amount) => a + (b - a) * amount
  },
  THREE: {
    Vector2: class Vector2 {},
    Vector3,
    Color,
    Raycaster: class Raycaster {},
    Plane: class Plane {},
    MathUtils: { degToRad: degrees => degrees * Math.PI / 180 }
  }
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(
  fs.readFileSync(path.resolve(__dirname, '..', 'world.js'), 'utf8'),
  sandbox,
  { filename: 'world.js' }
);

function run(code) {
  return vm.runInContext(code, sandbox);
}

assert.equal(run('World.SEA_SEGMENTS'), 128);
assert.equal((run('World.SEA_SEGMENTS') + 1) ** 2, 16641);

run(`
  var seaPositionWrites = 0;
  var seaColorWrites = 0;
  var seaNormalUpdates = 0;
  World.seaLastSurfaceTime = -Infinity;
  World.seaLastDetailTime = -Infinity;
  World.seaLastStorm = null;
  World.sea = { position: { set() {} } };
  World.seaGeo = {
    attributes: {
      position: {
        count: 4,
        needsUpdate: false,
        getX(index) { return index % 2; },
        getZ(index) { return Math.floor(index / 2); },
        setY() { seaPositionWrites++; }
      },
      color: {
        needsUpdate: false,
        setXYZ() { seaColorWrites++; }
      }
    },
    computeVertexNormals() { seaNormalUpdates++; }
  };
`);

run('World.updateSea(0, 0, 0, false);');
assert.equal(run('seaPositionWrites'), 4);
assert.equal(run('seaColorWrites'), 4);
assert.equal(run('seaNormalUpdates'), 1);

// Render intermedio y pausa: no deben volver a tocar buffers.
run('World.updateSea(0.01, 0, 0, false);');
assert.equal(run('seaPositionWrites'), 4);
run('World.updateSea(0.04, 0, 0, false);');
assert.equal(run('seaPositionWrites'), 8);
assert.equal(run('seaColorWrites'), 4);
assert.equal(run('seaNormalUpdates'), 1);
run('World.updateSea(0.04, 0, 0, false);');
assert.equal(run('seaPositionWrites'), 8);

// El detalle y las normales se refrescan a menor frecuencia.
run('World.updateSea(0.11, 0, 0, false);');
assert.equal(run('seaPositionWrites'), 12);
assert.equal(run('seaColorWrites'), 8);
assert.equal(run('seaNormalUpdates'), 2);

// Reiniciar el reloj de partida fuerza una superficie completa válida.
run('World.updateSea(0.01, 0, 0, false);');
assert.equal(run('seaPositionWrites'), 16);
assert.equal(run('seaColorWrites'), 12);
assert.equal(run('seaNormalUpdates'), 3);

console.log('✓ mar limitado a 30 Hz y normales/color a 10 Hz');

// Ejercitar geometría real de Three.js: la espuma debe respetar la huella y
// liberar sus recursos sólo cuando cambia, incluso al construir en pausa.
const THREE = require('../vendor/three.min.js');
sandbox.THREE = THREE;
const ocean = run('World');
ocean.scene = new THREE.Scene();
const raft = {
  cellSize: 2,
  deckHeight: 0.35,
  grid: new Map([['0,0', {}], ['1,0', {}], ['0,1', {}]]),
  group: new THREE.Group(),
};
const rect = { cx: 2, cz: 2, hx: 2, hz: 2, raft };
ocean.waveAmp = 0.8;
for (let frame = 0; frame < 90; frame++) {
  const time = frame * 0.31;
  raft.group.position.y = Math.sin(time) * 0.18;
  raft.group.rotation.set(Math.sin(time * 0.9) * 0.033, 0, Math.cos(time * 0.7) * 0.04);
  raft.group.updateMatrixWorld(true);
  const normal = new THREE.Vector3(0, 1, 0).transformDirection(raft.group.matrixWorld);
  const deckPoint = raft.group.localToWorld(new THREE.Vector3(0, raft.deckHeight, 0));
  for (const [x, z] of [[0.2, 0.2], [1, 1], [2.8, 1.3], [1.2, 2.9]]) {
    const water = ocean.seaSurfaceHeight(x, z, time, 10, -5, true, rect);
    const deck = deckPoint.y - (normal.x * (x - deckPoint.x) +
      normal.z * (z - deckPoint.z)) / normal.y;
    assert.ok(Number.isFinite(water) && water < deck - 0.18,
      'una ola no puede cruzar la cubierta durante el balanceo');
  }
}
// Fuera de la huella y su transición el océano conserva toda su amplitud.
const offshore = ocean.seaSurfaceHeight(10, 11, 3, 0, 0, true, null);
assert.equal(ocean.seaSurfaceHeight(10, 11, 3, 0, 0, true, rect), offshore);

ocean.updateHullFoam(rect, 1, 0, 0, false, true);
const firstFoam = ocean.hullFoam;
assert.equal(firstFoam.geometry.userData.edgeCount, 8, 'balsa en L: ocho aristas expuestas');
const meta = firstFoam.geometry.userData.meta;
const color = firstFoam.geometry.attributes.color;
let transparentEnds = 0, visibleFoam = 0;
for (let i = 0; i < color.count; i++) {
  const column = meta[i * 7 + 6], row = meta[i * 7 + 5];
  const alpha = color.getW(i);
  assert.ok(alpha >= 0 && alpha <= 0.33, 'espuma de contacto translúcida');
  if (column === 0 || column === 3 || row === 0 || row === 3) {
    assert.equal(alpha, 0, 'cada parche termina transparente, sin sábana continua');
    transparentEnds++;
  } else if (alpha > 0) visibleFoam++;
}
assert.ok(transparentEnds > 0 && visibleFoam > 0);
ocean.updateHullFoam(rect, 1.04, 0, 0, false, false);
assert.equal(ocean.hullFoam, firstFoam, 'los fotogramas reutilizan la malla de espuma');
let geometryDisposals = 0, materialDisposals = 0;
firstFoam.geometry.addEventListener('dispose', () => geometryDisposals++);
firstFoam.material.addEventListener('dispose', () => materialDisposals++);
// Cambiar una celda conservando área y rectángulo también cambia la huella.
raft.grid.delete('1,0');
raft.grid.set('1,1', {});
ocean.updateHullFoam(rect, 1.04, 0, 0, false, false);
assert.notEqual(ocean.hullFoam, firstFoam);
assert.equal(geometryDisposals, 1);
assert.equal(materialDisposals, 1);
assert.ok(Array.from(ocean.hullFoam.geometry.attributes.color.array)
  .some((value, index) => index % 4 === 3 && value > 0), 'nueva espuma visible sin esperar al siguiente tick de detalle');

// El hook se compone con el shader real de esta versión y conserva sombras,
// niebla y la iluminación existente. El agua opaca oculta correctamente el fondo.
const seaMaterial = ocean.createSeaMaterial();
const shader = {
  vertexShader: THREE.ShaderLib.phong.vertexShader,
  fragmentShader: THREE.ShaderLib.phong.fragmentShader,
  uniforms: {},
};
seaMaterial.onBeforeCompile(shader);
assert.ok(shader.vertexShader.includes('vSeaWorld = (modelMatrix'));
assert.ok(shader.fragmentShader.includes('float fresnel'));
assert.ok(shader.fragmentShader.includes('#include <fog_fragment>'));
assert.ok(shader.fragmentShader.includes('#include <shadowmap_pars_fragment>'));
assert.equal(shader.uniforms.seaTime, ocean.seaUniforms.seaTime);
assert.equal(seaMaterial.transparent, false);
console.log('✓ agua bajo cubierta, espuma irregular reutilizada y shader compatible');

// La espuma se apoya en la triangulación visible, incluida la diagonal entre
// vértices, y no en una altura analítica que puede atravesar la malla gruesa.
ocean.sea = { position: new THREE.Vector3(0, 0, 0) };
ocean.seaGeo = new THREE.PlaneGeometry(2, 2, 1, 1);
ocean.seaGeo.rotateX(-Math.PI / 2);
const heights = ocean.seaGeo.attributes.position;
heights.setY(0, 0); heights.setY(1, 0); heights.setY(2, 0); heights.setY(3, 1);
assert.equal(ocean.sampleSeaMeshHeight(-0.5, -0.5), 0);
assert.equal(ocean.sampleSeaMeshHeight(0, 0), 0);
assert.equal(ocean.sampleSeaMeshHeight(0.5, 0.5), 0.5);
assert.equal(ocean.sampleSeaMeshHeight(1, 1), 1);
assert.equal(ocean.sampleSeaMeshHeight(2, 2), null);
console.log('✓ espuma alineada con los triángulos visibles del océano');
