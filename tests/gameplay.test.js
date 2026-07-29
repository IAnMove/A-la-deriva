const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const elements = new Map();

function makeElement() {
  const classes = new Set();
  let html = '';
  const element = {
    classList: {
      add: (...names) => names.forEach(name => classes.add(name)),
      remove: (...names) => names.forEach(name => classes.delete(name)),
      toggle(name, force) {
        if (force === undefined) {
          if (classes.has(name)) classes.delete(name);
          else classes.add(name);
        } else if (force) classes.add(name);
        else classes.delete(name);
      },
      contains: name => classes.has(name)
    },
    style: {},
    dataset: {},
    children: [],
    textContent: '',
    disabled: false,
    appendChild(child) { this.children.push(child); },
    addEventListener() {}
  };
  Object.defineProperty(element, 'innerHTML', {
    get: () => html,
    set(value) {
      html = value;
      if (value === '') element.children = [];
    }
  });
  return element;
}

const sandbox = {
  console,
  performance: { now: () => 0 },
  requestAnimationFrame() {},
  setTimeout(fn) { return fn; },
  clearTimeout() {},
  window: { addEventListener() {}, innerWidth: 1280, innerHeight: 720 },
  document: {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, makeElement());
      return elements.get(id);
    },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    createElement() { return makeElement(); }
  }
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

function load(file) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), sandbox, { filename: file });
}
function run(code) {
  return vm.runInContext(code, sandbox);
}
function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

load('engine.js');
load('raft.js');
load('survivor.js');
run(`
  var World = { scene: {}, mouseToWorld: () => ({ x: 0, z: 0 }) };
  var EntityManager = { objects: [], dangers: [], fishBanks: [], scene: {}, reset() {}, update() {} };
  var HookVis = { hide() {}, show() {} };
  var AudioSys = { play() {}, isEnabled: () => true, setEnabled() {} };
  var Save = {
    saveCalls: 0,
    save() { this.saveCalls++; return true; },
    loadBest: () => 0,
    saveBest() {},
    load: () => null,
    exists: () => true
  };
  FloatingText.add = () => {};
  FloatingText.clear = () => {};
  Particles.emit = () => {};
  Particles.clear = () => {};
`);
load('game.js');
run(`
  Game.showFloatingText = () => {};
  Game.showEventMessage = () => {};
  Game.updateUI = () => {};
  Game.closeAllModals();
`);

function resetRaft(entries) {
  run('Game.raft.grid.clear();');
  for (const [key, buildingKey, health] of entries) {
    run(`Game.raft.grid.set(${JSON.stringify(key)}, {
      buildingKey: ${JSON.stringify(buildingKey)},
      health: ${health},
      maxHealth: ${health},
      mesh: null
    });`);
  }
}

test('economía, producción y recogida fraccionaria', () => {
  resetRaft([['0,0', 'net', 35]]);
  run('Game.resources.food = 0; Game.resources.water = 0; Game.rain = false; Game.updateProduction(10);');
  assert.equal(run('Game.resources.food'), 0.06);

  resetRaft([['0,0', 'rain', 30], ['1,0', 'purifier', 40]]);
  run('Game.resources.water = 0; Game.rain = false; Game.updateProduction(10);');
  assert.equal(run('Game.resources.water'), 0.12);
  run('Game.rain = true; Game.updateProduction(10);');
  assert.equal(run('Game.resources.water'), 0.44);

  run(`
    CrewManager.members = [];
    Game.resources.water = 0;
    Game.resources.plastic = 0;
    Game.stats.gathered = 0;
    var barrelFixture = {
      typeKey: 'barrel',
      loot: { name: 'Bidón', water: 0.4, plastic: 0.2 },
      x: 5, z: 5, collected: false, pendingDecision: false, marked: false,
      dispose() {}
    };
    EntityManager.objects = [barrelFixture];
    Game.collectObject(barrelFixture);
    Game.collectObject(barrelFixture);
  `);
  assert.equal(run('Game.resources.water'), 0.4);
  assert.equal(run('Game.resources.plastic'), 0.2);
  assert.equal(run('Game.stats.gathered'), 1);
});

