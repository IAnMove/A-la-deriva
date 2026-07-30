const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const THREE = require(path.join(root, 'vendor', 'three.min.js'));
const sandbox = {
  console,
  THREE,
  Util: {
    clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
    choice: values => values[0]
  }
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(
  fs.readFileSync(path.join(root, 'raft.js'), 'utf8'),
  sandbox,
  { filename: 'raft.js' }
);

function run(source) {
  return vm.runInContext(source, sandbox);
}

run(`
  var gpuSceneFixture = new THREE.Scene();
  var gpuRaftFixture = new Raft();
  gpuRaftFixture.init(gpuSceneFixture);
  gpuRaftFixture.placeAt(0, 0, 'net', true);
  var gpuNetCellFixture = gpuRaftFixture.get(0, 0);
  var gpuWireMeshFixture = null;
  gpuNetCellFixture.mesh.traverse(object => {
    if (object.material?.wireframe) gpuWireMeshFixture = object;
  });
  var gpuGeometryDisposeFixture = 0;
  var gpuMaterialDisposeFixture = 0;
  gpuWireMeshFixture.geometry.dispose = () => gpuGeometryDisposeFixture++;
  gpuWireMeshFixture.material.dispose = () => gpuMaterialDisposeFixture++;
  gpuRaftFixture.disposeMesh(gpuNetCellFixture);

  var tintRaftFixture = new Raft();
  tintRaftFixture.init(new THREE.Scene());
  tintRaftFixture.placeAt(0, 0, 'floor', true);
  var tintCellFixture = tintRaftFixture.get(0, 0);
  tintCellFixture.health = 25;
  tintRaftFixture.tintDamaged(tintCellFixture);
  var moderateMaterialFixture =
    tintCellFixture.mesh.getObjectByName('base').material;
  tintCellFixture.health = 20;
  tintRaftFixture.tintDamaged(tintCellFixture);
  var repeatedModerateMaterialFixture =
    tintCellFixture.mesh.getObjectByName('base').material;
  tintCellFixture.health = 10;
  tintRaftFixture.tintDamaged(tintCellFixture);
  var criticalMaterialFixture =
    tintCellFixture.mesh.getObjectByName('base').material;
  tintCellFixture.health = 5;
  tintRaftFixture.tintDamaged(tintCellFixture);
  var repeatedCriticalMaterialFixture =
    tintCellFixture.mesh.getObjectByName('base').material;

  var newStructureKeysFixture = [
    'lookout', 'smokehouse', 'armor', 'anchor', 'bunk',
    'harpoon', 'infirmary', 'chart', 'beacon', 'containment'
  ];
  var structureRaftFixture = new Raft();
  structureRaftFixture.init(new THREE.Scene());
  var allNewMeshesFixture = newStructureKeysFixture.every((key, index) => {
    if (!structureRaftFixture.placeAt(index, 0, key, true)) return false;
    var cell = structureRaftFixture.get(index, 0);
    var structure = cell.mesh.getObjectByName('structure');
    return !!structure && structure.children.length > 0;
  });
`);

assert.equal(THREE.REVISION, '149');
assert.equal(run('gpuGeometryDisposeFixture'), 1);
assert.equal(run('gpuMaterialDisposeFixture'), 1);
assert.equal(
  run('moderateMaterialFixture === repeatedModerateMaterialFixture'),
  true
);
assert.equal(
  run('criticalMaterialFixture === repeatedCriticalMaterialFixture'),
  true
);
assert.equal(
  run('moderateMaterialFixture !== criticalMaterialFixture'),
  true
);
assert.equal(run('allNewMeshesFixture'), true);
assert.equal(
  run('moderateMaterialFixture.userData.sharedRaftMaterial'),
  true
);

console.log('✓ materiales dañados reutilizados y recursos GPU propios liberados');
