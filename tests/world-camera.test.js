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
  copy(other) {
    return this.set(other.x, other.y, other.z);
  }
  length() {
    return Math.hypot(this.x, this.y, this.z);
  }
  distanceTo(other) {
    return Math.hypot(this.x - other.x, this.y - other.y, this.z - other.z);
  }
}

class Vector2 {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }
}

class Color {
  constructor(value = 0) {
    this.setHex(typeof value === 'number' ? value : 0);
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

class Raycaster {
  constructor() {
    this.ray = { intersectPlane: (_plane, out) => out };
  }
  setFromCamera() {}
}

const sandbox = {
  console,
  performance: { now: () => 0 },
  window: { innerWidth: 1280, innerHeight: 720 },
  Input: { isDown: () => false },
  Util: {
    clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
    lerp: (a, b, amount) => a + (b - a) * amount
  },
  THREE: {
    Vector2,
    Vector3,
    Color,
    Raycaster,
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

run(`
  World.camera = {
    position: new THREE.Vector3(0, 15, 12.5),
    lookAt() {}
  };
  World.scene = {
    background: new THREE.Color(0),
    fog: { color: new THREE.Color(0), near: 30, far: 85 }
  };
  World.sunLight = {
    color: new THREE.Color(0xffffff),
    intensity: 1,
    position: new THREE.Vector3()
  };
  World.ambient = { intensity: 1 };
  World.stars = {
    material: { opacity: 0 },
    position: new THREE.Vector3()
  };
`);

run(`
  World.cameraZoomTarget = 2;
  World.updateCamera(
    { x: 1, z: 1 },
    { minX: 0, maxX: 0, minY: 0, maxY: 0 },
    1 / 60,
    2
  );
`);
assert.equal(run('World.cameraMaxZoomOut'), 1);
assert.equal(run('World.cameraZoomTarget'), 1);

run(`
  World.updateCamera(
    { x: 12, z: 12 },
    { minX: 0, maxX: 11, minY: 0, maxY: 11 },
    1 / 60,
    2
  );
`);
assert.ok(run('World.cameraMaxZoomOut') > 1);

run('World.updateDayNight(12, false, true, 1);');
assert.ok(run('World.scene.fog.near') < run('World.scene.fog.far'));
assert.ok(
  run('World.scene.fog.far') >
  run('World.camera.position.distanceTo(World.camTarget)')
);

console.log('✓ niebla válida y cámara con zoom dinámico');
