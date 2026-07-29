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
        !BuildManager.active && !BuildManager.placing && !game.player.rowTarget) {
      game.row();
    }
    if (game.rowingCooldown > 0) game.rowingCooldown -= dt;
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