test('acciones especiales sin exploits y reparaciones completas', () => {
  resetRaft([['0,0', 'fire', 35]]);
  run(`
    Game.player.x = 1; Game.player.z = 1;
    Game.player.hunger = 40; Game.player.health = 70;
    Game.resources.food = 1; Game.raft.selected = null; Game.interact();
  `);
  assert.equal(run('Game.resources.food'), 0);
  assert.equal(run('Game.player.hunger'), 60);

  resetRaft([['0,0', 'medkit', 30]]);
  run('Game.player.health = 40; Game.resources.cloth = 1; Game.interact();');
  assert.equal(run('Game.player.health'), 65);
  assert.equal(run('Game.resources.cloth'), 0);

  resetRaft([['0,0', 'radio', 36]]);
  run(`
    Game.raft.get(0, 0).maxHealth = 44;
    Game.resources.wood = 1; Game.rescuedSignal = 10; Game.interact();
  `);
  assert.equal(run('Game.raft.get(0, 0).health'), 44);
  assert.equal(run('Game.rescuedSignal'), 10);
  run('Game.interact();');
  assert.equal(run('Game.rescuedSignal'), 10);
});

test('conectividad, destrucción y colisiones de la balsa', () => {
  resetRaft([['0,0', 'floor', 50], ['1,0', 'floor', 50], ['2,0', 'floor', 50]]);
  assert.equal(run('Game.raft.removeAt(1, 0)'), false);
  assert.equal(run('Game.raft.removeAt(2, 0)'), true);

  resetRaft([['0,0', 'floor', 1]]);
  run('Game.raft.takeDamage(5);');
  assert.equal(run('Game.raft.grid.size'), 0);

  resetRaft([['0,0', 'floor', 50], ['1,0', 'floor', 1], ['2,0', 'floor', 50]]);
  run(`
    var detachRandom = Math.random;
    Math.random = () => 0.4;
    Game.raft.takeDamage(5);
    Math.random = detachRandom;
  `);
  assert.equal(run('Game.raft.grid.size'), 1);
  assert.equal(run('Game.raft.lastDetached'), 1);

  resetRaft([['0,0', 'floor', 50], ['2,0', 'floor', 50]]);
  assert.equal(run('Game.raft.intersectsCircle(1, 1, 0)'), true);
  assert.equal(run('Game.raft.intersectsCircle(3, 1, 0)'), false);
});

test('clima, controles, pausa y menús', () => {
  run(`
    Game.time = 16; Game.zone = 'calm';
    Game.weatherTimers = { storm: 0, rain: 5, fog: 0, heat: 0 };
    Game.updateTime(1);
  `);
  assert.equal(run('Game.rain'), true);
  assert.equal(run('Game.weatherTimers.rain'), 4);

  run('Game.state = "playing"; Game.paused = false; Input.keys = { Space: true }; Game.update(0.016);');
  assert.equal(run('Game.state'), 'paused');
  run('Input.keys = { Space: true }; Game.update(0.016);');
  assert.equal(run('Game.state'), 'playing');

  run('Game.closeAllModals(); BuildManager.active = true; Game.updateBuildMenu();');
  assert.equal(run('Game.paused'), true);
  run('Input.keys = { Escape: true }; Game.update(0.016);');
  assert.equal(run('BuildManager.active'), false);
  assert.equal(run('Game.paused'), false);

  resetRaft([['0,0', 'floor', 50]]);
  run(`
    Game.player.x = 1; Game.player.z = 1;
    Game.player.moveTarget = { gx: 0, gy: 0 };
    Game.player.rowTarget = { x: 1.5, z: 1, pushX: -1, pushZ: 0 };
    Input.keys = { KeyD: true };
    Game.updatePlayer(0.1);
  `);
  assert.equal(run('Game.player.moveTarget'), null);
  assert.equal(run('Game.player.rowTarget'), null);

  run(`
    Input.keys = {}; Game.state = 'playing'; Game.paused = false;
    Game.mouseWorld = { x: 1, z: 1 };
    Game.player.hook = { returning: false };
    Game.handleLeftClick();
  `);
  assert.equal(run('Game.player.hook.returning'), true);
});

