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
  var EntityManager = {
    objects: [],
    dangers: [],
    reefs: [],
    fishBanks: [],
    scene: {},
    reset() {},
    update() {},
    spawnDanger() {},
    getThreatSummary: () => null
  };
  var HookVis = { hide() {}, show() {} };
  var PlayerVis = { sync() {}, updateAim() {} };
  var AudioSys = { play() {}, isEnabled: () => true, setEnabled() {} };
  var Save = {
    saveCalls: 0,
    clearCalls: 0,
    save() { this.saveCalls++; return true; },
    clear() { this.clearCalls++; },
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

test('el registro escapa texto externo antes de insertarlo en el DOM', () => {
  const container = makeElement();
  sandbox.logContainerFixture = container;
  run(`Log.clear(); Log.add('<img src=x onerror="globalThis.injected=true">&');`);
  run('Log.render(logContainerFixture)');
  assert.match(container.innerHTML, /&lt;img src=x onerror=&quot;globalThis\.injected=true&quot;&gt;&amp;/);
  assert.doesNotMatch(container.innerHTML, /<img/);
});

test('Game delega simulación e interfaz en módulos independientes', () => {
  const gameSource = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
  assert.equal(run('typeof GameSimulation.update'), 'function');
  assert.equal(run('typeof GameSimulation.resolveDailySupplies'), 'function');
  assert.equal(run('typeof GameUI.updateUI'), 'function');
  assert.equal(run('typeof GameUI.showDaySummary'), 'function');
  assert.equal(run('typeof GameRenderer.draw'), 'function');
  assert.match(gameSource, /update: \(dt\) => GameSimulation\.update\(Game, dt\)/);
  assert.match(
    gameSource,
    /updatePlayer: \(dt\) => GameSimulation\.updatePlayer\(Game, dt\)/
  );
  assert.match(
    gameSource,
    /offerIslandRoute: \(\) => GameSimulation\.offerIslandRoute\(Game\)/
  );
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
  assert.equal(run('Game.resources.water'), 0.35);
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

test('la balsa crece por anillos y no admite palos', () => {
  // Una sola celda: los 4 laterales sí, las esquinas no.
  resetRaft([['0,0', 'floor', 50]]);
  for (const cell of ['1,0', '-1,0', '0,1', '0,-1']) {
    const [gx, gy] = cell.split(',').map(Number);
    assert.equal(run(`Game.raft.canExpandTo(${gx}, ${gy})`), true, cell);
  }
  assert.equal(run('Game.raft.canExpandTo(1, 1)'), false);
  assert.equal(run('Game.raft.canExpandTo(0, 2)'), false);

  // Palo de dos celdas: no deja alargarlo ni cerrar esquinas sin lateral.
  resetRaft([['0,0', 'floor', 50], ['0,1', 'floor', 50]]);
  assert.equal(run('Game.raft.canExpandTo(0, 2)'), false);
  assert.equal(run('Game.raft.canExpandTo(0, -1)'), true);
  assert.equal(run('Game.raft.canExpandTo(1, 1)'), false);
  assert.equal(run('Game.raft.canExpandTo(-1, 1)'), false);

  // Cruz completa: las esquinas se desbloquean, el anillo 2 aún no.
  resetRaft([['0,0', 'floor', 50], ['1,0', 'floor', 50], ['-1,0', 'floor', 50], ['0,1', 'floor', 50], ['0,-1', 'floor', 50]]);
  assert.equal(run('Game.raft.canExpandTo(1, 1)'), true);
  assert.equal(run('Game.raft.canExpandTo(-1, -1)'), true);
  assert.equal(run('Game.raft.canExpandTo(0, 2)'), false);
  assert.equal(run('Game.raft.canExpandTo(2, 0)'), false);

  // 3x3 completo: nueva fila sí; la esquina del anillo 2 pide sus bordes.
  resetRaft([
    ['0,0', 'floor', 50], ['1,0', 'floor', 50], ['-1,0', 'floor', 50],
    ['0,1', 'floor', 50], ['0,-1', 'floor', 50], ['1,1', 'floor', 50],
    ['-1,-1', 'floor', 50], ['1,-1', 'floor', 50], ['-1,1', 'floor', 50]
  ]);
  assert.equal(run('Game.raft.canExpandTo(0, 2)'), true);
  assert.equal(run('Game.raft.canExpandTo(1, 2)'), true);
  assert.equal(run('Game.raft.canExpandTo(2, 1)'), true);
  assert.equal(run('Game.raft.canExpandTo(2, 2)'), false);
  assert.equal(run('Game.raft.canExpandTo(0, 3)'), false);

  // Con los dos bordes puestos, la esquina del anillo 2 ya es válida.
  resetRaft([
    ['0,0', 'floor', 50], ['1,0', 'floor', 50], ['-1,0', 'floor', 50],
    ['0,1', 'floor', 50], ['0,-1', 'floor', 50], ['1,1', 'floor', 50],
    ['-1,-1', 'floor', 50], ['1,-1', 'floor', 50], ['-1,1', 'floor', 50],
    ['1,2', 'floor', 50], ['2,1', 'floor', 50]
  ]);
  assert.equal(run('Game.raft.canExpandTo(2, 2)'), true);
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

test('las nuevas construcciones explican función y contrapartida en la lista', () => {
  run(`
    var newBuildingKeysFixture = [
      'lookout', 'smokehouse', 'armor', 'anchor', 'bunk',
      'harpoon', 'infirmary', 'chart', 'beacon', 'containment'
    ];
    var allNewBuildingsDescribedFixture = newBuildingKeysFixture.every(key =>
      BUILDINGS[key] &&
      typeof BUILDINGS[key].desc === 'string' &&
      BUILDINGS[key].desc.length > 20 &&
      typeof BUILDINGS[key].drawback === 'string' &&
      BUILDINGS[key].drawback.length > 20
    );
    var buildDescriptionListFixture = document.createElement('div');
    BuildManager.renderMenu(
      buildDescriptionListFixture,
      { wood: 99, plastic: 99, cloth: 99, metal: 99, rope: 99 }
    );
    var renderedDescriptionsFixture =
      buildDescriptionListFixture.children.map(child => child.innerHTML).join(' ');
  `);
  assert.equal(run('allNewBuildingsDescribedFixture'), true);
  assert.match(run('renderedDescriptionsFixture'), /Alarga el aviso/);
  assert.match(run('renderedDescriptionsFixture'), /Es alta y recibe/);
  assert.match(run('renderedDescriptionsFixture'), /Reduce el deterioro/);
  assert.match(run('renderedDescriptionsFixture'), /Reduce el daño/);
});

test('blindaje, ancla, carta y arponera cambian la navegación y el peligro', () => {
  resetRaft([
    ['0,0', 'armor', 80],
    ['1,0', 'floor', 200]
  ]);
  run(`
    Game.raft.get(1, 0).maxHealth = 200;
    var armoredReefDamageFixture =
      Game.raft.takeDamage(100, 3, 1, 'reef');

    Game.raft.grid.clear();
    Game.raft.grid.set('0,0', {
      buildingKey: 'floor', health: 200, maxHealth: 200, mesh: null
    });
    Game.raft.grid.set('1,0', {
      buildingKey: 'floor', health: 200, maxHealth: 200, mesh: null
    });
    var bareReefDamageFixture =
      Game.raft.takeDamage(100, 3, 1, 'reef');

    Game.raft.grid.clear();
    Game.raft.grid.set('0,0', {
      buildingKey: 'floor', health: 50, maxHealth: 50, mesh: null
    });
    Game.raft.grid.set('1,0', {
      buildingKey: 'anchor', health: 55, maxHealth: 55, mesh: null
    });
    Game.anchorDeployed = true;
    Game.beaconLit = false;
    Game.worldOffset = 0;
    Game.worldOffsetZ = 0;
    Game.victoryCondition = null;
    EntityManager.objects = [];
    EntityManager.dangers = [];
    EntityManager.reefs = [];
    EntityManager.fishBanks = [];
    Game.updateEntities(1);
    var anchoredOffsetFixture = Game.worldOffset;
    Game.anchorDeployed = false;
    Game.updateEntities(1);
    var driftingOffsetFixture = Game.worldOffset;

    var navigationCountFixture = Game.raft.countProvides;
    var navigationLoadFixture = Game.loadSpeedMultiplier;
    Game.raft.countProvides = key => ({
      sail: 1, rudder: 1, motor: 0, navigation: 1
    })[key] || 0;
    Game.loadSpeedMultiplier = () => 1;
    Game.victoryCondition = 'island';
    Game.islandDistance = 100;
    Game.resources.fuel = 0;
    var chartNavigationFixture = Game.resolveNavigationDay();
    Game.raft.countProvides = navigationCountFixture;
    Game.loadSpeedMultiplier = navigationLoadFixture;

    Game.raft.grid.clear();
    Game.raft.grid.set('0,0', {
      buildingKey: 'harpoon', health: 55, maxHealth: 55, mesh: null
    });
    Game.resetPlayerState({ x: 1, z: 1 });
    Game.resources.wood = 0;
    Game.resources.food = 0;
    Game.raft.selected = null;
    var harpoonScaredFixture = false;
    EntityManager.dangers = [{
      active: true,
      state: 'charge',
      x: 2,
      z: 1,
      scareFrom() {
        harpoonScaredFixture = true;
        this.state = 'flee';
      }
    }];
    Game.interact();
  `);
  assert.ok(run('armoredReefDamageFixture') < run('bareReefDamageFixture'));
  assert.equal(run('anchoredOffsetFixture'), 0);
  assert.ok(run('driftingOffsetFixture') > 0);
  assert.equal(run('chartNavigationFixture.moved'), 16);
  assert.equal(run('harpoonScaredFixture'), true);
  assert.equal(run('Game.resources.food'), 0.5);
  assert.equal(run('Game.raft.get(0, 0).health'), 49);
});

test('ahumadero, camarotes, enfermería y faro tienen costes diarios reales', () => {
  run(`
    var preservationDayFixture = 3;
    for (; preservationDayFixture < 300; preservationDayFixture++) {
      var preservationSeedFixture = (
        Math.imul(Math.floor(preservationDayFixture), 2654435761) ^
        Math.imul(1, 2246822519)
      ) >>> 0;
      if (preservationSeedFixture / 4294967296 < 0.08) break;
    }
    Game.raft.grid.clear();
    Game.raft.grid.set('0,0', {
      buildingKey: 'smokehouse', health: 38, maxHealth: 38, mesh: null
    });
    Game.day = preservationDayFixture;
    Game.stats.rescued = 0;
    Game.resources.food = 2;
    Game.resources.water = 2;
    Game.resolveUnstoredSpoilage();
    var preservedFoodLossFixture = 2 - Game.resources.food;

    Game.raft.grid.clear();
    Game.raft.grid.set('0,0', {
      buildingKey: 'floor', health: 50, maxHealth: 50, mesh: null
    });
    Game.resources.food = 2;
    Game.resources.water = 2;
    Game.resolveUnstoredSpoilage();
    var bareFoodLossFixture = 2 - Game.resources.food;

    Game.raft.grid.clear();
    Game.raft.grid.set('0,0', {
      buildingKey: 'infirmary', health: 48, maxHealth: 48, mesh: null
    });
    Game.raft.grid.set('1,0', {
      buildingKey: 'bunk', health: 45, maxHealth: 45, mesh: null
    });
    Game.raft.grid.set('2,0', {
      buildingKey: 'beacon', health: 42, maxHealth: 42, mesh: null
    });
    var restedCrewFixture = new Survivor();
    restedCrewFixture.stress = 50;
    var jealousCrewFixture = new Survivor();
    jealousCrewFixture.stress = 50;
    var unhousedCrewFixture = new Survivor();
    unhousedCrewFixture.stress = 50;
    CrewManager.members = [
      restedCrewFixture, jealousCrewFixture, unhousedCrewFixture
    ];
    Game.player.health = 100;
    Game.player.morale = 75;
    Game.infectionDays = 3;
    Game.beaconLit = true;
    Game.resources.fuel = 1;
    Game.victoryCondition = 'radio';
    Game.rescuedSignal = 0;
    Game.storm = false;
    Game.applyDailyBuildingEffects([]);
  `);
  assert.ok(run('preservedFoodLossFixture') < run('bareFoodLossFixture'));
  assert.equal(run('Game.infectionDays'), 1);
  assert.equal(run('Game.player.health'), 98);
  assert.ok(Math.abs(run('Game.resources.fuel') - 0.65) < 1e-9);
  assert.equal(run('Game.rescuedSignal'), 4);
  assert.equal(run('restedCrewFixture.stress'), 43);
  assert.equal(run('jealousCrewFixture.stress'), 43);
  assert.equal(run('unhousedCrewFixture.stress'), 54);
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

test('llegar a la isla gana aunque la propulsión se rompa al final', () => {
  resetRaft([
    ['0,0', 'sail', 0],
    ['1,0', 'rudder', 0]
  ]);
  run(`
    Game.state = 'playing';
    Game.victoryCondition = 'island';
    Game.islandDistance = 0;
    var finalArrivalFixture = Game.resolveNavigationDay();
    var finalArrivalStateFixture = Game.state;
    Game.state = 'playing';
  `);
  assert.equal(run('finalArrivalFixture.arrived'), true);
  assert.equal(run('finalArrivalStateFixture'), 'end');
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

test('movimiento por rutas, cámara relativa y remo agotado sin spam', () => {
  resetRaft([
    ['0,0', 'floor', 50],
    ['1,0', 'floor', 50],
    ['2,0', 'floor', 50],
    ['2,1', 'floor', 50],
    ['2,2', 'floor', 50]
  ]);
  run(`
    Game.resetPlayerState({ x: 1, z: 1 });
    Input.keys = {};
    Input.held = {};
    var concavePathFixture = Game.raft.findPath(0, 0, 2, 2);
    var plannedConcaveFixture = Game.planPlayerPath(2, 2);
    for (var pathFrameFixture = 0; pathFrameFixture < 180; pathFrameFixture++) {
      Game.updatePlayer(0.05);
    }
    var pathArrivalFixture = Game.raft.worldToGrid(Game.player.x, Game.player.z);
  `);
  assert.equal(run('plannedConcaveFixture'), true);
  assert.equal(run('concavePathFixture.length'), 5);
  assert.deepEqual(
    { ...run('pathArrivalFixture') },
    { gx: 2, gy: 2 }
  );
  assert.equal(run('Game.player.moveTarget'), null);
  run(`
    Game.player.x = 999;
    Game.player.z = 999;
    Game.player.rowTarget = {
      x: 4.8, z: 4.8, gx: 2, gy: 2, pushX: -1, pushZ: 0
    };
    Game.ensurePlayerOnRaft();
  `);
  assert.equal(run('Game.player.rowTarget'), null);

  resetRaft([
    ['0,0', 'floor', 50], ['1,0', 'floor', 50], ['2,0', 'floor', 50],
    ['0,1', 'floor', 50], ['1,1', 'floor', 50], ['2,1', 'floor', 50],
    ['0,2', 'floor', 50], ['1,2', 'floor', 50], ['2,2', 'floor', 50]
  ]);
  run(`
    Game.resetPlayerState({ x: 3, z: 3 });
    World.cameraYaw = Math.PI / 4;
    Input.held = { KeyW: true };
    Input.keys = {};
    Game.updatePlayer(0.1);
    var cameraMoveXFixture = Game.player.x - 3;
    var cameraMoveZFixture = Game.player.z - 3;
    Input.held = {};
    World.cameraYaw = 0;

    var rowingMessageFixture = Game.showFloatingText;
    var rowingMessageCountFixture = 0;
    Game.showFloatingText = () => { rowingMessageCountFixture++; };
    Game.player.stamina = 0;
    Game.rowingCooldown = 0;
    for (var exhaustedFrameFixture = 0; exhaustedFrameFixture < 60; exhaustedFrameFixture++) {
      Game.row();
      Game.rowingCooldown = Math.max(0, Game.rowingCooldown - 0.016);
    }
    Game.showFloatingText = rowingMessageFixture;
  `);
  assert.ok(run('cameraMoveXFixture') < -0.3);
  assert.ok(run('cameraMoveZFixture') < -0.3);
  assert.ok(run('rowingMessageCountFixture') <= 2);
});

test('los impactos localizados dañan el módulo alcanzado', () => {
  resetRaft([
    ['0,0', 'floor', 50],
    ['5,0', 'radio', 35]
  ]);
  run(`
    Game.raft.takeDamage(12, 11, 1);
    var farFloorHealthFixture = Game.raft.get(0, 0).health;
    var impactedRadioHealthFixture = Game.raft.get(5, 0).health;
  `);
  assert.equal(run('farFloorHealthFixture'), 50);
  assert.equal(run('impactedRadioHealthFixture'), 23);
});

test('tiburones telegrafiados devoran a una casilla, se esquivan y temen al gancho', () => {
  resetRaft([
    ['0,0', 'floor', 50],
    ['1,0', 'floor', 50],
    ['2,0', 'floor', 50]
  ]);
  run(`
    Game.state = 'playing';
    Game.day = 1;
    Game.resetPlayerState({ x: 5, z: 1, health: 100, morale: 75 });
    var sharkCrewFixture = new Survivor();
    sharkCrewFixture.name = 'Mara';
    sharkCrewFixture.gx = 0;
    sharkCrewFixture.gy = 0;
    CrewManager.members = [sharkCrewFixture];
    var crewSharkFixture = {
      active: true, resolved: false, state: 'charge',
      x: 1, z: 1, radius: 0.9,
      beginFlee() { this.resolved = true; this.state = 'flee'; }
    };
    var crewSharkResolvedFixture = Game.resolveSharkAttack(crewSharkFixture);
  `);
  assert.equal(run('crewSharkResolvedFixture'), true);
  assert.equal(run('sharkCrewFixture.alive'), false);
  assert.equal(run('Game.player.health'), 100);
  assert.equal(run('Game.player.morale'), 57);

  resetRaft([
    ['0,0', 'floor', 50],
    ['1,0', 'floor', 50],
    ['2,0', 'floor', 50]
  ]);
  run(`
    Game.state = 'playing';
    CrewManager.members = [];
    Game.resetPlayerState({ x: 5, z: 1, health: 100 });
    var dodgeSharkFixture = {
      active: true, resolved: false, state: 'charge',
      x: 1, z: 1, radius: 0.9,
      beginFlee() { this.resolved = true; this.state = 'flee'; }
    };
    var dodgeResolvedFixture = Game.resolveSharkAttack(dodgeSharkFixture);
    var dodgeHealthFixture = Game.player.health;
    var dodgeRaftHealthFixture = Game.raft.get(0, 0).health;
  `);
  assert.equal(run('dodgeResolvedFixture'), true);
  assert.equal(run('dodgeHealthFixture'), 100);
  assert.ok(run('dodgeRaftHealthFixture') < 50);
  assert.equal(run('Game.state'), 'playing');

  resetRaft([['0,0', 'floor', 50]]);
  run(`
    Game.state = 'playing';
    Game.stats.deathCause = '';
    Game.resetPlayerState({ x: 1, z: 1, health: 100 });
    var lethalSharkFixture = {
      active: true, resolved: false, state: 'charge',
      x: 1, z: 1, radius: 0.9,
      beginFlee() { this.resolved = true; this.state = 'flee'; }
    };
    Game.resolveSharkAttack(lethalSharkFixture);
    var lethalSharkCauseFixture = Game.stats.deathCause;
  `);
  assert.equal(run('Game.player.health'), 0);
  assert.equal(run('Game.state'), 'end');
  assert.match(run('lethalSharkCauseFixture'), /tiburón/i);

  run(`
    Game.state = 'playing';
    Game.resetPlayerState({ x: 1, z: 1 });
    var repelledFixture = false;
    EntityManager.objects = [];
    EntityManager.fishBanks = [];
    EntityManager.dangers = [{
      active: true, state: 'telegraph', x: 1.1, z: 1, radius: 0.9,
      scareFrom() { repelledFixture = true; this.state = 'flee'; return true; }
    }];
    Game.player.hook = {
      x: 1.1, z: 1, vx: 0, vz: 0, life: 0, distance: 0,
      maxRange: 8, returning: false, object: null
    };
    Game.updateHook(0.016);
  `);
  assert.equal(run('repelledFixture'), true);
  assert.equal(run('Game.player.hook.returning'), true);
});

test('los arrecifes dañan de forma localizada y pueden romper la balsa', () => {
  resetRaft([['0,0', 'floor', 50]]);
  run(`
    Game.state = 'playing';
    Game.day = 1;
    Game.resetPlayerState({ x: 1, z: 1, health: 100 });
    CrewManager.members = [];
    var reefFixture = {
      active: true, hit: false, x: 1, z: 1, radius: 1.2
    };
    var reefResolvedFixture = Game.resolveReefCollision(reefFixture);
  `);
  assert.equal(run('reefResolvedFixture'), true);
  assert.equal(run('reefFixture.hit'), true);
  assert.equal(run('Game.raft.totalArea()'), 0);
  assert.equal(run('Game.state'), 'end');
});

test('habilidades, carga, almacenamiento e interfaz', () => {
  run(`
    var skilledFixture = new Survivor();
    skilledFixture.skill = SKILLS.find(skill => skill.key === 'cook');
    skilledFixture.trait = TRAITS.find(trait => trait.key === 'conflictive');
    skilledFixture.job = 'cook';
    skilledFixture.stress = 20;
    CrewManager.members = [skilledFixture];
  `);
  assert.equal(run('CrewManager.getDailyFoodNeed()'), 0.9);
  assert.ok(Math.abs(run('CrewManager.getConflictChance()') - 0.0825) < 1e-9);
  assert.equal(run("BuildManager.realCost('storage', -0.15).wood"), 3.4);
  run("skilledFixture.skill = SKILLS.find(skill => skill.key === 'fisher'); skilledFixture.job = 'fish';");
  assert.ok(run('CrewManager.getFishingBonus()') > 0.2);
  assert.ok(run('CrewManager.getFishingBonus()') < 0.3);
  run("skilledFixture.skill = SKILLS.find(skill => skill.key === 'mechanic'); skilledFixture.job = 'repair'; Game.raft.grid.clear(); Game.raft.placeAt(0, 0, 'radio', true, CrewManager.getDurabilityBonus());");
  assert.ok(run('Game.raft.get(0, 0).maxHealth') > 35);
  assert.ok(run('Game.raft.get(0, 0).maxHealth') < 44);

  resetRaft([['0,0', 'storage', 40]]);
  assert.equal(run('Game.raft.maxWeight()'), 12.5);
  resetRaft([['0,0', 'floor', 50]]);
  run("CrewManager.members = []; Game.resources = { wood: 20, plastic: 0, cloth: 0, metal: 0, rope: 0, food: 0, water: 0 };");
  assert.equal(run('Game.totalWeight()'), 5.5);
  assert.equal(run('Game.loadSpeedMultiplier()'), 0.71875);
  assert.equal(run('Util.formatAmount(1.58)'), '1.6');
  assert.equal(run("Util.resourceName('wood')"), 'madera');
});

test('la tripulación no se superpone al jugador en una sola tabla', () => {
  resetRaft([['0,0', 'floor', 50]]);
  run(`
    Game.resetPlayerState({ x: 1, z: 1 });
    var crowdedCrewFixture = new Survivor();
    crowdedCrewFixture.gx = 0;
    crowdedCrewFixture.gy = 0;
    CrewManager.members = [crowdedCrewFixture];
    var crowdedOffsetFixture = CrewManager.getVisualOffset(crowdedCrewFixture, Game.raft);
  `);
  assert.ok(
    Math.hypot(
      run('crowdedOffsetFixture.x'),
      run('crowdedOffsetFixture.z')
    ) >= 0.5
  );
  run(`
    CrewManager.members = Array.from(
      { length: CrewManager.MAX_MEMBERS },
      () => new Survivor()
    );
    var rejectedCrewFixture = CrewManager.add(new Survivor());
  `);
  assert.equal(run('rejectedCrewFixture'), false);
  assert.equal(
    run('CrewManager.members.length'),
    run('CrewManager.MAX_MEMBERS')
  );
});

test('guardados inválidos se sanean', () => {
  run(`
    Game.raft.selected = { gx: 4, gy: 0 };
    Game.rowingBoost = 3.5;
    Game.rowingBoostZ = 2;
    Game.rowingCooldown = 1.5;
    Game.hallucinationTimer = -4;
    Game.loadFromSave({
      day: 'incorrecto', time: 99, zone: 'zona-inexistente',
      player: { x: 'NaN', health: -20, foodCredit: 99, speed: 0, hookRange: 999 },
      resources: { wood: -4, water: '2.5', plastic: 'Infinity', fuel: -8 },
      weatherTimers: { storm: {}, rain: 'Infinity', fog: -5, heat: 4 },
      worldOffset: 'Infinity',
      worldOffsetZ: {},
      stats: { rescued: 'Infinity', deathCause: { unsafe: true } },
      navigationHeading: 99,
      raftGrid: [
        null,
        ['0,0', { buildingKey: 'floor', health: 25 }],
        ['0.5,0', { buildingKey: 'radio', health: 35 }],
        ['1001,0', { buildingKey: 'radio', health: 35 }],
        ['4,0', { buildingKey: 'radio', health: 999 }]
      ],
      crew: [null, 7, 'fantasma', {}]
    });
  `);
  assert.equal(run('Game.day'), 1);
  assert.equal(run('Game.time'), 23.99);
  assert.equal(run('Game.player.x'), 1);
  assert.equal(run('Game.player.foodCredit'), 1);
  assert.equal(run('Game.player.speed'), 6);
  assert.equal(run('Game.player.hookRange'), 8);
  assert.equal(run('Game.resources.wood'), 0);
  assert.equal(run('Game.resources.plastic'), 0);
  assert.equal(run('Game.resources.fuel'), 0);
  assert.equal(run('Game.weatherTimers.storm'), 0);
  assert.equal(run('Game.weatherTimers.rain'), 0);
  assert.equal(run('Game.weatherTimers.fog'), 0);
  assert.equal(run('Game.weatherTimers.heat'), 4);
  assert.equal(run('Game.worldOffset'), 0);
  assert.equal(run('Game.worldOffsetZ'), 0);
  assert.equal(run('Game.stats.rescued'), 0);
  assert.equal(run('Game.stats.deathCause'), '');
  assert.equal(run('Game.navigationHeading'), 1);
  assert.equal(run('Game.raft.grid.size'), 1);
  assert.equal(run('Game.raft.selected'), null);
  assert.equal(run('Game.rowingBoost'), 0);
  assert.equal(run('Game.rowingBoostZ'), 0);
  assert.equal(run('Game.rowingCooldown'), 0);
  assert.equal(run('Game.hallucinationTimer'), 0);
  assert.equal(run('CrewManager.members.length'), 1);

  run(`
    Game.loadFromSave({
      islandDistance: 0,
      victoryCondition: 'island',
      raftGrid: [['0.5,0', { buildingKey: 'floor', health: 50 }]],
      crew: [null, 7, 'fantasma']
    });
    var fallbackCellFixture = Game.raft.has(0, 0);
    var fallbackPlayerCellFixture =
      Game.raft.worldToGrid(Game.player.x, Game.player.z);
    var sanitizedCrewStateFixture = Survivor.fromData({
      name: '  ' + 'N'.repeat(100) + '  ',
      skill: { key: 'medic' },
      job: 'imposible',
      trust: 999,
      stress: -50,
      deprivationDays: 999,
      days: 'Infinity',
      gx: 0.5,
      gy: 5000,
      hostile: true
    });
  `);
  assert.equal(run('fallbackCellFixture'), true);
  assert.equal(run('Game.raft.grid.size'), 1);
  assert.equal(run('Game.islandDistance'), 0);
  assert.equal(run('fallbackPlayerCellFixture.gx'), 0);
  assert.equal(run('fallbackPlayerCellFixture.gy'), 0);
  assert.equal(run('CrewManager.members.length'), 0);
  assert.equal(run('sanitizedCrewStateFixture.job'), 'care');
  assert.equal(run('sanitizedCrewStateFixture.trust'), 100);
  assert.equal(run('sanitizedCrewStateFixture.stress'), 0);
  assert.equal(run('sanitizedCrewStateFixture.deprivationDays'), 30);
  assert.equal(run('sanitizedCrewStateFixture.name.length'), 80);
  assert.equal(run('sanitizedCrewStateFixture.days'), 0);
  assert.equal(run('sanitizedCrewStateFixture.gx'), null);
  assert.equal(run('sanitizedCrewStateFixture.gy'), null);
  assert.equal(run('sanitizedCrewStateFixture.hostile'), true);
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
    fisherWorkFixture.job = 'fish';
    fisherWorkFixture.health = 100;
    fisherWorkFixture.hunger = 80;
    fisherWorkFixture.thirst = 80;
    fisherWorkFixture.stress = 15;
    fisherWorkFixture.trust = 50;
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
  assert.ok(run('Game.resources.food') > 0.25);
  assert.ok(run('Game.resources.food') < 0.35);
  assert.equal(run('workNotesFixture.length'), 1);
});

test('las tareas dependen del estado y los NPC colaboran o estorban', () => {
  resetRaft([['0,0', 'floor', 50]]);
  run(`
    var workerFixture = new Survivor();
    workerFixture.name = 'Irene Prueba';
    workerFixture.skill = SKILLS.find(skill => skill.key === 'fisher');
    workerFixture.job = 'fish';
    workerFixture.health = 100;
    workerFixture.hunger = 80;
    workerFixture.thirst = 80;
    workerFixture.trust = 65;
    workerFixture.stress = 15;
    CrewManager.members = [workerFixture];
    Game.resources.food = 0;
    var workerEfficiencyFixture = CrewManager.workEfficiency(workerFixture);
    CrewManager.applyDailyWork(Game);
    var workerFoodFixture = Game.resources.food;

    Game.resources.water = 0;
    var helpRollsFixture = [0, 0];
    var helpReportFixture = CrewManager.resolveDailyBehavior(
      Game,
      () => helpRollsFixture.shift() ?? 1
    );

    workerFixture.hunger = 20;
    workerFixture.thirst = 20;
    workerFixture.stress = 60;
    workerFixture.trust = 30;
    workerFixture.incidentCooldown = 0;
    Game.resources.food = 1;
    Game.resources.water = 1;
    var troubleRollsFixture = [0.9, 0, 0];
    var troubleReportFixture = CrewManager.resolveDailyBehavior(
      Game,
      () => troubleRollsFixture.shift() ?? 1
    );
  `);
  assert.ok(run('workerEfficiencyFixture') > 0.7);
  assert.ok(run('workerFoodFixture') > 0.25);
  assert.ok(run('workerFoodFixture') < 1);
  assert.equal(run('helpReportFixture.messages.length'), 1);
  assert.equal(run('Game.resources.food') < 1 || run('Game.resources.water') < 1, true);
  assert.equal(run('troubleReportFixture.messages.length'), 1);
  assert.ok(run('workerFixture.incidentCooldown') > 0);
});

test('la escasez castiga reservas sin almacenamiento de forma moderada', () => {
  resetRaft([['0,0', 'floor', 50]]);
  run(`
    Game.stats.rescued = 0;
    var spoilageNoteFixture = null;
    var spoilageDayFixture = 0;
    for (var testedDayFixture = 3; testedDayFixture <= 40; testedDayFixture++) {
      Game.day = testedDayFixture;
      Game.resources.food = 2;
      Game.resources.water = 2;
      spoilageNoteFixture = Game.resolveUnstoredSpoilage();
      if (spoilageNoteFixture) {
        spoilageDayFixture = testedDayFixture;
        break;
      }
    }
    var spoiledFoodFixture = Game.resources.food;
    var spoiledWaterFixture = Game.resources.water;
  `);
  assert.ok(run('spoilageDayFixture') >= 3);
  assert.match(run('spoilageNoteFixture'), /almacenamiento/i);
  assert.ok(run('spoiledFoodFixture') >= 1.75);
  assert.ok(run('spoiledWaterFixture') >= 1.65);

  resetRaft([['0,0', 'storage', 40]]);
  run(`
    Game.day = spoilageDayFixture;
    Game.resources.food = 2;
    Game.resources.water = 2;
    var protectedSpoilageFixture = Game.resolveUnstoredSpoilage();
  `);
  assert.equal(run('protectedSpoilageFixture'), null);
  assert.equal(run('Game.resources.food'), 2);
  assert.equal(run('Game.resources.water'), 2);
});

test('la privación provoca alucinaciones y una crisis hostil telegrafiada', () => {
  run(`
    var deprivedFixture = new Survivor();
    deprivedFixture.name = 'Mara Sedienta';
    deprivedFixture.trait = TRAITS.find(trait => trait.key === 'optimist');
    deprivedFixture.health = 100;
    deprivedFixture.hunger = 80;
    deprivedFixture.thirst = 80;
    for (var dryDayFixture = 0; dryDayFixture < 6; dryDayFixture++) {
      deprivedFixture.updateDaily(1, 0, false);
    }
    var hallucinatedBeforeCrisisFixture = deprivedFixture.hallucinating;
    deprivedFixture.trust = 20;
    deprivedFixture.stress = 92;
    deprivedFixture.hostile = false;
    CrewManager.members = [deprivedFixture];
    Game.day = 8;
    Game.resources.food = 0;
    Game.resources.water = 0;
    var deprivationReportFixture = CrewManager.resolveDailyBehavior(
      Game,
      () => 0
    );
  `);
  assert.equal(run('hallucinatedBeforeCrisisFixture'), true);
  assert.equal(run('deprivedFixture.alive'), true);
  assert.equal(run('deprivedFixture.getCondition().key'), 'hostile');
  assert.equal(run('deprivationReportFixture.conflict.member === deprivedFixture'), true);
  assert.match(run('deprivationReportFixture.messages.join(" ")'), /alucina/i);
});

test('las confrontaciones permiten calmar, reducir o morir en el forcejeo', () => {
  run(`
    Game.state = 'playing';
    Game.paused = false;
    Game.stats.deathCause = '';
    Game.resetPlayerState({ health: 100, stamina: 100 });
    Game.resources.food = 1;
    Game.resources.water = 1;
    var conflictMemberFixture = new Survivor();
    conflictMemberFixture.name = 'Pablo Crisis';
    conflictMemberFixture.hostile = true;
    conflictMemberFixture.hallucinating = true;
    CrewManager.members = [conflictMemberFixture];
    var startedRationFixture = Game.startCrewConflict(
      conflictMemberFixture,
      'delirio por deshidratación'
    );
    var rationResolvedFixture = Game.requestCrewConflictRation();
    var foodAfterRationFixture = Game.resources.food;
    var waterAfterRationFixture = Game.resources.water;

    conflictMemberFixture.hostile = true;
    conflictMemberFixture.restrainedDays = 0;
    Game.player.stamina = 100;
    Game.startCrewConflict(conflictMemberFixture, 'delirio por hambre');
    while (Game.crewConflict.active) {
      Game.crewConflict.pushCooldown = 0;
      Game.requestCrewConflictPush();
    }
    var restrainedFixture = conflictMemberFixture.restrainedDays;

    Game.state = 'playing';
    Game.player.health = 100;
    conflictMemberFixture.hostile = true;
    conflictMemberFixture.restrainedDays = 0;
    conflictMemberFixture.criticalDays = 2;
    var crewVictimFixture = new Survivor();
    crewVictimFixture.name = 'Víctima de prueba';
    crewVictimFixture.health = 40;
    CrewManager.members = [conflictMemberFixture, crewVictimFixture];
    Game.startCrewConflict(conflictMemberFixture, 'delirio por hambre');
    Game.finishCrewConflict('failed');
    var crewVictimAliveFixture = crewVictimFixture.alive;

    Game.state = 'playing';
    Game.stats.deathCause = '';
    Game.player.health = 20;
    conflictMemberFixture.hostile = true;
    conflictMemberFixture.restrainedDays = 0;
    conflictMemberFixture.criticalDays = 1;
    CrewManager.members = [conflictMemberFixture];
    Game.startCrewConflict(conflictMemberFixture, 'delirio por hambre');
    Game.finishCrewConflict('failed');
    var conflictDeathCauseFixture = Game.stats.deathCause;
  `);
  assert.equal(run('startedRationFixture'), true);
  assert.equal(run('rationResolvedFixture'), true);
  assert.equal(run('foodAfterRationFixture'), 0.5);
  assert.equal(run('waterAfterRationFixture'), 0.35);
  assert.equal(run('restrainedFixture'), 1);
  assert.equal(run('crewVictimAliveFixture'), false);
  assert.equal(run('Game.state'), 'end');
  assert.match(run('conflictDeathCauseFixture'), /crisis/i);
});

test('guardar durante una crisis restaura pelea, objetivo y resumen pendiente', () => {
  resetRaft([
    ['0,0', 'floor', 50],
    ['1,0', 'floor', 50]
  ]);
  run(`
    Game.state = 'playing';
    Game.resetPlayerState({ health: 100, stamina: 80 });
    Game.resources.food = 1;
    Game.resources.water = 1;
    var savedAggressorFixture = new Survivor();
    savedAggressorFixture.name = 'Agresor guardado';
    savedAggressorFixture.criticalDays = 2;
    savedAggressorFixture.hostile = true;
    var savedTargetFixture = new Survivor();
    savedTargetFixture.name = 'Objetivo guardado';
    CrewManager.members = [savedAggressorFixture, savedTargetFixture];
    Game.startCrewConflict(savedAggressorFixture, 'crisis persistente');
    Game.crewConflict.tension = 37;
    Game.crewConflict.timeLeft = 4.5;
    Game.pendingDaySummary = {
      food: 1,
      water: 1.3,
      events: ['heat', 'fire', 'evento-inválido'],
      crewNotes: ['Nota pendiente']
    };
    var activeConflictSaveFixture = Game.getSaveData();
    Game.loadFromSave(activeConflictSaveFixture);
  `);
  assert.equal(run('Game.crewConflict.active'), true);
  assert.equal(run('Game.crewConflict.member.name'), 'Agresor guardado');
  assert.equal(run('Game.crewConflict.target.name'), 'Objetivo guardado');
  assert.equal(run('Game.crewConflict.tension'), 37);
  assert.equal(run('Game.crewConflict.timeLeft'), 4.5);
  assert.equal(run('Game.pendingDaySummary.crewNotes[0]'), 'Nota pendiente');
  assert.equal(run('Game.pendingDaySummary.events.length'), 2);
  assert.equal(run('Game.paused'), true);
  run('Game.closeAllModals();');
});

test('si un evento mata al agresor pendiente el día se cierra y guarda', () => {
  resetRaft([['0,0', 'floor', 50]]);
  run(`
    var interruptedAggressorFixture = new Survivor();
    interruptedAggressorFixture.name = 'Agresor accidentado';
    interruptedAggressorFixture.health = 18;
    interruptedAggressorFixture.hostile = true;
    CrewManager.members = [interruptedAggressorFixture];
    Game.resetPlayerState({
      health: 100, hunger: 90, thirst: 90, morale: 75, sanity: 100
    });
    Game.resources = {
      wood: 0, plastic: 0, cloth: 0, metal: 0,
      rope: 0, food: 2, water: 2, fuel: 0
    };
    Game.day = 2;
    Game.zone = 'calm';
    Game.state = 'playing';
    Game.victoryCondition = null;
    var interruptedStoryFixture = CrewManager.resolveStoryEvents;
    var interruptedWorkFixture = CrewManager.applyDailyWork;
    var interruptedBehaviorFixture = CrewManager.resolveDailyBehavior;
    var interruptedEventsFixture = Game.pickDailyEvents;
    var interruptedSummaryFixture = Game.showDaySummary;
    var interruptedRandomFixture = Math.random;
    var interruptedSummaryShownFixture = false;
    CrewManager.resolveStoryEvents = () => [];
    CrewManager.applyDailyWork = () => [];
    CrewManager.resolveDailyBehavior = () => ({
      messages: ['La crisis iba a comenzar.'],
      conflict: {
        member: interruptedAggressorFixture,
        cause: 'crisis interrumpida'
      }
    });
    Game.pickDailyEvents = () => ['lost'];
    Game.showDaySummary = () => { interruptedSummaryShownFixture = true; };
    Math.random = () => 0;
    var interruptedSaveBeforeFixture = Save.saveCalls;
    Game.endDay();
    Math.random = interruptedRandomFixture;
    CrewManager.resolveStoryEvents = interruptedStoryFixture;
    CrewManager.applyDailyWork = interruptedWorkFixture;
    CrewManager.resolveDailyBehavior = interruptedBehaviorFixture;
    Game.pickDailyEvents = interruptedEventsFixture;
    Game.showDaySummary = interruptedSummaryFixture;
  `);
  assert.equal(run('interruptedAggressorFixture.alive'), false);
  assert.equal(run('interruptedAggressorFixture.hostile'), false);
  assert.equal(run('Game.crewConflict.active'), false);
  assert.equal(run('Game.pendingDaySummary'), null);
  assert.equal(run('interruptedSummaryShownFixture'), true);
  assert.equal(run('Save.saveCalls'), run('interruptedSaveBeforeFixture + 1'));
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
    medicFixture.job = 'care';
    medicFixture.stress = 15;
    medicFixture.incidentCooldown = 2;
    medicFixture.storyResolved = true;
    medicFixture.storyDaysRemaining = 0;
    CrewManager.members = [medicFixture];
    Game.resources.food = 2; Game.resources.water = 2.6;
    Object.assign(Game.player, { health: 50, hunger: 90, thirst: 90, morale: 60, sanity: 80 });
    Game.state = 'playing'; Game.endDay();
  `);
  assert.ok(run('Game.player.health') > 56);
  assert.ok(run('Game.player.health') < 57);
  assert.equal(run('Game.player.morale'), 65);
});

test('los once sucesos nuevos ofrecen decisiones, persisten y resuelven consecuencias', () => {
  resetRaft([['0,0', 'floor', 50]]);
  run(`
    Game.pickDailyEvents = dailyEventsFixture;
    var decisionDefinitionsFixture = DECISION_EVENT_KEYS.map(key => ({
      key,
      definition: Game.getDecisionEventDefinition(key)
    }));
    var everyDecisionDefinedFixture = decisionDefinitionsFixture.every(item =>
      item.definition &&
      item.definition.title &&
      item.definition.text &&
      item.definition.options.length >= 2
    );

    Game.state = 'playing';
    CrewManager.members = [];
    Game.resources = {
      wood: 0, plastic: 0, cloth: 0, metal: 0,
      rope: 0, food: 2, water: 2, fuel: 0
    };
    Game.resetPlayerState({ health: 100, morale: 75, sanity: 100 });
    Game.infectionDays = 0;
    Game.pendingDayResolution = {
      food: 1,
      water: 1.3,
      events: ['contaminatedWater'],
      crewNotes: [],
      decisions: ['contaminatedWater'],
      conflictMemberIndex: -1,
      conflictCause: ''
    };
    var decisionSaveFixture = Game.getSaveData();
    Game.loadFromSave(decisionSaveFixture);
    var restoredDecisionFixture =
      Game.pendingDayResolution.decisions[0];
    Game.state = 'playing';
    var eventSummaryFixture = Game.showDaySummary;
    var eventSummaryShownFixture = false;
    Game.showDaySummary = () => { eventSummaryShownFixture = true; };
    Game.resumePendingDayResolution();
    var eventButtonCountFixture =
      document.getElementById('decision-buttons').children.length;
    document.getElementById('decision-buttons').children[0].onclick();
    Game.showDaySummary = eventSummaryFixture;

    var eventRandomRestoreFixture = Math.random;
    Math.random = () => 0;
    Game.zone = 'calm';
    CrewManager.members = [];
    var generatedDecisionEventsFixture = Game.pickDailyEvents();
    Math.random = eventRandomRestoreFixture;

    Game.resources.food = 2;
    Game.resources.water = 2;
    var rescuedBeforeFlareFixture = Game.stats.rescued;
    var crewBeforeFlareFixture = CrewManager.members.length;
    var flareResultFixture =
      Game.applyDecisionEventOutcome('distressFlare', 'rescue');
  `);
  assert.equal(run('DECISION_EVENT_KEYS.length'), 11);
  assert.equal(run('everyDecisionDefinedFixture'), true);
  assert.equal(run('restoredDecisionFixture'), 'contaminatedWater');
  assert.equal(run('eventButtonCountFixture'), 2);
  assert.equal(run('Game.pendingDayResolution'), null);
  assert.equal(run('Game.infectionDays'), 3);
  assert.equal(run('Game.resources.water'), 0.7);
  assert.equal(run('eventSummaryShownFixture'), true);
  assert.equal(
    run("generatedDecisionEventsFixture.includes('contaminatedWater')"),
    true
  );
  assert.equal(
    run('CrewManager.members.length'),
    run('crewBeforeFlareFixture + 1')
  );
  assert.equal(
    run('Game.stats.rescued'),
    run('rescuedBeforeFlareFixture + 1')
  );
  assert.match(run('flareResultFixture'), /Rescataste/);
});

test('todas las respuestas de eventos mantienen un estado finito y jugable', () => {
  run(`
    Game.raft.grid.clear();
    [
      'floor', 'lookout', 'smokehouse', 'armor', 'anchor', 'bunk',
      'fire', 'sail', 'rudder', 'harpoon', 'infirmary', 'chart',
      'beacon', 'containment', 'radio'
    ].forEach((buildingKey, index) => {
      Game.raft.grid.set(index + ',0', {
        buildingKey,
        health: BUILDINGS[buildingKey].health,
        maxHealth: BUILDINGS[buildingKey].health,
        mesh: null
      });
    });
    Game.resetPlayerState({
      x: 1, z: 1, health: 100, hunger: 90, thirst: 90,
      morale: 75, stamina: 100, sanity: 100
    });
    Game.resources = {
      wood: 99, plastic: 99, cloth: 99, metal: 99,
      rope: 99, food: 99, water: 99, fuel: 99
    };
    Game.stats = {
      rescued: 0, abandoned: 0, gathered: 0,
      maxRaftSize: 15, deathCause: ''
    };
    CrewManager.members = [new Survivor(), new Survivor()];
    Game.state = 'playing';
    Game.victoryCondition = null;
    var eventOutcomeSnapshotFixture = Game.getSaveData();
    var eventOutcomeFailuresFixture = [];
    for (var eventKeyFixture of DECISION_EVENT_KEYS) {
      Game.loadFromSave(eventOutcomeSnapshotFixture);
      Game.state = 'playing';
      var eventOptionsFixture =
        Game.getDecisionEventDefinition(eventKeyFixture).options;
      for (var eventOptionFixture of eventOptionsFixture) {
        Game.loadFromSave(eventOutcomeSnapshotFixture);
        Game.state = 'playing';
        try {
          var eventResultFixture = Game.applyDecisionEventOutcome(
            eventKeyFixture,
            eventOptionFixture.id
          );
          var finiteResourcesFixture = Object.values(Game.resources)
            .every(Number.isFinite);
          var finitePlayerFixture = [
            'health', 'hunger', 'thirst', 'morale', 'stamina', 'sanity'
          ].every(key => Number.isFinite(Game.player[key]));
          if (!eventResultFixture || !finiteResourcesFixture ||
              !finitePlayerFixture || Game.raft.totalArea() <= 0) {
            eventOutcomeFailuresFixture.push(
              eventKeyFixture + ':' + eventOptionFixture.id
            );
          }
        } catch (error) {
          eventOutcomeFailuresFixture.push(
            eventKeyFixture + ':' + eventOptionFixture.id + ':' + error.message
          );
        }
      }
    }
    Game.loadFromSave(eventOutcomeSnapshotFixture);
    Game.state = 'playing';
  `);
  assert.deepEqual(
    JSON.parse(JSON.stringify(run('eventOutcomeFailuresFixture'))),
    []
  );
});

test('eventos y rutas finales son alcanzables', () => {
  resetRaft([['0,0', 'floor', 50]]);
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

test('el daño letal por hambre o sed no se cura después de morir', () => {
  resetRaft([
    ['0,0', 'bed', 30],
    ['1,0', 'medkit', 30],
    ['2,0', 'purifier', 40]
  ]);
  run(`
    var lethalEventsFixture = Game.pickDailyEvents;
    var lethalSummaryFixture = Game.showDaySummary;
    Game.pickDailyEvents = () => [];
    Game.showDaySummary = () => {};
    CrewManager.members = [];
    Game.resetPlayerState({
      x: 1, z: 1, health: 5, hunger: 0, thirst: 0,
      morale: 80, sanity: 100
    });
    Game.resources = {
      wood: 0, plastic: 0, cloth: 0, metal: 0,
      rope: 0, food: 0, water: 0, fuel: 0
    };
    Game.day = 8;
    Game.zone = 'debris';
    Game.storm = false;
    Game.state = 'playing';
    Game.endDay();
    var lethalStateFixture = Game.state;
    var lethalHealthFixture = Game.player.health;
    Game.pickDailyEvents = lethalEventsFixture;
    Game.showDaySummary = lethalSummaryFixture;
  `);
  assert.equal(run('lethalStateFixture'), 'end');
  assert.equal(run('lethalHealthFixture'), 0);
});

test('vela y radio activan rutas coherentes y conservan el progreso al cambiar', () => {
  resetRaft([
    ['0,0', 'sail', 40],
    ['1,0', 'rudder', 45]
  ]);
  run(`
    Game.state = 'playing';
    Game.paused = false;
    Game.resetPlayerState({ x: 1, z: 1 });
    Game.resources = {
      wood: 0, plastic: 0, cloth: 0, metal: 0,
      rope: 0, food: 2, water: 2.6, fuel: 0
    };
    Game.victoryCondition = null;
    Game.islandDistance = 2000;
    Game.navigationIntel = 0;
    var routeDecisionFixture = Game.showDecision;
    var routeOptionsFixture = null;
    Game.showDecision = (title, text, options) => {
      routeOptionsFixture = options;
    };
    Game.interact();
    routeOptionsFixture[0].action();
    var sailRouteFixture = Game.victoryCondition;
    var sailDistanceFixture = Game.islandDistance;
    Game.updateObjective();
    var islandObjectiveFixture =
      document.getElementById('objective-text').textContent;
  `);
  assert.equal(run('sailRouteFixture'), 'island');
  assert.equal(run('sailDistanceFixture'), 300);
  assert.match(run('islandObjectiveFixture'), /Isla a 300 m/);

  resetRaft([['0,0', 'radio', 35]]);
  run(`
    Game.resetPlayerState({ x: 1, z: 1 });
    Game.victoryCondition = 'island';
    Game.islandDistance = 123;
    Game.rescuedSignal = 55;
    routeOptionsFixture = null;
    Game.interact();
    routeOptionsFixture[0].action();
    var resumedRadioFixture = Game.victoryCondition;
    var preservedSignalFixture = Game.rescuedSignal;
  `);
  assert.equal(run('resumedRadioFixture'), 'radio');
  assert.equal(run('preservedSignalFixture'), 55);

  resetRaft([
    ['0,0', 'sail', 40],
    ['1,0', 'rudder', 45]
  ]);
  run(`
    Game.resetPlayerState({ x: 1, z: 1 });
    Game.victoryCondition = 'radio';
    Game.islandDistance = 123;
    routeOptionsFixture = null;
    Game.interact();
    routeOptionsFixture[0].action();
    var resumedIslandFixture = Game.victoryCondition;
    var preservedDistanceFixture = Game.islandDistance;
  `);
  assert.equal(run('resumedIslandFixture'), 'island');
  assert.equal(run('preservedDistanceFixture'), 123);

  resetRaft([
    ['0,0', 'motor', 50],
    ['1,0', 'sail', 40],
    ['0,1', 'rudder', 45]
  ]);
  run(`
    Game.resetPlayerState({ x: 1, z: 1 });
    Game.victoryCondition = 'radio';
    Game.resources.plastic = 1;
    Game.resources.fuel = 0;
    routeOptionsFixture = null;
    Game.interact();
    var storedFuelFixture = Game.resources.fuel;
    var routeAfterRefuelFixture = Game.victoryCondition;
    var refuelOpenedRouteFixture = routeOptionsFixture !== null;
    Game.showDecision = routeDecisionFixture;
  `);
  assert.equal(run('storedFuelFixture'), 2);
  assert.equal(run('routeAfterRefuelFixture'), 'radio');
  assert.equal(run('refuelOpenedRouteFixture'), false);
});

test('el mástil amplifica según la salud de la radio', () => {
  resetRaft([
    ['0,0', 'radio', 35],
    ['1,0', 'mast', 60]
  ]);
  run(`
    Game.raft.get(0, 0).health = 0.35;
    Game.raft.get(0, 0).maxHealth = 35;
    var mastEventsFixture = Game.pickDailyEvents;
    var mastSummaryFixture = Game.showDaySummary;
    Game.pickDailyEvents = () => [];
    Game.showDaySummary = () => {};
    CrewManager.members = [];
    Game.resetPlayerState({
      x: 1, z: 1, health: 100, hunger: 90, thirst: 90,
      morale: 80, sanity: 100
    });
    Game.resources = {
      wood: 0, plastic: 0, cloth: 0, metal: 0,
      rope: 0, food: 1, water: 1.3, fuel: 0
    };
    Game.day = 2;
    Game.zone = 'debris';
    Game.state = 'playing';
    Game.victoryCondition = 'radio';
    Game.rescuedSignal = 1;
    Game.endDay();
    var damagedRadioSignalFixture = Game.rescuedSignal;
    Game.pickDailyEvents = mastEventsFixture;
    Game.showDaySummary = mastSummaryFixture;
  `);
  assert.ok(Math.abs(run('damagedRadioSignalFixture') - 1.12) < 1e-9);
});

test('volver al menú guarda y un slot futuro no se sobrescribe al continuar', () => {
  run(`
    var continueWarningFixture = console.warn;
    console.warn = () => {};
    Game.state = 'paused';
    Game.resources.wood = 37;
    var menuSaveBeforeFixture = Save.saveCalls;
    var returnedToMenuFixture = Game.returnToMenu(true);
    var menuSaveAfterFixture = Save.saveCalls;

    var futureLoadFixture = Save.load;
    var futureCheckFixture = Save.hasIncompatibleCurrent;
    Save.load = () => null;
    Save.hasIncompatibleCurrent = () => true;
    var futureSaveBeforeFixture = Save.saveCalls;
    var futureContinueFixture = Game.continueGame();
    var futureSaveAfterFixture = Save.saveCalls;
    Save.load = futureLoadFixture;
    if (futureCheckFixture) Save.hasIncompatibleCurrent = futureCheckFixture;
    else delete Save.hasIncompatibleCurrent;

    var brokenLoadFixture = Game.loadFromSave;
    var recoverLoadFixture = Save.load;
    Save.load = () => ({ day: 8 });
    Game.loadFromSave = () => { throw new Error('guardado irreparable'); };
    var brokenSaveBeforeFixture = Save.saveCalls;
    var brokenContinueFixture = Game.continueGame();
    var brokenSaveAfterFixture = Save.saveCalls;
    Game.loadFromSave = brokenLoadFixture;
    Save.load = recoverLoadFixture;
    console.warn = continueWarningFixture;
  `);
  assert.equal(run('returnedToMenuFixture'), true);
  assert.equal(run('Game.state'), 'start');
  assert.equal(
    run('menuSaveAfterFixture'),
    run('menuSaveBeforeFixture + 1')
  );
  assert.equal(run('futureContinueFixture'), false);
  assert.equal(run('futureSaveAfterFixture'), run('futureSaveBeforeFixture'));
  assert.equal(run('brokenContinueFixture'), false);
  assert.equal(run('brokenSaveAfterFixture'), run('brokenSaveBeforeFixture'));
  assert.equal(run('Game.state'), 'start');
});

test('una partida terminada no deja un guardado que permita deshacer el desenlace', () => {
  run(`
    var terminalClearBeforeFixture = Save.clearCalls;
    Game.stats.deathCause = 'Prueba terminal';
    Game.triggerLose();
    Game.state = 'playing';
    Game.triggerWin('radio');
  `);
  assert.equal(run('Save.clearCalls'), run('terminalClearBeforeFixture + 2'));
  assert.equal(run('Game.state'), 'end');
});

console.log('Todas las pruebas jugables han pasado.');
