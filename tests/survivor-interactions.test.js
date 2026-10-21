const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const THREE = require(path.join(root, 'vendor', 'three.min.js'));
const sandbox = { console, THREE, Util: {
  clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
  choice: values => values[0], escapeHtml: value => String(value),
  resourceName: value => value, formatAmount: value => String(value)
} };
vm.createContext(sandbox);
for (const file of ['raft.js', 'survivor.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), sandbox, { filename: file });
}
const run = code => vm.runInContext(code, sandbox);
function test(name, fn) {
  try { fn(); console.log(`✓ ${name}`); }
  catch (error) { console.error(`✗ ${name}`); throw error; }
}
run(`
  var Game = { day: 4, player: { x: 100, z: 100 }, raft: null };
  function fixture(cells) {
    CrewManager.reset();
    const raft = new Raft();
    raft.init(new THREE.Scene());
    for (const key of Array.from(raft.grid.keys())) {
      const cell = raft.grid.get(key);
      if (cell.mesh) raft.group.remove(cell.mesh);
    }
    raft.grid.clear();
    for (const [gx, gy, buildingKey = 'floor'] of cells) {
      raft.grid.set(gx + ',' + gy, { buildingKey, health: 50, maxHealth: 50 });
    }
    Game.raft = raft;
    return raft;
  }
  function member(name, gx, gy, job = 'fish') {
    const survivor = new Survivor();
    survivor.name = name; survivor.gx = gx; survivor.gy = gy; survivor.job = job;
    CrewManager.add(survivor);
    return survivor;
  }
`);

test('la ruta rodea huecos y rechaza islas de tablas desconectadas', () => {
  run(`var raft = fixture([[0,0],[1,0],[2,0],[2,1],[2,2],[1,2],[0,2],[9,9]]);`);
  const route = run(`CrewManager.findDeckPath(raft, {gx:0,gy:0}, {gx:0,gy:2})`);
  assert.equal(route.length, 6);
  let previous = { gx: 0, gy: 0 };
  for (const node of route) {
    assert.equal(Math.abs(node.gx - previous.gx) + Math.abs(node.gy - previous.gy), 1);
    previous = node;
  }
  assert.equal(run(`CrewManager.findDeckPath(raft, {gx:0,gy:0}, {gx:9,gy:9}).length`), 0);
});

test('la marcha cruza celdas sin cortar esquinas ni caminar sobre huecos', () => {
  run(`
    var walker = member('Luis Vega', 0, 0);
    CrewManager.syncMeshes(raft, 0, 0);
    var routine = walker.mesh.userData.routine;
    routine.path = CrewManager.findDeckPath(raft, walker, {gx:0,gy:2});
    routine.goal = { gx:0,gy:2,offset:{x:0,z:0},face:{x:-1,z:5} };
    routine.timer = 1000; routine.socialCooldown = 1000;
    var stepsStayedOnDeck = true;
    for (let i=1; i<=1100; i++) {
      CrewManager.syncMeshes(raft, 0.02, i * 0.02);
      const cell = raft.worldToGrid(walker.mesh.position.x, walker.mesh.position.z);
      if (!raft.has(cell.gx, cell.gy)) stepsStayedOnDeck = false;
    }
  `);
  assert.equal(run('stepsStayedOnDeck'), true);
  assert.equal(run('walker.gx'), 0);
  assert.equal(run('walker.gy'), 2);
  assert.ok(run('Math.hypot(walker.mesh.position.x - 1, walker.mesh.position.z - 5)') < 0.1);
});

test('la pausa congela gestos, posiciones, herramientas y conversaciones', () => {
  run(`
    CrewManager.signalInteraction(walker, 'talk', Game.player, 5);
    CrewManager.syncMeshes(raft, 0.02, 23);
    var pauseBefore = JSON.stringify({ position: walker.mesh.position, rotation: walker.mesh.rotation,
      arm: walker.mesh.userData.parts.armR.rotation, remaining: walker.mesh.userData.routine.interaction.remaining });
    for (let i=0; i<80; i++) CrewManager.syncMeshes(raft, 0, 23);
    var pauseAfter = JSON.stringify({ position: walker.mesh.position, rotation: walker.mesh.rotation,
      arm: walker.mesh.userData.parts.armR.rotation, remaining: walker.mesh.userData.routine.interaction.remaining });
  `);
  assert.equal(run('pauseBefore === pauseAfter'), true);
});

test('la asignación saturada usa una tabla real aunque el centro esté vacío', () => {
  run(`
    raft = fixture([[0,0],[3,0],[3,3],[0,3]]);
    member('A',0,0); member('B',3,0); member('C',3,3); member('D',0,3);
    var extra = member('E',null,null);
    CrewManager.assignPosition(extra, raft);
  `);
  assert.equal(run('raft.has(extra.gx, extra.gy)'), true);
});

test('las profesiones eligen equipo alcanzable y los heridos descansan', () => {
  run(`
    raft = fixture([[0,0],[1,0],[2,0,'purifier'],[9,9,'purifier']]);
    var worker = member('Ana Gil',0,0,'water');
    var plan = CrewManager.getWorkPlan(worker,raft);
  `);
  assert.ok(run('plan.gx') <= 2);
  assert.equal(run('plan.face.x'), 5);
  assert.equal(run('plan.face.z'), 1);
  run(`worker.health = 18; var restPlan = CrewManager.getWorkPlan(worker,raft);`);
  assert.equal(run('restPlan.job'), 'rest');
  assert.equal(run('worker.getCondition().level'), 'critical');
});

test('los compañeros conversan mirándose y evitan superponerse al jugador', () => {
  run(`
    raft = fixture([[0,0],[1,0],[0,1],[1,1]]);
    Game.player.x = 1; Game.player.z = 1;
    var left = member('Marta',0,0,'guard');
    var right = member('Diego',1,0,'guard');
    CrewManager.syncMeshes(raft,0,0);
    left.mesh.position.set(1,0.35,1); right.mesh.position.set(2,0.35,1);
    for (const survivor of [left,right]) {
      const state = survivor.mesh.userData.routine;
      state.path = []; state.goal = null; state.timer = 100; state.job='guard'; state.socialCooldown=0;
    }
    CrewManager.syncMeshes(raft,0.1,1);
  `);
  assert.equal(run('left.mesh.userData.routine.interaction.target === right'), true);
  assert.equal(run('right.mesh.userData.routine.interaction.target === left'), true);
  assert.ok(run('Math.hypot(left.mesh.position.x - 1, left.mesh.position.z - 1)') > 0);
  assert.equal(run(`CrewManager.getActivity(left)`), 'Conversando');
});

test('los estados visuales no contaminan el guardado y el día de conversación se sanea', () => {
  run(`var saved = JSON.parse(JSON.stringify({...left, mesh:null})); var restored = Survivor.fromData(saved);`);
  assert.equal(run('restored.mesh'), null);
  assert.equal(run('Object.hasOwn(saved, "routine")'), false);
  assert.equal(run('Survivor.fromData({lastTalkDay:"3"}).lastTalkDay'), 3);
  assert.equal(run('Survivor.fromData({lastTalkDay:Infinity}).lastTalkDay'), -1);
});

test('liberar un náufrago GLB dispone sus herramientas y conserva geometrías compartidas', () => {
  run(`
    var fake = member('GLB',0,0);
    fake.mesh = new THREE.Group();
    fake.mesh.userData.glbCrew = true;
    var sharedGeometry = new THREE.BoxGeometry();
    var sharedDisposed = 0; sharedGeometry.dispose = () => sharedDisposed++;
    fake.mesh.add(new THREE.Mesh(sharedGeometry, mat(0xffffff)));
    CrewManager.addWorkProps(fake.mesh);
    var propDisposed = 0;
    fake.mesh.userData.workProps.traverse(obj => { if(obj.geometry) obj.geometry.dispose = () => propDisposed++; });
    var expectedDisposals = 0;
    fake.mesh.userData.workProps.traverse(obj => { if(obj.geometry) expectedDisposals++; });
    CrewManager.removeMesh(fake);
  `);
  assert.equal(run('sharedDisposed'), 0);
  assert.equal(run('propDisposed'), run('expectedDisposals'));
  assert.ok(run('propDisposed') > 0);
});
test('los gestos del rig respetan la orientación de la balsa sin acumular deformación', () => {
  run(`
    var poseRoot = new THREE.Group(); poseRoot.rotation.set(0.05,0.7,-0.03);
    var shoulder = new THREE.Bone(); shoulder.rotation.set(-0.45,0.35,0.1); poseRoot.add(shoulder);
    var arm = new THREE.Bone(); arm.name='RightArm'; arm.rotation.set(0.8,-0.1,0.45); shoulder.add(arm);
    var poseRig = { bone: name => poseRoot.getObjectByName(name) };
    CrewManager.aimLimb(poseRoot,poseRig,'RightArm',0,-1,0.4);
    var stablePose = arm.quaternion.clone();
    for(let i=0;i<120;i++) CrewManager.aimLimb(poseRoot,poseRig,'RightArm',0,-1,0.4);
    var aimedDirection = new THREE.Vector3(0,1,0).applyQuaternion(arm.getWorldQuaternion(new THREE.Quaternion()))
      .applyQuaternion(poseRoot.getWorldQuaternion(new THREE.Quaternion()).invert());
    var poseAgreement = aimedDirection.dot(new THREE.Vector3(0,-1,0.4).normalize());
    var poseDrift = Math.abs(1 - Math.abs(arm.quaternion.dot(stablePose)));
  `);
  assert.ok(run('poseAgreement') > 0.999999);
  assert.ok(run('poseDrift') < 1e-10);
});
test('el saludo solicitado antes de crear la figura se reproduce una vez y reset lo descarta', () => {
  run(`
    raft = fixture([[0,0],[1,0]]);
    var rescued = member('Rescate',0,0);
    var queuedWelcome = CrewManager.signalInteraction(rescued,'welcome',Game.player,4);
    CrewManager.syncMeshes(raft,0,0);
  `);
  assert.equal(run('queuedWelcome'), true);
  assert.equal(run('rescued.mesh.userData.routine.interaction.kind'), 'welcome');
  assert.equal(run('rescued.mesh.userData.routine.interaction.remaining'), 4);
  assert.equal(run('CrewManager.pendingInteractions.has(rescued)'), false);
  run(`CrewManager.reset(); CrewManager.signalInteraction(rescued,'welcome'); CrewManager.reset();`);
  assert.equal(run('CrewManager.pendingInteractions.has(rescued)'), false);
});
console.log('Todas las interacciones de tripulación han pasado.');