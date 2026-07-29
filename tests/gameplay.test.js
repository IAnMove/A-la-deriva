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
load('game-simulation.js');
load('game-ui.js');
load('game-renderer.js');
run(`
  var World = { scene: {}, mouseToWorld: () => ({ x: 0, z: 0 }) };
  var EntityManager = { objects: [], dangers: [], fishBanks: [], scene: {}, reset() {}, update() {} };
  var HookVis = { hide() {}, show() {} };
  var PlayerVis = { sync() {}, updateAim() {} };
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

test('Game delega simulación e interfaz en módulos independientes', () => {
  const gameSource = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
  assert.equal(run('typeof GameSimulation.update'), 'function');
  assert.equal(run('typeof GameSimulation.resolveDailySupplies'), 'function');
  assert.equal(run('typeof GameUI.updateUI'), 'function');
  assert.equal(run('typeof GameUI.showDaySummary'), 'function');
  assert.equal(run('typeof GameRenderer.draw'), 'function');
  assert.match(gameSource, /update: \(dt\) => GameSimulation\.update\(Game, dt\)/);
  assert.match(gameSource, /updateUI: \(\) => GameUI\.updateUI\(Game\)/);
  assert.doesNotMatch(gameSource, /const SURVIVAL_BALANCE/);
  assert.doesNotMatch(gameSource, /const NAVIGATION_BALANCE/);

  run(`
    Game.state = 'playing';
    Game.resources.fuel = 1.5;
    Game.navigationHeading = -0.4;
    Game.victoryCondition = null;
    GameUI.updateUI(Game);
  `);
  assert.equal(elements.get('res-fuel').textContent, '1.5');
  assert.match(elements.get('navigation-status').textContent, /Rumbo: babor/);
  assert.match(elements.get('navigation-status').textContent, /Combustible: 1\.5/);
});

test('el render separa reloj visual y congela el océano al pausar', () => {
  run(`
    var rendererSeaTimesFixture = [];
    var rendererRainDtsFixture = [];
    World.waveHeight = () => 0;
    World.updateCamera = () => {};
    World.updateSea = time => rendererSeaTimesFixture.push(time);
    World.updateDayNight = () => {};
    World.updateRain = dt => rendererRainDtsFixture.push(dt);
    World.render = () => {};
    CrewManager.syncMeshes = () => {};
    Game.raft.group = null;
    Game.elapsed = 5;
    Game.state = 'playing';
    Game.paused = true;
    Game.fishing = { active: false };
    GameRenderer.draw(Game, 0.5);
    var pausedElapsedFixture = Game.elapsed;
    Game.paused = false;
    GameRenderer.draw(Game, 0.5);
  `);
  assert.equal(run('pausedElapsedFixture'), 5);
  assert.equal(run('rendererSeaTimesFixture[0]'), 5);
  assert.equal(run('rendererRainDtsFixture[0]'), 0);
  assert.equal(run('Game.elapsed'), 5.5);
  assert.equal(run('rendererSeaTimesFixture[1]'), 5.5);
  assert.equal(run('rendererRainDtsFixture[1]'), 0.5);
});

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
  assert.ok(Math.abs(run('Game.resources.food') - 0.55 * 10 / 240) < 1e-9);

  resetRaft([['0,0', 'rain', 30], ['1,0', 'purifier', 40]]);
  run('Game.resources.water = 0; Game.rain = false; Game.updateProduction(10);');
  assert.ok(Math.abs(run('Game.resources.water') - 0.8 * 10 / 240) < 1e-9);
  run('Game.rain = true; Game.updateProduction(10);');
  assert.ok(Math.abs(run('Game.resources.water') - (0.8 + 0.8 + 1.1) * 10 / 240) < 1e-9);

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
  assert.equal(run('Game.player.hunger'), 48);
  assert.equal(run('Game.player.foodCredit'), 0.8);
  run('Game.player.foodCredit = 0;');

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

  resetRaft([['3,4', 'floor', 50], ['4,4', 'floor', 50]]);
  assert.deepEqual(
    JSON.parse(JSON.stringify(run('Game.raft.getBounds()'))),
    { minX: 3, maxX: 4, minY: 4, maxY: 4 }
  );
});

test('el daño reduce prestaciones y a cero las desactiva', () => {
  resetRaft([['0,0', 'net', 35], ['1,0', 'purifier', 40], ['2,0', 'storage', 40]]);
  run(`
    Game.raft.get(0, 0).maxHealth = 35;
    Game.raft.get(0, 0).health = 17.5;
    Game.raft.get(1, 0).maxHealth = 40;
    Game.raft.get(1, 0).health = 0;
    Game.raft.get(2, 0).maxHealth = 40;
    Game.raft.get(2, 0).health = 20;
  `);
  assert.ok(Math.abs(run("Game.raft.countProvides('autoFood')") - 0.275) < 1e-9);
  assert.equal(run("Game.raft.countProvides('purifiedWater')"), 0);
  assert.equal(run("Game.raft.countProvides('storage')"), 5);
  assert.equal(run('Game.raft.isOperational(Game.raft.get(1, 0))'), false);

  run('Game.resources.food = 0; Game.resources.water = 0; Game.rain = false; Game.updateProduction(240);');
  assert.ok(Math.abs(run('Game.resources.food') - 0.275) < 1e-9);
  assert.equal(run('Game.resources.water'), 0);
});

test('hambre y sed representan reservas y la automatización no cubre una persona', () => {
  resetRaft([['0,0', 'net', 35], ['1,0', 'purifier', 40]]);
  run(`
    CrewManager.members = [];
    Game.resources = { wood: 0, plastic: 0, cloth: 0, metal: 0, rope: 0, food: 0.55, water: 0.8, fuel: 0 };
    Object.assign(Game.player, { health: 100, hunger: 90, thirst: 90, morale: 75 });
    var partialSupplyFixture = Game.resolveDailySupplies();
    var partialHungerFixture = Game.player.hunger;
    var partialThirstFixture = Game.player.thirst;

    Game.resources.food = 1;
    Game.resources.water = 1.3;
    var fullSupplyFixture = Game.resolveDailySupplies();
  `);
  assert.equal(run('partialSupplyFixture.foodRatio'), 0.55);
  assert.ok(Math.abs(run('partialSupplyFixture.waterRatio') - 0.8 / 1.3) < 1e-9);
  assert.ok(run('partialHungerFixture') < 90);
  assert.ok(run('partialThirstFixture') < 90);
  assert.equal(run('fullSupplyFixture.foodConsumed'), 1);
  assert.equal(run('fullSupplyFixture.waterConsumed'), 1.3);
  assert.ok(run('Game.player.hunger') > run('partialHungerFixture'));
  assert.ok(run('Game.player.thirst') > run('partialThirstFixture'));

  resetRaft([['0,0', 'kitchen', 45]]);
  run(`
    CrewManager.members = [];
    Game.raft.selected = null;
    Game.player.x = 1; Game.player.z = 1;
    Game.player.hunger = 50;
    Game.player.foodCredit = 0;
    Game.resources.food = 1;
    Game.resources.water = 1.3;
    Game.interact();
    var cookedHungerFixture = Game.player.hunger;
    var cookedSupplyFixture = Game.resolveDailySupplies();
  `);
  assert.equal(run('cookedSupplyFixture.foodConsumed'), 0);
  assert.equal(run('cookedSupplyFixture.foodRatio'), 1);
  assert.equal(run('Game.resources.food'), 0);
  assert.ok(run('Game.player.hunger') > run('cookedHungerFixture'));
  assert.equal(run('Game.player.foodCredit'), 0);
});

test('timón, remo y combustible alteran la navegación', () => {
  resetRaft([['0,0', 'motor', 50], ['1,0', 'sail', 40], ['0,1', 'rudder', 45]]);
  run(`
    CrewManager.members = [];
    Game.resources = { wood: 0, plastic: 1, cloth: 0, metal: 0, rope: 0, food: 0, water: 0, fuel: 0 };
    var refueledFixture = Game.refuelMotor();
    Game.worldOffset = 0;
    Game.victoryCondition = null;
    Game.updateEntities(1);
    var passiveMotorOffsetFixture = Game.worldOffset;
    Game.worldOffset = 0;
    Game.victoryCondition = 'island';
    Game.updateEntities(1);
    var poweredMotorOffsetFixture = Game.worldOffset;
    Game.islandDistance = 300;
    var navigationDayFixture = Game.resolveNavigationDay();

    Game.player.stamina = 100;
    Game.player.hunger = 90;
    Game.player.thirst = 90;
    Game.player.rowTarget = { pushX: 0, pushZ: 1 };
    Game.rowingCooldown = 0;
    Game.navigationHeading = 0;
    var distanceBeforeRowFixture = Game.islandDistance;
    Game.row();
    var rowDistanceFixture = distanceBeforeRowFixture - Game.islandDistance;

    Game.raft.get(0, 1).health = 22.5;
    Game.resources.fuel = 0.5;
    Game.islandDistance = 300;
    var damagedRudderDayFixture = Game.resolveNavigationDay();

    Game.raft.get(0, 1).health = 0;
    Game.resources.fuel = 0.5;
    Game.islandDistance = 300;
    var brokenRudderDayFixture = Game.resolveNavigationDay();

    Game.raft.get(0, 1).health = 45;
    Game.raft.get(0, 0).health = 0;
    Game.resources.fuel = 0.5;
    Game.islandDistance = 300;
    var brokenMotorDayFixture = Game.resolveNavigationDay();
  `);
  assert.equal(run('refueledFixture'), true);
  assert.equal(run('Game.resources.plastic'), 0);
  assert.ok(run('poweredMotorOffsetFixture') > run('passiveMotorOffsetFixture'));
  assert.equal(run('navigationDayFixture.fuelConsumed'), 0.5);
  assert.equal(run('navigationDayFixture.moved'), 30);
  assert.equal(run('rowDistanceFixture'), 4);
  assert.equal(run('Game.navigationHeading'), 0.5);
  assert.ok(Math.abs(run('damagedRudderDayFixture.moved') - 20.25) < 1e-9);
  assert.equal(run('brokenRudderDayFixture.moved'), 0);
  assert.equal(run('brokenRudderDayFixture.fuelConsumed'), 0);
  assert.equal(run('brokenMotorDayFixture.moved'), 12);
  assert.equal(run('brokenMotorDayFixture.fuelConsumed'), 0);
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
      player: { x: 'NaN', health: -20, foodCredit: 99 },
      resources: { wood: -4, water: '2.5', fuel: -8 },
      navigationHeading: 99,
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
  assert.equal(run('Game.player.foodCredit'), 1);
  assert.equal(run('Game.resources.wood'), 0);
  assert.equal(run('Game.resources.fuel'), 0);
  assert.equal(run('Game.navigationHeading'), 1);
  assert.equal(run('Game.raft.grid.size'), 1);
});

test('historias de náufragos aportan valor y riesgo persistente', () => {
  run(`
    var riskyStoryFixture = new Survivor();
    riskyStoryFixture.name = 'Náufrago de prueba';
    riskyStoryFixture.story = 'thirsty_deserter';
    riskyStoryFixture.storyResolved = false;
    riskyStoryFixture.storyDaysRemaining = 1;
    CrewManager.members = [riskyStoryFixture];
    Game.resources = { wood: 0, plastic: 0, cloth: 0, metal: 0, rope: 0, food: 3, water: 3 };
    Object.assign(Game.player, { health: 100, hunger: 90, thirst: 90, morale: 70, stamina: 100, sanity: 100 });
    var riskyNotesFixture = CrewManager.resolveStoryEvents(Game);

    var chartStoryFixture = new Survivor();
    chartStoryFixture.story = 'folded_chart';
    chartStoryFixture.storyResolved = false;
    chartStoryFixture.storyDaysRemaining = 1;
    CrewManager.members = [chartStoryFixture];
    Game.victoryCondition = null;
    Game.rescuedSignal = 0;
    Game.radioIntel = 0;
    Game.navigationIntel = 0;
    CrewManager.resolveStoryEvents(Game);

    var restoredStoryFixture = Survivor.fromData({
      ...chartStoryFixture,
      mesh: null
    });

    var fisherWorkFixture = new Survivor();
    fisherWorkFixture.skill = SKILLS.find(skill => skill.key === 'fisher');
    fisherWorkFixture.storyResolved = true;
    CrewManager.members = [fisherWorkFixture];
    Game.resources.food = 0;
    var workNotesFixture = CrewManager.applyDailyWork(Game);
  `);

  assert.equal(run('riskyStoryFixture.storyResolved'), true);
  assert.equal(run('Game.resources.water'), 1.5);
  assert.equal(run('riskyNotesFixture.length'), 1);
  assert.equal(run('Game.rescuedSignal'), 0);
  assert.equal(run('Game.radioIntel'), 5);
  assert.equal(run('Game.navigationIntel'), 20);
  assert.equal(run("restoredStoryFixture.story"), 'folded_chart');
  assert.equal(run('restoredStoryFixture.storyResolved'), true);
  assert.ok(Math.abs(run('Game.resources.food') - 0.3) < 1e-9);
  assert.equal(run('workNotesFixture.length'), 1);
});

test('minijuego de pesca pausa el mundo y resuelve captura o escape', () => {
  run(`
    CrewManager.members = [];
    Game.state = 'playing';
    Game.paused = false;
    Game.time = 10;
    Game.resources.food = 0;
    Input.keys = {};
    Input.held = {};

    var fishingBankFixture = {
      x: 4, z: 4, radius: 2, active: true, fishCount: 3, fishing: false,
      takeCalls: 0,
      takeFishVisual() {
        this.fishCount--;
        this.takeCalls++;
        return {};
      }
    };
    var fishingHookFixture = {
      x: 4, z: 4, returning: false, fishing: false
    };
    var fishingStartedFixture = Game.startFishing(fishingBankFixture, fishingHookFixture);
    var fishingTimeFixture = Game.time;
    Game.update(0.1);
    var fishingWorldPausedFixture = Game.time === fishingTimeFixture;

    Game.fishing.marker = Game.fishing.targetCenter;
    Game.requestFishingPull();
    Game.updateFishing(0);
    Game.fishing.cooldown = 0;
    Game.fishing.marker = Game.fishing.targetCenter;
    Game.requestFishingPull();
    Game.updateFishing(0);

    var foodAfterCatchFixture = Game.resources.food;
    var escapedBankFixture = {
      x: 5, z: 5, radius: 2, active: true, fishCount: 2, fishing: false
    };
    var escapedHookFixture = {
      x: 5, z: 5, returning: false, fishing: false
    };
    var escapeStartedFixture = Game.startFishing(escapedBankFixture, escapedHookFixture);
    Game.fishing.timeLeft = 0.01;
    Game.updateFishing(0.02);
  `);

  assert.equal(run('fishingStartedFixture'), true);
  assert.equal(run('fishingWorldPausedFixture'), true);
  assert.equal(run('fishingBankFixture.takeCalls'), 1);
  assert.equal(run('fishingBankFixture.fishCount'), 2);
  assert.equal(run('fishingHookFixture.returning'), true);
  assert.equal(run('foodAfterCatchFixture'), 3);
  assert.equal(run('Game.paused'), false);
  assert.equal(run('escapeStartedFixture'), true);
  assert.equal(run('escapedBankFixture.fishCount'), 2);
  assert.equal(run('escapedHookFixture.returning'), true);
  assert.equal(run('Game.fishing.active'), false);
});

test('supervivencia diaria, recuperación y autoguardado', () => {
  resetRaft([['0,0', 'net', 35], ['1,0', 'purifier', 40]]);
  run(`
    CrewManager.members = [];
    Game.resources = { wood: 0, plastic: 0, cloth: 0, metal: 0, rope: 0, food: 0, water: 0 };
    Object.assign(Game.player, { health: 100, hunger: 90, thirst: 90, morale: 75, sanity: 100, foodCredit: 0 });
    Game.day = 1; Game.zone = 'debris'; Game.storm = false; Game.state = 'playing';
    var dailyEventsFixture = Game.pickDailyEvents;
    var dailySummaryFixture = Game.showDaySummary;
    Game.pickDailyEvents = () => [];
    Game.showDaySummary = () => {};
    var savesBeforeFixture = Save.saveCalls;
    Game.updateProduction(240);
    var producedFoodFixture = Game.resources.food;
    var producedWaterFixture = Game.resources.water;
    Game.endDay();
  `);
  assert.ok(Math.abs(run('producedFoodFixture') - 0.55) < 1e-9);
  assert.ok(Math.abs(run('producedWaterFixture') - 0.8) < 1e-9);
  assert.equal(run('Game.resources.food'), 0);
  assert.equal(run('Game.resources.water'), 0);
  assert.equal(run('Save.saveCalls'), run('savesBeforeFixture + 1'));

  resetRaft([['0,0', 'bed', 30], ['1,0', 'floor', 50]]);
  run(`
    var medicFixture = new Survivor();
    medicFixture.skill = SKILLS.find(skill => skill.key === 'medic');
    medicFixture.trait = TRAITS.find(trait => trait.key === 'fearful');
    medicFixture.storyResolved = true;
    medicFixture.storyDaysRemaining = 0;
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
      Game.resources = { wood: 0, plastic: 0, cloth: 0, metal: 0, rope: 0, food: 1, water: 1.3, fuel: 0.5 };
      Game.endDay(); islandDaysFixture++;
    }
  `);
  assert.equal(run('islandDaysFixture'), 10);

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
