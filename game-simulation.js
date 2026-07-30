/*****************************************************
 * game-simulation.js - Reglas y orquestación del juego.
 *
 * El módulo recibe el estado como argumento para que las reglas no dependan
 * del singleton global Game. game.js conserva adaptadores con la API pública
 * anterior, de modo que el resto del proyecto puede migrar gradualmente.
 *****************************************************/

const RESOURCE_KEYS = Object.freeze([
  'wood', 'plastic', 'cloth', 'metal', 'rope', 'food', 'water', 'fuel'
]);

// Valores expresados por día para que el balance sea legible y fácil de ajustar.
const SURVIVAL_BALANCE = Object.freeze({
  playerFoodNeed: 1,
  playerWaterNeed: 1.3,
  crewWaterNeed: 1.3,
  hungerDrain: 18,
  hungerFromFullRation: 20,
  thirstDrain: 24,
  thirstFromFullRation: 26,
  fedThreshold: 0.75,
  foodShortageDamage: 8,
  waterShortageDamage: 12,
  criticalHungerDamage: 6,
  criticalThirstDamage: 12
});

const NAVIGATION_BALANCE = Object.freeze({
  headingStep: 0.5,
  maxHeading: 1,
  lateralSteering: 0.65,
  rowRouteMeters: 4,
  plasticFuelYield: 2,
  motorFuelPerDay: 0.5,
  sailMetersPerDay: 12,
  motorMetersPerDay: 18,
  navigatorMetersPerDay: 10
});

