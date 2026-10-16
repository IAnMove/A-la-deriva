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

run(`
  var glbBonesFixture = {};
  for (var sideFixture of ['Right', 'Left']) {
    var armFixture = new THREE.Bone();
    armFixture.name = sideFixture + 'Arm';
    armFixture.position.set(sideFixture === 'Right' ? 0.22 : -0.22, 0.9, 0);
    PlayerVis.mesh.add(armFixture);
    glbBonesFixture[armFixture.name] = armFixture;
    var foreFixture = new THREE.Bone(); foreFixture.name = sideFixture + 'ForeArm';
    foreFixture.position.y = 0.27; armFixture.add(foreFixture);
    glbBonesFixture[foreFixture.name] = foreFixture;
    var handFixture = new THREE.Bone(); handFixture.name = sideFixture + 'Hand';
    handFixture.position.y = 0.23; foreFixture.add(handFixture);
    glbBonesFixture[handFixture.name] = handFixture;
  }
  var neckFixture = new THREE.Bone(); neckFixture.name = 'Neck';
  PlayerVis.mesh.add(neckFixture); glbBonesFixture.Neck = neckFixture;
  var headFixture = new THREE.Bone(); headFixture.name = 'Head';
  neckFixture.add(headFixture); glbBonesFixture.Head = headFixture;
  PlayerVis.glbRig = {
    actions: {},
    bone: name => glbBonesFixture[name],
    play: () => {},
    update: () => {
      glbBonesFixture.RightArm.rotation.set(0, 0, -1.5);
      glbBonesFixture.LeftArm.rotation.set(0, 0, 1.5);
      glbBonesFixture.RightForeArm.rotation.set(-0.8, 0, 0);
      glbBonesFixture.LeftForeArm.rotation.set(-0.8, 0, 0);
      glbBonesFixture.Head.rotation.set(1.2, 0, 0);
    }
  };
  var glbPlayerFixture = { x: 1, z: 1, vx: 0, vz: 0, rowAnim: 0, hook: null };
  var limbDirectionFixture = name => {
    var rotation = glbBonesFixture[name].getWorldQuaternion(new THREE.Quaternion());
    var inverseRoot = PlayerVis.mesh.getWorldQuaternion(new THREE.Quaternion()).invert();
    return new THREE.Vector3(0, 1, 0).applyQuaternion(rotation).applyQuaternion(inverseRoot);
  };
  PlayerVis.fpMode = false; PlayerVis.castTime = 99;
  PlayerVis.sync(glbPlayerFixture, 0.1, 2);
  var idleArmsDownFixture = ['RightArm', 'LeftArm', 'RightForeArm', 'LeftForeArm']
    .every(name => limbDirectionFixture(name).y < -0.95);
  var idleHeadUprightFixture = limbDirectionFixture('Head').y > 0.95;
  glbPlayerFixture.vz = 1; PlayerVis.walkTime = 0.7;
  PlayerVis.sync(glbPlayerFixture, 0.1, 3);
  var walkArmsDownFixture = limbDirectionFixture('RightArm').y < -0.85 &&
    limbDirectionFixture('LeftArm').y < -0.85;
  var walkCounterSwingFixture = limbDirectionFixture('RightArm').z * limbDirectionFixture('LeftArm').z < 0;
  glbPlayerFixture.vz = 0; glbPlayerFixture.rowAnim = 0.48;
  PlayerVis.sync(glbPlayerFixture, 0.1, 4);
  var paddleVisibleFixture = PlayerVis.paddle.visible;
  var paddleForwardFixture = limbDirectionFixture('RightForeArm').z > 0.4;
  glbPlayerFixture.rowAnim = 0; PlayerVis.sync(glbPlayerFixture, 0.1, 5);
  var paddleHiddenFixture = !PlayerVis.paddle.visible;
  glbPlayerFixture.hook = { x: 3, z: 1, fishing: true };
  PlayerVis.castTime = 99; PlayerVis.lastHook = glbPlayerFixture.hook;
  PlayerVis.sync(glbPlayerFixture, 0.1, 6);
  var fishingRigPreservedFixture = Math.abs(glbBonesFixture.RightArm.rotation.z + 1.5) < 0.0001;
  glbPlayerFixture.hook = null; PlayerVis.fpMode = true;
  PlayerVis.sync(glbPlayerFixture, 0.1, 7);
  var fpRigPreservedFixture = Math.abs(glbBonesFixture.RightArm.rotation.z + 1.5) < 0.0001;
`);
assert.equal(run('idleArmsDownFixture'), true);
assert.equal(run('idleHeadUprightFixture'), true);
assert.equal(run('walkArmsDownFixture'), true);
assert.equal(run('walkCounterSwingFixture'), true);
assert.equal(run('paddleVisibleFixture'), true);
assert.equal(run('paddleForwardFixture'), true);
assert.equal(run('paddleHiddenFixture'), true);
assert.equal(run('fishingRigPreservedFixture'), true);
assert.equal(run('fpRigPreservedFixture'), true);
console.log('✓ GLB: reposo natural, brazos al caminar y palada sin alterar pesca ni primera persona');
