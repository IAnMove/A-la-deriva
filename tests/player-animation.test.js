const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const THREE = require(path.join(root, 'vendor', 'three.min.js'));
let now = 0;
const sandbox = {
  console,
  THREE,
  performance: { now: () => now },
  Util: {
    clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
    choice: values => values[0],
    rand: (min, max) => (min + max) / 2,
    escapeHtml: value => String(value)
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

load('raft.js');
load('survivor.js');
load('player.js');
load('hook.js');

run(`
  var animationSceneFixture = new THREE.Scene();
  var animationRaftFixture = new THREE.Group();
  animationSceneFixture.add(animationRaftFixture);
  PlayerVis.init(animationRaftFixture);
  HookVis.init(animationSceneFixture);

  var animationPartsFixture = PlayerVis.mesh.userData.parts;
  var animationPlayerFixture = {
    x: 1,
    z: 1,
    vx: 0,
    vz: 0,
    rowAnim: 0,
    hook: {
      x: 1,
      z: 1,
      vx: 8,
      vz: 0,
      distance: 0,
      maxRange: 8,
      returning: false,
      fishing: false
    }
  };

  PlayerVis.beginCast({ x: 9, z: 1 });
  PlayerVis.sync(animationPlayerFixture, 0.1, 0.1);
  var anticipationPoseFixture = PlayerVis.pose;
  var anticipationArmFixture = animationPartsFixture.armR.rotation.x;
  for (var castReleaseStepFixture = 0; castReleaseStepFixture < 3; castReleaseStepFixture++) {
    PlayerVis.sync(animationPlayerFixture, 0.1, 0.2 + castReleaseStepFixture * 0.1);
  }
  var releasePoseFixture = PlayerVis.pose;
  var releaseArmFixture = animationPartsFixture.armR.rotation.x;
  for (var castFollowStepFixture = 0; castFollowStepFixture < 3; castFollowStepFixture++) {
    PlayerVis.sync(animationPlayerFixture, 0.1, 0.5 + castFollowStepFixture * 0.1);
  }
  var followPoseFixture = PlayerVis.pose;

  animationPlayerFixture.hook.distance = 4;
  HookVis.show(1, 1, 5, 1, animationPlayerFixture.hook);
  var castEndpointHeightFixture =
    HookVis.line.geometry.attributes.position.getY(HookVis.lineSegments - 1);
  var castLineCountFixture =
    HookVis.line.geometry.attributes.position.count;

  animationPlayerFixture.hook.returning = true;
  HookVis.show(1, 1, 5, 1, animationPlayerFixture.hook);
  var returnStateFixture = HookVis.lastState;
  var returnEndpointHeightFixture =
    HookVis.line.geometry.attributes.position.getY(HookVis.lineSegments - 1);

  animationPlayerFixture.hook.returning = false;
  animationPlayerFixture.hook.fishing = true;
  for (var castFinishStepFixture = 0; castFinishStepFixture < 3; castFinishStepFixture++) {
    PlayerVis.sync(animationPlayerFixture, 0.1, 0.8 + castFinishStepFixture * 0.1);
  }
  PlayerVis.pulseTug(true);
  PlayerVis.sync(animationPlayerFixture, 0.05, 1.1);
  var tugPoseFixture = PlayerVis.pose;
  var flexFixture = PlayerVis.rodSegments[2].rotation.x;
  var rodTipFixture = PlayerVis.getRodTipWorld(new THREE.Vector3());
`);

assert.ok(run('animationPartsFixture.forearmL'));
assert.ok(run('animationPartsFixture.forearmR'));
assert.ok(run('animationPartsFixture.handR'));
assert.equal(run('PlayerVis.rodSegments.length'), 3);
assert.ok(run('PlayerVis.mesh.getObjectByName("player-life-vest")'));
assert.equal(run('anticipationPoseFixture'), 'cast-anticipation');
assert.equal(run('releasePoseFixture'), 'cast-release');
assert.equal(run('followPoseFixture'), 'cast-follow-through');
assert.notEqual(run('anticipationArmFixture'), run('releaseArmFixture'));
assert.equal(run('castLineCountFixture'), 16);
assert.ok(run('castEndpointHeightFixture > 1'));
assert.equal(run('returnStateFixture'), 'returning');
assert.ok(Math.abs(run('returnEndpointHeightFixture') - 0.38) < 0.001);
assert.equal(run('tugPoseFixture'), 'fishing-pull');
assert.ok(run('flexFixture > 0.05'));
assert.ok(run('Number.isFinite(rodTipFixture.x) && Number.isFinite(rodTipFixture.y)'));

console.log('✓ personaje articulado y ciclo visual completo de pesca');