const GameSimulation = Object.freeze({
  update(game, dt) {
    if (game.fishing?.active) {
      game.updateFishing(dt);
      Input.resetClick();
      return;
    }
    if (game.crewConflict?.active) {
      game.updateCrewConflict(dt);
      if (Input.wasPressed('KeyE') || Input.wasPressed('Space')) {
        game.requestCrewConflictPush();
      }
      Input.resetClick();
      return;
    }
    if (game.menuModalOpen() && Input.wasPressed('Escape')) {
      game.closeAllModals();
      game.raft.selected = null;
      Input.resetClick();
      return;
    }
    if (BuildManager.active && game.paused && Input.wasPressed('KeyB')) {
      game.closeAllModals();
      Input.resetClick();
      return;
    }
    if (Input.wasPressed('Space') &&
        (game.state === 'paused' || (game.state === 'playing' && !game.paused))) {
      game.togglePause();
      Input.resetClick();
      return;
    }
    if (Input.wasPressed('KeyM')) {
      game.toggleSound();
    }
    if (game.state !== 'playing' || game.paused) {
      Input.resetClick();
      return;
    }

    game.mouseWorld = World.mouseToWorld(Input.mouse.x, Input.mouse.y);

    game.updateTime(dt);
    if (game.paused || game.state !== 'playing') {
      Input.resetClick();
      return;
    }
    game.updateZone(dt);
    game.updatePlayer(dt);

    if ((Input.isDown('ShiftLeft') || Input.isDown('ShiftRight')) &&
        !BuildManager.active && !BuildManager.placing &&
        !game.player.rowTarget && !game.player.hook) {
      game.row();
    }
    if (game.rowingCooldown > 0) {
      game.rowingCooldown = Math.max(0, game.rowingCooldown - dt);
    }
    if (game.player.rowAnim > 0) {
      game.player.rowAnim = Math.max(0, game.player.rowAnim - dt);
    }
    if (game.rowingBoost > 0) {
      game.rowingBoost = Math.max(0, game.rowingBoost - dt * 0.4);
    }
    if (game.rowingBoostZ !== 0) {
      game.rowingBoostZ = Math.abs(game.rowingBoostZ) < 0.01
        ? 0
        : game.rowingBoostZ - Math.sign(game.rowingBoostZ) * dt * 0.4;
    }
    game.player.stamina = Math.min(100, game.player.stamina + dt * 4);
    if (game.heat) {
      game.player.thirst = Math.max(0, game.player.thirst - dt * 0.2);
    }

    if (game.player.sanity < 40) {
      game.hallucinationTimer -= dt;
      if (game.hallucinationTimer <= 0) {
        game.hallucinationTimer = Util.rand(6, 14);
        const messages = [
          '¿Has oído eso?',
          'El mar susurra tu nombre...',
          '¿Era una sombra?',
          'No estás solo...',
          '¿Dónde está todo el mundo?'
        ];
        game.showEventMessage(Util.choice(messages));
      }
    }

    game.updateHook(dt);
    if (game.paused || game.state !== 'playing') {
      Input.resetClick();
      return;
    }
    game.updateEntities(dt);
    game.updateProduction(dt);
    game.checkEvents(dt);
    game.checkWinLose();
    if (game.state !== 'playing' || game.checkRouteVictory()) {
      Input.resetClick();
      return;
    }
    game.updateObjective();
    game.updateUI();
    game.updateHighlights();

    FloatingText.update(dt);
    Particles.update(dt);

    if (Input.mouse.clicked) game.handleLeftClick();
    if (Input.mouse.rightClicked) game.handleRightClick();
    Input.resetClick();

    if (Input.wasPressed('KeyB')) {
      if (BuildManager.placing) BuildManager.stopPlacing();
      BuildManager.toggle();
      game.updateBuildMenu();
    }
    if (Input.wasPressed('KeyE')) game.interact();
    if (Input.wasPressed('Escape')) {
      game.closeAllModals();
      BuildManager.close();
      game.raft.selected = null;
    }
  },

  resetPlayerState(game, saved = null) {
    const source = saved && typeof saved === 'object' ? saved : {};
    const numberOr = (value, fallback) => {
      const number = Number(value);
      return Number.isFinite(number) ? number : fallback;
    };
    game.player = {
      x: numberOr(source.x, 1),
      z: numberOr(source.z, 1),
      vx: 0,
      vz: 0,
      speed: 6,
      health: Util.clamp(numberOr(source.health, 100), 0, 100),
      hunger: Util.clamp(numberOr(source.hunger, 90), 0, 100),
      thirst: Util.clamp(numberOr(source.thirst, 90), 0, 100),
      morale: Util.clamp(numberOr(source.morale, 75), 0, 100),
      stamina: Util.clamp(numberOr(source.stamina, 100), 0, 100),
      sanity: Util.clamp(numberOr(source.sanity, 100), 0, 100),
      foodCredit: Util.clamp(
        numberOr(source.foodCredit, 0),
        0,
        SURVIVAL_BALANCE.playerFoodNeed
      ),
      hook: null,
      hookRange: 8,
      hookSpeed: 11,
      moveTarget: null,
      movePath: [],
      moveDestination: null,
      rowTarget: null,
      rowAnim: 0
    };
  },

  resetTransientState(game) {
    game.rowingBoost = 0;
    game.rowingBoostZ = 0;
    game.rowingCooldown = 0;
    game.hallucinationTimer = 0;
    game.crewConflict = { active: false };
    game.pendingDaySummary = null;
    game.mouseWorld = null;
    game.elapsed = 0;
    if (typeof GameRenderer !== 'undefined') GameRenderer.visualElapsed = 0;
    game.raft.selected = null;
  },

  ensurePlayerOnRaft(game) {
    const player = game.player;
    const current = game.raft.worldToGrid(player.x, player.z);
    if (game.raft.has(current.gx, current.gy)) return true;

    let nearest = null;
    let nearestDistance = Infinity;
    const cellSize = game.raft.cellSize;
    for (const key of game.raft.grid.keys()) {
      const [gx, gy] = key.split(',').map(Number);
      const x = (gx + 0.5) * cellSize;
      const z = (gy + 0.5) * cellSize;
      const distance = Math.hypot(x - player.x, z - player.z);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = { x, z };
      }
    }
    if (!nearest) return false;

    player.x = nearest.x;
    player.z = nearest.z;
    player.vx = 0;
    player.vz = 0;
    player.moveTarget = null;
    player.movePath = [];
    player.moveDestination = null;
    player.rowTarget = null;
    return true;
  },

  planPlayerPath(game, targetGx, targetGy) {
    const player = game.player;
    if (!GameSimulation.ensurePlayerOnRaft(game) ||
        !game.raft.has(targetGx, targetGy)) return false;
    const start = game.raft.worldToGrid(player.x, player.z);
    const path = game.raft.findPath(
      start.gx,
      start.gy,
      targetGx,
      targetGy
    );
    if (!path) return false;
    player.moveDestination = { gx: targetGx, gy: targetGy };
    player.movePath = path.slice(1);
    player.moveTarget = player.movePath.shift() || null;
    if (!player.moveTarget) player.moveDestination = null;
    return true;
  },

  startRowingTowards(game, worldX, worldZ) {
    if (game.rowingCooldown > 0) return false;
    const cellSize = game.raft.cellSize;
    let best = null;
    let bestDistance = Infinity;
    for (const key of game.raft.grid.keys()) {
      const [gx, gy] = key.split(',').map(Number);
      const centerX = (gx + 0.5) * cellSize;
      const centerZ = (gy + 0.5) * cellSize;
      const distance = Math.hypot(centerX - worldX, centerZ - worldZ);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = { gx, gy, centerX, centerZ };
      }
    }
    if (!best) return false;

    const targetX = Util.clamp(
      worldX,
      best.centerX - cellSize / 2 + 0.15,
      best.centerX + cellSize / 2 - 0.15
    );
    const targetZ = Util.clamp(
      worldZ,
      best.centerZ - cellSize / 2 + 0.15,
      best.centerZ + cellSize / 2 - 0.15
    );
    const center = game.raft.getCenter();
    const pushX = center.x - worldX;
    const pushZ = center.z - worldZ;
    const pushLength = Math.hypot(pushX, pushZ) || 1;
    game.player.rowTarget = {
      x: targetX,
      z: targetZ,
      gx: best.gx,
      gy: best.gy,
      pushX: pushX / pushLength,
      pushZ: pushZ / pushLength
    };
    if (!GameSimulation.planPlayerPath(game, best.gx, best.gy)) {
      game.player.rowTarget = null;
      return false;
    }
    game.showFloatingText(
      game.player.x,
      game.player.z,
      'Ve al borde a remar',
      '#4fc3f7'
    );
    return true;
  },

  row(game) {
    if (game.rowingCooldown > 0) return false;
    if (game.player.stamina < 30) {
      game.rowingCooldown = 0.75;
      game.showFloatingText(
        game.player.x,
        game.player.z,
        'Demasiado cansado',
        '#ef5350'
      );
      return false;
    }
    const player = game.player;
    const center = game.raft.getCenter();
    const edgeX = center.x - player.x;
    const edgeZ = center.z - player.z;
    const edgeLength = Math.hypot(edgeX, edgeZ);
    const push = player.rowTarget
      ? {
          x: player.rowTarget.pushX ?? -1,
          z: player.rowTarget.pushZ ?? 0
        }
      : (edgeLength > 0.25
          ? { x: edgeX / edgeLength, z: edgeZ / edgeLength }
          : { x: -1, z: 0 });
    game.rowingBoost = 3.5 * Math.abs(push.x);
    game.rowingBoostZ = 3.5 * push.z;
    game.rowingCooldown = 2;
    player.rowAnim = 0.65;
    player.stamina = Math.max(0, player.stamina - 35);
    player.hunger = Math.max(0, player.hunger - 2);
    player.thirst = Math.max(0, player.thirst - 3);

    const rudderEfficiency = Util.clamp(
      game.raft.countProvides('rudder'),
      0,
      1
    );
    if (rudderEfficiency > 0 && Math.abs(push.z) > 0.05) {
      game.navigationHeading = Util.clamp(
        game.navigationHeading +
          push.z * NAVIGATION_BALANCE.headingStep * rudderEfficiency,
        -NAVIGATION_BALANCE.maxHeading,
        NAVIGATION_BALANCE.maxHeading
      );
    }
    if (game.victoryCondition === 'island' && game.islandDistance > 0) {
      const routeControl = 0.5 + rudderEfficiency * 0.5;
      const routeProgress =
        NAVIGATION_BALANCE.rowRouteMeters *
        routeControl *
        game.loadSpeedMultiplier();
      game.islandDistance = Math.max(0, game.islandDistance - routeProgress);
      GameSimulation.checkRouteVictory(game);
    }

    for (let index = 0; index < 3; index++) {
      const backX = player.x - push.x * (1 + Util.rand(0, 1));
      const backZ = player.z - push.z * (1 + Util.rand(0, 1));
      Particles.emit(
        backX,
        0.3,
        backZ,
        '#dcf5ff',
        10,
        3 + Util.rand(0, 2)
      );
    }
    AudioSys.play('hook');
    game.showFloatingText(player.x, player.z, '¡Remando!', '#4fc3f7');
    player.rowTarget = null;
    return true;
  },

  updatePlayer(game, dt) {
    const player = game.player;
    const cellSize = game.raft.cellSize;
    if (!GameSimulation.ensurePlayerOnRaft(game)) return;
    const manualMove =
      Input.isDown('KeyW') || Input.isDown('ArrowUp') ||
      Input.isDown('KeyS') || Input.isDown('ArrowDown') ||
      Input.isDown('KeyA') || Input.isDown('ArrowLeft') ||
      Input.isDown('KeyD') || Input.isDown('ArrowRight');
    if (manualMove) {
      player.moveTarget = null;
      player.movePath = [];
      player.moveDestination = null;
      player.rowTarget = null;
    }

    if (player.moveTarget &&
        !game.raft.has(player.moveTarget.gx, player.moveTarget.gy)) {
      const destination = player.moveDestination;
      player.moveTarget = null;
      player.movePath = [];
      player.moveDestination = null;
      if (destination && game.raft.has(destination.gx, destination.gy)) {
        GameSimulation.planPlayerPath(
          game,
          destination.gx,
          destination.gy
        );
      } else {
        player.rowTarget = null;
      }
    }
    if (player.moveTarget) {
      const targetX = (player.moveTarget.gx + 0.5) * cellSize;
      const targetZ = (player.moveTarget.gy + 0.5) * cellSize;
      const deltaX = targetX - player.x;
      const deltaZ = targetZ - player.z;
      const distance = Math.hypot(deltaX, deltaZ);
      if (distance < 0.2) {
        player.x = targetX;
        player.z = targetZ;
        player.vx = 0;
        player.vz = 0;
        player.moveTarget = player.movePath.shift() || null;
        if (!player.moveTarget) player.moveDestination = null;
      } else {
        const speed = player.speed * 1.3;
        player.vx = deltaX / distance * speed;
        player.vz = deltaZ / distance * speed;
        const previousX = player.x;
        const previousZ = player.z;
        player.x += player.vx * dt;
        player.z += player.vz * dt;
        const nextCell = game.raft.worldToGrid(player.x, player.z);
        if (!game.raft.has(nextCell.gx, nextCell.gy)) {
          const previousCell =
            game.raft.worldToGrid(previousX, previousZ);
          if (game.raft.has(previousCell.gx, previousCell.gy)) {
            player.x = previousX;
            player.z = previousZ;
          }
        }
      }
      return;
    }

    if (player.rowTarget) {
      if (Number.isInteger(player.rowTarget.gx) &&
          Number.isInteger(player.rowTarget.gy) &&
          !game.raft.has(player.rowTarget.gx, player.rowTarget.gy)) {
        player.rowTarget = null;
        player.vx = 0;
        player.vz = 0;
        return;
      }
      const deltaX = player.rowTarget.x - player.x;
      const deltaZ = player.rowTarget.z - player.z;
      const distance = Math.hypot(deltaX, deltaZ);
      if (distance < 0.2) {
        GameSimulation.row(game);
        player.vx = 0;
        player.vz = 0;
      } else {
        const speed = player.speed * 1.4;
        player.vx = deltaX / distance * speed;
        player.vz = deltaZ / distance * speed;
        const previousX = player.x;
        const previousZ = player.z;
        player.x += player.vx * dt;
        player.z += player.vz * dt;
        const nextCell = game.raft.worldToGrid(player.x, player.z);
        if (!game.raft.has(nextCell.gx, nextCell.gy)) {
          const previousCell =
            game.raft.worldToGrid(previousX, previousZ);
          if (game.raft.has(previousCell.gx, previousCell.gy)) {
            player.x = previousX;
            player.z = previousZ;
          }
        }
      }
      return;
    }

    let inputX = 0;
    let inputZ = 0;
    if (Input.isDown('KeyW') || Input.isDown('ArrowUp')) inputZ -= 1;
    if (Input.isDown('KeyS') || Input.isDown('ArrowDown')) inputZ += 1;
    if (Input.isDown('KeyA') || Input.isDown('ArrowLeft')) inputX -= 1;
    if (Input.isDown('KeyD') || Input.isDown('ArrowRight')) inputX += 1;
    if (inputX !== 0 || inputZ !== 0) {
      const length = Math.hypot(inputX, inputZ) || 1;
      inputX /= length;
      inputZ /= length;
      const cameraYaw = Number(World.cameraYaw) || 0;
      const cosine = Math.cos(cameraYaw);
      const sine = Math.sin(cameraYaw);
      const worldX = inputX * cosine + inputZ * sine;
      const worldZ = -inputX * sine + inputZ * cosine;
      inputX = worldX;
      inputZ = worldZ;
    }

    player.vx = inputX * player.speed;
    player.vz = inputZ * player.speed;

    const previousX = player.x;
    const previousZ = player.z;
    player.x += player.vx * dt;
    player.z += player.vz * dt;

    const nextCell = game.raft.worldToGrid(player.x, player.z);
    if (!game.raft.has(nextCell.gx, nextCell.gy)) {
      const previousCell = game.raft.worldToGrid(previousX, previousZ);
      if (game.raft.has(previousCell.gx, previousCell.gy)) {
        player.x = previousX;
        player.z = previousZ;
      } else {
        let nearest = null;
        let nearestDistance = Infinity;
        for (const key of game.raft.grid.keys()) {
          const [gx, gy] = key.split(',').map(Number);
          const centerX = (gx + 0.5) * cellSize;
          const centerZ = (gy + 0.5) * cellSize;
          const distance = Math.hypot(
            centerX - player.x,
            centerZ - player.z
          );
          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearest = { x: centerX, z: centerZ };
          }
        }
        if (nearest) {
          player.x = nearest.x;
          player.z = nearest.z;
        }
      }
    }

    const bounds = game.raft.getBounds();
    player.x = Util.clamp(
      player.x,
      bounds.minX * cellSize + 0.3,
      (bounds.maxX + 1) * cellSize - 0.3
    );
    player.z = Util.clamp(
      player.z,
      bounds.minY * cellSize + 0.3,
      (bounds.maxY + 1) * cellSize - 0.3
    );
  },

  offerIslandRoute(game) {
    const sail = game.raft.countProvides('sail');
    const rudder = game.raft.countProvides('rudder');
    if (sail <= 0 || rudder <= 0) {
      game.showFloatingText(
        game.player.x,
        game.player.z,
        'Necesitas vela y timón operativos',
        '#ef5350'
      );
      return false;
    }
    if (game.victoryCondition === 'island') {
      game.showFloatingText(
        game.player.x,
        game.player.z,
        `Isla: ${Math.max(0, game.islandDistance).toFixed(0)} m`,
        '#4fc3f7'
      );
      return true;
    }

    const switching = game.victoryCondition === 'radio';
    const motor = game.raft.countProvides('motor');
    const fuel = Math.max(0, game.resources.fuel || 0);
    const propulsion = motor > 0
      ? (fuel > 0
        ? 'El motor consumirá combustible y acelerará el viaje.'
        : 'El motor está sin combustible; podrás avanzar a vela y repostarlo después.')
      : 'La vela impulsará la balsa; el motor es opcional.';
    game.showDecision(
      'Navegar hacia la isla',
      `Vela y timón listos. ${propulsion}` +
        (switching
          ? ' La señal de radio quedará en pausa, pero conservará su progreso.'
          : '') +
        ' ¿Partir?',
      [
        {
          label: 'Sí',
          action: () => {
            const initialDistance = Math.max(150, 300 - game.navigationIntel);
            if (!Number.isFinite(game.islandDistance) ||
                game.islandDistance > initialDistance) {
              game.islandDistance = initialDistance;
            }
            game.victoryCondition = 'island';
            Log.add(game.navigationIntel > 0
              ? `Las historias de la tripulación sitúan la isla a ${game.islandDistance.toFixed(0)} m.`
              : 'Has decidido navegar hacia una isla.');
            GameSimulation.checkRouteVictory(game);
          }
        },
        { label: 'No', action: () => {} }
      ]
    );
    return true;
  },

  offerRadioRoute(game) {
    if (game.victoryCondition === 'radio') {
      game.showFloatingText(
        game.player.x,
        game.player.z,
        `Señal automática ${game.rescuedSignal.toFixed(0)}%`
      );
      return true;
    }
    const switching = game.victoryCondition === 'island';
    const resume = game.rescuedSignal > 0;
    game.showDecision(
      resume ? 'Reanudar señal de socorro' : 'Señal de socorro',
      (resume
        ? `La emisión conserva ${game.rescuedSignal.toFixed(0)}% de progreso.`
        : 'La radio puede emitir una señal continua mientras siga operativa.') +
        (switching
          ? ' La navegación a la isla quedará en pausa y conservará la distancia alcanzada.'
          : '') +
        ' ¿Emitir por radio?',
      [
        {
          label: 'Sí',
          action: () => {
            game.victoryCondition = 'radio';
            game.rescuedSignal = Math.max(
              1,
              game.rescuedSignal,
              1 + game.radioIntel
            );
            Log.add(resume
              ? 'La radio reanuda la señal de socorro.'
              : 'La radio comienza a emitir señal de socorro.');
            GameSimulation.checkRouteVictory(game);
          }
        },
        { label: 'No', action: () => {} }
      ]
    );
    return true;
  },

  updateObjective(game) {
    const area = game.raft.totalArea();
    const crew = CrewManager.count();
    if (game.victoryCondition === 'radio') {
      game.currentObjective = 5;
      GameUI.setObjective(
        `Mantén la radio operativa · Señal ${game.rescuedSignal.toFixed(0)}%`
      );
      return;
    }
    if (game.victoryCondition === 'island') {
      game.currentObjective = 5;
      GameUI.setObjective(
        `Mantén vela y timón operativos · Isla a ${Math.max(0, game.islandDistance).toFixed(0)} m`
      );
      return;
    }

    let index;
    if (game.resources.food < 3 || game.resources.water < 3) index = 0;
    else if (area < 4) index = 1;
    else if (game.raft.totalAutoFood() <= 0 &&
             game.raft.totalAutoWater() <= 0) index = 2;
    else if (crew < 1) index = 3;
    else if (game.raft.countProvides('sail') <= 0 ||
             game.raft.countProvides('rudder') <= 0) index = 4;
    else index = 5;
    game.currentObjective = index;
    GameUI.setObjective(game.objectives[index]);
  },

  checkRouteVictory(game) {
    if (game.state !== 'playing') return false;
    if (game.victoryCondition === 'radio' && game.rescuedSignal >= 100) {
      game.triggerWin('radio');
      return true;
    }
    if (game.victoryCondition === 'island' && game.islandDistance <= 0) {
      game.triggerWin('island');
      return true;
    }
    return false;
  },

  resolveUnstoredSpoilage(game) {
    if (!game?.resources || !game.raft ||
        game.raft.countProvides('storage') > 0 ||
        game.day <= 2) return null;
    const seed = (
      Math.imul(Math.floor(game.day), 2654435761) ^
      Math.imul(Math.floor(game.stats?.rescued || 0) + 1, 2246822519)
    ) >>> 0;
    const roll = seed / 4294967296;
    if (roll >= 0.18) return null;
    const foodLost = Math.min(
      Math.max(0, game.resources.food || 0),
      Math.min(0.25, (game.resources.food || 0) * 0.12)
    );
    const waterLost = Math.min(
      Math.max(0, game.resources.water || 0),
      Math.min(0.35, (game.resources.water || 0) * 0.12)
    );
    if (foodLost <= 0 && waterLost <= 0) return null;
    game.resources.food = Math.max(0, game.resources.food - foodLost);
    game.resources.water = Math.max(0, game.resources.water - waterLost);
    return `Sin almacenamiento se estropearon ${foodLost.toFixed(1)} de comida y ${waterLost.toFixed(1)} de agua.`;
  },

  getDailyNeeds(game) {
    const crewCount = CrewManager.count();
    const playerFoodCredit = Util.clamp(
      Number(game.player.foodCredit) || 0,
      0,
      SURVIVAL_BALANCE.playerFoodNeed
    );
    return {
      playerFood: SURVIVAL_BALANCE.playerFoodNeed,
      playerFoodCredit,
      playerFoodFromStores:
        SURVIVAL_BALANCE.playerFoodNeed - playerFoodCredit,
      playerWater: SURVIVAL_BALANCE.playerWaterNeed,
      crewFood: CrewManager.getDailyFoodNeed(),
      crewWater: crewCount * SURVIVAL_BALANCE.crewWaterNeed
    };
  },

  resolveDailySupplies(game) {
    const needs = GameSimulation.getDailyNeeds(game);
    const totalFoodNeed = needs.playerFoodFromStores + needs.crewFood;
    const totalWaterNeed = needs.playerWater + needs.crewWater;
    const foodConsumed = Math.min(
      Math.max(0, game.resources.food || 0),
      totalFoodNeed
    );
    const waterConsumed = Math.min(
      Math.max(0, game.resources.water || 0),
      totalWaterNeed
    );
    game.resources.food = Math.max(
      0,
      (game.resources.food || 0) - foodConsumed
    );
    game.resources.water = Math.max(
      0,
      (game.resources.water || 0) - waterConsumed
    );

    const playerFoodFromStores = totalFoodNeed > 0
      ? needs.playerFoodFromStores / totalFoodNeed * foodConsumed
      : 0;
    const playerFoodShare = Math.min(
      needs.playerFood,
      needs.playerFoodCredit + playerFoodFromStores
    );
    const playerWaterShare = totalWaterNeed > 0
      ? needs.playerWater / totalWaterNeed * waterConsumed
      : 0;
    const foodRatio = Util.clamp(
      playerFoodShare / Math.max(0.01, needs.playerFood),
      0,
      1
    );
    const waterRatio = Util.clamp(
      playerWaterShare / Math.max(0.01, needs.playerWater),
      0,
      1
    );

    game.player.hunger += -SURVIVAL_BALANCE.hungerDrain +
      SURVIVAL_BALANCE.hungerFromFullRation * foodRatio;
    game.player.thirst += -SURVIVAL_BALANCE.thirstDrain +
      SURVIVAL_BALANCE.thirstFromFullRation * waterRatio;

    if (foodRatio < SURVIVAL_BALANCE.fedThreshold) {
      const severity = SURVIVAL_BALANCE.fedThreshold - foodRatio;
      game.player.health -= severity * SURVIVAL_BALANCE.foodShortageDamage;
      game.player.morale -= (1 - foodRatio) * 5;
    }
    if (waterRatio < SURVIVAL_BALANCE.fedThreshold) {
      const severity = SURVIVAL_BALANCE.fedThreshold - waterRatio;
      game.player.health -= severity * SURVIVAL_BALANCE.waterShortageDamage;
      game.player.morale -= (1 - waterRatio) * 8;
    }
    if (foodRatio >= 0.9 && waterRatio >= 0.9) {
      game.player.health = Math.min(100, game.player.health + 2);
    }

    game.clampPlayerStats();
    if (game.player.hunger <= 0) {
      game.player.health -= SURVIVAL_BALANCE.criticalHungerDamage;
    }
    if (game.player.thirst <= 0) {
      game.player.health -= SURVIVAL_BALANCE.criticalThirstDamage;
    }
    game.clampPlayerStats();

    const crewFoodShare = Math.max(0, foodConsumed - playerFoodFromStores);
    const crewWaterShare = Math.max(0, waterConsumed - playerWaterShare);
    CrewManager.dailyUpdateByShare(
      crewFoodShare,
      crewWaterShare,
      game.storm
    );
    game.player.foodCredit = 0;

    return {
      ...needs,
      foodConsumed,
      waterConsumed,
      playerFoodShare,
      playerFoodFromStores,
      playerWaterShare,
      foodRatio,
      waterRatio
    };
  },

  getNavigationState(game) {
    return {
      sail: Util.clamp(game.raft.countProvides('sail'), 0, 1),
      rudder: Util.clamp(game.raft.countProvides('rudder'), 0, 1),
      motor: Util.clamp(game.raft.countProvides('motor'), 0, 1),
      fuel: Math.max(0, Number(game.resources.fuel) || 0),
      heading: Util.clamp(
        Number(game.navigationHeading) || 0,
        -NAVIGATION_BALANCE.maxHeading,
        NAVIGATION_BALANCE.maxHeading
      )
    };
  },

  refuelMotor(game) {
    if ((game.resources.plastic || 0) < 1) return false;
    game.resources.plastic -= 1;
    game.resources.fuel =
      Math.max(0, game.resources.fuel || 0) +
      NAVIGATION_BALANCE.plasticFuelYield;
    return true;
  },

  resolveNavigationDay(game) {
    if (game.victoryCondition !== 'island') {
      return { moved: 0, fuelConsumed: 0 };
    }
    if (game.islandDistance <= 0) {
      game.triggerWin('island');
      return { moved: 0, fuelConsumed: 0, arrived: true };
    }
    const navigation = GameSimulation.getNavigationState(game);
    if (navigation.sail <= 0 || navigation.rudder <= 0) {
      Log.add(
        'El viaje a la isla se detiene: la vela o el timón no funcionan.'
      );
      return { moved: 0, fuelConsumed: 0 };
    }

    let fuelConsumed = 0;
    let motorFuelRatio = 0;
    if (navigation.motor > 0) {
      const fuelNeeded =
        NAVIGATION_BALANCE.motorFuelPerDay * navigation.motor;
      fuelConsumed = Math.min(navigation.fuel, fuelNeeded);
      game.resources.fuel = Math.max(
        0,
        navigation.fuel - fuelConsumed
      );
      motorFuelRatio = fuelNeeded > 0 ? fuelConsumed / fuelNeeded : 0;
      if (motorFuelRatio < 1) {
        Log.add(fuelConsumed > 0
          ? 'El motor se queda sin combustible durante la jornada; la vela mantiene el rumbo.'
          : 'El motor está sin combustible; la vela mantiene el rumbo.');
      }
    }

    const steeringEfficiency = 0.35 + navigation.rudder * 0.65;
    const propulsion =
      navigation.sail * NAVIGATION_BALANCE.sailMetersPerDay +
      navigation.motor * motorFuelRatio *
        NAVIGATION_BALANCE.motorMetersPerDay +
      CrewManager.getDriftBonus() *
        NAVIGATION_BALANCE.navigatorMetersPerDay;
    const moved =
      propulsion * steeringEfficiency * game.loadSpeedMultiplier();
    game.islandDistance = Math.max(0, game.islandDistance - moved);
    if (game.islandDistance <= 0) game.triggerWin('island');
    return { moved, fuelConsumed, motorFuelRatio };
  }
});