test('habilidades, carga, almacenamiento e interfaz', () => {
  run(`
    var skilledFixture = new Survivor();
    skilledFixture.skill = SKILLS.find(skill => skill.key === 'cook');
    skilledFixture.trait = TRAITS.find(trait => trait.key === 'conflictive');
    CrewManager.members = [skilledFixture];
  `);
  assert.equal(run('CrewManager.getDailyFoodNeed()'), 0.9);
  assert.equal(run('CrewManager.getConflictChance()'), 0.15);
  assert.equal(run("BuildManager.realCost('storage', -0.15).wood"), 3.4);
  run("skilledFixture.skill = SKILLS.find(skill => skill.key === 'fisher');");
  assert.equal(run('CrewManager.getFishingBonus()'), 0.3);
  run("skilledFixture.skill = SKILLS.find(skill => skill.key === 'mechanic'); Game.raft.grid.clear(); Game.raft.placeAt(0, 0, 'radio', true, CrewManager.getDurabilityBonus());");
  assert.equal(run('Game.raft.get(0, 0).maxHealth'), 44);

  resetRaft([['0,0', 'storage', 40]]);
  assert.equal(run('Game.raft.maxWeight()'), 12.5);
  resetRaft([['0,0', 'floor', 50]]);
  run("CrewManager.members = []; Game.resources = { wood: 20, plastic: 0, cloth: 0, metal: 0, rope: 0, food: 0, water: 0 };");
  assert.equal(run('Game.totalWeight()'), 5.5);
  assert.equal(run('Game.loadSpeedMultiplier()'), 0.71875);
  assert.equal(run('Util.formatAmount(1.58)'), '1.6');
  assert.equal(run("Util.resourceName('wood')"), 'madera');
});

test('guardados inválidos se sanean', () => {
  run(`
    Game.loadFromSave({
      day: 'incorrecto', time: 99, zone: 'zona-inexistente',
      player: { x: 'NaN', health: -20 },
      resources: { wood: -4, water: '2.5' },
      raftGrid: [
        ['0,0', { buildingKey: 'floor', health: 25 }],
        ['4,0', { buildingKey: 'radio', health: 999 }]
      ],
      crew: [{}]
    });
  `);
  assert.equal(run('Game.day'), 1);
  assert.equal(run('Game.time'), 23.99);
  assert.equal(run('Game.player.x'), 1);
  assert.equal(run('Game.resources.wood'), 0);
  assert.equal(run('Game.raft.grid.size'), 1);
});

test('supervivencia diaria, recuperación y autoguardado', () => {
  resetRaft([['0,0', 'net', 35], ['1,0', 'purifier', 40]]);
  run(`
    CrewManager.members = [];
    Game.resources = { wood: 0, plastic: 0, cloth: 0, metal: 0, rope: 0, food: 0, water: 0 };
    Object.assign(Game.player, { health: 100, hunger: 90, thirst: 90, morale: 75, sanity: 100 });
    Game.day = 1; Game.zone = 'debris'; Game.storm = false; Game.state = 'playing';
    var dailyEventsFixture = Game.pickDailyEvents;
    var dailySummaryFixture = Game.showDaySummary;
    Game.pickDailyEvents = () => [];
    Game.showDaySummary = () => {};
    var savesBeforeFixture = Save.saveCalls;
    Game.updateProduction(240);
    Game.endDay();
  `);
  assert.ok(Math.abs(run('Game.resources.food') - 0.44) < 1e-9);
  assert.ok(Math.abs(run('Game.resources.water') - 1.58) < 1e-9);
  assert.equal(run('Save.saveCalls'), run('savesBeforeFixture + 1'));

  resetRaft([['0,0', 'bed', 30], ['1,0', 'floor', 50]]);
  run(`
    var medicFixture = new Survivor();
    medicFixture.skill = SKILLS.find(skill => skill.key === 'medic');
    medicFixture.trait = TRAITS.find(trait => trait.key === 'fearful');
    CrewManager.members = [medicFixture];
    Game.resources.food = 2; Game.resources.water = 2.6;
    Object.assign(Game.player, { health: 50, hunger: 90, thirst: 90, morale: 60, sanity: 80 });
    Game.state = 'playing'; Game.endDay();
  `);
  assert.equal(run('Game.player.health'), 56);
  assert.equal(run('Game.player.morale'), 65);
});

