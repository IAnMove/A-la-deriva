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

assert.equal(run('World.SEA_SEGMENTS'), 64);
assert.equal((run('World.SEA_SEGMENTS') + 1) ** 2, 4225);

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
