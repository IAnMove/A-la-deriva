/*****************************************************
 * game.js - Controlador y estado de la partida.
 * Las reglas agregadas, el DOM y el render 3D viven en módulos separados.
 *****************************************************/

const DAY_REAL_SECONDS = 240; // 4 minutos
const HOURS_PER_DAY = 24;
const SECONDS_PER_HOUR = DAY_REAL_SECONDS / HOURS_PER_DAY;

const ZONES = [
  'calm', 'debris', 'fish', 'calm', 'storm', 'sharks',
  'polluted', 'reef', 'calm', 'ship'
];

const DECISION_EVENT_KEYS = Object.freeze([
  'fire', 'contaminatedWater', 'sealedContainer', 'ghostShip',
  'fishMigration', 'current', 'outbreak', 'mutiny', 'whale',
  'distressFlare', 'gulls'
]);

const DAILY_EVENT_KEYS = Object.freeze([
  'storm', 'shark', 'sick', 'argument', 'lost', 'gift', 'debris',
  'heat', 'wave', 'bird', 'ship', ...DECISION_EVENT_KEYS
]);

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

  // Sistemas y carta náutica (chartX, chartZ en metros como fuente de verdad)
  worldSeed: 1,
  get seed() {
    return Game.worldSeed;
  },
  set seed(value) {
    Game.worldSeed = GameSimulation.normalizeSeed(value);
  },
  chartX: 0,
  chartZ: 0,
  chartVx: 0,
  chartVz: 0,
  currentSpeed: 0,
  currentSpeedZ: 0,
  currentVector: { x: 0.72, z: 0 },
  windVector: { x: 0.9, z: 0, angle: 0, strength: 0.9, sailAlignment: 1, sailFactor: 1.1, label: 'popa' },
  windAngle: 0,
  windStrength: 0.9,
  windX: 0.9,
  windZ: 0,
  windOverride: null,
  islandX: 285.94,
  islandZ: 90.89,
  islandBearing: 0.308,
  islandRevealed: false,
  islandIntelApplied: 0,
  rescueShipBearing: -0.62,
  regions: [],
  currentRegion: null,
  regionBlend: 0,
  rescuedSignal: 0,
  get islandDistance() {
    return GameSimulation.getIslandDistance(Game);
  },
  set islandDistance(value) {
    GameSimulation.setIslandDistance(Game, value);
  },
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
  infectionDays: 0,
  anchorDeployed: false,
  beaconLit: false,
  fishing: { active: false },
  crewConflict: { active: false },
  pendingDaySummary: null,
  pendingDayResolution: null,

  initChart: (seed = null) => GameSimulation.initChart(Game, seed),
  getCurrentAt: (x = Game.chartX, z = Game.chartZ) =>
    GameSimulation.getCurrentAt(Game.worldSeed, x, z),
  getWindAt: () => GameSimulation.getWindAt(Game),
  evaluateChartRegion: () => GameSimulation.evaluateChartRegion(Game),

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

  newGame: (seed = null) => {
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
    Game.radioIntel = 0;
    Game.navigationIntel = 0;
    Game.victoryCondition = null;
    Game.currentObjective = 0;
    Game.navigationHeading = 0;
    Game.worldOffset = 0;
    Game.worldOffsetZ = 0;
    Game.infectionDays = 0;
    Game.anchorDeployed = false;
    Game.beaconLit = false;
    Game.pendingDayResolution = null;
    Game.initChart(typeof seed === 'number' ? seed : null);
    GameSimulation.syncZoneFromChart(Game, true);
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
    Game.resumePendingDayResolution();
    return true;
  },

  loadFromSave: (data) => {
    if (Game.fishing?.active) Game.cancelFishing(false);
    const finite = (value, fallback = 0) => {
      const number = Number(value);
      return Number.isFinite(number) ? number : fallback;
    };
    Game.paused = false;
    Game.day = Util.clamp(Math.floor(finite(data.day, 1)), 1, 1000000);
    Game.time = Util.clamp(finite(data.time, 6), 0, 23.99);
    Game.zone = ZONES.includes(data.zone) ? data.zone : 'calm';
    Game.zoneTimer = Util.clamp(finite(data.zoneTimer, 30), 1, 86400);
    Game.weatherTimers = {
      storm: Util.clamp(
        finite(data.weatherTimers?.storm, data.storm ? 10 : 0),
        0,
        86400
      ),
      rain: Util.clamp(finite(data.weatherTimers?.rain), 0, 86400),
      fog: Util.clamp(finite(data.weatherTimers?.fog), 0, 86400),
      heat: Util.clamp(finite(data.weatherTimers?.heat), 0, 86400)
    };
    Game.resetPlayerState(data.player);
    const savedResources = data.resources || {};
    Game.resources = {};
    for (const key of RESOURCE_KEYS) {
      Game.resources[key] = Util.clamp(finite(savedResources[key]), 0, 1000000);
    }
    Game.stats = {
      rescued: Util.clamp(Math.floor(finite(data.stats?.rescued)), 0, 1000000),
      abandoned: Util.clamp(Math.floor(finite(data.stats?.abandoned)), 0, 1000000),
      gathered: Util.clamp(finite(data.stats?.gathered), 0, 1000000),
      maxRaftSize: Util.clamp(finite(data.stats?.maxRaftSize, 1), 1, 5000),
      deathCause: typeof data.stats?.deathCause === 'string'
        ? data.stats.deathCause.slice(0, 240)
        : ''
    };
    Game.rescuedSignal = Util.clamp(finite(data.rescuedSignal), 0, 100);
    Game.radioIntel = Util.clamp(finite(data.radioIntel), 0, 40);
    Game.navigationIntel = Util.clamp(finite(data.navigationIntel), 0, 120);
    Game.victoryCondition = ['radio', 'island'].includes(data.victoryCondition) ? data.victoryCondition : null;

    const savedSeed = finite(data.worldSeed, finite(data.seed, 1));
    Game.initChart(savedSeed > 0 ? savedSeed : 1);
    if (Number.isFinite(Number(data.islandX)) && Number.isFinite(Number(data.islandZ))) {
      Game.islandX = Util.clamp(Number(data.islandX), -10000000, 10000000);
      Game.islandZ = Util.clamp(Number(data.islandZ), -10000000, 10000000);
      Game.islandBearing = Math.atan2(Game.islandZ, Game.islandX);
    }
    Game.islandRevealed =
      data.islandRevealed === true || Game.victoryCondition === 'island';
    Game.islandIntelApplied = Util.clamp(finite(data.islandIntelApplied), 0, 120);

    if (Array.isArray(data.regions) && data.regions.length > 0) {
      Game.regions = data.regions
        .filter(r => r && typeof r === 'object' && CHART_REGION_TYPES.includes(r.type))
        .slice(0, 32)
        .map((r, idx) => ({
          id: typeof r.id === 'string' && r.id ? r.id.slice(0, 64) : `region-${idx}`,
          type: r.type,
          x: Util.clamp(finite(r.x), -10000000, 10000000),
          z: Util.clamp(finite(r.z), -10000000, 10000000),
          radius: Util.clamp(finite(r.radius, 26), 6, 500),
          borderWidth: Util.clamp(finite(r.borderWidth, 7), 2, 200),
          angle: Util.clamp(finite(r.angle), -Math.PI * 2, Math.PI * 2),
          length: Util.clamp(finite(r.length), 0, 500),
          visited: r.visited === true,
          discovered: r.discovered === true,
          reefsSpawned: r.reefsSpawned === true
        }));
      if (Game.regions.length === 0) {
        Game.regions = GameSimulation.buildRegions(
          Game.worldSeed,
          Game.islandX,
          Game.islandZ
        );
      }
    }

    const hasChartCoords =
      data.chartX !== undefined && data.chartX !== null &&
      data.chartZ !== undefined && data.chartZ !== null &&
      Number.isFinite(Number(data.chartX)) &&
      Number.isFinite(Number(data.chartZ));
    if (hasChartCoords) {
      Game.chartX = Util.clamp(Number(data.chartX), -10000000, 10000000);
      Game.chartZ = Util.clamp(Number(data.chartZ), -10000000, 10000000);
    } else {
      const legacyDist = Util.clamp(finite(data.islandDistance, 300), 0, 10000000);
      GameSimulation.placeOnIslandLine(Game, legacyDist);
    }
    GameSimulation.syncZoneFromChart(Game, true);
    if (!hasChartCoords && ZONES.includes(data.zone) && Game.zone === 'calm') {
      Game.zone = data.zone;
    }
    Game.storm = Game.zone === 'storm' || Game.weatherTimers.storm > 0;
    Game.rain = Game.storm || Game.weatherTimers.rain > 0;
    Game.fog = Game.weatherTimers.fog > 0;
    Game.heat = Game.weatherTimers.heat > 0;

    Game.currentObjective = Util.clamp(
      Math.floor(finite(data.currentObjective)),
      0,
      Game.objectives.length - 1
    );
    Game.worldOffset = Util.clamp(finite(data.worldOffset), -10000000, 10000000);
    Game.worldOffsetZ = Util.clamp(finite(data.worldOffsetZ), -10000000, 10000000);
    Game.navigationHeading = Util.clamp(
      finite(data.navigationHeading),
      -NAVIGATION_BALANCE.maxHeading,
      NAVIGATION_BALANCE.maxHeading
    );
    Game.infectionDays = Util.clamp(
      Math.floor(finite(data.infectionDays)),
      0,
      14
    );
    Game.anchorDeployed = data.anchorDeployed === true;
    Game.beaconLit = data.beaconLit === true;

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
        cell.maxHealth = Util.clamp(
          finite(v.maxHealth, BUILDINGS[v.buildingKey].health),
          BUILDINGS[v.buildingKey].health,
          10000
        );
        cell.health = Util.clamp(
          finite(v.health, cell.maxHealth),
          0,
          cell.maxHealth
        );
        Game.raft.tintDamaged(cell);
      }
    }
    if (Game.raft.grid.size === 0) Game.raft.placeAt(0, 0, 'floor', true);
    Game.raft.removeDetachedCells();
    if (Game.raft.countProvides('anchor') <= 0) Game.anchorDeployed = false;
    if (Game.raft.countProvides('beacon') <= 0) Game.beaconLit = false;
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
    Game.restoreSavedConflict(data);
    if (!Game.crewConflict.active) Game.restorePendingDayResolution(data);
    Game.highlightsDirty = true;
    Log.add('Partida cargada.');
  },

  restoreSavedConflict: (data) => {
    for (const member of CrewManager.members) member.hostile = false;
    const saved = data?.crewConflict;
    if (!saved?.active) return false;
    const finite = (value, fallback = 0) => {
      const number = Number(value);
      return Number.isFinite(number) ? number : fallback;
    };
    const memberIndex = Number(saved.memberIndex);
    if (!Number.isInteger(memberIndex)) return false;
    const member = CrewManager.members[memberIndex];
    if (!member?.alive) return false;

    let target = Game.player;
    if (saved.targetType === 'crew') {
      const targetIndex = Number(saved.targetIndex);
      const savedTarget = Number.isInteger(targetIndex)
        ? CrewManager.members[targetIndex]
        : null;
      if (savedTarget?.alive && savedTarget !== member) target = savedTarget;
    }
    member.hostile = true;
    Game.crewConflict = {
      active: true,
      member,
      target,
      cause: typeof saved.cause === 'string' && saved.cause
        ? saved.cause.slice(0, 160)
        : 'delirio por privación',
      tension: Util.clamp(finite(saved.tension, 62), 1, 100),
      timeLeft: Util.clamp(finite(saved.timeLeft, 9), 0.1, 12),
      pushCooldown: Util.clamp(finite(saved.pushCooldown), 0, 1),
      feedback: typeof saved.feedback === 'string' && saved.feedback
        ? saved.feedback.slice(0, 240)
        : 'La confrontación continúa.'
    };

    const summary = data?.pendingDaySummary;
    Game.pendingDaySummary = summary && typeof summary === 'object'
      ? {
          food: Util.clamp(finite(summary.food), 0, 1000000),
          water: Util.clamp(finite(summary.water), 0, 1000000),
          events: Array.isArray(summary.events)
            ? summary.events
                .slice(0, 12)
                .map(String)
                .filter(event => DAILY_EVENT_KEYS.includes(event))
            : [],
          crewNotes: Array.isArray(summary.crewNotes)
            ? summary.crewNotes
                .slice(0, 80)
                .map(note => String(note).slice(0, 500))
            : []
        }
      : null;
    Game.paused = true;
    const panel = document.getElementById('crew-conflict-panel');
    if (panel) panel.classList.remove('hidden');
    GameUI.updateCrewConflictUI(Game);
    return true;
  },

  restorePendingDayResolution: (data) => {
    const saved = data?.pendingDayResolution;
    if (!saved || typeof saved !== 'object') return false;
    const finite = (value, fallback = 0) => {
      const number = Number(value);
      return Number.isFinite(number) ? number : fallback;
    };
    const decisions = Array.isArray(saved.decisions)
      ? saved.decisions
          .slice(0, 8)
          .map(String)
          .filter(event => DECISION_EVENT_KEYS.includes(event))
      : [];
    const events = Array.isArray(saved.events)
      ? saved.events
          .slice(0, 16)
          .map(String)
          .filter(event => DAILY_EVENT_KEYS.includes(event))
      : [];
    const memberIndex = Number(saved.conflictMemberIndex);
    Game.pendingDayResolution = {
      food: Util.clamp(finite(saved.food), 0, 1000000),
      water: Util.clamp(finite(saved.water), 0, 1000000),
      events,
      crewNotes: Array.isArray(saved.crewNotes)
        ? saved.crewNotes.slice(0, 100).map(note => String(note).slice(0, 500))
        : [],
      decisions,
      conflictMemberIndex: Number.isInteger(memberIndex) ? memberIndex : -1,
      conflictCause: typeof saved.conflictCause === 'string'
        ? saved.conflictCause.slice(0, 160)
        : ''
    };
    return true;
  },

  getSaveData: () => {
    Game.syncStructureStates();
    const conflict = Game.crewConflict?.active
      ? {
          active: true,
          memberIndex: CrewManager.members.indexOf(Game.crewConflict.member),
          targetType:
            Game.crewConflict.target === Game.player ? 'player' : 'crew',
          targetIndex:
            Game.crewConflict.target === Game.player
              ? -1
              : CrewManager.members.indexOf(Game.crewConflict.target),
          cause: String(Game.crewConflict.cause || '').slice(0, 160),
          tension: Util.clamp(
            Number(Game.crewConflict.tension) || 0,
            0,
            100
          ),
          timeLeft: Util.clamp(
            Number(Game.crewConflict.timeLeft) || 0,
            0,
            12
          ),
          pushCooldown: Util.clamp(
            Number(Game.crewConflict.pushCooldown) || 0,
            0,
            1
          ),
          feedback: String(Game.crewConflict.feedback || '').slice(0, 240)
        }
      : null;
    const pendingDaySummary = conflict && Game.pendingDaySummary
      ? {
          food: Math.max(0, Number(Game.pendingDaySummary.food) || 0),
          water: Math.max(0, Number(Game.pendingDaySummary.water) || 0),
          events: Array.isArray(Game.pendingDaySummary.events)
            ? Game.pendingDaySummary.events.slice(0, 12).map(String)
            : [],
          crewNotes: Array.isArray(Game.pendingDaySummary.crewNotes)
            ? Game.pendingDaySummary.crewNotes
                .slice(0, 80)
                .map(note => String(note).slice(0, 500))
            : []
        }
      : null;
    const pendingDayResolution = Game.pendingDayResolution
      ? {
          food: Math.max(0, Number(Game.pendingDayResolution.food) || 0),
          water: Math.max(0, Number(Game.pendingDayResolution.water) || 0),
          events: Array.isArray(Game.pendingDayResolution.events)
            ? Game.pendingDayResolution.events
                .slice(0, 16)
                .filter(event => DAILY_EVENT_KEYS.includes(event))
            : [],
          crewNotes: Array.isArray(Game.pendingDayResolution.crewNotes)
            ? Game.pendingDayResolution.crewNotes
                .slice(0, 100)
                .map(note => String(note).slice(0, 500))
            : [],
          decisions: Array.isArray(Game.pendingDayResolution.decisions)
            ? Game.pendingDayResolution.decisions
                .slice(0, 8)
                .filter(event => DECISION_EVENT_KEYS.includes(event))
            : [],
          conflictMemberIndex: Number.isInteger(
            Game.pendingDayResolution.conflictMemberIndex
          )
            ? Game.pendingDayResolution.conflictMemberIndex
            : -1,
          conflictCause: String(
            Game.pendingDayResolution.conflictCause || ''
          ).slice(0, 160)
        }
      : null;
    return {
      day: Game.day,
      time: Game.time,
      zone: Game.zone,
      zoneTimer: Game.zoneTimer,
      storm: Game.storm,
      weatherTimers: Game.weatherTimers,
      worldSeed: Game.worldSeed,
      seed: Game.worldSeed,
      chartX: Game.chartX,
      chartZ: Game.chartZ,
      islandX: Game.islandX,
      islandZ: Game.islandZ,
      islandRevealed: Game.islandRevealed === true,
      islandIntelApplied: Game.islandIntelApplied || 0,
      regions: (Game.regions || []).map(r => ({
        id: String(r.id || ''),
        type: String(r.type || 'debris'),
        x: Number(r.x) || 0,
        z: Number(r.z) || 0,
        radius: Number(r.radius) || 26,
        borderWidth: Number(r.borderWidth) || 7,
        angle: Number(r.angle) || 0,
        length: Number(r.length) || 0,
        visited: Boolean(r.visited),
        discovered: Boolean(r.discovered),
        reefsSpawned: Boolean(r.reefsSpawned)
      })),
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
      crewConflict: conflict,
      pendingDaySummary,
      pendingDayResolution,
      rescuedSignal: Game.rescuedSignal,
      islandDistance: Game.islandDistance,
      radioIntel: Game.radioIntel,
      navigationIntel: Game.navigationIntel,
      navigationHeading: Game.navigationHeading,
      infectionDays: Game.infectionDays,
      anchorDeployed: Game.anchorDeployed,
      beaconLit: Game.beaconLit,
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

  syncStructureStates: () => {
    if (Game.anchorDeployed && Game.raft.countProvides('anchor') <= 0) {
      Game.anchorDeployed = false;
    }
    if (Game.beaconLit && Game.raft.countProvides('beacon') <= 0) {
      Game.beaconLit = false;
    }
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

    const contextButton = document.getElementById('btn-context-action');
    if (contextButton) contextButton.onclick = () => {
      if (Game.state === 'playing' && !Game.paused) { Game.interact(); Game.updateUI(); }
    };
    document.getElementById('btn-crew').onclick = () => {
      Game.paused = true;
      document.getElementById('crew-panel').classList.remove('hidden');
      Game.renderCrewPanel();
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
    if (fishingButton) {
      fishingButton.onclick = e => {
        if (e?.stopPropagation) e.stopPropagation();
        Game.requestFishingPull();
      };
    }
    const fishingPanel = document.getElementById('fishing-panel');
    if (fishingPanel) {
      fishingPanel.onpointerdown = e => {
        if (e?.button != null && e.button !== 0) return;
        Game.requestFishingPull();
      };
    }
    const conflictPush = document.getElementById('btn-conflict-push');
    if (conflictPush) conflictPush.onclick = Game.requestCrewConflictPush;
    const conflictRation = document.getElementById('btn-conflict-ration');
    if (conflictRation) conflictRation.onclick = Game.requestCrewConflictRation;

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
    const conflictPanel = document.getElementById('crew-conflict-panel');
    if (conflictPanel) conflictPanel.classList.add('hidden');
    Game.crewConflict = { active: false };
    Game.pendingDaySummary = null;
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

  renderCrewPanel: () => {
    GameUI.updateCrewOverview(Game);
    CrewManager.renderList(
      document.getElementById('crew-list'),
      (member, action) => {
        if (action === 'expel') {
          Game.expelCrewMember(member);
        } else {
          Save.save(Game.getSaveData());
        }
        GameUI.updateCrewOverview(Game);
        Game.renderCrewPanel();
      },
      (member, kind) => {
        Game.interactWithCrew(member, kind);
        Game.renderCrewPanel();
      }
    );
  },

  expelCrewMember: (member) => {
    if (!member?.alive || member.restrainedDays <= 0) return false;
    const confirmed = typeof window.confirm !== 'function' ||
      window.confirm(
        `¿Expulsar a ${member.name}? Perderás moral y no podrá regresar.`
      );
    if (!confirmed) return false;
    CrewManager.removeMesh(member);
    const index = CrewManager.members.indexOf(member);
    if (index >= 0) CrewManager.members.splice(index, 1);
    Game.stats.abandoned++;
    Game.player.morale = Math.max(0, Game.player.morale - 10);
    for (const crewMember of CrewManager.members) {
      if (crewMember.alive) {
        crewMember.morale = Math.max(0, crewMember.morale - 5);
        crewMember.trust = Math.max(0, crewMember.trust - 4);
      }
    }
    Log.add(`Expulsaste a ${member.name} tras la crisis.`);
    Save.save(Game.getSaveData());
    return true;
  },

  updateBuildMenu: () => {
    const menu = document.getElementById('build-menu');
    const list = document.getElementById('build-list');
    if (BuildManager.active) {
      Game.paused = true;
      menu.classList.remove('hidden');
      const carpenter = CrewManager.getConstructionDiscount();
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
      const carpenter = CrewManager.getConstructionDiscount();
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
      if (!Game.raft.canExpandTo(gx, gy)) {
        Game.showFloatingText(w.x, w.z, 'Completa el lateral actual primero', '#ef5350');
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
        const scarcity = k === 'food' || k === 'water' ? 0.88 : 1;
        const amount = Math.round(
          chanceOrAmount * scarcity * gatherBonus * 100
        ) / 100;
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
      `Has encontrado a ${survivor.name}.\nHabilidad: ${survivor.skill.name}. Rasgo: ${survivor.trait.name}. Tarea inicial: ${getCrewJob(survivor.job).name}.${storyText}\n\nRescatarlo añade su talento, pero también hasta 1 de comida y 1,3 de agua al consumo diario. La confianza, el estrés y la privación determinarán si colabora, estorba o entra en crisis.`,
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
    CrewManager.signalInteraction?.(survivor, 'welcome', Game.player, 4);
    Game.stats.rescued++;
    Log.add(
      `Has rescatado a ${survivor.name} (${survivor.skill.name}). ` +
      `Tarea inicial: ${getCrewJob(survivor.job).name}.`
    );
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

    // Vista de pesca: primera persona apuntando a la boya. Si ya estábamos
    // en primera persona solo se encuadra; al terminar se restaura.
    if (typeof World !== 'undefined' && World.enterFirstPerson &&
        World.findPlayerObject && World.findPlayerObject()) {
      if (!World.firstPerson) {
        World.enterFirstPerson();
        Game.fishing.autoFp = true;
      }
      World.fpYaw = Math.atan2(
        hook.x - Game.player.x,
        hook.z - Game.player.z
      );
      World.fpPitch = -0.42;
    }

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
    if (Input.wasPressed('Space') || Input.mouse?.clicked) {
      fishing.pullRequested = true;
    }

    // En primera persona el panel se compacta para no tapar la vista.
    const fpPanel = document.getElementById('fishing-panel');
    if (fpPanel?.classList) {
      fpPanel.classList.toggle(
        'fishing-fp',
        typeof World !== 'undefined' && !!World.firstPerson
      );
    }

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
      if (typeof PlayerVis !== 'undefined' && PlayerVis.pulseTug) {
        PlayerVis.pulseTug(hit);
      }

      if (hit) {
        const precision = 1 - distance / Math.max(0.001, halfWidth);
        fishing.hits++;
        fishing.precision += precision;
        fishing.feedback = 'hit';
        fishing.instruction = fishing.hits >= 2
          ? '¡Pez asegurado!'
          : '¡Buen tirón! Prepárate para el siguiente.';
        AudioSys.play('fish-tug');
        if (fishing.hook && typeof Particles !== 'undefined' && Particles.emit) {
          Particles.emit(fishing.hook.x, 0.3, fishing.hook.z, '#e1f5fe', 8, 2.6);
        }
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
      hook.life = 0;
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
      if (!caughtFish && typeof HookVis !== 'undefined' && HookVis.makeFallbackFish) {
        caughtFish = HookVis.makeFallbackFish();
      }
      if (hook) {
        hook.hasCatch = true;
        hook.catchStartDist = Math.max(
          1.2,
          Util.dist2(hook.x, hook.z, Game.player.x, Game.player.z)
        );
      }
      if (caughtFish && HookVis.attachCatch) HookVis.attachCatch(caughtFish);
      if (hook && typeof HookVis !== 'undefined' && HookVis.launchLeapingFish) {
        HookVis.launchLeapingFish(hook.x, hook.z, Game.player.x, Game.player.z);
      }
      Game.showFloatingText(hook.x, hook.z, `+${Util.formatAmount(amount, 2)} comida`);
      AudioSys.play('fish-success');
      message = `${message} +${Util.formatAmount(amount, 2)} comida.`;
    } else {
      AudioSys.play('fish-fail');
    }

    const panel = document.getElementById('fishing-panel');
    if (panel) {
      panel.classList.add('hidden');
      panel.classList.remove('success', 'failure', 'fishing-fp');
    }
    const track = document.getElementById('fishing-track');
    if (track) track.classList.remove('success', 'failure');
    // Salir de la vista de pesca solo si la puso el juego.
    if (fishing.autoFp && typeof World !== 'undefined' &&
        World.exitFirstPerson) {
      World.exitFirstPerson();
    }
    Game.fishing = { active: false };
    Game.paused = false;
    if (announce && message) Game.showEventMessage(message);
    return success;
  },

  cancelFishing: (announce = true) => {
    if (!Game.fishing?.active) {
      const panel = document.getElementById('fishing-panel');
      if (panel) panel.classList.add('hidden');
      if (panel) panel.classList.remove('fishing-fp');
      const track = document.getElementById('fishing-track');
      if (track) track.classList.remove('success', 'failure');
      return false;
    }
    return Game.finishFishing(false, 'Pesca cancelada.', announce);
  },

  updateFishingUI: () => GameUI.updateFishingUI(Game),

  startCrewConflict: (member, cause = 'delirio por privación') => {
    if (!member?.alive || Game.crewConflict?.active) return false;
    const guard = CrewManager.conflictSupport(member);
    const vulnerableCrew = CrewManager.members
      .filter(candidate => candidate.alive && candidate !== member)
      .sort((a, b) => a.health - b.health);
    const target = vulnerableCrew.length > 0 && member.criticalDays % 2 === 0
      ? vulnerableCrew[0]
      : Game.player;
    Game.crewConflict = {
      active: true,
      member,
      target,
      cause,
      tension: Util.clamp(62 - guard * 24, 42, 72),
      timeLeft: 9,
      pushCooldown: 0,
      feedback:
        guard > 0.1
          ? 'La guardia contiene parte del ataque. Pulsa E para ayudar.'
          : 'Usa una ración para calmarlo o pulsa E para empujarlo.'
    };
    Game.paused = true;
    const panel = document.getElementById('crew-conflict-panel');
    if (panel) panel.classList.remove('hidden');
    AudioSys.play('conflict-warning');
    Game.showEventMessage(`¡${member.name} se ha vuelto hostil!`);
    GameUI.updateCrewConflictUI(Game);
    return true;
  },

  updateCrewConflict: (dt) => {
    const conflict = Game.crewConflict;
    if (!conflict?.active) return;
    const safeDt = Math.max(0, Math.min(dt || 0, 0.1));
    conflict.timeLeft = Math.max(0, conflict.timeLeft - safeDt);
    conflict.pushCooldown = Math.max(0, conflict.pushCooldown - safeDt);
    conflict.tension = Math.min(100, conflict.tension + safeDt * 4.2);
    if (conflict.timeLeft <= 0 || conflict.tension >= 100) {
      Game.finishCrewConflict('failed');
      return;
    }
    GameUI.updateCrewConflictUI(Game);
  },

  requestCrewConflictPush: () => {
    const conflict = Game.crewConflict;
    if (!conflict?.active || conflict.pushCooldown > 0 ||
        Game.player.stamina < 8) return false;
    const energyBefore = Game.player.stamina;
    Game.player.stamina = Math.max(0, Game.player.stamina - 14);
    const guardAssist = CrewManager.conflictSupport(conflict.member) * 8;
    const force = 13 + energyBefore * 0.055 + guardAssist;
    conflict.tension = Math.max(0, conflict.tension - force);
    conflict.pushCooldown = 0.38;
    conflict.member.health = Math.max(1, conflict.member.health - 3);
    conflict.feedback =
      conflict.tension <= 0
        ? 'Has conseguido reducirlo sin matarlo.'
        : `Resiste. Peligro restante: ${Math.ceil(conflict.tension)}%.`;
    AudioSys.play('conflict-shove');
    if (conflict.tension <= 0) {
      Game.finishCrewConflict('restrained');
      return true;
    }
    GameUI.updateCrewConflictUI(Game);
    return true;
  },

  requestCrewConflictRation: () => {
    const conflict = Game.crewConflict;
    if (!conflict?.active || Game.resources.food < 0.5 ||
        Game.resources.water < 0.65) return false;
    Game.resources.food -= 0.5;
    Game.resources.water -= 0.65;
    const member = conflict.member;
    member.hunger = Util.clamp(member.hunger + 18, 0, 100);
    member.thirst = Util.clamp(member.thirst + 24, 0, 100);
    member.stress = Math.max(0, member.stress - 38);
    member.trust = Util.clamp(member.trust + 8, 0, 100);
    member.criticalDays = Math.max(0, member.criticalDays - 1);
    member.hallucinating = false;
    member.lastIncident = 'El grupo compartió una ración durante su crisis.';
    AudioSys.play('conflict-calm');
    Game.finishCrewConflict('calmed');
    return true;
  },

  finishCrewConflict: (outcome) => {
    const conflict = Game.crewConflict;
    if (!conflict?.active) return false;
    const member = conflict.member;
    let note;
    if (outcome === 'calmed') {
      member.hostile = false;
      note = `${member.name} recuperó el control tras recibir una ración.`;
    } else if (outcome === 'restrained') {
      member.hostile = false;
      member.restrainedDays = 1;
      member.stress = Math.max(38, member.stress - 22);
      member.trust = Math.max(0, member.trust - 10);
      member.morale = Math.max(0, member.morale - 6);
      member.lastIncident = 'Fue reducido durante una crisis y descansará un día.';
      note = `${member.name} fue reducido sin sufrir heridas graves.`;
    } else {
      member.hostile = false;
      member.restrainedDays = 1;
      member.trust = Math.max(0, member.trust - 14);
      member.stress = Math.max(45, member.stress - 12);
      const target = conflict.target || Game.player;
      const targetsPlayer = target === Game.player;
      const damage = targetsPlayer ? 34 : 55;
      target.health = Math.max(0, target.health - damage);
      if (targetsPlayer) {
        if (Game.player.health <= 0) {
          Game.stats.deathCause =
            `${member.name} mató al personaje durante una crisis a bordo`;
        }
        Game.player.morale = Math.max(0, Game.player.morale - 10);
      } else {
        Game.player.morale = Math.max(0, Game.player.morale - 12);
        if (target.health <= 0) {
          target.alive = false;
          target.deathLogged = true;
          CrewManager.removeMesh(target);
        }
      }
      const stolenFood = Math.min(Game.resources.food, 0.35);
      const stolenWater = Math.min(Game.resources.water, 0.5);
      Game.resources.food -= stolenFood;
      Game.resources.water -= stolenWater;
      const targetName = targetsPlayer ? 'al personaje principal' : `a ${target.name}`;
      member.lastIncident =
        `Hirió ${targetName} antes de que pudieran reducirlo.`;
      note = target.health <= 0 && !targetsPlayer
        ? `${member.name} mató a ${target.name} antes de ser reducido.`
        : `${member.name} hirió ${targetName} (-${damage} salud) antes de ser reducido.`;
      AudioSys.play('damage');
    }

    Log.add(note);
    const panel = document.getElementById('crew-conflict-panel');
    if (panel) panel.classList.add('hidden');
    Game.crewConflict = { active: false };
    Game.paused = false;
    Game.checkWinLose();
    if (Game.state !== 'playing') {
      Game.pendingDaySummary = null;
      return true;
    }
    Game.showEventMessage(note);
    const summary = Game.pendingDaySummary;
    Game.pendingDaySummary = null;
    Save.save(Game.getSaveData());
    if (summary) {
      summary.crewNotes.push(note);
      Game.showDaySummary(
        summary.food,
        summary.water,
        summary.events,
        summary.crewNotes
      );
    }
    return true;
  },

  showDecision: (title, text, options) => {
    Game.paused = true;
    if (document.pointerLockElement && typeof document.exitPointerLock === 'function') {
      document.exitPointerLock();
    }
    const panel = document.getElementById('decision-panel');
    document.getElementById('decision-title').textContent = title;
    document.getElementById('decision-text').textContent = text;
    const btns = document.getElementById('decision-buttons');
    btns.innerHTML = '';
    for (const opt of options) {
      const b = document.createElement('button');
      b.textContent = opt.label;
      b.disabled = opt.disabled === true;
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

  updateZone: () => {
    GameSimulation.syncZoneFromChart(Game, false);
  },

  zoneName: (z) => {
    return {
      calm: 'Mar tranquilo',
      debris: 'Zona de restos',
      storm: 'Tormenta',
      fish: 'Banco de peces',
      polluted: 'Aguas contaminadas',
      sharks: 'Zona de tiburones',
      reef: 'Arrecife de coral',
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
        HookVis.show(p.x, p.z, h.x, h.z, h);
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
    if (!h.object && !h.returning) {
      for (const bank of EntityManager.fishBanks) {
        if (Util.dist2(h.x, h.z, bank.x, bank.z) < bank.radius) {
          if (Game.startFishing(bank, h)) {
            HookVis.show(p.x, p.z, h.x, h.z, h);
            return;
          }
        }
      }
    }

    // Golpear a un tiburón con el gancho interrumpe su ataque. Esto ofrece
    // una defensa activa cuando la balsa aún es demasiado pequeña para huir.
    if (!h.object && !h.returning) {
      for (const danger of EntityManager.dangers) {
        if (!danger.active || danger.state === 'flee') continue;
        if (Util.dist2(h.x, h.z, danger.x, danger.z) >=
            danger.radius + 0.45) continue;
        if (typeof danger.scareFrom === 'function' &&
            danger.scareFrom(p.x, p.z)) {
          h.returning = true;
          Game.showEventMessage('¡Has ahuyentado al tiburón con el gancho!');
          Log.add('Un golpe de gancho hizo huir al tiburón.');
          AudioSys.play('shark-repel');
          Particles.emit(danger.x, 0.45, danger.z, '#e3f2fd', 14, 4);
        }
        break;
      }
    }

    if (h.distance >= h.maxRange) h.returning = true;

    HookVis.show(p.x, p.z, h.x, h.z, h);
  },

  updateEntities: (dt) => {
    if (Game.anchorDeployed && Game.raft.countProvides('anchor') <= 0) {
      Game.anchorDeployed = false;
      Log.add('El ancla dejó de sujetar la balsa al quedar inoperativa.');
    }
    if (Game.beaconLit && Game.raft.countProvides('beacon') <= 0) {
      Game.beaconLit = false;
      Log.add('El faro de señales se apagó al quedar inoperativo.');
    }
    const velocity = GameSimulation.computeChartVelocity(Game);
    const currentSpeed = velocity.vx;
    const currentSpeedZ = velocity.vz;
    if (Game._routeFixGrace > 0 && dt < 0.1) {
      Game._routeFixGrace = Math.max(0, Game._routeFixGrace - dt);
    } else {
      Game._routeFixGrace = 0;
      Game.chartX += currentSpeed * dt;
      Game.chartZ += currentSpeedZ * dt;
    }
    Game.worldOffset += currentSpeed * dt;
    Game.worldOffsetZ += currentSpeedZ * dt;
    GameSimulation.syncZoneFromChart(Game, false);

    const center = Game.raft.getCenter();
    const hazardTargets = Game.getHazardTargets();
    EntityManager.update(
      dt,
      center,
      Game.zone,
      Game.day,
      currentSpeed,
      currentSpeedZ,
      Game.elapsed,
      hazardTargets
    );

    for (const danger of EntityManager.dangers) {
      if (!danger.justLocked) continue;
      danger.justLocked = false;
      Game.showEventMessage(
        `¡Tiburón acechando a ${danger.targetName || 'la tripulación'}! ` +
        'Aléjate más de una casilla o usa el gancho.'
      );
      AudioSys.play('shark-warning');
    }

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

    // Los tiburones solo golpean durante una carga telegrafiada. Si entran a
    // una casilla de distancia de un personaje, lo devoran; si falla, dañan
    // el módulo alcanzado y el jugador ha esquivado el ataque.
    for (const d of EntityManager.dangers) {
      Game.resolveSharkAttack(d);
      if (Game.state !== 'playing') return;
    }

    for (const reef of EntityManager.reefs || []) {
      Game.resolveReefCollision(reef);
      if (Game.state !== 'playing') return;
    }
  },

  getHazardTargets: () => {
    const targets = [{
      id: 'player',
      type: 'player',
      name: 'ti',
      x: Game.player.x,
      z: Game.player.z,
      source: Game.player
    }];
    const cellSize = Game.raft.cellSize;
    for (let index = 0; index < CrewManager.members.length; index++) {
      const member = CrewManager.members[index];
      if (!member.alive || !Number.isFinite(member.gx) ||
          !Number.isFinite(member.gy)) continue;
      targets.push({
        id: `crew-${index}`,
        type: 'crew',
        name: member.name,
        x: (member.gx + 0.5) * cellSize,
        z: (member.gy + 0.5) * cellSize,
        source: member
      });
    }
    return targets;
  },

  resolveSharkAttack: (danger) => {
    if (!danger?.active || danger.resolved || danger.state !== 'charge' ||
        !Game.raft.intersectsCircle(
          danger.x,
          danger.z,
          danger.radius + 0.15
        )) return false;

    const sharkCell = Game.raft.worldToGrid(danger.x, danger.z);
    const victim = Game.getHazardTargets()
      .map(target => {
        const cell = Game.raft.worldToGrid(target.x, target.z);
        return {
          target,
          cellDistance: Math.max(
            Math.abs(cell.gx - sharkCell.gx),
            Math.abs(cell.gy - sharkCell.gy)
          ),
          distance: Util.dist2(danger.x, danger.z, target.x, target.z)
        };
      })
      .filter(entry => entry.cellDistance <= 1)
      .sort((a, b) => a.distance - b.distance)[0]?.target;

    if (victim?.type === 'player') {
      Game.player.health = 0;
      Game.stats.deathCause =
        'Un tiburón alcanzó y devoró al personaje principal';
      Game.showEventMessage('¡El tiburón te ha alcanzado!');
      Log.add('El tiburón alcanzó al personaje principal.');
      AudioSys.play('shark-bite');
    } else if (victim?.type === 'crew') {
      victim.source.health = 0;
      victim.source.alive = false;
      victim.source.deathLogged = true;
      CrewManager.removeMesh(victim.source);
      Game.player.morale = Math.max(0, Game.player.morale - 18);
      Game.showEventMessage(`¡El tiburón se ha llevado a ${victim.name}!`);
      Log.add(`${victim.name} fue devorado por un tiburón.`);
      AudioSys.play('shark-bite');
    } else {
      const damage = 20 + Math.min(18, Game.day * 0.8);
      const dealt = Game.raft.takeDamage(
        damage,
        danger.x,
        danger.z,
        'shark'
      );
      Game.reportDetachedModules();
      Game.showEventMessage(
        `Esquivaste al tiburón, pero golpeó la balsa (-${Math.floor(dealt)})`
      );
      Log.add(`El tiburón falló su presa y causó ${Math.floor(dealt)} de daño.`);
      AudioSys.play('damage');
      Game.highlightsDirty = true;
    }

    Particles.emit(danger.x, 0.5, danger.z, '#ff7043', 16, 4);
    if (typeof danger.beginFlee === 'function') {
      const center = Game.raft.getCenter();
      danger.beginFlee(center.x, center.z);
    } else {
      danger.resolved = true;
      danger.active = false;
    }
    Game.checkWinLose();
    return true;
  },

  resolveReefCollision: (reef) => {
    if (!reef?.active || reef.hit ||
        !Game.raft.intersectsCircle(
          reef.x,
          reef.z,
          reef.radius + 0.1
        )) return false;
    reef.hit = true;
    reef.active = false;
    const damage = 55 + Math.min(25, Game.day * 1.5);
    const dealt = Game.raft.takeDamage(
      damage,
      reef.x,
      reef.z,
      'reef'
    );
    Game.reportDetachedModules();
    Game.highlightsDirty = true;
    Game.showEventMessage(
      `¡La balsa ha encallado en el coral! -${Math.floor(dealt)} estructura`
    );
    Log.add(
      `El arrecife abrió la balsa y causó ${Math.floor(dealt)} de daño.`
    );
    AudioSys.play('reef-hit');
    Particles.emit(reef.x, 0.35, reef.z, '#ffca28', 20, 5);
    Game.checkWinLose();
    return true;
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

  resolveUnstoredSpoilage: () =>
    GameSimulation.resolveUnstoredSpoilage(Game),

  resolveDailySupplies: () => GameSimulation.resolveDailySupplies(Game),

  getNavigationState: () => GameSimulation.getNavigationState(Game),

  refuelMotor: () => GameSimulation.refuelMotor(Game),

  resolveNavigationDay: () => GameSimulation.resolveNavigationDay(Game),

  offerIslandRoute: () => GameSimulation.offerIslandRoute(Game),

  offerRadioRoute: () => GameSimulation.offerRadioRoute(Game),

  getInteractionContext: () => GameActions.context(Game),

  interactWithCrew: (member, kind) => GameActions.interactWithCrew(Game, member, kind),

  interact: () => {
    const p = Game.player;
    const context = Game.getInteractionContext();
    if (context?.kind === 'crew') {
      GameActions.openCrew(Game, context.member);
      return;
    }
    if (p.hook && !Game.raft.selected) {
      p.hook.returning = true;
      return;
    }

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
          Game.syncStructureStates();
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
    if (cell.health < maxHealth) {
      if (Game.resources.wood < 1) {
        Game.showFloatingText(p.x, p.z, 'Necesitas 1 madera para reparar', '#ef5350');
        return;
      }
      Game.resources.wood -= 1;
      Game.raft.repairAt(gx, gy, 15);
      Game.showFloatingText(p.x, p.z, 'Reparado · ' + Math.ceil(cell.health) + '/' + maxHealth + ' estructura');
      Particles.emit(p.x, 0.5, p.z, '#d6b17d', 8, 1.2);
      Game.updateUI();
      AudioSys.play('build');
      return;
    }

    if (efficiency <= 0) {
      Game.showFloatingText(p.x, p.z, 'Estructura inoperativa: necesita reparación', '#ef5350');
      return;
    }

    if (b.key === 'rain' || b.key === 'purifier') {
      if (p.thirst >= 100) Game.showFloatingText(p.x, p.z, 'Ya has bebido suficiente');
      else if (Game.resources.water < 0.5) Game.showFloatingText(p.x, p.z, 'Necesitas 0,5 agua', '#ef5350');
      else {
        Game.resources.water -= 0.5;
        p.thirst = Math.min(100, p.thirst + 20 * efficiency);
        Game.showFloatingText(p.x, p.z, 'Agua bebida · −0,5 agua', '#67d8ff');
        AudioSys.play('collect');
        Game.updateUI();
      }
    } else if (b.key === 'fire' || b.key === 'kitchen') {
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
    } else if (b.key === 'smokehouse') {
      if (Game.resources.food >= 1 && Game.resources.fuel >= 0.2) {
        Game.resources.food -= 1;
        Game.resources.fuel -= 0.2;
        Game.player.foodCredit = Math.min(
          SURVIVAL_BALANCE.playerFoodNeed,
          (Game.player.foodCredit || 0) + efficiency
        );
        Game.player.morale = Math.min(100, Game.player.morale + 3);
        Game.showFloatingText(p.x, p.z, 'Pescado ahumado y conservado');
        Log.add('El ahumadero convirtió una ración en comida segura para la jornada.');
        AudioSys.play('collect');
      } else {
        Game.showFloatingText(
          p.x,
          p.z,
          Game.resources.food < 1
            ? 'Necesitas 1 de comida'
            : 'Necesitas 0,2 de combustible',
          '#ef5350'
        );
      }
    } else if (b.key === 'medkit' || b.key === 'infirmary') {
      const isInfirmary = b.key === 'infirmary';
      if (isInfirmary && Game.infectionDays > 0 &&
          Game.resources.cloth >= 1 && Game.resources.water >= 0.5) {
        Game.resources.cloth -= 1;
        Game.resources.water -= 0.5;
        Game.infectionDays = 0;
        Game.player.health = Math.min(100, Game.player.health + 12 * efficiency);
        Game.showFloatingText(p.x, p.z, 'Infección tratada', '#66bb6a');
        Log.add('La enfermería detuvo la infección.');
        AudioSys.play('collect');
      } else if ((!isInfirmary || Game.infectionDays <= 0) &&
          Game.resources.cloth >= 1 && Game.player.health < 100) {
        Game.resources.cloth -= 1;
        const healing = Math.round((isInfirmary ? 34 : 25) * efficiency);
        Game.player.health = Math.min(100, Game.player.health + healing);
        Game.showFloatingText(p.x, p.z, `+${healing} salud`);
        AudioSys.play('collect');
      } else if (isInfirmary && Game.infectionDays > 0) {
        Game.showFloatingText(p.x, p.z, 'Necesitas 1 tela y 0,5 de agua', '#ef5350');
      } else {
        Game.showFloatingText(p.x, p.z, Game.player.health >= 100 ? 'Ya estás sano' : 'Necesitas 1 tela', '#ef5350');
      }
    } else if (b.key === 'anchor') {
      Game.anchorDeployed = !Game.anchorDeployed;
      GameSimulation.computeChartVelocity(Game);
      const state = Game.anchorDeployed ? 'desplegada' : 'recogida';
      Game.showFloatingText(p.x, p.z, `Ancla ${state}`, '#4fc3f7');
      Log.add(`El ancla queda ${state}.`);
      Save.save(Game.getSaveData());
    } else if (b.key === 'beacon') {
      if (!Game.beaconLit && Game.resources.fuel < 0.25) {
        Game.showFloatingText(p.x, p.z, 'Necesitas combustible para encenderlo', '#ef5350');
      } else {
        Game.beaconLit = !Game.beaconLit;
        Game.showFloatingText(
          p.x,
          p.z,
          Game.beaconLit ? 'Faro encendido' : 'Faro apagado',
          Game.beaconLit ? '#ffca28' : '#90a4ae'
        );
        Log.add(`El faro de señales queda ${Game.beaconLit ? 'encendido' : 'apagado'}.`);
        Save.save(Game.getSaveData());
      }
    } else if (b.key === 'harpoon') {
      const danger = (EntityManager.dangers || [])
        .filter(candidate => candidate.active && candidate.state !== 'flee')
        .sort((a, c) =>
          Util.dist2(p.x, p.z, a.x, a.z) -
          Util.dist2(p.x, p.z, c.x, c.z)
        )[0];
      if (!danger || Util.dist2(p.x, p.z, danger.x, danger.z) > 12) {
        Game.showFloatingText(p.x, p.z, 'No hay tiburones al alcance', '#90a4ae');
      } else {
        const hunted = danger.state === 'charge' ||
          Util.dist2(p.x, p.z, danger.x, danger.z) < 6;
        danger.scareFrom?.(p.x, p.z);
        if (hunted) Game.resources.food += 0.5 * efficiency;
        cell.health = Math.max(1, cell.health - 6);
        Game.raft.tintDamaged(cell);
        Game.showFloatingText(
          p.x,
          p.z,
          hunted ? 'Tiburón repelido · +0,5 comida' : 'Tiburón ahuyentado',
          '#ffca28'
        );
        Log.add('La arponera hizo huir a un tiburón.');
        AudioSys.play('shark-repel');
      }
    } else if (b.key === 'chart') {
      const route = Game.victoryCondition === 'island'
        ? `Isla a ${Math.max(0, Game.islandDistance).toFixed(0)} m.`
        : 'Aún no has fijado una ruta a tierra.';
      Game.showFloatingText(p.x, p.z, route, '#4fc3f7');
      Log.add(`La mesa de navegación confirma el rumbo. ${route}`);
    } else if (b.key === 'containment') {
      const restrained = CrewManager.members.filter(member =>
        member.alive && member.restrainedDays > 0
      ).length;
      Game.showFloatingText(
        p.x,
        p.z,
        restrained > 0
          ? `${restrained} tripulante(s) bajo vigilancia`
          : 'Celda preparada · la tripulación desconfía',
        restrained > 0 ? '#ffca28' : '#90a4ae'
      );
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
      GameSimulation.computeChartVelocity(Game);
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

  applyDailyBuildingEffects: (crewNotes = []) => {
    const note = (text) => {
      crewNotes.push(text);
      Log.add(text);
    };
    const infirmary = Util.clamp(
      Game.raft.countProvides('infirmary'),
      0,
      2
    );
    if (Game.infectionDays > 0) {
      const damage = infirmary > 0 ? 2 : 7;
      Game.player.health = Math.max(0, Game.player.health - damage);
      Game.infectionDays = Math.max(
        0,
        Game.infectionDays - (infirmary > 0 ? 2 : 1)
      );
      note(
        infirmary > 0
          ? `La enfermería contiene la infección (-${damage} salud).`
          : `La infección empeora (-${damage} salud, ${Game.infectionDays} día(s) restantes).`
      );
    }

    if (infirmary > 0) {
      const injured = CrewManager.members
        .filter(member => member.alive && member.health < 100)
        .sort((a, b) => a.health - b.health)[0];
      if (injured) {
        const healed = Math.min(100 - injured.health, 4 * infirmary);
        injured.health += healed;
        note(`La enfermería atendió a ${injured.name} (+${healed.toFixed(0)} salud).`);
      }
    }

    const bunks = Math.floor(Game.raft.countProvides('bunk'));
    const aliveCrew = CrewManager.members.filter(member => member.alive);
    for (let index = 0; index < aliveCrew.length; index++) {
      const member = aliveCrew[index];
      if (index < bunks) {
        member.stress = Math.max(0, member.stress - 7);
        member.morale = Math.min(100, member.morale + 3);
      } else if (bunks > 0) {
        member.stress = Math.min(100, member.stress + 4);
        member.morale = Math.max(0, member.morale - 3);
      }
    }
    if (bunks > 0 && aliveCrew.length > bunks) {
      note('Faltan literas para toda la tripulación; aparecen celos y tensión.');
    }

    const containment = Game.raft.countProvides('containment');
    if (containment > 0) {
      const crisisAboard = aliveCrew.some(member =>
        member.hostile || member.restrainedDays > 0
      );
      if (crisisAboard) {
        for (const member of aliveCrew) {
          if (member.restrainedDays > 0) {
            member.stress = Math.max(0, member.stress - 6 * containment);
          }
        }
      } else {
        Game.player.morale = Math.max(0, Game.player.morale - containment);
        for (const member of aliveCrew) {
          member.trust = Math.max(0, member.trust - containment);
        }
        note('La celda vacía inquieta a la tripulación y reduce su confianza.');
      }
    }

    if (Game.beaconLit) {
      const beacon = Util.clamp(
        Game.raft.countProvides('beacon'),
        0,
        1.5
      );
      const fuelNeeded = 0.35;
      if (beacon <= 0 || Game.resources.fuel < fuelNeeded) {
        Game.beaconLit = false;
        note('El faro de señales se apaga por falta de combustible.');
      } else {
        Game.resources.fuel -= fuelNeeded;
        if (Game.victoryCondition === 'radio') {
          Game.rescuedSignal = Math.min(
            100,
            Game.rescuedSignal + 4 * beacon
          );
        } else {
          Game.radioIntel = Math.min(40, Game.radioIntel + 2 * beacon);
        }
        note('El faro consume 0,35 de combustible y proyecta una señal sobre el mar.');
      }
    }

    if (Game.anchorDeployed && Game.storm) {
      const anchorEntry = Array.from(Game.raft.grid.entries())
        .find(([, cell]) => cell.buildingKey === 'anchor');
      if (anchorEntry) {
        const [gx, gy] = anchorEntry[0].split(',').map(Number);
        const position = Game.raft.getCellWorldPos(gx, gy);
        const damage = Game.raft.takeDamage(
          12,
          position.x + Game.raft.cellSize * 0.5,
          position.z + Game.raft.cellSize * 0.5,
          'generic'
        );
        note(`La tormenta tensa el ancla y causa ${Math.floor(damage)} de daño.`);
        if (Game.raft.countProvides('anchor') <= 0) {
          Game.anchorDeployed = false;
        }
      }
    }

    if (Game.storm) {
      const lookoutEntry = Array.from(Game.raft.grid.entries())
        .find(([, cell]) => cell.buildingKey === 'lookout');
      if (lookoutEntry) {
        const [gx, gy] = lookoutEntry[0].split(',').map(Number);
        const position = Game.raft.getCellWorldPos(gx, gy);
        Game.raft.takeDamage(
          7,
          position.x + Game.raft.cellSize * 0.5,
          position.z + Game.raft.cellSize * 0.5,
          'generic'
        );
        note('El viento castiga la torre de vigía.');
      }
    }
    Game.reportDetachedModules();
    return crewNotes;
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
    const spoilageNote = Game.resolveUnstoredSpoilage();
    if (spoilageNote) {
      crewNotes.push(spoilageNote);
      Log.add(spoilageNote);
    }

    const supplyReport = Game.resolveDailySupplies();
    const foodConsumed = supplyReport.foodConsumed;
    const waterConsumed = supplyReport.waterConsumed;
    Game.applyDailyBuildingEffects(crewNotes);
    if (Game.player.health <= 0) {
      Game.stats.deathCause = 'El personaje principal ha muerto';
      Game.triggerLose();
      return;
    }
    const behaviorReport = CrewManager.resolveDailyBehavior
      ? CrewManager.resolveDailyBehavior(Game)
      : { messages: [], conflict: null };
    crewNotes.push(...behaviorReport.messages);
    for (const note of behaviorReport.messages) Log.add(note);
    Game.reportDetachedModules();

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
    const decisions = [];
    for (const ev of events) {
      if (DECISION_EVENT_KEYS.includes(ev)) decisions.push(ev);
      else Game.applyEvent(ev);
    }
    Game.clampPlayerStats();
    Game.checkWinLose();
    if (Game.state !== 'playing') return;
    if (Game.checkRouteVictory()) return;
    const conflictMemberIndex = behaviorReport.conflict
      ? CrewManager.members.indexOf(behaviorReport.conflict.member)
      : -1;
    const resolution = {
      food: foodConsumed,
      water: waterConsumed,
      events,
      crewNotes: [...crewNotes],
      decisions,
      conflictMemberIndex,
      conflictCause: behaviorReport.conflict?.cause || ''
    };
    if (decisions.length > 0) {
      Game.pendingDayResolution = resolution;
      Save.save(Game.getSaveData());
      Game.resumePendingDayResolution();
      return;
    }
    Game.finishDayResolution(resolution);
  },

  finishDayResolution: (resolution = Game.pendingDayResolution) => {
    if (!resolution) return false;
    Game.pendingDayResolution = null;
    Game.syncStructureStates();
    Game.clampPlayerStats();
    Game.checkWinLose();
    if (Game.state !== 'playing') return false;
    if (Game.checkRouteVictory()) return true;

    const radioEfficiency = Util.clamp(Game.raft.countProvides('radio'), 0, 1);
    if (Game.victoryCondition === 'radio' && radioEfficiency > 0) {
      const mastBonus = Game.raft.countProvides('mast') * 4;
      Game.rescuedSignal += (8 + mastBonus) * radioEfficiency;
      if (Game.rescuedSignal >= 100) {
        Game.triggerWin('radio');
        return true;
      }
    }
    if (Game.victoryCondition === 'island') {
      Game.resolveNavigationDay();
      if (Game.state !== 'playing') return true;
    }

    Game.updateObjective();
    const conflictMember = Number.isInteger(resolution.conflictMemberIndex)
      ? CrewManager.members[resolution.conflictMemberIndex]
      : null;
    if (conflictMember) {
      const alreadyContained =
        conflictMember.restrainedDays > 0 || !conflictMember.alive;
      const started = !alreadyContained && Game.startCrewConflict(
        conflictMember,
        resolution.conflictCause
      );
      if (started) {
        Game.pendingDaySummary = {
          food: resolution.food,
          water: resolution.water,
          events: resolution.events,
          crewNotes: [...resolution.crewNotes]
        };
        Save.save(Game.getSaveData());
        return true;
      }
      conflictMember.hostile = false;
      if (alreadyContained && conflictMember.alive) {
        resolution.crewNotes.push(
          `${conflictMember.name} quedó contenido antes de iniciar la crisis.`
        );
      }
      Game.pendingDaySummary = null;
    }
    Save.save(Game.getSaveData());
    Game.showDaySummary(
      resolution.food,
      resolution.water,
      resolution.events,
      resolution.crewNotes
    );
    return true;
  },

  resumePendingDayResolution: () => {
    const pending = Game.pendingDayResolution;
    if (!pending || Game.state !== 'playing') return false;
    if (!Array.isArray(pending.decisions) || pending.decisions.length === 0) {
      return Game.finishDayResolution(pending);
    }
    const eventKey = pending.decisions[0];
    const definition = Game.getDecisionEventDefinition(eventKey);
    if (!definition) {
      pending.decisions.shift();
      Save.save(Game.getSaveData());
      return Game.resumePendingDayResolution();
    }
    Game.showDecision(
      definition.title,
      definition.text,
      definition.options.map(option => ({
        label: option.label,
        action: () => Game.resolveDailyEventDecision(eventKey, option.id)
      }))
    );
    return true;
  },

  resolveDailyEventDecision: (eventKey, optionId) => {
    const pending = Game.pendingDayResolution;
    if (!pending || pending.decisions?.[0] !== eventKey) return false;
    const definition = Game.getDecisionEventDefinition(eventKey);
    if (!definition?.options.some(option => option.id === optionId)) {
      return false;
    }
    const result = Game.applyDecisionEventOutcome(eventKey, optionId);
    pending.decisions.shift();
    if (result) {
      pending.crewNotes.push(result);
      Log.add(result);
      Game.showEventMessage(result);
    }
    Game.clampPlayerStats();
    Game.checkWinLose();
    if (Game.state !== 'playing') return true;
    Save.save(Game.getSaveData());
    return Game.resumePendingDayResolution();
  },

  getDecisionEventDefinition: (eventKey) => {
    const has = key => Game.raft.countProvides(key) > 0;
    const options = (...items) => items.filter(Boolean);
    const definitions = {
      fire: {
        title: '¡Incendio a bordo!',
        text: 'Las llamas pueden destruir un módulo y propagarse. Elige cómo sofocarlas.',
        options: options(
          Game.resources.water >= 1 && {
            id: 'water',
            label: 'Usar 1 de agua · daño mínimo'
          },
          {
            id: 'cut',
            label: 'Cortar el módulo en llamas · perder estructura'
          },
          {
            id: 'smother',
            label: 'Sofocarlo a mano · arriesgar salud'
          }
        )
      },
      contaminatedWater: {
        title: 'Agua contaminada',
        text: 'Encuentras un depósito turbio. Puede salvar las reservas o provocar una infección.',
        options: options(
          has('cook') && {
            id: 'boil',
            label: 'Hervirla · obtener 0,8 de agua segura'
          },
          {
            id: 'drink',
            label: 'Guardarla y beber · +1 agua, riesgo de infección'
          },
          { id: 'discard', label: 'Desecharla' }
        )
      },
      sealedContainer: {
        title: 'Contenedor sellado',
        text: 'Una caja industrial golpea la balsa. Dentro se oyen piezas sueltas.',
        options: options(
          Game.resources.metal >= 1 && {
            id: 'tools',
            label: 'Gastar 1 metal y abrir con cuidado'
          },
          { id: 'force', label: 'Forzar la tapa · riesgo de heridas' },
          { id: 'leave', label: 'Dejarla pasar' }
        )
      },
      ghostShip: {
        title: 'Barco fantasma',
        text: 'Un casco abandonado deriva cerca. Hay suministros, pero también manchas y silencio.',
        options: [
          { id: 'explore', label: 'Explorar el interior · botín y riesgo' },
          { id: 'salvage', label: 'Recoger restos desde fuera' },
          { id: 'avoid', label: 'Mantener la distancia' }
        ]
      },
      fishMigration: {
        title: 'Migración de peces',
        text: 'El agua hierve de peces durante unas horas. Detenerse da más comida, pero retrasa el viaje.',
        options: options(
          has('anchor') && {
            id: 'stop',
            label: 'Echar el ancla · +2,5 comida'
          },
          { id: 'moving', label: 'Pescar en marcha · +1 comida' },
          { id: 'ignore', label: 'Mantener el rumbo' }
        )
      },
      current: {
        title: 'Corriente marina',
        text: 'Una corriente fuerte puede acelerar la ruta o lanzar la balsa contra restos y arrecifes.',
        options: options(
          has('forecast') && has('rudder') && {
            id: 'steer',
            label: 'Leerla y gobernar · avance seguro'
          },
          has('anchor') && {
            id: 'anchor',
            label: 'Desplegar el ancla · resistir'
          },
          {
            id: 'row',
            label: 'Remar contra ella · agotamiento'
          },
          { id: 'ride', label: 'Dejarse llevar · mucho avance y daños' }
        )
      },
      outbreak: {
        title: 'Brote infeccioso',
        text: 'La fiebre aparece entre la tripulación. Sin una respuesta rápida puede alcanzarte.',
        options: options(
          has('infirmary') &&
            Game.resources.cloth >= 1 &&
            Game.resources.water >= 0.5 && {
              id: 'treat',
              label: 'Enfermería · 1 tela y 0,5 agua'
            },
          has('containment') && {
            id: 'isolate',
            label: 'Aislar al enfermo · aumenta tensión'
          },
          Game.resources.food >= 0.5 &&
            Game.resources.water >= 1 && {
              id: 'care',
              label: 'Cuidados básicos · 0,5 comida y 1 agua'
            },
          {
            id: 'separate',
            label: 'Separar a los enfermos con medios improvisados'
          },
          { id: 'ignore', label: 'Esperar · infección probable' }
        )
      },
      mutiny: {
        title: 'Conato de motín',
        text: 'La tripulación cuestiona tus decisiones. La confianza y las reservas están en juego.',
        options: options(
          Game.resources.food >= 1 &&
            Game.resources.water >= 1.3 && {
              id: 'negotiate',
              label: 'Compartir reservas · 1 comida y 1,3 agua'
            },
          (has('containment') || CrewManager.guardStrength() > 0) && {
            id: 'contain',
            label: 'Contener a los cabecillas'
          },
          {
            id: 'appease',
            label: 'Prometer cambios · perder autoridad'
          },
          { id: 'confront', label: 'Enfrentarte · riesgo de heridas' }
        )
      },
      whale: {
        title: 'Una ballena junto a la balsa',
        text: 'La ballena remueve bancos de peces. Acercarse demasiado puede volcar módulos.',
        options: options(
          has('forecast') && {
            id: 'follow',
            label: 'Seguirla con la carta · comida y rumbo'
          },
          { id: 'approach', label: 'Acercarse a pescar · gran botín y golpe' },
          { id: 'keep', label: 'Observar desde lejos' }
        )
      },
      distressFlare: {
        title: 'Llamarada de auxilio',
        text: 'Alguien pide ayuda desde una pequeña balsa. Rescatarlo consume suministros.',
        options: options(
          Game.resources.food >= 1 &&
            Game.resources.water >= 1.3 &&
            CrewManager.members.length < CrewManager.MAX_MEMBERS && {
              id: 'rescue',
              label: 'Rescatar · 1 comida y 1,3 agua'
            },
          (has('beacon') || has('radio')) && {
            id: 'signal',
            label: 'Responder con señales'
          },
          CrewManager.members.length < CrewManager.MAX_MEMBERS && {
            id: 'tow',
            label: 'Remolcarlo sin reservas · riesgo físico'
          },
          { id: 'ignore', label: 'No desviarse' }
        )
      },
      gulls: {
        title: 'Bandada de gaviotas',
        text: 'Las aves intentan robar comida, pero su dirección podría señalar tierra.',
        options: options(
          (has('lookout') || has('forecast')) && {
            id: 'follow',
            label: 'Seguir la bandada · buscar tierra'
          },
          { id: 'protect', label: 'Proteger las reservas' },
          { id: 'trap', label: 'Improvisar una trampa · comida y moral' }
        )
      }
    };
    return definitions[eventKey] || null;
  },

  applyDecisionEventOutcome: (eventKey, optionId) => {
    const damageAtBuilding = (keys, amount, type = 'generic') => {
      const entry = Array.from(Game.raft.grid.entries())
        .find(([, cell]) => keys.includes(cell.buildingKey));
      const healthBefore = Array.from(Game.raft.grid.values())
        .reduce((sum, cell) => sum + Math.max(0, cell.health), 0);
      if (!entry) {
        Game.raft.takeDamage(amount, null, null, type);
      } else {
        const [gx, gy] = entry[0].split(',').map(Number);
        const position = Game.raft.getCellWorldPos(gx, gy);
        Game.raft.takeDamage(
          amount,
          position.x + Game.raft.cellSize * 0.5,
          position.z + Game.raft.cellSize * 0.5,
          type
        );
      }
      const healthAfter = Array.from(Game.raft.grid.values())
        .reduce((sum, cell) => sum + Math.max(0, cell.health), 0);
      return Math.max(0, healthBefore - healthAfter);
    };
    const healthiestCrew = () => CrewManager.members
      .filter(member => member.alive)
      .sort((a, b) => b.health - a.health)[0];
    const mostStressedCrew = () => CrewManager.members
      .filter(member => member.alive)
      .sort((a, b) => b.stress - a.stress)[0];

    if (eventKey === 'fire') {
      if (optionId === 'water') {
        Game.resources.water -= 1;
        const spottedEarly = Game.raft.countProvides('lookout') > 0;
        const damage = damageAtBuilding(
          ['fire', 'kitchen', 'smokehouse', 'lookout', 'sail', 'bunk'],
          spottedEarly ? 2 : 4,
          'fire'
        );
        return `El agua apaga el incendio; las llamas causan ${Math.floor(damage)} de daño.`;
      }
      if (optionId === 'cut') {
        const damage = damageAtBuilding(
          ['fire', 'kitchen', 'smokehouse', 'lookout', 'sail', 'bunk'],
          999,
          'fire'
        );
        Game.reportDetachedModules();
        return `Cortaste la zona en llamas antes de que se propagara (-${Math.floor(damage)} estructura).`;
      }
      Game.player.health -= 10;
      const spottedEarly = Game.raft.countProvides('lookout') > 0;
      const damage = damageAtBuilding(
        ['fire', 'kitchen', 'smokehouse', 'lookout', 'sail', 'bunk'],
        spottedEarly ? 8 : 12,
        'fire'
      );
      return `Sofocaste el incendio a mano (-10 salud, -${Math.floor(damage)} estructura).`;
    }

    if (eventKey === 'contaminatedWater') {
      if (optionId === 'boil') {
        Game.resources.water += 0.8;
        return 'Herviste el depósito y recuperaste 0,8 de agua segura.';
      }
      if (optionId === 'drink') {
        Game.resources.water += 1;
        Game.player.health -= 5;
        Game.infectionDays = Math.max(Game.infectionDays, 3);
        return 'Guardaste el agua contaminada: +1 agua, -5 salud y una infección.';
      }
      Game.player.morale -= 1;
      return 'Desechaste el agua dudosa antes de que enfermara a nadie.';
    }

    if (eventKey === 'sealedContainer') {
      if (optionId === 'tools') {
        Game.resources.metal -= 1;
        Game.resources.wood += 3;
        Game.resources.plastic += 2;
        Game.resources.rope += 1;
        return 'Abriste el contenedor: +3 madera, +2 plástico y +1 cuerda.';
      }
      if (optionId === 'force') {
        Game.player.health -= 8;
        Game.resources.metal += 2;
        Game.resources.food += 1;
        return 'La tapa te hirió, pero recuperaste +2 metal y +1 comida (-8 salud).';
      }
      Game.player.morale -= 1;
      return 'El contenedor desapareció entre las olas.';
    }

    if (eventKey === 'ghostShip') {
      if (optionId === 'explore') {
        Game.resources.wood += 4;
        Game.resources.metal += 3;
        Game.resources.cloth += 2;
        Game.player.health -= 4;
        Game.infectionDays = Math.max(
          Game.infectionDays,
          Game.raft.countProvides('infirmary') > 0 ? 1 : 3
        );
        return 'Exploraste el barco: gran botín, una herida y posible infección.';
      }
      if (optionId === 'salvage') {
        Game.resources.wood += 2;
        Game.resources.metal += 1;
        return 'Recogiste +2 madera y +1 metal sin subir al barco.';
      }
      Game.player.sanity += 3;
      return 'Te alejaste del barco fantasma y recuperaste algo de cordura.';
    }

    if (eventKey === 'fishMigration') {
      if (optionId === 'stop') {
        Game.anchorDeployed = true;
        Game.resources.food += 2.5;
        if (Game.victoryCondition === 'island') Game.islandDistance += 8;
        return 'Echaste el ancla y llenaste las redes (+2,5 comida), pero perdiste distancia.';
      }
      if (optionId === 'moving') {
        Game.resources.food += 1;
        return 'Pescaste en marcha y recuperaste +1 de comida.';
      }
      if (Game.victoryCondition === 'island') {
        Game.islandDistance = Math.max(0, Game.islandDistance - 3);
      }
      return 'Mantuviste el rumbo y dejaste atrás el banco.';
    }

    if (eventKey === 'current') {
      if (optionId === 'steer') {
        if (Game.victoryCondition === 'island') {
          Game.islandDistance = Math.max(0, Game.islandDistance - 14);
        } else {
          Game.navigationIntel = Math.min(120, Game.navigationIntel + 12);
        }
        return 'La mesa de navegación convirtió la corriente en avance seguro.';
      }
      if (optionId === 'anchor') {
        Game.anchorDeployed = true;
        Game.player.morale += 2;
        return 'El ancla resistió la corriente sin desviar la balsa.';
      }
      if (optionId === 'row') {
        Game.player.stamina = Math.max(0, Game.player.stamina - 50);
        Game.player.thirst = Math.max(0, Game.player.thirst - 8);
        const damage = Game.raft.takeDamage(4);
        if (Game.victoryCondition === 'island') {
          Game.islandDistance = Math.max(0, Game.islandDistance - 8);
        }
        return `La tripulación venció la corriente remando (-50 energía, -${Math.floor(damage)} estructura).`;
      }
      const damage = Game.raft.takeDamage(14, null, null, 'reef');
      if (Game.victoryCondition === 'island') {
        Game.islandDistance = Math.max(0, Game.islandDistance - 24);
      } else {
        Game.worldOffset += 120;
      }
      return `La corriente dio un gran impulso, pero causó ${Math.floor(damage)} de daño.`;
    }

    if (eventKey === 'outbreak') {
      if (optionId === 'treat') {
        Game.resources.cloth -= 1;
        Game.resources.water -= 0.5;
        for (const member of CrewManager.members) {
          if (member.alive) member.health = Math.min(100, member.health + 5);
        }
        return 'La enfermería cortó el brote antes de que se extendiera.';
      }
      if (optionId === 'isolate') {
        const patient = healthiestCrew();
        if (patient) {
          patient.restrainedDays = Math.max(1, patient.restrainedDays);
          patient.stress = Math.min(100, patient.stress + 14);
          patient.trust = Math.max(0, patient.trust - 8);
        }
        return 'El aislamiento contuvo el brote, pero aumentó la tensión.';
      }
      if (optionId === 'care') {
        Game.resources.food -= 0.5;
        Game.resources.water -= 1;
        for (const member of CrewManager.members) {
          if (member.alive) member.health = Math.max(1, member.health - 3);
        }
        return 'Los cuidados básicos evitaron la infección, aunque varios siguen débiles.';
      }
      if (optionId === 'separate') {
        for (const member of CrewManager.members) {
          if (!member.alive) continue;
          member.health = Math.max(1, member.health - 3);
          member.stress = Math.min(100, member.stress + 10);
        }
        Game.player.morale -= 3;
        return 'La separación improvisada frenó el brote, pero debilitó y tensó al grupo.';
      }
      Game.infectionDays = Math.max(Game.infectionDays, 3);
      for (const member of CrewManager.members) {
        if (member.alive) {
          member.health = Math.max(0, member.health - 10);
          if (member.health <= 0) member.alive = false;
        }
      }
      return 'El brote se extendió: la tripulación pierde salud y tú quedas infectado.';
    }

    if (eventKey === 'mutiny') {
      if (optionId === 'negotiate') {
        Game.resources.food -= 1;
        Game.resources.water -= 1.3;
        for (const member of CrewManager.members) {
          if (!member.alive) continue;
          member.stress = Math.max(0, member.stress - 18);
          member.trust = Math.min(100, member.trust + 8);
        }
        return 'Compartir las reservas frenó el motín y recuperó confianza.';
      }
      if (optionId === 'contain') {
        const leader = mostStressedCrew();
        if (leader) {
          leader.restrainedDays = Math.max(1, leader.restrainedDays);
          leader.stress = Math.max(35, leader.stress - 12);
          leader.trust = Math.max(0, leader.trust - 12);
        }
        Game.player.morale -= 5;
        return 'Los cabecillas fueron contenidos, pero la moral del grupo cayó.';
      }
      if (optionId === 'appease') {
        Game.player.morale -= 8;
        for (const member of CrewManager.members) {
          if (!member.alive) continue;
          member.stress = Math.max(0, member.stress - 6);
          member.trust = Math.min(100, member.trust + 2);
        }
        return 'Prometiste cambios: bajó la tensión, pero también tu autoridad.';
      }
      Game.player.health -= 15;
      Game.player.morale -= 8;
      const leader = mostStressedCrew();
      if (leader) {
        leader.health = Math.max(1, leader.health - 10);
        leader.trust = Math.max(0, leader.trust - 15);
      }
      return 'El enfrentamiento terminó con heridas y resentimiento (-15 salud).';
    }

    if (eventKey === 'whale') {
      if (optionId === 'follow') {
        Game.resources.food += 1.5;
        if (Game.victoryCondition === 'island') {
          Game.islandDistance = Math.max(0, Game.islandDistance - 10);
        } else {
          Game.navigationIntel = Math.min(120, Game.navigationIntel + 10);
        }
        return 'Seguiste a la ballena: +1,5 comida y una ruta más clara.';
      }
      if (optionId === 'approach') {
        Game.resources.food += 3;
        const damage = Game.raft.takeDamage(18);
        return `La pesca fue abundante (+3), pero la ballena causó ${Math.floor(damage)} de daño.`;
      }
      Game.player.morale += 5;
      return 'Observar la ballena desde lejos levantó la moral.';
    }

    if (eventKey === 'distressFlare') {
      if (optionId === 'rescue') {
        Game.resources.food -= 1;
        Game.resources.water -= 1.3;
        const survivor = new Survivor();
        survivor.health = 65;
        survivor.hunger = 45;
        survivor.thirst = 35;
        survivor.trust = 58;
        survivor.stress = 42;
        if (CrewManager.add(survivor)) {
          CrewManager.assignPosition(survivor, Game.raft);
          Game.stats.rescued++;
          return `Rescataste a ${survivor.name}; llega débil y con su propia historia.`;
        }
        return 'No había espacio seguro para completar el rescate.';
      }
      if (optionId === 'signal') {
        if (Game.victoryCondition === 'radio') {
          Game.rescuedSignal = Math.min(100, Game.rescuedSignal + 10);
        } else {
          Game.radioIntel = Math.min(40, Game.radioIntel + 6);
        }
        return 'La respuesta luminosa reforzó la red de señales de rescate.';
      }
      if (optionId === 'tow') {
        Game.player.health -= 10;
        Game.player.stamina = Math.max(0, Game.player.stamina - 45);
        const survivor = new Survivor();
        survivor.health = 40;
        survivor.hunger = 25;
        survivor.thirst = 20;
        survivor.trust = 50;
        survivor.stress = 60;
        if (CrewManager.add(survivor)) {
          CrewManager.assignPosition(survivor, Game.raft);
          Game.stats.rescued++;
          return `Remolcaste a ${survivor.name} sin reservas (-10 salud, -45 energía).`;
        }
        return 'El remolque fracasó y te dejó exhausto.';
      }
      Game.player.morale -= 4;
      return 'La llamarada quedó atrás y la decisión pesó sobre el grupo.';
    }

    if (eventKey === 'gulls') {
      if (optionId === 'follow') {
        Game.resources.food = Math.max(0, Game.resources.food - 0.2);
        if (Game.victoryCondition === 'island') {
          Game.islandDistance = Math.max(0, Game.islandDistance - 30);
        } else {
          Game.navigationIntel = Math.min(120, Game.navigationIntel + 20);
        }
        return 'Seguiste la bandada y obtuviste una pista firme de tierra.';
      }
      if (optionId === 'protect') {
        const loss = Game.raft.countProvides('lookout') > 0 ? 0 : 0.5;
        Game.resources.food = Math.max(0, Game.resources.food - loss);
        return loss > 0
          ? 'Protegiste casi todo, pero las gaviotas robaron 0,5 de comida.'
          : 'La vigía permitió espantar a las gaviotas sin perder comida.';
      }
      Game.resources.food += 0.8;
      Game.player.morale -= 2;
      return 'La trampa aportó 0,8 de comida, pero incomodó a la tripulación.';
    }
    return '';
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
    if (Math.random() < 0.16) {
      const decisionEvents = [
        'contaminatedWater', 'sealedContainer', 'ghostShip',
        'fishMigration', 'current', 'whale', 'distressFlare', 'gulls'
      ];
      if (CrewManager.count() > 0) {
        decisionEvents.push('outbreak', 'mutiny');
      }
      decisionEvents.push('fire');
      if (
        Game.raft.countProvides('cook') > 0 ||
        Game.raft.countProvides('preserve') > 0 ||
        Game.raft.countProvides('lookout') > 0
      ) {
        decisionEvents.push('fire');
      }
      if (Game.zone === 'fish') decisionEvents.push('fishMigration');
      if (Game.zone === 'reef' || Game.zone === 'storm') {
        decisionEvents.push('current');
      }
      list.push(Util.choice(decisionEvents));
    }
    const attraction = Util.clamp(
      Game.raft.countProvides('sharkScent') * 0.06 +
        (Game.beaconLit ? 0.08 : 0),
      0,
      0.35
    );
    if (!list.includes('shark') && Math.random() < attraction) {
      list.push('shark');
    }
    return [...new Set(list)];
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
        Game.showEventMessage(
          'Una aleta rodea la balsa. Prepárate para esquivar o usar el gancho.'
        );
        AudioSys.play('shark-warning');
        if (typeof EntityManager.spawnDanger === 'function') {
          EntityManager.spawnDanger(Game.raft.getCenter(), 'sharks');
        }
        Log.add('Un tiburón comienza a acechar a la tripulación.');
        break;
      }
      case 'sick':
        Game.player.health -= 10;
        Game.player.morale -= 5;
        Log.add('Alguien ha enfermado por el agua.');
        break;
      case 'argument':
        Game.player.morale -= 8;
        if (CrewManager.count() > 0) {
          const instigator = CrewManager.members
            .filter(member => member.alive)
            .sort((a, b) => b.stress - a.stress)[0];
          instigator.stress = Util.clamp(instigator.stress + 8, 0, 100);
          instigator.trust = Util.clamp(instigator.trust - 3, 0, 100);
          instigator.lastIncident = 'Protagonizó una discusión a bordo.';
          Log.add(`${instigator.name} protagonizó una discusión.`);
        } else {
          Log.add('La tensión del aislamiento resulta insoportable.');
        }
        break;
      case 'lost':
        if (CrewManager.count() > 0 && Math.random() < 0.3) {
          const victim = Util.choice(CrewManager.members.filter(m => m.alive));
          const lookout = Game.raft.countProvides('lookout');
          const fallDamage = lookout > 0 ? 8 : 20;
          victim.health = Math.max(0, victim.health - fallDamage);
          if (victim.health <= 0) {
            victim.alive = false;
            CrewManager.removeMesh(victim);
            victim.deathLogged = true;
            Log.add(`${victim.name} cayó al mar y no sobrevivió.`);
          } else {
            Log.add(
              lookout > 0
                ? `La vigía vio caer a ${victim.name} y permitió rescatarlo a tiempo.`
                : `${victim.name} cayó al mar y resultó herido.`
            );
          }
        }
        break;
      case 'gift': {
        const res = Util.choice(['wood', 'food', 'water', 'rope']);
        Game.resources[res] +=
          res === 'food' || res === 'water' ? 1.5 : 2;
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
      heat: 'calor extremo', wave: 'ola gigante', bird: 'ave cercana', ship: 'barco avistado',
      fire: 'incendio a bordo',
      contaminatedWater: 'agua contaminada',
      sealedContainer: 'contenedor sellado',
      ghostShip: 'barco fantasma',
      fishMigration: 'migración de peces',
      current: 'corriente marina',
      outbreak: 'brote infeccioso',
      mutiny: 'conato de motín',
      whale: 'ballena cercana',
      distressFlare: 'llamarada de auxilio',
      gulls: 'bandada de gaviotas'
    }[ev] || ev;
  },

  checkRouteVictory: () => GameSimulation.checkRouteVictory(Game),

  checkWinLose: () => {
    if (Game.player.health <= 0) {
      if (!Game.stats.deathCause) {
        Game.stats.deathCause = 'El personaje principal ha muerto';
      }
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
    Save.clear();
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
    Save.clear();
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