test('eventos y rutas finales son alcanzables', () => {
  run(`
    Game.pickDailyEvents = dailyEventsFixture;
    Game.showDaySummary = dailySummaryFixture;
    Game.zone = 'ship';
    var shipEventsFixture = Game.pickDailyEvents();
    var eventRandomFixture = Math.random;
    Math.random = () => 0;
    CrewManager.members = [];
    Game.zone = 'debris';
    var soloEventsFixture = Game.pickDailyEvents();
    var victimFixture = new Survivor();
    victimFixture.health = 10;
    CrewManager.members = [victimFixture];
    Game.applyEvent('lost');
    Math.random = eventRandomFixture;
    Game.pickDailyEvents = () => [];
    Game.showDaySummary = () => {};
  `);
  assert.equal(run("shipEventsFixture.includes('ship')"), true);
  assert.equal(run("soloEventsFixture.includes('argument')"), false);
  assert.equal(run('victimFixture.alive'), false);

  resetRaft([['0,0', 'motor', 50], ['1,0', 'sail', 40], ['0,1', 'rudder', 45]]);
  run(`
    CrewManager.members = [];
    Game.day = 1; Game.state = 'playing'; Game.victoryCondition = 'island'; Game.islandDistance = 300;
    Object.assign(Game.player, { health: 100, hunger: 90, thirst: 90, morale: 75, sanity: 100 });
    var islandDaysFixture = 0;
    while (Game.state === 'playing' && islandDaysFixture < 20) {
      Game.resources = { wood: 0, plastic: 0, cloth: 0, metal: 0, rope: 0, food: 1, water: 1.3 };
      Game.endDay(); islandDaysFixture++;
    }
  `);
  assert.equal(run('islandDaysFixture'), 12);

  resetRaft([['0,0', 'radio', 35]]);
  run(`
    Game.day = 1; Game.state = 'playing'; Game.victoryCondition = 'radio'; Game.rescuedSignal = 1;
    Object.assign(Game.player, { health: 100, hunger: 90, thirst: 90, morale: 75, sanity: 100 });
    var radioDaysFixture = 0;
    while (Game.state === 'playing' && radioDaysFixture < 20) {
      Game.resources = { wood: 0, plastic: 0, cloth: 0, metal: 0, rope: 0, food: 1, water: 1.3 };
      Game.endDay(); radioDaysFixture++;
    }
  `);
  assert.equal(run('radioDaysFixture'), 13);

  resetRaft([['0,0', 'floor', 50]]);
  run(`
    Game.day = 1; Game.state = 'playing'; Game.victoryCondition = null;
    Game.resources = { wood: 0, plastic: 0, cloth: 0, metal: 0, rope: 0, food: 0, water: 0 };
    Object.assign(Game.player, { health: 100, hunger: 90, thirst: 90, morale: 75, sanity: 100 });
    var lossDaysFixture = 0;
    while (Game.state === 'playing' && lossDaysFixture < 20) {
      Game.endDay(); lossDaysFixture++;
    }
    Game.pickDailyEvents = dailyEventsFixture;
    Game.showDaySummary = dailySummaryFixture;
  `);
  assert.ok(run('lossDaysFixture') <= 7);
  assert.equal(run('Game.state'), 'end');
});

console.log('Todas las pruebas jugables han pasado.');
