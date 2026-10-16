const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const THREE = require(path.join(root, 'vendor/three.min.js'));
const sandbox = {
  THREE, console,
  Util: {
    clamp: (n, min, max) => Math.max(min, Math.min(max, n)),
    choice: values => values[0]
  }
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'raft.js'), 'utf8'), sandbox);
const evaluate = source => vm.runInContext(source, sandbox);
const { Raft, BUILDINGS } = evaluate('({ Raft, BUILDINGS })');

function makeRaft() {
  const raft = new Raft();
  raft.init(new THREE.Scene());
  raft.reset();
  return raft;
}

const raft = makeRaft();
const original = raft.get(0, 0);
const edgeCount = cell => cell.mesh.userData.edges.filter(edge => edge.mesh.visible).length;
assert.equal(edgeCount(original), 4);
const revision = raft.visualRevision;
raft.placeAt(1, 0, 'floor', true);
assert.ok(raft.visualRevision > revision, 'la huella avisa a la espuma del nuevo borde');
assert.equal(edgeCount(original), 3);
assert.equal(edgeCount(raft.get(1, 0)), 3);
raft.selected = { gx: 1, gy: 0 };
const removalRevision = raft.visualRevision;
assert.equal(raft.removeAt(1, 0), true);
assert.equal(edgeCount(original), 4);
assert.equal(raft.selected, null, 'retirar un módulo limpia su selección');
assert.ok(raft.visualRevision > removalRevision);

const surface = original.mesh.getObjectByName('base');
const initialMaterial = surface.material;
const geometry = surface.geometry;
original.health = 9;
raft.tintDamaged(original);
assert.equal(original.mesh.getObjectByName('damage-cracks').visible, true);
assert.ok(original.mesh.userData.deck.rotation.x > 0);
assert.notEqual(surface.material, initialMaterial);
assert.equal(surface.material.vertexColors, true, 'el daño conserva las vetas y colores de los tablones');
for (const invalid of [0, -10, NaN, Infinity]) {
  assert.equal(raft.repairAt(0, 0, invalid), false);
  assert.equal(raft.takeDamage(invalid), 0);
  assert.equal(original.health, 9);
}
assert.equal(raft.repairAt(0, 0, 50), true);
assert.equal(original.health, original.maxHealth);
assert.equal(surface.material, initialMaterial, 'la reparación restaura el material compartido original');
assert.equal(surface.geometry, geometry, 'el daño y la reparación no reconstruyen geometrías');
assert.equal(original.mesh.getObjectByName('damage-cracks').visible, false);
assert.equal(original.mesh.userData.deck.rotation.x, 0);

let visibleMeshes = 0;
original.mesh.traverseVisible(object => { if (object.isMesh) visibleMeshes++; });
assert.ok(visibleMeshes <= 7, 'tablones y detalles se agrupan para limitar llamadas de dibujo');
const deckBox = new THREE.Box3().setFromObject(original.mesh.getObjectByName('deck'));
assert.ok(Math.abs(deckBox.max.y - raft.deckHeight) < 0.002, 'se conserva la altura donde pisan los personajes');
assert.ok(original.mesh.getObjectByName('flotation'), 'la cubierta tiene soportes y flotadores');

const modelRaft = makeRaft();
let index = 1;
for (const key of Object.keys(BUILDINGS).filter(key => key !== 'floor')) {
  modelRaft.placeAt(index++, 0, key, true);
}
for (const cell of modelRaft.grid.values()) {
  cell.mesh.traverse(object => {
    if (!object.geometry) return;
    const positions = object.geometry.getAttribute('position');
    assert.ok(positions && Array.from(positions.array).every(Number.isFinite), 'todas las construcciones tienen geometría finita');
  });
}
const findStructure = key => [...modelRaft.grid.values()].find(cell => cell.buildingKey === key).mesh.getObjectByName('structure');
const anchor = findStructure('anchor').getObjectByName('anchor-head');
const propeller = findStructure('motor').getObjectByName('prop');
const light = findStructure('beacon').getObjectByName('beacon-light');
const groupPosition = modelRaft.group.position.clone();
modelRaft.updateVisuals(12, 0.1, { anchorDeployed: true, motorActive: true, beaconLit: true, heading: 1, wind: 1.8 });
assert.ok(anchor.position.y < 0.03, 'desplegar el ancla la hace bajar');
assert.ok(propeller.rotation.x > 1, 'el motor gira alrededor de su eje');
assert.equal(light.visible, true);
assert.ok(modelRaft.group.position.equals(groupPosition), 'la animación de piezas no altera coordenadas físicas');
modelRaft.updateVisuals(13, 0.1, { beaconLit: false });
assert.equal(light.visible, false);

const damagedRaft = makeRaft();
damagedRaft.placeAt(1, 0, 'floor');
damagedRaft.placeAt(2, 0, 'floor');
damagedRaft.selected = { gx: 2, gy: 0 };
const damageRevision = damagedRaft.visualRevision;
damagedRaft.takeDamage(80, 3, 1);
assert.equal(damagedRaft.grid.size, 1, 'romper el puente retira el módulo separado');
assert.equal(damagedRaft.selected, null);
assert.equal(edgeCount(damagedRaft.get(0, 0)), 4);
assert.ok(damagedRaft.visualRevision > damageRevision);

console.log('✓ balsa detallada: bordes, daño reversible, recursos agrupados y mecanismos animados');