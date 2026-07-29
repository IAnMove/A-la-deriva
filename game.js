/*****************************************************
 * game.js - Lógica principal, estados, día/noche,
 * eventos, victoria/derrota y UI (versión 3D)
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
    hook: null,
    hookRange: 8,
    hookSpeed: 11,
    moveTarget: null,
    rowTarget: null,
  },

  // Recursos
  resources: {
    wood: 0, plastic: 0, cloth: 0, metal: 0, rope: 0,
    food: 0, water: 0,
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
  worldOffset: 0,
  worldOffsetZ: 0,
  hallucinationTimer: 0,

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
    'Construye radio o motor para escapar.'
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
    document.getElementById('btn-sound').textContent = soundEnabled ? '🔊' : '🔇';
  },

  savePrefs: () => {
    Save.savePrefs({ sound: AudioSys.isEnabled() });
  },

  setState: (s) => {
    Game.state = s;
    document.getElementById('start-screen').classList.toggle('active', s === 'start');
    document.getElementById('end-screen').classList.toggle('active', s === 'end');
    document.getElementById('pause-screen').classList.toggle('active', s === 'paused');
    document.getElementById('ui').classList.toggle('hidden', s !== 'playing');
    if (s === 'start') document.getElementById('btn-continue').disabled = !Save.exists();
  },

  newGame: () => {
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

    Game.player.x = 1; Game.player.z = 1;
    Game.player.vx = 0; Game.player.vz = 0;
    Game.player.health = 100; Game.player.hunger = 90; Game.player.thirst = 90; Game.player.morale = 75;
    Game.player.sanity = 100; Game.player.stamina = 100;
    Game.player.hook = null;
    Game.player.rowTarget = null;
    Game.player.moveTarget = null;

    Game.resources = { wood: 4, plastic: 1, cloth: 0, metal: 0, rope: 1, food: 2, water: 1 };

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
    Game.rowingBoost = 0;
    Game.rowingBoostZ = 0;
    Game.rowingCooldown = 0;
    Game.worldOffset = 0;
    Game.worldOffsetZ = 0;
    Game.hallucinationTimer = 0;
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
    if (!data) return Game.newGame();
    try {
      Game.loadFromSave(data);
    } catch (e) {
      console.warn('Guardado inválido; se inicia una partida nueva.', e);
      Game.newGame();
      return;
    }
    Game.setState('playing');
  },

  loadFromSave: (data) => {
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
    Object.assign(Game.player, {
      x: 1, z: 1,
      health: 100, hunger: 90, thirst: 90, morale: 75, stamina: 100, sanity: 100
    }, data.player || {});
    Game.player.x = Number.isFinite(Number(Game.player.x)) ? Number(Game.player.x) : 1;
    Game.player.z = Number.isFinite(Number(Game.player.z)) ? Number(Game.player.z) : 1;
    for (const key of ['health', 'hunger', 'thirst', 'morale', 'stamina', 'sanity']) {
      const fallback = key === 'morale' ? 75 : (key === 'hunger' || key === 'thirst' ? 90 : 100);
      Game.player[key] = Util.clamp(
        Number.isFinite(Number(Game.player[key])) ? Number(Game.player[key]) : fallback,
        0,
        100
      );
    }
    Game.player.hook = null;
    Game.player.rowTarget = null;
    Game.player.moveTarget = null;
    const savedResources = data.resources || {};
    Game.resources = {};
    for (const key of ['wood', 'plastic', 'cloth', 'metal', 'rope', 'food', 'water']) {
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
    Game.islandDistance = Math.max(0, Number(data.islandDistance) || 2000);
    Game.radioIntel = Util.clamp(Number(data.radioIntel) || 0, 0, 40);
    Game.navigationIntel = Util.clamp(Number(data.navigationIntel) || 0, 0, 120);
    Game.victoryCondition = ['radio', 'island'].includes(data.victoryCondition) ? data.victoryCondition : null;
    Game.currentObjective = Util.clamp(Number(data.currentObjective) || 0, 0, Game.objectives.length - 1);
    Game.worldOffset = Number(data.worldOffset) || 0;
    Game.worldOffsetZ = Number(data.worldOffsetZ) || 0;

    // Reconstruir balsa con meshes
    for (const cell of Game.raft.grid.values()) Game.raft.disposeMesh(cell);
    Game.raft.grid.clear();
    const entries = Array.isArray(data.raftGrid) ? data.raftGrid : [['0,0', { buildingKey: 'floor', health: 50 }]];
    for (const [k, v] of entries) {
      const [gx, gy] = k.split(',').map(Number);
      if (Number.isFinite(gx) && Number.isFinite(gy) && BUILDINGS[v?.buildingKey] &&
          Game.raft.placeAt(gx, gy, v.buildingKey, true)) {
        const cell = Game.raft.get(gx, gy);
        cell.maxHealth = Math.max(
          BUILDINGS[v.buildingKey].health,
          Number(v.maxHealth) || BUILDINGS[v.buildingKey].health
        );
        cell.health = Util.clamp(Number(v.health) || cell.maxHealth, 1, cell.maxHealth);
        Game.raft.tintDamaged(cell);
      }
    }
    if (Game.raft.grid.size === 0) Game.raft.placeAt(0, 0, 'floor', true);
    Game.raft.removeDetachedCells();
    CrewManager.reset();
    CrewManager.members = (Array.isArray(data.crew) ? data.crew : []).map(Survivor.fromData);
    EntityManager.reset();
    FloatingText.clear();
    Particles.clear();
    Log.clear();
    HookVis.hide();
    BuildManager.close();
    Game.closeAllModals();
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
        stamina: Game.player.stamina, sanity: Game.player.sanity
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

  bindUI: () => {
    document.getElementById('btn-new-game').onclick = Game.newGame;
    document.getElementById('btn-continue').onclick = Game.continueGame;
    document.getElementById('btn-restart').onclick = Game.newGame;
    document.getElementById('btn-menu').onclick = () => Game.setState('start');
    document.getElementById('btn-resume').onclick = () => Game.setState('playing');
    document.getElementById('btn-save').onclick = Game.saveGame;
    document.getElementById('btn-pause-menu').onclick = () => Game.setState('start');

    document.getElementById('btn-sound').onclick = () => {
      AudioSys.setEnabled(!AudioSys.isEnabled());
      document.getElementById('btn-sound').textContent = AudioSys.isEnabled() ? '🔊' : '🔇';
      Game.savePrefs();
    };
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
      Game.player.moveTarget = { gx, gy };
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

  startRowingTowards: (wx, wz) => {
    if (Game.rowingCooldown > 0) return;
    const cs = Game.raft.cellSize;
    let best = null, bestD = Infinity;
    for (const [k] of Game.raft.grid.entries()) {
      const [gx, gy] = k.split(',').map(Number);
      const cx = (gx + 0.5) * cs;
      const cz = (gy + 0.5) * cs;
      const d = Math.hypot(cx - wx, cz - wz);
      if (d < bestD) { bestD = d; best = { cx, cz }; }
    }
    if (!best) return;
    const tx = Util.clamp(wx, best.cx - cs / 2 + 0.15, best.cx + cs / 2 - 0.15);
    const tz = Util.clamp(wz, best.cz - cs / 2 + 0.15, best.cz + cs / 2 - 0.15);
    const center = Game.raft.getCenter();
    const vx = center.x - wx;
    const vz = center.z - wz;
    const vlen = Math.hypot(vx, vz) || 1;
    Game.player.rowTarget = {
      x: tx, z: tz,
      pushX: vx / vlen,
      pushZ: vz / vlen
    };
    Game.showFloatingText(Game.player.x, Game.player.z, 'Ve al borde a remar', '#4fc3f7');
  },

  row: () => {
    if (Game.rowingCooldown > 0) return;
    if (Game.player.stamina < 30) {
      Game.showFloatingText(Game.player.x, Game.player.z, 'Demasiado cansado', '#ef5350');
      return;
    }
    const p = Game.player;
    const center = Game.raft.getCenter();
    const edgeX = center.x - p.x;
    const edgeZ = center.z - p.z;
    const edgeLen = Math.hypot(edgeX, edgeZ);
    const push = p.rowTarget
      ? { x: p.rowTarget.pushX ?? -1, z: p.rowTarget.pushZ ?? 0 }
      : (edgeLen > 0.25 ? { x: edgeX / edgeLen, z: edgeZ / edgeLen } : { x: -1, z: 0 });
    Game.rowingBoost = 3.5 * Math.abs(push.x);
    Game.rowingBoostZ = 3.5 * push.z;
    Game.rowingCooldown = 2.0;
    Game.player.stamina = Math.max(0, Game.player.stamina - 35);
    Game.player.hunger = Math.max(0, Game.player.hunger - 2);
    Game.player.thirst = Math.max(0, Game.player.thirst - 3);
    // Salpicaduras
    for (let i = 0; i < 3; i++) {
      const backX = p.x - push.x * (1 + Util.rand(0, 1));
      const backZ = p.z - push.z * (1 + Util.rand(0, 1));
      Particles.emit(backX, 0.3, backZ, '#dcf5ff', 10, 3 + Util.rand(0, 2));
    }
    AudioSys.play('hook');
    Game.showFloatingText(p.x, p.z, '¡Remando!', '#4fc3f7');
    Game.player.rowTarget = null;
  },

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
    CrewManager.add(survivor);
    CrewManager.assignPosition(survivor, Game.raft);
    Game.stats.rescued++;
    Log.add(`Has rescatado a ${survivor.name} (${survivor.skill.name}).`);
    Game.removeEntity(obj);
    Game.showFloatingText(obj.x, obj.z, `¡${survivor.name} rescatado!`);
    AudioSys.play('alert');
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

  showEventMessage: (text) => {
    const el = document.getElementById('event-message');
    el.textContent = text;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2500);
  },

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
  update: (dt) => {
    if (Game.menuModalOpen() && Input.wasPressed('Escape')) {
      Game.closeAllModals();
      Game.raft.selected = null;
      Input.resetClick();
      return;
    }
    if (BuildManager.active && Game.paused && Input.wasPressed('KeyB')) {
      Game.closeAllModals();
      Input.resetClick();
      return;
    }
    if (Input.wasPressed('Space') &&
        (Game.state === 'paused' || (Game.state === 'playing' && !Game.paused))) {
      Game.togglePause();
      Input.resetClick();
      return;
    }
    if (Input.wasPressed('KeyM')) {
      AudioSys.setEnabled(!AudioSys.isEnabled());
      document.getElementById('btn-sound').textContent = AudioSys.isEnabled() ? '🔊' : '🔇';
      Game.savePrefs();
    }
    if (Game.state !== 'playing' || Game.paused) { Input.resetClick(); return; }

    // Punto del mundo bajo el cursor
    Game.mouseWorld = World.mouseToWorld(Input.mouse.x, Input.mouse.y);

    Game.updateTime(dt);
    if (Game.paused || Game.state !== 'playing') { Input.resetClick(); return; }
    Game.updateZone(dt);
    Game.updatePlayer(dt);

    if ((Input.isDown('ShiftLeft') || Input.isDown('ShiftRight')) && !BuildManager.active && !BuildManager.placing && !Game.player.rowTarget) Game.row();
    if (Game.rowingCooldown > 0) Game.rowingCooldown -= dt;
    if (Game.rowingBoost > 0) Game.rowingBoost = Math.max(0, Game.rowingBoost - dt * 0.4);
    if (Game.rowingBoostZ !== 0) Game.rowingBoostZ = Math.abs(Game.rowingBoostZ) < 0.01 ? 0 : Game.rowingBoostZ - Math.sign(Game.rowingBoostZ) * dt * 0.4;
    Game.player.stamina = Math.min(100, Game.player.stamina + dt * 4);
    if (Game.heat) Game.player.thirst = Math.max(0, Game.player.thirst - dt * 0.2);

    // Alucinaciones por baja cordura
    if (Game.player.sanity < 40) {
      Game.hallucinationTimer -= dt;
      if (Game.hallucinationTimer <= 0) {
        Game.hallucinationTimer = Util.rand(6, 14);
        const msgs = ['¿Has oído eso?', 'El mar susurra tu nombre...', '¿Era una sombra?', 'No estás solo...', '¿Dónde está todo el mundo?'];
        Game.showEventMessage(Util.choice(msgs));
      }
    }

    Game.updateHook(dt);
    if (Game.paused || Game.state !== 'playing') { Input.resetClick(); return; }
    Game.updateEntities(dt);
    Game.updateProduction(dt);
    Game.checkEvents(dt);
    Game.checkWinLose();
    Game.updateObjective();
    Game.updateUI();
    Game.updateHighlights();

    FloatingText.update(dt);
    Particles.update(dt);

    // Clics
    if (Input.mouse.clicked) Game.handleLeftClick();
    if (Input.mouse.rightClicked) Game.handleRightClick();
    Input.resetClick();

    // Teclas UI
    if (Input.wasPressed('KeyB')) {
      if (BuildManager.placing) { BuildManager.stopPlacing(); }
      BuildManager.toggle();
      Game.updateBuildMenu();
    }
    if (Input.wasPressed('KeyE')) Game.interact();
    if (Input.wasPressed('Escape')) { Game.closeAllModals(); BuildManager.close(); Game.raft.selected = null; }
  },

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

  updatePlayer: (dt) => {
    const p = Game.player;
    const cs = Game.raft.cellSize;
    const manualMove = Input.isDown('KeyW') || Input.isDown('ArrowUp') ||
      Input.isDown('KeyS') || Input.isDown('ArrowDown') ||
      Input.isDown('KeyA') || Input.isDown('ArrowLeft') ||
      Input.isDown('KeyD') || Input.isDown('ArrowRight');
    if (manualMove) {
      p.moveTarget = null;
      p.rowTarget = null;
    }

    // Movimiento automático hacia una celda (clic)
    if (p.moveTarget) {
      const tx = (p.moveTarget.gx + 0.5) * cs;
      const tz = (p.moveTarget.gy + 0.5) * cs;
      const dx = tx - p.x;
      const dz = tz - p.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.2) {
        p.moveTarget = null;
        p.vx = 0; p.vz = 0;
      } else {
        const speed = p.speed * 1.3;
        p.vx = (dx / dist) * speed;
        p.vz = (dz / dist) * speed;
        const prevX = p.x, prevZ = p.z;
        p.x += p.vx * dt;
        p.z += p.vz * dt;
        const g = Game.raft.worldToGrid(p.x, p.z);
        if (!Game.raft.has(g.gx, g.gy)) {
          const prev = Game.raft.worldToGrid(prevX, prevZ);
          if (Game.raft.has(prev.gx, prev.gy)) { p.x = prevX; p.z = prevZ; }
        }
      }
      return;
    }

    // Movimiento automático hacia el borde para remar
    if (p.rowTarget) {
      const dx = p.rowTarget.x - p.x;
      const dz = p.rowTarget.z - p.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.2) {
        Game.row();
        p.vx = 0; p.vz = 0;
      } else {
        const speed = p.speed * 1.4;
        p.vx = (dx / dist) * speed;
        p.vz = (dz / dist) * speed;
        const prevX = p.x, prevZ = p.z;
        p.x += p.vx * dt;
        p.z += p.vz * dt;
        const g = Game.raft.worldToGrid(p.x, p.z);
        if (!Game.raft.has(g.gx, g.gy)) {
          const prev = Game.raft.worldToGrid(prevX, prevZ);
          if (Game.raft.has(prev.gx, prev.gy)) { p.x = prevX; p.z = prevZ; }
        }
      }
      return;
    }

    let dx = 0, dz = 0;
    if (Input.isDown('KeyW') || Input.isDown('ArrowUp')) dz -= 1;
    if (Input.isDown('KeyS') || Input.isDown('ArrowDown')) dz += 1;
    if (Input.isDown('KeyA') || Input.isDown('ArrowLeft')) dx -= 1;
    if (Input.isDown('KeyD') || Input.isDown('ArrowRight')) dx += 1;
    if (dx !== 0 || dz !== 0) {
      const len = Math.hypot(dx, dz) || 1;
      dx /= len; dz /= len;
    }

    p.vx = dx * p.speed;
    p.vz = dz * p.speed;

    const prevX = p.x, prevZ = p.z;
    p.x += p.vx * dt;
    p.z += p.vz * dt;

    // Mantener dentro de la balsa
    const g = Game.raft.worldToGrid(p.x, p.z);
    if (!Game.raft.has(g.gx, g.gy)) {
      const prev = Game.raft.worldToGrid(prevX, prevZ);
      if (Game.raft.has(prev.gx, prev.gy)) {
        p.x = prevX; p.z = prevZ;
      } else {
        let best = null, bestD = Infinity;
        for (const [k] of Game.raft.grid.entries()) {
          const [cx, cy] = k.split(',').map(Number);
          const cwx = (cx + 0.5) * cs;
          const cwz = (cy + 0.5) * cs;
          const d = Math.hypot(cwx - p.x, cwz - p.z);
          if (d < bestD) { bestD = d; best = { x: cwx, z: cwz }; }
        }
        if (best) { p.x = best.x; p.z = best.z; }
      }
    }

    const b = Game.raft.getBounds();
    p.x = Util.clamp(p.x, b.minX * cs + 0.3, (b.maxX + 1) * cs - 0.3);
    p.z = Util.clamp(p.z, b.minY * cs + 0.3, (b.maxY + 1) * cs - 0.3);
  },

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
          const amount = Math.round(Util.randInt(1, 3) * (1 + CrewManager.getFishingBonus()) * 100) / 100;
          Game.resources.food += amount;
          Game.showFloatingText(h.x, h.z, `+${amount} comida`);
          AudioSys.play('collect');
          if (bank.takeFishVisual) {
            const caughtFish = bank.takeFishVisual();
            if (caughtFish && HookVis.attachCatch) HookVis.attachCatch(caughtFish);
          } else {
            bank.fishCount--;
            if (bank.fishCount <= 0) bank.active = false;
          }
          h.returning = true;
          break;
        }
      }
    }

    if (h.distance >= h.maxRange) h.returning = true;

    HookVis.show(p.x, p.z, h.x, h.z);
  },

  updateEntities: (dt) => {
    const driftBonus = CrewManager.getDriftBonus();
    const sailBonus = Game.raft.countProvides('sail') ? 0.5 : 0;
    const motorBonus = Game.raft.countProvides('motor') ? 1.0 : 0;
    const loadMul = Game.loadSpeedMultiplier();
    const currentSpeed = (0.75 + driftBonus * 0.75 + sailBonus + motorBonus + Game.rowingBoost) * loadMul;
    const currentSpeedZ = Game.rowingBoostZ * loadMul;
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
        const dmg = Game.raft.takeDamage(12);
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
    if (Game.rain) {
      const rainCollectors = Game.raft.countProvides('rainWater');
      if (rainCollectors > 0) {
        Game.resources.water += rainCollectors * dt * 0.05;
      }
    }
    const autoFood = Game.raft.totalAutoFood();
    if (autoFood > 0) {
      Game.resources.food += autoFood * dt * 0.02;
    }
    const purifierWater = Game.raft.countProvides('purifiedWater');
    if (purifierWater > 0) {
      Game.resources.water += purifierWater * dt * 0.015;
    }
  },

  cargoWeight: () => {
    const weights = { wood: 0.25, plastic: 0.15, cloth: 0.1, metal: 0.4, rope: 0.15, food: 0.2, water: 0.3 };
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

    // Una estructura dañada se repara antes de ejecutar su acción especial.
    if (cell.health < maxHealth && Game.resources.wood >= 1) {
      Game.resources.wood -= 1;
      Game.raft.repairAt(gx, gy, 15);
      Game.showFloatingText(p.x, p.z, 'Reparado');
      AudioSys.play('build');
      return;
    }

    if (b.key === 'fire' || b.key === 'kitchen') {
      if (Game.resources.food >= 1) {
        Game.resources.food -= 1;
        const isKitchen = b.key === 'kitchen';
        Game.player.hunger = Math.min(100, Game.player.hunger + (isKitchen ? 30 : 20));
        Game.player.health = Math.min(100, Game.player.health + (isKitchen ? 8 : 5));
        Game.showFloatingText(p.x, p.z, 'Ración cocinada y consumida');
        AudioSys.play('collect');
      } else {
        Game.showFloatingText(p.x, p.z, 'No tienes comida', '#ef5350');
      }
    } else if (b.key === 'medkit') {
      if (Game.resources.cloth >= 1 && Game.player.health < 100) {
        Game.resources.cloth -= 1;
        Game.player.health = Math.min(100, Game.player.health + 25);
        Game.showFloatingText(p.x, p.z, '+25 salud');
        AudioSys.play('collect');
      } else {
        Game.showFloatingText(p.x, p.z, Game.player.health >= 100 ? 'Ya estás sano' : 'Necesitas 1 tela', '#ef5350');
      }
    } else if (b.key === 'radio') {
      if (Game.rescuedSignal === 0) {
        Game.showDecision('Señal de socorro', '¿Deseas empezar a emitir una señal continua con la radio? Requiere mantenerla operativa.', [
          { label: 'Sí', action: () => {
            Game.victoryCondition = 'radio';
            Game.rescuedSignal = Math.max(1, 1 + Game.radioIntel);
            Log.add(Game.radioIntel > 0
              ? `La radio usa la información de la tripulación y comienza con ${Game.rescuedSignal.toFixed(0)}% de señal.`
              : 'La radio comienza a emitir señal de socorro.');
          } },
          { label: 'No', action: () => { } }
        ]);
      } else {
        Game.showFloatingText(p.x, p.z, `Señal automática ${Game.rescuedSignal.toFixed(0)}%`);
      }
    } else if (b.key === 'motor') {
      if (Game.raft.countProvides('sail') && Game.raft.countProvides('rudder')) {
        Game.showDecision('Navegar hacia la isla', 'El motor y el timón están listos. ¿Partir hacia la isla más cercana?', [
          { label: 'Sí', action: () => {
            Game.victoryCondition = 'island';
            Game.islandDistance = Math.max(150, 300 - Game.navigationIntel);
            Log.add(Game.navigationIntel > 0
              ? `Las historias de la tripulación acortan la ruta inicial a ${Game.islandDistance.toFixed(0)} m.`
              : 'Has decidido navegar hacia una isla.');
          } },
          { label: 'No', action: () => { } }
        ]);
      } else {
        Game.showFloatingText(p.x, p.z, 'Necesitas vela y timón');
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

    const crewCount = CrewManager.count();

    const playerFoodNeed = 1;
    const playerWaterNeed = 1.3;
    const crewFoodNeed = CrewManager.getDailyFoodNeed();
    const crewWaterNeed = crewCount * 1.3;

    const totalFoodNeed = playerFoodNeed + crewFoodNeed;
    const totalWaterNeed = playerWaterNeed + crewWaterNeed;

    const foodConsumed = Math.min(Game.resources.food, totalFoodNeed);
    const waterConsumed = Math.min(Game.resources.water, totalWaterNeed);
    Game.resources.food -= foodConsumed;
    Game.resources.water -= waterConsumed;

    const playerFoodShare = totalFoodNeed > 0 ? (playerFoodNeed / totalFoodNeed) * foodConsumed : 0;
    const playerWaterShare = totalWaterNeed > 0 ? (playerWaterNeed / totalWaterNeed) * waterConsumed : 0;

    Game.player.hunger = Math.min(100, Game.player.hunger + playerFoodShare * 12);
    Game.player.thirst = Math.min(100, Game.player.thirst + playerWaterShare * 12);

    if (playerFoodShare < playerFoodNeed * 0.8) {
      Game.player.health -= (playerFoodNeed - playerFoodShare) * 5;
      Game.player.morale -= 5;
      Game.player.hunger = Math.max(0, Game.player.hunger - (playerFoodNeed - playerFoodShare) * 10);
    } else {
      Game.player.health = Math.min(100, Game.player.health + 1);
    }
    if (playerWaterShare < playerWaterNeed * 0.8) {
      Game.player.health -= (playerWaterNeed - playerWaterShare) * 8;
      Game.player.morale -= 8;
      Game.player.thirst = Math.max(0, Game.player.thirst - (playerWaterNeed - playerWaterShare) * 12);
    } else {
      Game.player.health = Math.min(100, Game.player.health + 1);
    }

    const crewFoodShare = foodConsumed - playerFoodShare;
    const crewWaterShare = waterConsumed - playerWaterShare;
    CrewManager.dailyUpdateByShare(crewFoodShare, crewWaterShare, Game.storm);

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

    if (Game.victoryCondition === 'radio' && Game.raft.countProvides('radio')) {
      Game.rescuedSignal += 8 + Game.raft.countProvides('mast') * 4;
      if (Game.rescuedSignal >= 100) {
        Game.triggerWin('radio');
        return;
      }
    }
    if (Game.victoryCondition === 'island') {
      const navigationReady = Game.raft.countProvides('motor') &&
        Game.raft.countProvides('sail') && Game.raft.countProvides('rudder');
      if (navigationReady) {
        const nav = (25 + CrewManager.getDriftBonus() * 20) * Game.loadSpeedMultiplier();
        Game.islandDistance -= nav;
        if (Game.islandDistance <= 0) {
          Game.triggerWin('island');
          return;
        }
      } else {
        Log.add('El viaje a la isla se detiene: faltan motor, vela o timón.');
      }
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

  updateObjective: () => {
    const area = Game.raft.totalArea();
    const crew = CrewManager.count();
    let idx = 0;
    if (Game.resources.food >= 3 && Game.resources.water >= 3) idx = 1;
    if (area >= 4) idx = 2;
    if (Game.raft.totalAutoFood() > 0 || Game.raft.countProvides('rainWater') > 0) idx = 3;
    if (crew >= 1) idx = 4;
    if (Game.raft.countProvides('sail') && Game.raft.countProvides('rudder')) idx = 5;
    Game.currentObjective = idx;
    document.getElementById('objective-text').textContent = Game.objectives[idx];
  },

  showDaySummary: (food, water, events, crewNotes = []) => {
    Game.paused = true;
    const panel = document.getElementById('day-summary');
    const content = document.getElementById('summary-content');
    let html = `
      <div class="summary-line"><strong>Recursos consumidos:</strong> ${food.toFixed(1)} comida, ${water.toFixed(1)} agua</div>
      <div class="summary-line"><strong>Tripulación:</strong> ${CrewManager.count()} supervivientes</div>
      <div class="summary-line"><strong>Balsa:</strong> ${Game.raft.totalArea()} módulos</div>
    `;
    if (Game.victoryCondition === 'radio') html += `<div class="summary-line"><strong>Señal de socorro:</strong> ${Game.rescuedSignal.toFixed(0)}%</div>`;
    if (Game.victoryCondition === 'island') html += `<div class="summary-line"><strong>Distancia a la isla:</strong> ${Math.max(0, Game.islandDistance).toFixed(0)} m</div>`;
    if (events.length) html += `<div class="summary-line"><strong>Sucesos:</strong> ${events.map(Game.eventName).join(', ')}</div>`;
    if (crewNotes.length) {
      const safe = crewNotes.map(note => typeof escapeSurvivorHtml === 'function'
        ? escapeSurvivorHtml(note)
        : String(note));
      html += `<div class="summary-line"><strong>Tripulación:</strong><ul>${safe.map(note => `<li>${note}</li>`).join('')}</ul></div>`;
    }
    content.innerHTML = html;
    panel.classList.remove('hidden');
  },

  eventName: (ev) => {
    return {
      storm: 'tormenta', shark: 'ataque de tiburón', sick: 'enfermedad',
      argument: 'discusión', lost: 'accidente', gift: 'suministros', debris: 'restos',
      heat: 'calor extremo', wave: 'ola gigante', bird: 'ave cercana', ship: 'barco avistado'
    }[ev] || ev;
  },

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

  endStatsHtml: (win, score) => {
    return `
      <div class="summary-line">Días sobrevividos: <strong>${Game.day}</strong></div>
      <div class="summary-line">Personas rescatadas: <strong>${Game.stats.rescued}</strong></div>
      <div class="summary-line">Personas abandonadas: <strong>${Game.stats.abandoned}</strong></div>
      <div class="summary-line">Recursos recogidos: <strong>${Game.stats.gathered}</strong></div>
      <div class="summary-line">Tamaño máximo de la balsa: <strong>${Game.stats.maxRaftSize}</strong></div>
      <div class="summary-line">Mejor puntuación: <strong>${Save.loadBest()}</strong></div>
      <div class="summary-line">Puntuación final: <strong>${score}</strong></div>
    `;
  },

  updateUI: () => {
    if (Game.state !== 'playing') return;
    document.getElementById('day-label').textContent = `Día ${Game.day}`;
    document.getElementById('time-label').textContent = Util.formatTime(Game.time);
    const phase = Game.time < 6 ? 'Noche' : Game.time < 12 ? 'Mañana' : Game.time < 18 ? 'Tarde' : 'Noche';
    document.getElementById('phase-label').textContent = `${phase} · ${Game.zoneName(Game.zone)}`;

    Game.setBar('bar-health', Game.player.health);
    Game.setBar('bar-hunger', Game.player.hunger);
    Game.setBar('bar-thirst', Game.player.thirst);
    Game.setBar('bar-morale', Game.player.morale);
    Game.setBar('bar-stamina', Game.player.stamina);
    Game.setBar('bar-sanity', Game.player.sanity);

    document.getElementById('food-label').textContent = `🍖 ${Util.formatAmount(Game.resources.food)}`;
    document.getElementById('water-label').textContent = `💧 ${Util.formatAmount(Game.resources.water)}`;
    const totalWeight = Game.totalWeight();
    const maxW = Game.raft.maxWeight();
    const wl = document.getElementById('weight-label');
    wl.textContent = `⚖ ${totalWeight.toFixed(1)}/${maxW.toFixed(1)}`;
    wl.style.color = totalWeight > maxW ? 'var(--danger)' : '';

    document.getElementById('res-wood').textContent = Util.formatAmount(Game.resources.wood);
    document.getElementById('res-plastic').textContent = Util.formatAmount(Game.resources.plastic);
    document.getElementById('res-cloth').textContent = Util.formatAmount(Game.resources.cloth);
    document.getElementById('res-metal').textContent = Util.formatAmount(Game.resources.metal);
    document.getElementById('res-rope').textContent = Util.formatAmount(Game.resources.rope);

    const crewCount = CrewManager.count();
    document.getElementById('daily-food').textContent = (1 + CrewManager.getDailyFoodNeed()).toFixed(1);
    document.getElementById('daily-water').textContent = ((crewCount + 1) * 1.3).toFixed(1);
    let totalHealth = 0, totalMax = 0;
    for (const cell of Game.raft.grid.values()) {
      totalHealth += cell.health;
      totalMax += cell.maxHealth || BUILDINGS[cell.buildingKey].health;
    }
    const structPct = totalMax > 0 ? Math.floor((totalHealth / totalMax) * 100) : 0;
    const sh = document.getElementById('structural-health');
    sh.textContent = `${structPct}%`;
    sh.style.color = structPct < 40 ? 'var(--danger)' : (structPct < 70 ? 'var(--warning)' : 'var(--success)');

    const rowEl = document.getElementById('rowing-status');
    if (Game.rowingCooldown > 0) {
      rowEl.textContent = `${Game.rowingCooldown.toFixed(1)}s`;
      rowEl.style.color = 'var(--warning)';
    } else {
      rowEl.textContent = 'listo';
      rowEl.style.color = 'var(--success)';
    }

    // Overlays de efectos
    document.getElementById('fx-heat').style.opacity = Game.heat ? 1 : 0;
    const sanity = Game.player.sanity;
    document.getElementById('fx-hallucination').style.opacity = sanity < 50 ? ((50 - sanity) / 50) * 0.9 : 0;
  },

  setBar: (id, value) => {
    const el = document.getElementById(id);
    const safeValue = Util.clamp(Number(value) || 0, 0, 100);
    el.style.width = `${safeValue}%`;
    el.classList.toggle('low', safeValue < 25);
  },

  // ---- Highlights 3D (colocación, remo, selección) ----
  updateHighlights: () => {
    const cs = Game.raft.cellSize;

    // Reconstruir corona de remo / celdas válidas si cambió la balsa
    if (Game.highlightsDirty) {
      Game.highlightsDirty = false;

      // Corona de remo
      while (Game.rowGroup.children.length) {
        const c = Game.rowGroup.children[0];
        Game.rowGroup.remove(c);
        c.geometry.dispose();
      }
      const bounds = Game.raft.getBounds();
      const rowMat = new THREE.MeshBasicMaterial({ color: 0x4fc3f7, transparent: true, opacity: 0.10 });
      const validMat = new THREE.MeshBasicMaterial({ color: 0x66bb6a, transparent: true, opacity: 0.18 });
      while (Game.highlightGroup.children.length) {
        const c = Game.highlightGroup.children[0];
        Game.highlightGroup.remove(c);
        c.geometry.dispose();
      }
      for (let gx = bounds.minX - 1; gx <= bounds.maxX + 1; gx++) {
        for (let gy = bounds.minY - 1; gy <= bounds.maxY + 1; gy++) {
          if (Game.raft.has(gx, gy) || !Game.raft.isConnected(gx, gy)) continue;
          const rm = new THREE.Mesh(new THREE.BoxGeometry(cs - 0.15, 0.1, cs - 0.15), rowMat);
          rm.position.set((gx + 0.5) * cs, 0.05, (gy + 0.5) * cs);
          Game.rowGroup.add(rm);
          const vm = new THREE.Mesh(new THREE.BoxGeometry(cs - 0.15, 0.1, cs - 0.15), validMat);
          vm.position.set((gx + 0.5) * cs, 0.06, (gy + 0.5) * cs);
          Game.highlightGroup.add(vm);
        }
      }
    }

    const placing = BuildManager.placing && BuildManager.selected;
    Game.highlightGroup.visible = !!placing;
    Game.rowGroup.visible = !placing && Game.state === 'playing';

    // Fantasma de colocación y celda de remo bajo el cursor
    Game.ghostMesh.visible = false;
    Game.hoverRowMesh.visible = false;
    if (Game.mouseWorld) {
      const { gx, gy } = Game.raft.worldToGrid(Game.mouseWorld.x, Game.mouseWorld.z);
      if (placing) {
        Game.ghostMesh.visible = true;
        const valid = !Game.raft.has(gx, gy) && Game.raft.isConnected(gx, gy);
        Game.ghostMesh.material.color.setHex(valid ? 0x66bb6a : 0xef5350);
        Game.ghostMesh.position.set((gx + 0.5) * cs, 0.35, (gy + 0.5) * cs);
      } else if (Game.isRowingCell(gx, gy)) {
        Game.hoverRowMesh.visible = true;
        Game.hoverRowMesh.position.set((gx + 0.5) * cs, 0.12, (gy + 0.5) * cs);
      }
    }

    // Selección
    if (Game.raft.selected) {
      Game.selectionMesh.visible = true;
      Game.selectionMesh.position.set(
        (Game.raft.selected.gx + 0.5) * cs, 0.4,
        (Game.raft.selected.gy + 0.5) * cs
      );
    } else {
      Game.selectionMesh.visible = false;
    }
  },

  elapsed: 0,

  // ---- Renderizado ----
  draw: (dt) => {
    Game.elapsed += dt;
    const time = Game.elapsed;
    const center = Game.raft.getCenter();

    // Balanceo de la balsa con las olas
    if (Game.raft.group) {
      const wh = World.waveHeight(center.x, center.z, time, Game.worldOffset, Game.worldOffsetZ);
      Game.raft.group.position.y = wh * World.waveAmp * 0.6;
      const rockMul = Game.storm ? 2.2 : 1;
      Game.raft.group.rotation.x = Math.sin(time * 0.9) * 0.015 * rockMul;
      Game.raft.group.rotation.z = Math.cos(time * 0.7) * 0.018 * rockMul;
    }

    // Animar llamas y hélices
    if (Game.raft.group) {
      Game.raft.group.traverse(o => {
        if (o.name === 'flame') {
          const s = 0.9 + Math.sin(time * 12 + o.id) * 0.2;
          o.scale.set(s, 1 + Math.sin(time * 15 + o.id) * 0.25, s);
        } else if (o.name === 'prop') {
          o.rotation.x += dt * 6;
        }
      });
    }

    // Jugador y tripulación
    PlayerVis.sync(Game.player, dt, time);
    PlayerVis.updateAim(Game.player, BuildManager.placing ? null : Game.mouseWorld);
    CrewManager.syncMeshes(Game.raft);

    // Mundo
    World.updateCamera(center, Game.raft.getBounds(), dt, Game.raft.cellSize);
    World.updateSea(time, Game.worldOffset, Game.worldOffsetZ, Game.storm);
    World.updateDayNight(Game.time, Game.storm, Game.fog, dt);
    World.updateRain(dt, Game.rain);
    World.render();
  }
};
