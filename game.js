/*****************************************************
 * game.js - Controlador y estado de la partida.
 * Las reglas agregadas, el DOM y el render 3D viven en módulos separados.
 *****************************************************/

const DAY_REAL_SECONDS = 240; // 4 minutos
const HOURS_PER_DAY = 24;
const SECONDS_PER_HOUR = DAY_REAL_SECONDS / HOURS_PER_DAY;

const ZONES = ['calm', 'debris', 'fish', 'calm', 'storm', 'sharks', 'polluted', 'calm', 'ship'];

const Game = {
  state: 'start', // start, playing, paused, end
  paused: false,
  day: 1,
  time: 6, // hora del día 0-24
  zone: 'calm',
  zoneTimer: 0,
  storm: false,
  rain: false,
  fog: false,
  heat: false,
  weatherTimers: { storm: 0, rain: 0, fog: 0, heat: 0 },

  // Jugador (posiciones en unidades de mundo; el plano es XZ)
  player: {
    x: 1, z: 1,
    vx: 0, vz: 0,
    speed: 6,
    health: 100, hunger: 90, thirst: 90, morale: 75, stamina: 100, sanity: 100,
    foodCredit: 0,
    hook: null,
    hookRange: 8,
    hookSpeed: 11,
    moveTarget: null,
    movePath: [],
    moveDestination: null,
    rowTarget: null,
    rowAnim: 0,
  },

  // Recursos
  resources: {
    wood: 0, plastic: 0, cloth: 0, metal: 0, rope: 0,
    food: 0, water: 0, fuel: 0,
  },

  // Estadísticas
  stats: {
    rescued: 0, abandoned: 0, gathered: 0, maxRaftSize: 1, deathCause: ''
  },

  raft: new Raft(),

  // Sistemas
  rescuedSignal: 0,
  islandDistance: 2000,
  radioIntel: 0,
  navigationIntel: 0,
  victoryCondition: null,
  rowingBoost: 0,
  rowingBoostZ: 0,
  rowingCooldown: 0,
  navigationHeading: 0,
  worldOffset: 0,
  worldOffsetZ: 0,
  hallucinationTimer: 0,
  fishing: { active: false },

  // Meshes auxiliares
  ghostMesh: null,
  highlightGroup: null,
  rowGroup: null,
  hoverRowMesh: null,
  selectionMesh: null,
  highlightsDirty: true,
  mouseWorld: null,

  objectives: [
    'Recoge restos y consigue comida y agua.',
    'Amplía tu balsa con suelos de madera.',
    'Construye redes y recolectores.',
    'Rescata supervivientes con habilidades útiles.',
    'Construye vela y timón para navegar.',
    'Usa la vela para partir o construye una radio para pedir rescate.'
  ],
  currentObjective: 0,

  init: () => {
    const canvas = document.getElementById('game-canvas');
    World.init(canvas);
    Input.init(canvas);
    FloatingText.init(World.scene);
    Particles.init(World.scene);
    EntityManager.init(World.scene);
    HookVis.init(World.scene);

    Game.raft.init(World.scene);
    PlayerVis.init(Game.raft.group);

    Game.initAuxMeshes();
    Game.bindUI();
    Game.loadPrefs();
    Game.setState('start');
    Loop.start(Game.update, Game.draw);
  },

  initAuxMeshes: () => {
    const cs = Game.raft.cellSize;
    // Fantasma de colocación
    Game.ghostMesh = new THREE.Mesh(
      new THREE.BoxGeometry(cs - 0.1, 0.6, cs - 0.1),
      new THREE.MeshBasicMaterial({ color: 0x66bb6a, transparent: true, opacity: 0.4 })
    );
    Game.ghostMesh.visible = false;
    World.scene.add(Game.ghostMesh);

    // Grupo de celdas válidas (construcción) y corona de remo
    Game.highlightGroup = new THREE.Group();
    World.scene.add(Game.highlightGroup);
    Game.rowGroup = new THREE.Group();
    World.scene.add(Game.rowGroup);

    // Celda de remo bajo el cursor
    Game.hoverRowMesh = new THREE.Mesh(
      new THREE.BoxGeometry(cs - 0.1, 0.3, cs - 0.1),
      new THREE.MeshBasicMaterial({ color: 0x4fc3f7, transparent: true, opacity: 0.45 })
    );
    Game.hoverRowMesh.visible = false;
    World.scene.add(Game.hoverRowMesh);

    // Celda seleccionada (clic derecho)
    Game.selectionMesh = new THREE.Mesh(
      new THREE.BoxGeometry(cs, 0.7, cs),
      new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true })
    );
    Game.selectionMesh.visible = false;
    World.scene.add(Game.selectionMesh);
  },

  loadPrefs: () => {
    const p = Save.loadPrefs();
    const soundEnabled = p.sound !== false;
    AudioSys.setEnabled(soundEnabled);
    GameUI.setSoundButton(soundEnabled);
  },

  savePrefs: () => {
    Save.savePrefs({ sound: AudioSys.isEnabled() });
  },

  toggleSound: () => {
    AudioSys.setEnabled(!AudioSys.isEnabled());
    GameUI.setSoundButton(AudioSys.isEnabled());
    Game.savePrefs();
  },

  resetPlayerState: (saved = null) =>
    GameSimulation.resetPlayerState(Game, saved),

  resetTransientState: () => GameSimulation.resetTransientState(Game),

  setState: (s) => {
    Game.state = s;
    document.getElementById('start-screen').classList.toggle('active', s === 'start');
    document.getElementById('end-screen').classList.toggle('active', s === 'end');
    document.getElementById('pause-screen').classList.toggle('active', s === 'paused');
    document.getElementById('ui').classList.toggle('hidden', s !== 'playing');
    if (s === 'start') {
      const continueButton = document.getElementById('btn-continue');
      const incompatible = Save.hasIncompatibleCurrent?.() === true;
      continueButton.disabled = incompatible || !Save.exists();
      continueButton.textContent = incompatible
        ? 'Guardado de una versión más reciente'
        : 'Continuar guardado';
    }
  },

  newGame: () => {
    if (Game.fishing?.active) Game.cancelFishing(false);
    Game.paused = false;
    Game.day = 1;
    Game.time = 6;
    Game.zone = 'calm';
    Game.zoneTimer = 30;
    Game.storm = false;
    Game.rain = false;
    Game.fog = false;
    Game.heat = false;
    Game.weatherTimers = { storm: 0, rain: 0, fog: 0, heat: 0 };

    Game.resetPlayerState();

    Game.resources = { wood: 4, plastic: 1, cloth: 0, metal: 0, rope: 1, food: 2, water: 1, fuel: 0 };

    Game.stats = { rescued: 0, abandoned: 0, gathered: 0, maxRaftSize: 1, deathCause: '' };

    Game.raft.reset();
    Game.raft.selected = null;

    EntityManager.reset();
    CrewManager.reset();
    FloatingText.clear();
    Particles.clear();
    Log.clear();

    Game.rescuedSignal = 0;
    Game.islandDistance = 2000;
    Game.radioIntel = 0;
    Game.navigationIntel = 0;
    Game.victoryCondition = null;
    Game.currentObjective = 0;
    Game.navigationHeading = 0;
    Game.worldOffset = 0;
    Game.worldOffsetZ = 0;
    Game.resetTransientState();
    Game.highlightsDirty = true;

    PlayerVis.reset();
    HookVis.hide();
    BuildManager.close();
    Game.closeAllModals();

    Log.add('Despiertas a la deriva sobre una tabla de madera.');
    Game.setState('playing');
    Save.save(Game.getSaveData());
  },

  continueGame: () => {
    const data = Save.load();
    if (!data) {
      if (Save.hasIncompatibleCurrent?.()) {
        const button = document.getElementById('btn-continue');
        if (button) {
          button.textContent = 'Guardado de una versión más reciente';
          button.disabled = true;
        }
        console.warn('El guardado pertenece a una versión más reciente del juego.');
        return false;
      }
      return Game.newGame();
    }
    try {
      Game.loadFromSave(data);
    } catch (e) {
      console.warn('No se pudo cargar el guardado; se conserva sin sobrescribir.', e);
      Game.setState('start');
      const button = document.getElementById('btn-continue');
      if (button) {
        button.textContent = 'No se pudo recuperar el guardado';
        button.disabled = true;
      }
      return false;
    }
    Game.setState('playing');
    return true;
  },

  loadFromSave: (data) => {
    if (Game.fishing?.active) Game.cancelFishing(false);
    Game.paused = false;
    Game.day = Number.isFinite(data.day) ? Math.max(1, Math.floor(data.day)) : 1;
    Game.time = Number.isFinite(data.time) ? Util.clamp(data.time, 0, 23.99) : 6;
    Game.zone = ZONES.includes(data.zone) ? data.zone : 'calm';
    Game.zoneTimer = Number.isFinite(data.zoneTimer) ? Math.max(1, data.zoneTimer) : 30;
    Game.weatherTimers = {
      storm: Math.max(0, data.weatherTimers?.storm || (data.storm ? 10 : 0)),
      rain: Math.max(0, data.weatherTimers?.rain || 0),
      fog: Math.max(0, data.weatherTimers?.fog || 0),
      heat: Math.max(0, data.weatherTimers?.heat || 0)
    };
    Game.storm = Game.zone === 'storm' || Game.weatherTimers.storm > 0;
    Game.rain = Game.storm || Game.weatherTimers.rain > 0;
    Game.fog = Game.weatherTimers.fog > 0;
    Game.heat = Game.weatherTimers.heat > 0;
    Game.resetPlayerState(data.player);
    const savedResources = data.resources || {};
    Game.resources = {};
    for (const key of RESOURCE_KEYS) {
      Game.resources[key] = Math.max(0, Number(savedResources[key]) || 0);
    }
    Game.stats = {
      rescued: Math.max(0, Number(data.stats?.rescued) || 0),
      abandoned: Math.max(0, Number(data.stats?.abandoned) || 0),
      gathered: Math.max(0, Number(data.stats?.gathered) || 0),
      maxRaftSize: Math.max(1, Number(data.stats?.maxRaftSize) || 1),
      deathCause: data.stats?.deathCause || ''
    };
    Game.rescuedSignal = Util.clamp(Number(data.rescuedSignal) || 0, 0, 100);
    const savedIslandDistance = Number(data.islandDistance);
    Game.islandDistance = Math.max(
      0,
      Number.isFinite(savedIslandDistance) ? savedIslandDistance : 2000
    );
    Game.radioIntel = Util.clamp(Number(data.radioIntel) || 0, 0, 40);
    Game.navigationIntel = Util.clamp(Number(data.navigationIntel) || 0, 0, 120);
    Game.victoryCondition = ['radio', 'island'].includes(data.victoryCondition) ? data.victoryCondition : null;
    Game.currentObjective = Util.clamp(Number(data.currentObjective) || 0, 0, Game.objectives.length - 1);
    Game.worldOffset = Number(data.worldOffset) || 0;
    Game.worldOffsetZ = Number(data.worldOffsetZ) || 0;
    Game.navigationHeading = Util.clamp(
      Number.isFinite(Number(data.navigationHeading)) ? Number(data.navigationHeading) : 0,
      -NAVIGATION_BALANCE.maxHeading,
      NAVIGATION_BALANCE.maxHeading
    );

    // Reconstruir balsa con meshes
    for (const cell of Game.raft.grid.values()) Game.raft.disposeMesh(cell);
    Game.raft.grid.clear();
    const entries = Array.isArray(data.raftGrid) ? data.raftGrid : [['0,0', { buildingKey: 'floor', health: 50 }]];
    for (const entry of entries) {
      if (!Array.isArray(entry) || entry.length < 2 ||
          typeof entry[0] !== 'string') continue;
      const [k, v] = entry;
      const [gx, gy] = k.split(',').map(Number);
      if (Number.isInteger(gx) && Number.isInteger(gy) &&
          Math.abs(gx) <= 1000 && Math.abs(gy) <= 1000 &&
          BUILDINGS[v?.buildingKey] &&
          Game.raft.placeAt(gx, gy, v.buildingKey, true)) {
        const cell = Game.raft.get(gx, gy);
        cell.maxHealth = Math.max(
          BUILDINGS[v.buildingKey].health,
          Number(v.maxHealth) || BUILDINGS[v.buildingKey].health
        );
        const savedHealth = Number(v.health);
        cell.health = Util.clamp(Number.isFinite(savedHealth) ? savedHealth : cell.maxHealth, 0, cell.maxHealth);
        Game.raft.tintDamaged(cell);
      }
    }
    if (Game.raft.grid.size === 0) Game.raft.placeAt(0, 0, 'floor', true);
    Game.raft.removeDetachedCells();
    Game.ensurePlayerOnRaft();
    CrewManager.reset();
    CrewManager.members = (Array.isArray(data.crew) ? data.crew : [])
      .filter(member => member && typeof member === 'object' &&
        !Array.isArray(member))
      .slice(0, CrewManager.MAX_MEMBERS || 64)
      .map(Survivor.fromData);
    EntityManager.reset();
    FloatingText.clear();
    Particles.clear();
    Log.clear();
    HookVis.hide();
    BuildManager.close();
    Game.closeAllModals();
    Game.resetTransientState();
    Game.highlightsDirty = true;
    Log.add('Partida cargada.');
  },

  getSaveData: () => {
    return {
      day: Game.day,
      time: Game.time,
      zone: Game.zone,
      zoneTimer: Game.zoneTimer,
      storm: Game.storm,
      weatherTimers: Game.weatherTimers,
      player: {
        x: Game.player.x, z: Game.player.z,
        health: Game.player.health, hunger: Game.player.hunger,
        thirst: Game.player.thirst, morale: Game.player.morale,
        stamina: Game.player.stamina, sanity: Game.player.sanity,
        foodCredit: Game.player.foodCredit
      },
      resources: Game.resources,
      stats: Game.stats,
      raftGrid: Array.from(Game.raft.grid.entries()).map(([k, v]) => [
        k,
        { buildingKey: v.buildingKey, health: v.health, maxHealth: v.maxHealth }
      ]),
      crew: CrewManager.members.map(m => ({ ...m, mesh: null })),
      rescuedSignal: Game.rescuedSignal,
      islandDistance: Game.islandDistance,
      radioIntel: Game.radioIntel,
      navigationIntel: Game.navigationIntel,
      navigationHeading: Game.navigationHeading,
      victoryCondition: Game.victoryCondition,
      currentObjective: Game.currentObjective,
      worldOffset: Game.worldOffset,
      worldOffsetZ: Game.worldOffsetZ
    };
  },

  saveGame: () => {
    const ok = Save.save(Game.getSaveData());
    if (Game.state === 'paused') {
      const button = document.getElementById('btn-save');
      button.textContent = ok ? 'Guardado ✓' : 'Error al guardar';
      setTimeout(() => { button.textContent = 'Guardar partida'; }, 1800);
    } else {
      Game.showEventMessage(ok ? 'Partida guardada' : 'Error al guardar');
    }
  },

  requestNewGame: () => {
    const mustConfirm = Game.state === 'start' && Save.exists() &&
      typeof window.confirm === 'function';
    if (mustConfirm &&
        !window.confirm('Hay una partida guardada. ¿Quieres reemplazarla por una nueva?')) {
      return false;
    }
    if (mustConfirm && Save.hasIncompatibleCurrent?.()) Save.clear();
    Game.newGame();
    return true;
  },

  returnToMenu: (saveCurrent = true) => {
    const canSave = Game.state === 'playing' || Game.state === 'paused';
    if (saveCurrent && canSave && !Save.save(Game.getSaveData())) {
      const button = document.getElementById('btn-pause-menu');
      if (button) button.textContent = 'No se pudo guardar';
      return false;
    }
    Game.closeAllModals();
    Game.raft.selected = null;
    Game.setState('start');
    return true;
  },

  bindUI: () => {
    document.getElementById('btn-new-game').onclick = Game.requestNewGame;
    document.getElementById('btn-continue').onclick = Game.continueGame;
    document.getElementById('btn-restart').onclick = Game.newGame;
    document.getElementById('btn-menu').onclick = () => Game.returnToMenu(false);
    document.getElementById('btn-resume').onclick = () => Game.setState('playing');
    document.getElementById('btn-save').onclick = Game.saveGame;
    document.getElementById('btn-pause-menu').onclick = () => Game.returnToMenu(true);

    document.getElementById('btn-sound').onclick = Game.toggleSound;
    document.getElementById('btn-pause').onclick = Game.togglePause;

    document.getElementById('btn-build').onclick = () => {
      if (BuildManager.placing) { BuildManager.stopPlacing(); }
      BuildManager.toggle();
      Game.updateBuildMenu();
    };
    document.getElementById('close-build').onclick = () => { BuildManager.close(); Game.updateBuildMenu(); };

    document.getElementById('btn-crew').onclick = () => {
      Game.paused = true;
      document.getElementById('crew-panel').classList.remove('hidden');
      CrewManager.renderList(document.getElementById('crew-list'));
    };
    document.getElementById('close-crew').onclick = () => {
      document.getElementById('crew-panel').classList.add('hidden');
      Game.paused = false;
    };

    document.getElementById('btn-log').onclick = () => {
      Game.paused = true;
      document.getElementById('log-panel').classList.remove('hidden');
      Log.render(document.getElementById('log-list'));
    };
    document.getElementById('close-log').onclick = () => {
      document.getElementById('log-panel').classList.add('hidden');
      Game.paused = false;
    };

    document.getElementById('btn-summary-ok').onclick = () => {
      document.getElementById('day-summary').classList.add('hidden');
      Game.paused = false;
    };
    const fishingButton = document.getElementById('btn-fishing-pull');
    if (fishingButton) fishingButton.onclick = Game.requestFishingPull;

    document.querySelectorAll('#build-tabs .tab').forEach(tab => {
      tab.onclick = () => {
        document.querySelectorAll('#build-tabs .tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        Game.updateBuildMenu();
      };
    });
  },

  closeAllModals: () => {
    document.getElementById('build-menu').classList.add('hidden');
    document.getElementById('crew-panel').classList.add('hidden');
    document.getElementById('log-panel').classList.add('hidden');
    document.getElementById('decision-panel').classList.add('hidden');
    document.getElementById('day-summary').classList.add('hidden');
    const fishingPanel = document.getElementById('fishing-panel');
    if (fishingPanel) fishingPanel.classList.add('hidden');
    if (Game.fishing?.active) Game.cancelFishing(false);
    BuildManager.close();
    Game.paused = false;
  },

  menuModalOpen: () => {
    return BuildManager.active ||
      !document.getElementById('crew-panel').classList.contains('hidden') ||
      !document.getElementById('log-panel').classList.contains('hidden');
  },

  togglePause: () => {
    if (Game.state === 'playing') Game.setState('paused');
    else if (Game.state === 'paused') Game.setState('playing');
  },

  updateBuildMenu: () => {
    const menu = document.getElementById('build-menu');
    const list = document.getElementById('build-list');
    if (BuildManager.active) {
      Game.paused = true;
      menu.classList.remove('hidden');
      const carpenter = CrewManager.members.some(m => m.alive && m.skill.effect === 'woodCost') ? -0.15 : 0;
      BuildManager.renderMenu(list, Game.resources, carpenter);
      if (BuildManager.selected) BuildManager.renderInfo(document.getElementById('build-info'), BuildManager.selected, Game.resources, carpenter);
      else document.getElementById('build-info').innerHTML = 'Selecciona una estructura para colocarla en la balsa.';
    } else {
      menu.classList.add('hidden');
      if (Game.state === 'playing' &&
          document.getElementById('decision-panel').classList.contains('hidden') &&
          document.getElementById('day-summary').classList.contains('hidden')) {
        Game.paused = false;
      }
    }
  },

  // ---- Clics sobre el mundo 3D ----

  handleLeftClick: () => {
    if (Game.state !== 'playing' || Game.paused) return;
    const w = Game.mouseWorld;
    if (!w) return;
    Game.raft.selected = null;
    const { gx, gy } = Game.raft.worldToGrid(w.x, w.z);

    // Modo colocación
    if (BuildManager.placing && BuildManager.selected) {
      const carpenter = CrewManager.members.some(m => m.alive && m.skill.effect === 'woodCost') ? -0.15 : 0;
      const cost = BuildManager.realCost(BuildManager.selected, carpenter);
      if (!BuildManager.canAffordCustom(cost, Game.resources)) {
        Game.showFloatingText(w.x, w.z, 'Faltan recursos', '#ef5350');
        return;
      }
      if (Game.raft.has(gx, gy)) {
        Game.showFloatingText(w.x, w.z, 'Celda ocupada', '#ef5350');
        return;
      }
      if (!Game.raft.isConnected(gx, gy)) {
        Game.showFloatingText(w.x, w.z, 'No conectado', '#ef5350');
        return;
      }
      BuildManager.payCost(cost, Game.resources);
      Game.raft.placeAt(gx, gy, BuildManager.selected, true, CrewManager.getDurabilityBonus());
      AudioSys.play('build');
      Particles.emit(w.x, 0.6, w.z, '#8d6e63', 12, 2.5);
      Game.stats.maxRaftSize = Math.max(Game.stats.maxRaftSize, Game.raft.totalArea());
      Game.highlightsDirty = true;
      Game.updateBuildMenu();
      Game.updateUI();
      return;
    }

    // Un segundo clic siempre recoge el gancho, aunque el cursor esté sobre la balsa.
    if (Game.player.hook) {
      Game.castHook(w);
      return;
    }

    // Moverse dentro de la balsa
    if (Game.raft.has(gx, gy)) {
      Game.player.rowTarget = null;
      if (!Game.planPlayerPath(gx, gy)) {
        Game.showFloatingText(w.x, w.z, 'No hay un camino seguro', '#ef5350');
      }
      return;
    }

    // Remar en la corona adyacente
    if (Game.isRowingCell(gx, gy)) {
      Game.startRowingTowards(w.x, w.z);
      return;
    }

    // Lanzar gancho
    Game.castHook(w);
  },

  handleRightClick: () => {
    if (Game.state !== 'playing' || Game.paused) return;
    const w = Game.mouseWorld;
    if (!w) return;
    const { gx, gy } = Game.raft.worldToGrid(w.x, w.z);
    if (Game.raft.has(gx, gy)) {
      Game.raft.selected = { gx, gy };
      const cell = Game.raft.get(gx, gy);
      const b = BUILDINGS[cell.buildingKey];
      Game.showFloatingText(w.x, w.z, `${b.name} seleccionado (E: desmontar)`, '#fff');
    } else {
      Game.raft.selected = null;
    }
  },

  isRowingCell: (gx, gy) => {
    if (Game.raft.has(gx, gy)) return false;
    return Game.raft.isConnected(gx, gy);
  },

  ensurePlayerOnRaft: () => GameSimulation.ensurePlayerOnRaft(Game),

  planPlayerPath: (targetGx, targetGy) =>
    GameSimulation.planPlayerPath(Game, targetGx, targetGy),

  startRowingTowards: (wx, wz) =>
    GameSimulation.startRowingTowards(Game, wx, wz),

  row: () => GameSimulation.row(Game),

  castHook: (target) => {
    if (Game.player.hook) {
      Game.player.hook.returning = true;
      return;
    }
    const p = Game.player;
    const angle = Math.atan2(target.z - p.z, target.x - p.x);
    Game.player.hook = {
      x: p.x,
      z: p.z,
      vx: Math.cos(angle) * p.hookSpeed,
      vz: Math.sin(angle) * p.hookSpeed,
      distance: 0,
      life: 0,
      returning: false,
      object: null,
      maxRange: p.hookRange
    };
    if (typeof PlayerVis !== 'undefined' && PlayerVis.beginCast) PlayerVis.beginCast(target);
    AudioSys.play('hook');
  },

  collectObject: (obj) => {
    if (!obj || obj.collected || obj.pendingDecision) return;
    if (obj.typeKey === 'survivor') {
      obj.pendingDecision = true;
      Game.offerSurvivor(obj);
      return;
    }
    obj.collected = true;
    const loot = obj.loot;
    const gatherBonus = 1 + CrewManager.getResourceBonus();
    let msg = [];
    for (const [k, chanceOrAmount] of Object.entries(loot)) {
      if (k === 'survivor' || k === 'name' || k === 'icon') continue;
      if (typeof chanceOrAmount === 'number') {
        const amount = Math.round(chanceOrAmount * gatherBonus * 100) / 100;
        if (amount > 0) {
          Game.resources[k] = (Game.resources[k] || 0) + amount;
          msg.push(`+${Util.formatAmount(amount, 2)} ${Util.resourceName(k)}`);
        }
      }
    }
    Game.stats.gathered++;
    Game.removeEntity(obj);
    if (msg.length) {
      Game.showFloatingText(obj.x, obj.z, msg.join(' '));
      AudioSys.play('collect');
      Particles.emit(obj.x, 0.5, obj.z, '#4fc3f7', 8, 2);
    }
    if (BuildManager.active) Game.updateBuildMenu();
  },

  offerSurvivor: (obj) => {
    const survivor = new Survivor();
    const storyText = survivor.getStoryOfferText ? `\n\n${survivor.getStoryOfferText()}` : '';
    Game.showDecision(
      'Náufrago a la deriva',
      `Has encontrado a ${survivor.name}.\nHabilidad: ${survivor.skill.name}. Rasgo: ${survivor.trait.name}.${storyText}\n\nRescatarlo añade su talento, pero también hasta 1 de comida y 1,3 de agua al consumo diario, además del desenlace de su historia.`,
      [
        { label: 'Rescatar', action: () => { Game.rescueSurvivor(survivor, obj); } },
        { label: 'Dar suministros', action: () => { Game.giveSupplies(survivor, obj); } },
        { label: 'Ignorar', action: () => { Game.ignoreSurvivor(survivor, obj); } }
      ]
    );
  },

  rescueSurvivor: (survivor, obj) => {
    if (!CrewManager.add(survivor)) {
      obj.pendingDecision = false;
      Game.showFloatingText(
        obj.x,
        obj.z,
        'La tripulación ha alcanzado su límite',
        '#ef5350'
      );
      Log.add(
        `${survivor.name} no pudo subir: la tripulación ya tiene ` +
        `${CrewManager.MAX_MEMBERS} integrantes.`
      );
      return false;
    }
    CrewManager.assignPosition(survivor, Game.raft);
    Game.stats.rescued++;
    Log.add(`Has rescatado a ${survivor.name} (${survivor.skill.name}).`);
    Game.removeEntity(obj);
    Game.showFloatingText(obj.x, obj.z, `¡${survivor.name} rescatado!`);
    AudioSys.play('alert');
    return true;
  },

  giveSupplies: (survivor, obj) => {
    let helped = false;
    if (Game.resources.food >= 1) { Game.resources.food -= 1; helped = true; }
    if (Game.resources.water >= 1) { Game.resources.water -= 1; helped = true; }
    if (helped) {
      Game.stats.abandoned++;
      Log.add(`Diste suministros a ${survivor.name} y continuó a la deriva.`);
      Game.showFloatingText(obj.x, obj.z, 'Ayuda entregada');
    } else {
      Game.ignoreSurvivor(survivor, obj);
    }
    Game.removeEntity(obj);
  },

  ignoreSurvivor: (survivor, obj) => {
    Game.stats.abandoned++;
    Log.add(`Abandonaste a ${survivor.name}.`);
    Game.removeEntity(obj);
    Game.player.morale = Math.max(0, Game.player.morale - 5);
  },

  removeEntity: (obj) => {
    if (!obj) return;
    obj.collected = true;
    obj.pendingDecision = false;
    obj.marked = false;
    const idx = EntityManager.objects.indexOf(obj);
    if (idx >= 0) {
      obj.dispose(EntityManager.scene);
      EntityManager.objects.splice(idx, 1);
    }
  },

  // ---- Minijuego de pesca ----
  startFishing: (bank, hook) => {
    if (Game.fishing?.active || !bank || !hook || bank.fishing ||
        bank.active === false || bank.fishCount <= 0) return false;

    const marker = Util.rand(0.08, 0.2);
    Game.fishing = {
      active: true,
      bank,
      hook,
      marker,
      direction: 1,
      speed: 0.62,
      targetCenter: 0.65,
      targetWidth: 0.24,
      timeLeft: 7,
      duration: 7,
      hits: 0,
      misses: 0,
      precision: 0,
      pullRequested: false,
      cooldown: 0,
      feedback: '',
      feedbackTimer: 0,
      instruction: 'Espera a que el pez entre en la zona y tira.'
    };
    Game.pickFishingTarget();
    bank.fishing = true;
    hook.fishing = true;
    hook.returning = false;
    Game.paused = true;

    const panel = document.getElementById('fishing-panel');
    if (panel) {
      panel.classList.remove('hidden', 'success', 'failure');
    }
    const track = document.getElementById('fishing-track');
    if (track) track.classList.remove('success', 'failure');
    const button = document.getElementById('btn-fishing-pull');
    if (button?.focus) button.focus({ preventScroll: true });
    AudioSys.play('fish-bite');
    Game.updateFishingUI();
    return true;
  },

  pickFishingTarget: () => {
    const fishing = Game.fishing;
    if (!fishing?.active) return;
    const min = 0.18 + fishing.targetWidth * 0.5;
    const max = 0.82 - fishing.targetWidth * 0.5;
    let center = Util.rand(min, max);
    if (Math.abs(center - fishing.marker) < 0.2) {
      center = fishing.marker < 0.5 ? max : min;
    }
    fishing.targetCenter = Util.clamp(center, min, max);
  },

  requestFishingPull: () => {
    if (Game.fishing?.active) Game.fishing.pullRequested = true;
  },

  updateFishing: (dt) => {
    const fishing = Game.fishing;
    if (!fishing?.active) return;
    const safeDt = Math.max(0, Math.min(dt || 0, 0.1));

    if (Input.wasPressed('Escape')) {
      Game.cancelFishing(true);
      return;
    }
    if (Input.wasPressed('Space')) fishing.pullRequested = true;

    fishing.timeLeft = Math.max(0, fishing.timeLeft - safeDt);
    fishing.cooldown = Math.max(0, fishing.cooldown - safeDt);
    fishing.feedbackTimer = Math.max(0, fishing.feedbackTimer - safeDt);
    if (fishing.feedbackTimer <= 0) fishing.feedback = '';

    fishing.marker += fishing.direction * fishing.speed * safeDt;
    if (fishing.marker >= 0.96) {
      fishing.marker = 0.96;
      fishing.direction = -1;
    } else if (fishing.marker <= 0.04) {
      fishing.marker = 0.04;
      fishing.direction = 1;
    }

    if (fishing.pullRequested && fishing.cooldown <= 0) {
      fishing.pullRequested = false;
      fishing.cooldown = 0.32;
      const halfWidth = fishing.targetWidth * 0.5;
      const distance = Math.abs(fishing.marker - fishing.targetCenter);
      const hit = distance <= halfWidth;

      if (hit) {
        const precision = 1 - distance / Math.max(0.001, halfWidth);
        fishing.hits++;
        fishing.precision += precision;
        fishing.feedback = 'hit';
        fishing.instruction = fishing.hits >= 2
          ? '¡Pez asegurado!'
          : '¡Buen tirón! Prepárate para el siguiente.';
        AudioSys.play('fish-tug');
      } else {
        fishing.misses++;
        fishing.feedback = 'miss';
        fishing.instruction = fishing.misses >= 2
          ? 'El sedal perdió tensión.'
          : 'Demasiado pronto o demasiado tarde. Inténtalo otra vez.';
        AudioSys.play('fish-miss');
      }
      fishing.feedbackTimer = 0.38;

      if (fishing.hits >= 2) {
        Game.finishFishing(true, '¡Pez capturado!');
        return;
      }
      if (fishing.misses >= 2) {
        Game.finishFishing(false, 'El pez escapó tras dos tirones fallidos.');
        return;
      }

      fishing.targetWidth = Math.max(0.15, fishing.targetWidth - 0.035);
      fishing.speed = Math.min(0.95, fishing.speed + 0.08);
      Game.pickFishingTarget();
    }

    if (fishing.timeLeft <= 0) {
      Game.finishFishing(false, 'Se agotó el tiempo y el pez escapó.');
      return;
    }
    Game.updateFishingUI();
  },

  finishFishing: (success, message, announce = true) => {
    const fishing = Game.fishing;
    if (!fishing?.active) return false;
    const { bank, hook } = fishing;
    if (bank) bank.fishing = false;
    if (hook) {
      hook.fishing = false;
      hook.returning = true;
    }

    if (success) {
      const baseAmount = fishing.precision >= 1.35 ? 3 : 2;
      const amount = Math.round(baseAmount * (1 + CrewManager.getFishingBonus()) * 100) / 100;
      Game.resources.food += amount;
      let caughtFish = null;
      if (bank?.takeFishVisual) {
        const fishBefore = bank.fishCount;
        caughtFish = bank.takeFishVisual();
        // Conserva la lógica aunque un banco cargado de una versión anterior
        // no tenga sus peces visuales sincronizados.
        if (!caughtFish && bank.fishCount === fishBefore) {
          bank.fishCount = Math.max(0, bank.fishCount - 1);
          if (bank.fishCount <= 0) bank.active = false;
        }
      } else if (bank) {
        bank.fishCount = Math.max(0, bank.fishCount - 1);
        if (bank.fishCount <= 0) bank.active = false;
      }
      if (caughtFish && HookVis.attachCatch) HookVis.attachCatch(caughtFish);
      Game.showFloatingText(hook.x, hook.z, `+${Util.formatAmount(amount, 2)} comida`);
      AudioSys.play('fish-success');
      message = `${message} +${Util.formatAmount(amount, 2)} comida.`;
    } else {
      AudioSys.play('fish-fail');
    }

    const panel = document.getElementById('fishing-panel');
    if (panel) {
      panel.classList.add('hidden');
      panel.classList.remove('success', 'failure');
    }
    const track = document.getElementById('fishing-track');
    if (track) track.classList.remove('success', 'failure');
    Game.fishing = { active: false };
    Game.paused = false;
    if (announce && message) Game.showEventMessage(message);
    return success;
  },

  cancelFishing: (announce = true) => {
    if (!Game.fishing?.active) {
      const panel = document.getElementById('fishing-panel');
      if (panel) panel.classList.add('hidden');
      const track = document.getElementById('fishing-track');
      if (track) track.classList.remove('success', 'failure');
      return false;
    }
    return Game.finishFishing(false, 'Pesca cancelada.', announce);
  },

  updateFishingUI: () => GameUI.updateFishingUI(Game),

  showDecision: (title, text, options) => {
    Game.paused = true;
    const panel = document.getElementById('decision-panel');
    document.getElementById('decision-title').textContent = title;
    document.getElementById('decision-text').textContent = text;
    const btns = document.getElementById('decision-buttons');
    btns.innerHTML = '';
    for (const opt of options) {
      const b = document.createElement('button');
      b.textContent = opt.label;
      b.onclick = () => {
        panel.classList.add('hidden');
        Game.paused = false;
        opt.action();
        Game.updateUI();
      };
      btns.appendChild(b);
    }
    panel.classList.remove('hidden');
  },

  showEventMessage: (text) => GameUI.showEventMessage(Game, text),

  showFloatingText: (x, z, text, color = '#fff') => {
    FloatingText.add(x, 1.4, z, text, color);
  },

  reportDetachedModules: () => {
    const count = Game.raft.lastDetached || 0;
    if (count <= 0) return;
    const text = `${count} ${count === 1 ? 'módulo se desprendió' : 'módulos se desprendieron'}`;
    const center = Game.raft.getCenter();
    Game.showFloatingText(center.x, center.z, text, '#ef5350');
    Log.add(text[0].toUpperCase() + text.slice(1) + ' de la balsa.');
  },

  // ---- Actualización principal ----
  update: (dt) => GameSimulation.update(Game, dt),

  updateTime: (dt) => {
    Game.time += dt / SECONDS_PER_HOUR;
    if (Game.time >= HOURS_PER_DAY) {
      Game.time -= HOURS_PER_DAY;
      Game.endDay();
    }
    for (const key of Object.keys(Game.weatherTimers)) {
      Game.weatherTimers[key] = Math.max(0, Game.weatherTimers[key] - dt);
    }
    const starts = meanSeconds => Math.random() < 1 - Math.exp(-dt / meanSeconds);
    if (Game.zone !== 'storm' && Game.time > 18 && Game.weatherTimers.storm <= 0 && starts(150)) {
      Game.weatherTimers.storm = Util.rand(8, 18);
    }
    if (Game.time > 14 && Game.time < 20 && Game.weatherTimers.rain <= 0 && starts(100)) {
      Game.weatherTimers.rain = Util.rand(12, 28);
    }
    if (Game.zone === 'calm' && Game.time > 4 && Game.time < 9 && Game.weatherTimers.fog <= 0 && starts(120)) {
      Game.weatherTimers.fog = Util.rand(15, 35);
    }
    if (Game.zone === 'calm' && Game.time > 11 && Game.time < 15 && Game.weatherTimers.heat <= 0 && starts(120)) {
      Game.weatherTimers.heat = Util.rand(15, 30);
    }
    Game.storm = Game.zone === 'storm' || Game.weatherTimers.storm > 0;
    Game.rain = Game.storm || Game.weatherTimers.rain > 0;
    Game.fog = Game.weatherTimers.fog > 0;
    Game.heat = Game.weatherTimers.heat > 0;
  },

  updateZone: (dt) => {
    Game.zoneTimer -= dt;
    if (Game.zoneTimer <= 0) {
      Game.zoneTimer = Util.rand(40, 90);
      const prev = Game.zone;
      let next = Util.choice(ZONES);
      if (prev === 'storm' && next === 'storm') next = 'calm';
      Game.zone = next;
      Game.showEventMessage(Game.zoneName(next));
      Log.add(`Entras en ${Game.zoneName(next).toLowerCase()}.`);
    }
  },

  zoneName: (z) => {
    return {
      calm: 'Mar tranquilo',
      debris: 'Zona de restos',
      storm: 'Tormenta',
      fish: 'Banco de peces',
      polluted: 'Aguas contaminadas',
      sharks: 'Zona de tiburones',
      ship: 'Ruta de barcos',
      island: 'Cercanía de una isla'
    }[z] || z;
  },

  updatePlayer: (dt) => GameSimulation.updatePlayer(Game, dt),

  updateHook: (dt) => {
    const p = Game.player;
    if (!p.hook) { HookVis.hide(); return; }
    const h = p.hook;

    if (!isFinite(h.x) || !isFinite(h.z) || !isFinite(h.vx) || !isFinite(h.vz)) {
      if (h.object) h.object.marked = false;
      p.hook = null;
      HookVis.hide();
      return;
    }

    h.life += dt;
    if (h.life > 3.5) {
      if (h.object) h.object.marked = false;
      p.hook = null;
      HookVis.hide();
      return;
    }

    if (h.returning) {
      const angle = Math.atan2(p.z - h.z, p.x - h.x);
      h.x += Math.cos(angle) * p.hookSpeed * dt;
      h.z += Math.sin(angle) * p.hookSpeed * dt;
      if (h.object) {
        h.object.x = h.x;
        h.object.z = h.z;
        h.object.mesh.position.x = h.x;
        h.object.mesh.position.z = h.z;
      }
      if (Util.dist2(h.x, h.z, p.x, p.z) < 0.8) {
        if (h.object) Game.collectObject(h.object);
        p.hook = null;
        HookVis.hide();
      } else {
        HookVis.show(p.x, p.z, h.x, h.z);
      }
      return;
    }

    h.x += h.vx * dt;
    h.z += h.vz * dt;
    h.distance += Math.hypot(h.vx * dt, h.vz * dt);

    // Colisión con objetos
    for (const obj of EntityManager.objects) {
      if (Util.dist2(h.x, h.z, obj.x, obj.z) < obj.radius + 0.3) {
        h.object = obj;
        h.returning = true;
        obj.marked = true;
        break;
      }
    }

    // Colisión con bancos de peces
    if (!h.object) {
      for (const bank of EntityManager.fishBanks) {
        if (Util.dist2(h.x, h.z, bank.x, bank.z) < bank.radius) {
          if (Game.startFishing(bank, h)) {
            HookVis.show(p.x, p.z, h.x, h.z);
            return;
          }
        }
      }
    }

    if (h.distance >= h.maxRange) h.returning = true;

    HookVis.show(p.x, p.z, h.x, h.z);
  },

  updateEntities: (dt) => {
    const driftBonus = CrewManager.getDriftBonus();
    const sailEfficiency = Util.clamp(Game.raft.countProvides('sail'), 0, 1);
    const rudderEfficiency = Util.clamp(Game.raft.countProvides('rudder'), 0, 1);
    const motorEfficiency = Util.clamp(Game.raft.countProvides('motor'), 0, 1);
    const sailBonus = sailEfficiency * 0.5;
    const motorBonus = Game.victoryCondition === 'island' &&
      (Game.resources.fuel || 0) > 0
      ? motorEfficiency
      : 0;
    const loadMul = Game.loadSpeedMultiplier();
    const currentSpeed = (0.75 + driftBonus * 0.75 + sailBonus + motorBonus + Game.rowingBoost) * loadMul;
    const steeringSpeed = (sailBonus + motorBonus) * rudderEfficiency *
      Game.navigationHeading * NAVIGATION_BALANCE.lateralSteering;
    const currentSpeedZ = (Game.rowingBoostZ + steeringSpeed) * loadMul;
    Game.worldOffset += currentSpeed * dt;
    Game.worldOffsetZ += currentSpeedZ * dt;

    const center = Game.raft.getCenter();
    EntityManager.update(dt, center, Game.zone, Game.day, currentSpeed, currentSpeedZ, Game.elapsed);

    // Recogida automática SOLO cuando el objeto toca la balsa;
    // cualquier objeto más lejano requiere el gancho.
    const MARGIN = 0.15;
    for (let i = EntityManager.objects.length - 1; i >= 0; i--) {
      const o = EntityManager.objects[i];
      if (!o.marked && !o.pendingDecision && Game.raft.intersectsCircle(o.x, o.z, o.radius + MARGIN)) {
        Game.collectObject(o);
        if (Game.paused) break;
      }
    }

    // Colisiones de peligros con la balsa
    for (const d of EntityManager.dangers) {
      if (d.active && Game.raft.intersectsCircle(d.x, d.z, d.radius + 0.2)) {
        const dmg = Game.raft.takeDamage(12, d.x, d.z);
        Game.reportDetachedModules();
        Game.showEventMessage(`¡Tiburón golpea la balsa! -${Math.floor(dmg)} estructura`);
        AudioSys.play('damage');
        Particles.emit(d.x, 0.5, d.z, '#ff7043', 10, 3);
        Game.highlightsDirty = true;
        d.active = false;
      }
    }
  },

  updateProduction: (dt) => {
    const dayFraction = Math.max(0, dt) / DAY_REAL_SECONDS;
    if (Game.rain) {
      const rainCollectors = Game.raft.countProvides('rainWater');
      if (rainCollectors > 0) {
        Game.resources.water += rainCollectors * dayFraction;
      }
    }
    const autoFood = Game.raft.totalAutoFood();
    if (autoFood > 0) {
      Game.resources.food += autoFood * dayFraction;
    }
    const purifierWater = Game.raft.countProvides('purifiedWater');
    if (purifierWater > 0) {
      Game.resources.water += purifierWater * dayFraction;
    }
  },

  cargoWeight: () => {
    const weights = { wood: 0.25, plastic: 0.15, cloth: 0.1, metal: 0.4, rope: 0.15, food: 0.2, water: 0.3, fuel: 0.25 };
    return Object.entries(weights).reduce((total, [key, weight]) => {
      return total + Math.max(0, Game.resources[key] || 0) * weight;
    }, 0);
  },

  totalWeight: () => {
    return Game.raft.totalWeight() + CrewManager.totalWeight() + Game.cargoWeight();
  },

  loadSpeedMultiplier: () => {
    const maxWeight = Game.raft.maxWeight();
    const overloadRatio = Math.max(0, (Game.totalWeight() - maxWeight) / Math.max(1, maxWeight));
    return Math.max(0.35, 1 - overloadRatio * 0.75);
  },

  clampPlayerStats: () => {
    for (const key of ['health', 'hunger', 'thirst', 'morale', 'stamina', 'sanity']) {
      Game.player[key] = Util.clamp(Game.player[key], 0, 100);
    }
  },

  getDailyNeeds: () => GameSimulation.getDailyNeeds(Game),

  resolveDailySupplies: () => GameSimulation.resolveDailySupplies(Game),

  getNavigationState: () => GameSimulation.getNavigationState(Game),

  refuelMotor: () => GameSimulation.refuelMotor(Game),

  resolveNavigationDay: () => GameSimulation.resolveNavigationDay(Game),

  offerIslandRoute: () => GameSimulation.offerIslandRoute(Game),

  offerRadioRoute: () => GameSimulation.offerRadioRoute(Game),

  interact: () => {
    const p = Game.player;

    // Desmontar celda seleccionada
    if (Game.raft.selected) {
      const { gx, gy } = Game.raft.selected;
      if (gx === 0 && gy === 0) {
        Game.showFloatingText(p.x, p.z, 'No puedes demoler la tabla inicial');
      } else {
        const cell = Game.raft.get(gx, gy);
        if (cell) {
          const b = BUILDINGS[cell.buildingKey];
          if (!Game.raft.removeAt(gx, gy)) {
            Game.showFloatingText(p.x, p.z, 'No puedes separar la balsa', '#ef5350');
            Game.raft.selected = null;
            return;
          }
          for (const [k, v] of Object.entries(b.cost)) {
            Game.resources[k] = (Game.resources[k] || 0) + Math.max(0, Math.floor(v * 0.5));
          }
          Game.showFloatingText(p.x, p.z, `${b.name} desmontado`);
          AudioSys.play('build');
          Game.highlightsDirty = true;
          Game.updateBuildMenu();
          Game.updateUI();
        }
      }
      Game.raft.selected = null;
      return;
    }

    const { gx, gy } = Game.raft.worldToGrid(p.x, p.z);
    const cell = Game.raft.get(gx, gy);
    if (!cell) return;
    const b = BUILDINGS[cell.buildingKey];
    const maxHealth = cell.maxHealth || b.health;
    const efficiency = Game.raft.cellEfficiency(cell);

    // Una estructura dañada se repara antes de ejecutar su acción especial.
    if (cell.health < maxHealth && Game.resources.wood >= 1) {
      Game.resources.wood -= 1;
      Game.raft.repairAt(gx, gy, 15);
      Game.showFloatingText(p.x, p.z, 'Reparado');
      AudioSys.play('build');
      return;
    }

    if (efficiency <= 0) {
      Game.showFloatingText(p.x, p.z, 'Estructura inoperativa: necesita reparación', '#ef5350');
      return;
    }

    if (b.key === 'fire' || b.key === 'kitchen') {
      if (Game.resources.food >= 1) {
        Game.resources.food -= 1;
        const isKitchen = b.key === 'kitchen';
        const mealCredit = (isKitchen ? 1 : 0.8) * efficiency;
        Game.player.foodCredit = Math.min(
          SURVIVAL_BALANCE.playerFoodNeed,
          (Game.player.foodCredit || 0) + mealCredit
        );
        Game.player.hunger = Math.min(
          100,
          Game.player.hunger + (isKitchen ? 12 : 8) * efficiency
        );
        Game.player.health = Math.min(100, Game.player.health + (isKitchen ? 8 : 5) * efficiency);
        Game.showFloatingText(p.x, p.z, 'Ración cocinada y consumida');
        AudioSys.play('collect');
      } else {
        Game.showFloatingText(p.x, p.z, 'No tienes comida', '#ef5350');
      }
    } else if (b.key === 'medkit') {
      if (Game.resources.cloth >= 1 && Game.player.health < 100) {
        Game.resources.cloth -= 1;
        const healing = Math.round(25 * efficiency);
        Game.player.health = Math.min(100, Game.player.health + healing);
        Game.showFloatingText(p.x, p.z, `+${healing} salud`);
        AudioSys.play('collect');
      } else {
        Game.showFloatingText(p.x, p.z, Game.player.health >= 100 ? 'Ya estás sano' : 'Necesitas 1 tela', '#ef5350');
      }
    } else if (b.key === 'radio') {
      Game.offerRadioRoute();
    } else if (b.key === 'sail') {
      Game.offerIslandRoute();
    } else if (b.key === 'rudder') {
      const headings = [-1, 0, 1];
      const currentIndex = headings.reduce((best, value, index) =>
        Math.abs(value - Game.navigationHeading) < Math.abs(headings[best] - Game.navigationHeading)
          ? index
          : best, 0);
      Game.navigationHeading = headings[(currentIndex + 1) % headings.length];
      const label = Game.navigationHeading < 0 ? 'babor' : (Game.navigationHeading > 0 ? 'estribor' : 'recto');
      Game.showFloatingText(p.x, p.z, `Rumbo: ${label}`, '#4fc3f7');
      Log.add(`El timón fija el rumbo hacia ${label}.`);
    } else if (b.key === 'motor') {
      const canNavigate =
        Game.raft.countProvides('sail') > 0 &&
        Game.raft.countProvides('rudder') > 0;
      if ((Game.resources.fuel || 0) < NAVIGATION_BALANCE.motorFuelPerDay) {
        if (Game.refuelMotor()) {
          Game.showFloatingText(
            p.x,
            p.z,
            `+${NAVIGATION_BALANCE.plasticFuelYield} combustible (-1 plástico)`,
            '#ffca28'
          );
          Log.add('Conviertes una pieza de plástico en combustible para el motor.');
          return;
        }
        if (Game.victoryCondition !== 'island' && canNavigate) {
          Game.offerIslandRoute();
        } else {
          Game.showFloatingText(p.x, p.z, 'Necesitas 1 plástico para fabricar combustible', '#ef5350');
        }
        return;
      }
      if (Game.victoryCondition !== 'island' && canNavigate) {
        Game.offerIslandRoute();
        return;
      }
      if (Game.victoryCondition === 'island') {
        Game.showFloatingText(p.x, p.z, `Combustible: ${Game.resources.fuel.toFixed(1)}`, '#ffca28');
      } else {
        Game.showFloatingText(p.x, p.z, 'Necesitas vela y timón operativos');
      }
    }
  },

  endDay: () => {
    Game.day++;
    AudioSys.play('day');

    const storyNotes = CrewManager.resolveStoryEvents
      ? CrewManager.resolveStoryEvents(Game)
      : [];
    const workNotes = CrewManager.applyDailyWork
      ? CrewManager.applyDailyWork(Game)
      : [];
    const crewNotes = [...storyNotes, ...workNotes];
    for (const note of storyNotes) Log.add(note);
    if (workNotes.length) Log.add(`Trabajo de la tripulación: ${workNotes.join(' ')}`);

    const supplyReport = Game.resolveDailySupplies();
    const foodConsumed = supplyReport.foodConsumed;
    const waterConsumed = supplyReport.waterConsumed;
    if (Game.player.health <= 0) {
      Game.stats.deathCause = 'El personaje principal ha muerto';
      Game.triggerLose();
      return;
    }

    const heal = Game.raft.countProvides('heal');
    if (heal > 0) Game.player.health = Math.min(100, Game.player.health + heal);

    const rest = Game.raft.countProvides('rest');
    if (rest > 0) {
      Game.player.health = Math.min(100, Game.player.health + rest * 2);
      Game.player.morale = Math.min(100, Game.player.morale + 5);
    }
    if (Game.raft.totalShelter() > 0) Game.player.morale = Math.min(100, Game.player.morale + 5);

    const moraleBonus = CrewManager.getMoraleBonus();
    Game.player.morale = Math.min(100, Game.player.morale + moraleBonus * 10);

    Game.player.sanity -= 2;
    if (CrewManager.count() === 0) Game.player.sanity -= 4;
    else Game.player.sanity += CrewManager.count() * 2;
    if (Game.raft.totalShelter() > 0) Game.player.sanity += 3;

    Game.clampPlayerStats();

    const events = Game.pickDailyEvents();
    for (const ev of events) Game.applyEvent(ev);
    Game.clampPlayerStats();
    Game.checkWinLose();
    if (Game.state !== 'playing') return;
    if (Game.checkRouteVictory()) return;

    const radioEfficiency = Util.clamp(Game.raft.countProvides('radio'), 0, 1);
    if (Game.victoryCondition === 'radio' && radioEfficiency > 0) {
      const mastBonus = Game.raft.countProvides('mast') * 4;
      Game.rescuedSignal += (8 + mastBonus) * radioEfficiency;
      if (Game.rescuedSignal >= 100) {
        Game.triggerWin('radio');
        return;
      }
    }
    if (Game.victoryCondition === 'island') {
      Game.resolveNavigationDay();
      if (Game.state !== 'playing') return;
    }

    Game.updateObjective();
    Save.save(Game.getSaveData());
    Game.showDaySummary(foodConsumed, waterConsumed, events, crewNotes);
  },

  pickDailyEvents: () => {
    const list = [];
    if (Game.zone === 'storm') list.push('storm');
    if (Game.zone === 'sharks') list.push('shark');
    if (Game.zone === 'ship') list.push('ship');
    if (Game.zone === 'calm' && Math.random() < 0.2) list.push(Util.choice(['bird', 'ship']));
    if (Math.random() < 0.25) {
      const randomEvents = ['sick', 'lost', 'gift', 'debris', 'heat', 'wave'];
      if (CrewManager.count() > 0) randomEvents.push('argument');
      list.push(Util.choice(randomEvents));
    }
    if (!list.includes('argument') && Math.random() < CrewManager.getConflictChance()) list.push('argument');
    return list;
  },

  applyEvent: (ev) => {
    switch (ev) {
      case 'storm': {
        Game.showEventMessage('La tormenta azota la balsa.');
        AudioSys.play('storm');
        const dmg = Game.raft.takeDamage(10 + Game.day * 0.5);
        Game.reportDetachedModules();
        Game.player.health -= 5;
        Game.player.morale -= 10;
        Game.highlightsDirty = true;
        Log.add(`Tormenta causó ${Math.floor(dmg)} de daño estructural.`);
        break;
      }
      case 'shark': {
        Game.showEventMessage('Un tiburón ataca la balsa.');
        AudioSys.play('damage');
        const dmg2 = Game.raft.takeDamage(8);
        Game.reportDetachedModules();
        Game.highlightsDirty = true;
        Log.add(`Tiburón causó ${Math.floor(dmg2)} de daño.`);
        break;
      }
      case 'sick':
        Game.player.health -= 10;
        Game.player.morale -= 5;
        Log.add('Alguien ha enfermado por el agua.');
        break;
      case 'argument':
        Game.player.morale -= 12;
        Log.add('Discusión entre supervivientes.');
        break;
      case 'lost':
        if (CrewManager.count() > 0 && Math.random() < 0.3) {
          const victim = Util.choice(CrewManager.members.filter(m => m.alive));
          victim.health = Math.max(0, victim.health - 20);
          if (victim.health <= 0) {
            victim.alive = false;
            CrewManager.removeMesh(victim);
            victim.deathLogged = true;
            Log.add(`${victim.name} cayó al mar y no sobrevivió.`);
          } else {
            Log.add(`${victim.name} cayó al mar y resultó herido.`);
          }
        }
        break;
      case 'gift': {
        const res = Util.choice(['wood', 'food', 'water', 'rope']);
        Game.resources[res] += 2;
        Log.add(`Encontraste ${Util.resourceName(res)} flotando cerca.`);
        break;
      }
      case 'debris':
        Game.resources.wood += Util.randInt(2, 5);
        Log.add('Restos de un naufragio pasan cerca.');
        break;
      case 'heat':
        Game.showEventMessage('Calor extremo.');
        Game.player.thirst = Math.max(0, Game.player.thirst - 15);
        Game.player.morale -= 5;
        for (const m of CrewManager.members) if (m.alive) m.thirst = Math.max(0, m.thirst - 10);
        Log.add('Un día de calor extremo aumenta la sed.');
        break;
      case 'wave': {
        Game.showEventMessage('¡Ola gigante!');
        AudioSys.play('storm');
        const waveDmg = Game.raft.takeDamage(15 + Game.day * 0.5);
        Game.reportDetachedModules();
        Game.player.health -= 8;
        Game.player.morale -= 8;
        Game.highlightsDirty = true;
        Log.add(`Una ola gigante causó ${Math.floor(waveDmg)} de daño.`);
        break;
      }
      case 'bird':
        Game.showEventMessage('Un ave indica tierra cercana.');
        Game.player.morale = Math.min(100, Game.player.morale + 10);
        if (Game.victoryCondition === 'island') Game.islandDistance = Math.max(0, Game.islandDistance - 100);
        Log.add('Un ave sobrevuela la balsa, tal vez tierra esté cerca.');
        break;
      case 'ship':
        Game.showEventMessage('¡Barco a la distancia!');
        Game.player.morale = Math.min(100, Game.player.morale + 5);
        if (Game.raft.countProvides('radio') && Game.victoryCondition === 'radio') Game.rescuedSignal = Math.min(100, Game.rescuedSignal + 15);
        Log.add('Avistas un barco en el horizonte.');
        break;
    }
  },

  checkEvents: (dt) => {
    if (Game.storm && Math.random() < 1 - Math.exp(-dt / 18)) AudioSys.play('storm');
  },

  updateObjective: () => GameSimulation.updateObjective(Game),

  showDaySummary: (food, water, events, crewNotes = []) => {
    Game.paused = true;
    GameUI.showDaySummary(Game, food, water, events, crewNotes);
  },

  eventName: (ev) => {
    return {
      storm: 'tormenta', shark: 'ataque de tiburón', sick: 'enfermedad',
      argument: 'discusión', lost: 'accidente', gift: 'suministros', debris: 'restos',
      heat: 'calor extremo', wave: 'ola gigante', bird: 'ave cercana', ship: 'barco avistado'
    }[ev] || ev;
  },

  checkRouteVictory: () => GameSimulation.checkRouteVictory(Game),

  checkWinLose: () => {
    if (Game.player.health <= 0) {
      Game.stats.deathCause = 'El personaje principal ha muerto';
      Game.triggerLose();
      return;
    }
    if (Game.raft.totalArea() <= 0) {
      Game.stats.deathCause = 'La balsa fue destruida';
      Game.triggerLose();
      return;
    }
    if (Game.player.morale <= 0 && Game.day > 5) {
      Game.stats.deathCause = 'Motín: la moral colapsó';
      Game.triggerLose();
      return;
    }
  },

  triggerWin: (type) => {
    Game.paused = false;
    Game.closeAllModals();
    Game.state = 'end';
    AudioSys.play('win');
    const title = type === 'radio' ? '¡Rescatados!' : '¡Isla a la vista!';
    const cause = type === 'radio' ? 'Un barco respondió a tu señal de socorro.' : 'Alcanzaste tierra firme.';
    document.getElementById('end-title').textContent = title;
    document.getElementById('end-cause').textContent = cause;
    const score = Game.calculateScore(true);
    Save.saveBest(score);
    document.getElementById('end-stats').innerHTML = Game.endStatsHtml(true, score);
    Game.setState('end');
  },

  triggerLose: () => {
    Game.paused = false;
    Game.closeAllModals();
    Game.state = 'end';
    AudioSys.play('lose');
    document.getElementById('end-title').textContent = 'Fin de la partida';
    document.getElementById('end-cause').textContent = Game.stats.deathCause;
    const score = Game.calculateScore(false);
    Save.saveBest(score);
    document.getElementById('end-stats').innerHTML = Game.endStatsHtml(false, score);
    Game.setState('end');
  },

  calculateScore: (win) => {
    let s = Game.day * 50 + Game.stats.rescued * 100 + Game.stats.gathered * 5 + Game.raft.totalArea() * 30;
    if (win) s += 1000;
    return Math.floor(s);
  },

  endStatsHtml: (win, score) => GameUI.endStatsHtml(Game, win, score),

  updateUI: () => GameUI.updateUI(Game),

  setBar: (id, value) => GameUI.setBar(id, value),

  // ---- Highlights 3D (colocación, remo, selección) ----
  updateHighlights: () => {
    if (Game.raft.selected &&
        !Game.raft.has(Game.raft.selected.gx, Game.raft.selected.gy)) {
      Game.raft.selected = null;
    }
    GameRenderer.updateHighlights(Game);
  },

  elapsed: 0,

  // ---- Renderizado ----
  draw: (dt) => {
    GameRenderer.draw(Game, dt);
  }
};
