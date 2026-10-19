const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const THREE = require(path.join(root, 'vendor', 'three.min.js'));
const sandbox = {
  console,
  THREE,
  Math,
  World: {
    waveAmp: 1,
    waveHeight: () => 0
  },
  Game: {
    worldOffset: 0,
    worldOffsetZ: 0
  }
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

function load(file) {
  vm.runInContext(
    fs.readFileSync(path.join(root, file), 'utf8'),
    sandbox,
    { filename: file }
  );
}

function run(source) {
  return vm.runInContext(source, sandbox);
}

load('engine.js');
load('raft.js');
load('survivor.js');
load('entities.js');

run(`
  var hazardSceneFixture = new THREE.Scene();
  var dangerFixture = new Danger(10, 1, 'shark', hazardSceneFixture);
  var playerTargetFixture = {
    id: 'player', type: 'player', name: 'ti', x: 1, z: 1
  };
  dangerFixture.update(
    0.1, 0, 0, 1, { x: 1, z: 1 }, [playerTargetFixture]
  );
`);

assert.equal(run('dangerFixture.state'), 'telegraph');
assert.equal(run('dangerFixture.justLocked'), true);
assert.equal(run('dangerFixture.targetMarker.visible'), true);
assert.equal(run('dangerFixture.targetId'), 'player');

run(`
  Game.raft = { countProvides: key => key === 'lookout' ? 1 : 0 };
  var warnedDangerFixture = new Danger(10, 1, 'shark', hazardSceneFixture);
  warnedDangerFixture.lockTarget([playerTargetFixture]);
`);
assert.ok(run('warnedDangerFixture.attackTimer') > 2.4);

run(`
  dangerFixture.attackTimer = 0.01;
  dangerFixture.update(
    0.1, 0, 0, 2, { x: 1, z: 1 }, [playerTargetFixture]
  );
`);
assert.equal(run('dangerFixture.state'), 'charge');
assert.ok(Math.hypot(run('dangerFixture.vx'), run('dangerFixture.vz')) > 5);

run('var scaredFixture = dangerFixture.scareFrom(1, 1);');
assert.equal(run('scaredFixture'), true);
assert.equal(run('dangerFixture.state'), 'flee');
assert.equal(run('dangerFixture.resolved'), true);
assert.equal(run('dangerFixture.targetMarker.visible'), false);

run(`
  var reefFixture = new Reef(20, 4, hazardSceneFixture);
  var reefStartXFixture = reefFixture.x;
  reefFixture.update(0.1, 2, 1, 2);
`);
assert.ok(run('reefFixture.x') < run('reefStartXFixture'));
assert.ok(run('reefFixture.z') < 4);

run(`
  EntityManager.init(hazardSceneFixture);
  EntityManager.dangers = [];
  EntityManager.reefs = [reefFixture];
  var reefThreatFixture = EntityManager.getThreatSummary({ x: 1, z: 1 });
`);
assert.equal(run('reefThreatFixture.title'), 'Arrecife de coral');
assert.match(run('reefThreatFixture.detail'), /desvía la balsa/);

run(`
  var warningDangerFixture = new Danger(8, 1, 'shark', hazardSceneFixture);
  warningDangerFixture.lockTarget([playerTargetFixture]);
  EntityManager.dangers = [warningDangerFixture];
  var sharkThreatFixture = EntityManager.getThreatSummary({ x: 1, z: 1 });
`);
assert.equal(run('sharkThreatFixture.level'), 'warning');
assert.match(run('sharkThreatFixture.detail'), /ataque en/);

run('EntityManager.reset();');
assert.equal(run('EntityManager.dangers.length'), 0);
assert.equal(run('EntityManager.reefs.length'), 0);

run(`
  var raftForReefsFixture = new Raft();
  for (let gx = -1; gx <= 2; gx++) {
    for (let gy = -1; gy <= 2; gy++) {
      raftForReefsFixture.grid.set(gx + ',' + gy, {
        buildingKey: 'floor', health: 50, maxHealth: 50, mesh: null
      });
    }
  }
  var centerForReefsFixture = raftForReefsFixture.getCenter();
  EntityManager.spawnReefRegionAhead(centerForReefsFixture, raftForReefsFixture);
`);
assert.ok(run('EntityManager.reefs.length') >= 3);
assert.equal(
  run('EntityManager.reefs.every(r => r.x > centerForReefsFixture.x + 10)'),
  true
);
assert.equal(
  run('EntityManager.reefs.every(r => !raftForReefsFixture.intersectsCircle(r.x, r.z, r.radius + 1))'),
  true
);

console.log('✓ tiburones telegrafiados, defensa con gancho y arrecifes navegables');
