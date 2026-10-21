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

const CHART_REGION_TYPES = Object.freeze([
  'debris', 'fish', 'polluted', 'reef', 'storm', 'ship'
]);

const GameSimulation = Object.freeze({
  hashSeed(seed, salt = 0) {
    let h = ((Number(seed) || 1) ^ Math.imul(Number(salt) || 0, 0x9e3779b9)) >>> 0;
    h ^= h >>> 16;
    h = Math.imul(h, 0x85ebca6b) >>> 0;
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35) >>> 0;
    h ^= h >>> 16;
    return h >>> 0;
  },

  seededUnit(seed, salt = 0) {
    return GameSimulation.hashSeed(seed, salt) / 4294967296;
  },

  normalizeSeed(seed) {
    const num = Number(seed);
    if (Number.isFinite(num) && num !== 0) {
      return (Math.floor(Math.abs(num)) >>> 0) || 1;
    }
    return ((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0) || 1;
  },

  computeIslandBearing(seed) {
    const u = GameSimulation.seededUnit(seed, 101);
    const sign = (GameSimulation.hashSeed(seed, 102) & 1) === 0 ? 1 : -1;
    // La isla nunca está en línea recta (z = 0): desviación lateral de ~16° a 28°
    return sign * (0.28 + u * 0.2);
  },

  buildRegions(seed, islandX, islandZ) {
    const s = GameSimulation.normalizeSeed(seed);
    const bearing = Math.atan2(islandZ, islandX);
    const perpX = -Math.sin(bearing);
    const perpZ = Math.cos(bearing);
    const dirX = Math.cos(bearing);
    const dirZ = Math.sin(bearing);
    const jitter = (salt, span) =>
      (GameSimulation.seededUnit(s, salt) * 2 - 1) * span;

    // Cadena de arrecifes interpuesta en la línea directa y regiones repartidas
    // por la carta para que virar y elegir rumbo importen.
    const templates = [
      {
        id: 'debris-near',
        type: 'debris',
        along: 44 + jitter(1, 6),
        lateral: -10 + jitter(2, 5),
        radius: 26,
        borderWidth: 7
      },
      {
        id: 'fish-shoal',
        type: 'fish',
        along: 78 + jitter(3, 8),
        lateral: 26 + jitter(4, 6),
        radius: 28,
        borderWidth: 8
      },
      {
        id: 'reef-chain-main',
        type: 'reef',
        // En la línea recta desde el origen (+X) y cerca de la derrota directa:
        // obliga a virar para rodearla o cruzar con cuidado.
        x: 118 + jitter(5, 8),
        z: 6 + jitter(6, 5),
        radius: 28,
        borderWidth: 7,
        angle: bearing + 0.95,
        length: 34
      },
      {
        id: 'polluted-slick',
        type: 'polluted',
        along: 145 + jitter(7, 10),
        lateral: -34 + jitter(8, 7),
        radius: 30,
        borderWidth: 8
      },
      {
        id: 'storm-cell-main',
        type: 'storm',
        along: 175 + jitter(9, 10),
        lateral: 22 + jitter(10, 8),
        radius: 34,
        borderWidth: 10
      },
      {
        id: 'ship-lane-main',
        type: 'ship',
        along: 210 + jitter(11, 10),
        lateral: -24 + jitter(12, 8),
        radius: 32,
        borderWidth: 9,
        angle: bearing - 0.55,
        length: 44
      },
      {
        id: 'reef-chain-outer',
        type: 'reef',
        along: 242 + jitter(13, 8),
        lateral: 14 + jitter(14, 6),
        radius: 25,
        borderWidth: 7,
        angle: bearing + 1.1,
        length: 28
      },
      {
        id: 'debris-far',
        type: 'debris',
        along: 112 + jitter(15, 10),
        lateral: 46 + jitter(16, 8),
        radius: 26,
        borderWidth: 7
      },
      {
        id: 'fish-outer',
        type: 'fish',
        along: 255 + jitter(17, 10),
        lateral: -18 + jitter(18, 6),
        radius: 26,
        borderWidth: 7
      },
      {
        id: 'polluted-outer',
        type: 'polluted',
        along: 88 + jitter(19, 10),
        lateral: -52 + jitter(20, 8),
        radius: 27,
        borderWidth: 8
      },
      {
        id: 'storm-cell-outer',
        type: 'storm',
        along: 95 + jitter(21, 10),
        lateral: 58 + jitter(22, 8),
        radius: 32,
        borderWidth: 9
      },
      {
        id: 'ship-lane-west',
        type: 'ship',
        along: 58 + jitter(23, 8),
        lateral: -44 + jitter(24, 6),
        radius: 28,
        borderWidth: 8,
        angle: 0.35,
        length: 36
      }
    ];

    return templates.map((tpl, idx) => {
      const rx = Number.isFinite(tpl.x)
        ? tpl.x
        : dirX * tpl.along + perpX * tpl.lateral;
      const rz = Number.isFinite(tpl.z)
        ? tpl.z
        : dirZ * tpl.along + perpZ * tpl.lateral;
      return {
        id: tpl.id || `region-${idx}`,
        type: tpl.type,
        x: Math.round(rx * 100) / 100,
        z: Math.round(rz * 100) / 100,
        radius: tpl.radius,
        borderWidth: tpl.borderWidth || Math.round(tpl.radius * 0.28),
        angle: Number.isFinite(tpl.angle) ? tpl.angle : 0,
        length: Number.isFinite(tpl.length) ? tpl.length : 0,
        visited: false,
        discovered: false,
        reefsSpawned: false
      };
    });
  },

  initChart(game, seed = null) {
    const normalizedSeed = GameSimulation.normalizeSeed(
      seed ?? game.nextWorldSeed ?? game.worldSeed
    );
    game.worldSeed = normalizedSeed;
    game.chartX = 0;
    game.chartZ = 0;
    game.chartVx = 0;
    game.chartVz = 0;
    game.currentSpeed = 0;
    game.currentSpeedZ = 0;
    const bearing = GameSimulation.computeIslandBearing(normalizedSeed);
    game.islandBearing = bearing;
    const initialDistance = 300;
    game.islandX = Math.cos(bearing) * initialDistance;
    game.islandZ = Math.sin(bearing) * initialDistance;
    game.islandRevealed = false;
    game.islandIntelApplied = 0;
    const shipSign = (GameSimulation.hashSeed(normalizedSeed, 303) & 1) === 0 ? -1 : 1;
    game.rescueShipBearing = shipSign * (0.45 + GameSimulation.seededUnit(normalizedSeed, 304) * 0.5);
    game.regions = GameSimulation.buildRegions(
      normalizedSeed,
      game.islandX,
      game.islandZ
    );
    game.currentRegion = null;
    game.regionBlend = 0;
    game.chartTrail = [{ x: 0, z: 0 }];
    game.currentVector = GameSimulation.getCurrentAt(normalizedSeed, 0, 0, game);
    game.windOverride = null;
    GameSimulation.getWindAt(game);
  },

  recordChartTrail(game) {
    if (!game) return;
    if (!Array.isArray(game.chartTrail) || game.chartTrail.length === 0) {
      game.chartTrail = [{ x: 0, z: 0 }];
    }
    const cx = Math.round((Number(game.chartX) || 0) * 100) / 100;
    const cz = Math.round((Number(game.chartZ) || 0) * 100) / 100;
    const last = game.chartTrail[game.chartTrail.length - 1];
    if (!last || Math.hypot(cx - last.x, cz - last.z) >= 3.2) {
      game.chartTrail.push({ x: cx, z: cz });
      if (game.chartTrail.length > 160) {
        const origin = game.chartTrail[0] || { x: 0, z: 0 };
        game.chartTrail = [origin, ...game.chartTrail.slice(-159)];
      }
    }
  },

  setNavigationHeading(game, heading) {
    if (!game) return 0;
    const clamped = Util.clamp(
      Number(heading) || 0,
      -NAVIGATION_BALANCE.maxHeading,
      NAVIGATION_BALANCE.maxHeading
    );
    game.navigationHeading = Math.round(clamped * 100) / 100;
    GameSimulation.computeChartVelocity(game);
    return game.navigationHeading;
  },

  setHeadingFromChartTarget(game, targetX, targetZ) {
    if (!game) return 0;
    const cx = Number(game.chartX) || 0;
    const cz = Number(game.chartZ) || 0;
    const tx = Number(targetX);
    const tz = Number(targetZ);
    if (!Number.isFinite(tx) || !Number.isFinite(tz)) {
      return game.navigationHeading || 0;
    }
    let refAngle = 0;
    if (game.victoryCondition === 'island' &&
        Number.isFinite(game.islandX) && Number.isFinite(game.islandZ)) {
      const ix = game.islandX - cx;
      const iz = game.islandZ - cz;
      if (Math.hypot(ix, iz) > 1) refAngle = Math.atan2(iz, ix);
    }
    const dx = tx - cx;
    const dz = tz - cz;
    const dist = Math.hypot(dx, dz);
    if (dist < 1) return game.navigationHeading || 0;
    const targetAngle = Math.atan2(dz, dx);
    const deltaAngle = Math.atan2(
      Math.sin(targetAngle - refAngle),
      Math.cos(targetAngle - refAngle)
    );
    const normalizedHeading = Util.clamp(
      deltaAngle / 0.52,
      -NAVIGATION_BALANCE.maxHeading,
      NAVIGATION_BALANCE.maxHeading
    );
    return GameSimulation.setNavigationHeading(game, normalizedHeading);
  },

  getChartSnapshot(game) {
    if (!Array.isArray(game.regions) || game.regions.length === 0) {
      GameSimulation.initChart(game, game.worldSeed);
    }
    GameSimulation.recordChartTrail(game);
    const cx = Number(game.chartX) || 0;
    const cz = Number(game.chartZ) || 0;
    const ix = Number.isFinite(Number(game.islandX)) ? Number(game.islandX) : 285;
    const iz = Number.isFinite(Number(game.islandZ)) ? Number(game.islandZ) : 90;
    const trail = [
      ...(Array.isArray(game.chartTrail) ? game.chartTrail : [{ x: 0, z: 0 }]),
      { x: Math.round(cx * 100) / 100, z: Math.round(cz * 100) / 100 }
    ];
    const lookoutBonus = game.raft ? Util.clamp(game.raft.countProvides('lookout'), 0, 2) * 18 : 0;
    const chartBonus = game.raft ? Util.clamp(game.raft.countProvides('navigation'), 0, 2) * 24 : 0;
    const discoveryHorizon = 52 + lookoutBonus + chartBonus;
    const visibleRegions = [];
    for (const r of game.regions) {
      if (!r) continue;
      const dist = Math.hypot(cx - r.x, cz - r.z);
      if (dist <= r.radius + discoveryHorizon) {
        r.discovered = true;
      }
      if (r.discovered || r.visited) {
        visibleRegions.push({
          id: r.id,
          type: r.type,
          label: typeof game.zoneName === 'function' ? game.zoneName(r.type) : r.type,
          x: r.x,
          z: r.z,
          radius: r.radius,
          visited: Boolean(r.visited),
          discovered: Boolean(r.discovered),
          active: game.currentRegion?.id === r.id,
          poi: r.poi || null
        });
      }
    }
    const revealed = Boolean(game.islandRevealed || game.victoryCondition === 'island');
    const intel = Math.max(0, Number(game.navigationIntel) || 0);
    const coneHalfAngle = revealed
      ? 0.04
      : Math.max(0.11, 0.38 - Math.min(0.24, intel * 0.0035) - (chartBonus > 0 ? 0.04 : 0));
    const islandBearingFromOrigin = Math.atan2(iz, ix);
    const islandBearingFromRaft = Math.atan2(iz - cz, ix - cx);
    const islandDistance = GameSimulation.getIslandDistance(game);

    const minX = Math.min(-25, cx - 55, ix - 30);
    const maxX = Math.max(320, cx + 65, ix + 35);
    const minZ = Math.min(-115, cz - 65, iz - 45);
    const maxZ = Math.max(115, cz + 65, iz + 45);

    const currents = [];
    const cols = 5;
    const rows = 4;
    for (let col = 0; col < cols; col++) {
      for (let row = 0; row < rows; row++) {
        const sx = minX + ((col + 0.5) / cols) * (maxX - minX);
        const sz = minZ + ((row + 0.5) / rows) * (maxZ - minZ);
        const cur = GameSimulation.getCurrentAt(game.worldSeed, sx, sz);
        currents.push({
          x: Math.round(sx * 10) / 10,
          z: Math.round(sz * 10) / 10,
          vx: cur.x,
          vz: cur.z
        });
      }
    }

    const wind = GameSimulation.getWindAt(game);
    const anchored = Boolean(
      game.anchorDeployed && game.raft && game.raft.countProvides('anchor') > 0
    );

    return {
      origin: { x: 0, z: 0 },
      raft: {
        x: cx,
        z: cz,
        vx: Number(game.chartVx) || 0,
        vz: Number(game.chartVz) || 0,
        heading: Number(game.navigationHeading) || 0,
        anchored
      },
      trail,
      regions: visibleRegions,
      currents,
      wind,
      island: {
        revealed,
        x: ix,
        z: iz,
        distance: islandDistance,
        bearingFromOrigin: islandBearingFromOrigin,
        bearingFromRaft: islandBearingFromRaft,
        coneHalfAngle
      },
      bounds: { minX, maxX, minZ, maxZ }
    };
  },

  getIslandDistance(game) {
    const ix = Number(game.islandX);
    const iz = Number(game.islandZ);
    const cx = Number(game.chartX) || 0;
    const cz = Number(game.chartZ) || 0;
    if (!Number.isFinite(ix) || !Number.isFinite(iz)) return 300;
    const raw = Math.hypot(ix - cx, iz - cz);
    return Math.round(raw * 1e6) / 1e6;
  },

  setIslandDistance(game, distance) {
    const target = Math.max(0, Number(distance) || 0);
    if (!Number.isFinite(game.islandX) || !Number.isFinite(game.islandZ)) {
      const bearing = GameSimulation.computeIslandBearing(game.worldSeed || 1);
      game.islandBearing = bearing;
      game.islandX = Math.cos(bearing) * 300;
      game.islandZ = Math.sin(bearing) * 300;
    }
    const cx = Number(game.chartX) || 0;
    const cz = Number(game.chartZ) || 0;
    const dx = cx - game.islandX;
    const dz = cz - game.islandZ;
    const currentDist = Math.hypot(dx, dz);
    let ux, uz;
    if (currentDist > 1e-6) {
      ux = dx / currentDist;
      uz = dz / currentDist;
      game._lastIslandUnitX = ux;
      game._lastIslandUnitZ = uz;
    } else if (Number.isFinite(game._lastIslandUnitX) &&
               Number.isFinite(game._lastIslandUnitZ)) {
      ux = game._lastIslandUnitX;
      uz = game._lastIslandUnitZ;
    } else {
      const len = Math.hypot(game.islandX, game.islandZ) || 1;
      ux = -game.islandX / len;
      uz = -game.islandZ / len;
    }
    game.chartX = game.islandX + ux * target;
    game.chartZ = game.islandZ + uz * target;
    return target;
  },

  placeOnIslandLine(game, distance) {
    const target = Math.max(0, Number(distance) || 0);
    if (!Number.isFinite(game.islandX) || !Number.isFinite(game.islandZ)) {
      const bearing = GameSimulation.computeIslandBearing(game.worldSeed || 1);
      game.islandBearing = bearing;
      game.islandX = Math.cos(bearing) * 300;
      game.islandZ = Math.sin(bearing) * 300;
    }
    const len = Math.hypot(game.islandX, game.islandZ) || 1;
    const ux = game.islandX / len;
    const uz = game.islandZ / len;
    game._lastIslandUnitX = -ux;
    game._lastIslandUnitZ = -uz;
    game.chartX = game.islandX - ux * target;
    game.chartZ = game.islandZ - uz * target;
    return target;
  },

  revealAndFixIsland(game) {
    if (!Number.isFinite(game.islandX) || !Number.isFinite(game.islandZ)) {
      GameSimulation.initChart(game, game.worldSeed);
    }
    const intel = Math.max(0, Number(game.navigationIntel) || 0);
    const applied = Math.max(0, Number(game.islandIntelApplied) || 0);
    if (!game.islandRevealed) {
      const unapplied = Math.max(0, intel - applied);
      if (unapplied > 0) {
        const currentDist = GameSimulation.getIslandDistance(game);
        const nextDist = Math.max(150, currentDist - unapplied);
        const dx = game.islandX - game.chartX;
        const dz = game.islandZ - game.chartZ;
        const len = Math.hypot(dx, dz) || 1;
        game.islandX = game.chartX + (dx / len) * nextDist;
        game.islandZ = game.chartZ + (dz / len) * nextDist;
      }
      game.islandIntelApplied = intel;
      game.islandRevealed = true;
      game._routeFixGrace = 0.25;
    }
    return GameSimulation.getIslandDistance(game);
  },

  getCurrentAt(seed, x = 0, z = 0) {
    const s = GameSimulation.normalizeSeed(seed);
    const p1 = GameSimulation.seededUnit(s, 11) * Math.PI * 2;
    const p2 = GameSimulation.seededUnit(s, 12) * Math.PI * 2;
    const p3 = GameSimulation.seededUnit(s, 13) * Math.PI * 2;
    const p4 = GameSimulation.seededUnit(s, 14) * Math.PI * 2;
    const px = Number(x) || 0;
    const pz = Number(z) || 0;
    const wave1 = Math.sin(px * 0.014 + pz * 0.018 + p1);
    const wave2 = Math.cos(px * -0.009 + pz * 0.013 + p2);
    const curl = Math.sin((px - pz) * 0.011 + p3);
    const vx = 0.72 + 0.22 * wave1 + 0.12 * wave2;
    const vz = 0.26 * Math.cos(px * 0.012 - pz * 0.016 + p4) + 0.16 * curl;
    return { x: vx, z: vz };
  },

  getNearestRegion(game, type = null) {
    const regions = Array.isArray(game.regions) ? game.regions : [];
    const cx = Number(game.chartX) || 0;
    const cz = Number(game.chartZ) || 0;
    let best = null;
    let bestDist = Infinity;
    for (const region of regions) {
      if (!region || (type && region.type !== type)) continue;
      const d = Math.hypot(cx - region.x, cz - region.z);
      if (d < bestDist) {
        bestDist = d;
        best = { region, distance: d };
      }
    }
    return best;
  },

  getStormPush(game) {
    const cx = Number(game.chartX) || 0;
    const cz = Number(game.chartZ) || 0;
    const nearestStorm = GameSimulation.getNearestRegion(game, 'storm');
    let regionIntensity = 0;
    let bearing = 0.6;
    let distance = Infinity;
    if (nearestStorm) {
      const { region, distance: d } = nearestStorm;
      distance = d;
      bearing = Math.atan2(region.z - cz, region.x - cx);
      const outer = region.radius * 1.45;
      if (d < outer) {
        regionIntensity = Util.clamp(1 - d / outer, 0, 1);
      }
    }
    const activeStorm = game.storm || game.zone === 'storm' ? 1 : 0;
    const intensity = Math.max(activeStorm * 0.85, regionIntensity);
    if (intensity <= 0.001) {
      return { x: 0, z: 0, intensity: 0, bearing, distance };
    }
    const pushAngle = bearing + Math.PI * 0.65;
    return {
      x: (0.42 + 0.25 * Math.cos(pushAngle)) * intensity,
      z: (0.48 * Math.sin(pushAngle) || 0.38) * intensity,
      intensity,
      bearing,
      distance
    };
  },

  evaluateChartRegion(game) {
    const regions = Array.isArray(game.regions) ? game.regions : [];
    const cx = Number(game.chartX) || 0;
    const cz = Number(game.chartZ) || 0;
    let matched = null;
    let bestBlend = 0;
    let bestScore = -Infinity;
    for (const region of regions) {
      if (!region || !Number.isFinite(region.x) || !Number.isFinite(region.z)) continue;
      const radius = Math.max(4, Number(region.radius) || 24);
      const dist = Math.hypot(cx - region.x, cz - region.z);
      if (dist <= radius + 45) region.discovered = true;
      if (dist >= radius) continue;
      const border = Math.max(3, Number(region.borderWidth) || radius * 0.28);
      const edgeDist = radius - dist;
      const blend = Util.clamp(edgeDist / border, 0.05, 1);
      const score = edgeDist / radius;
      if (score > bestScore) {
        bestScore = score;
        bestBlend = blend;
        matched = region;
      }
    }
    return {
      region: matched,
      zone: matched ? matched.type : 'calm',
      blend: matched ? bestBlend : 0
    };
  },

  syncZoneFromChart(game, silent = false) {
    if (!Array.isArray(game.regions) || game.regions.length === 0) {
      GameSimulation.initChart(game, game.worldSeed);
    }
    GameSimulation.recordChartTrail(game);
    const evalResult = GameSimulation.evaluateChartRegion(game);
    const prevZone = game.zone;
    const prevRegion = game.currentRegion;
    game.currentRegion = evalResult.region;
    game.regionBlend = evalResult.blend;
    const nextZone = evalResult.zone;
    const enteredNewRegion =
      evalResult.region && evalResult.region !== prevRegion;
    const enteredReef =
      nextZone === 'reef' &&
      (prevZone !== 'reef' || enteredNewRegion || !evalResult.region?.reefsSpawned);

    if (nextZone !== prevZone) {
      game.zone = nextZone;
      if (evalResult.region) {
        evalResult.region.visited = true;
        evalResult.region.discovered = true;
      }
      if (!silent && game.state === 'playing') {
        game.showEventMessage(game.zoneName(nextZone));
        Log.add(`Entras en ${game.zoneName(nextZone).toLowerCase()}.`);
      }
    } else if (evalResult.region) {
      evalResult.region.visited = true;
    }

    if (enteredReef && typeof EntityManager !== 'undefined') {
      if (evalResult.region) evalResult.region.reefsSpawned = true;
      const center = game.raft.getCenter();
      if (typeof EntityManager.spawnReefRegionAhead === 'function') {
        EntityManager.spawnReefRegionAhead(
          center,
          game.raft,
          evalResult.region
        );
      } else if (typeof EntityManager.spawnReef === 'function' &&
                 (!EntityManager.reefs || EntityManager.reefs.length === 0)) {
        EntityManager.spawnReef(center, game.raft);
      } else if (Array.isArray(EntityManager.reefs)) {
        const bounds = game.raft.getBounds();
        const cs = game.raft.cellSize || 2;
        const maxRaftX = Math.max((center?.x ?? 1) + 2, (bounds.maxX + 1) * cs);
        const minAheadX = Math.max((center?.x ?? 1) + 18, maxRaftX + 10);
        const offsets = [
          { x: 19, z: -4.5 },
          { x: 23, z: 1.2 },
          { x: 27, z: 6.0 }
        ];
        for (const off of offsets) {
          let rx = Math.max(minAheadX, (center?.x ?? 1) + off.x);
          const rz = (center?.z ?? 1) + off.z;
          while (game.raft.intersectsCircle(rx, rz, 2.8)) {
            rx += 4;
          }
          EntityManager.reefs.push({
            x: rx,
            z: rz,
            radius: 1.2,
            life: 55,
            active: true,
            hit: false,
            update(dt, vx, vz) {
              const safeDt = Math.max(0, Math.min(dt || 0, 0.1));
              this.x -= vx * safeDt;
              this.z -= vz * safeDt;
            },
            dispose() {}
          });
        }
      }
    }

    game.storm = game.zone === 'storm' || (game.weatherTimers?.storm || 0) > 0;
    game.rain = game.storm || (game.weatherTimers?.rain || 0) > 0;
    return evalResult;
  },

  getWindAt(game) {
    const s = GameSimulation.normalizeSeed(game?.worldSeed);
    const px = Number(game?.chartX) || 0;
    const pz = Number(game?.chartZ) || 0;
    const dayPhase = ((Number(game?.day) || 1) * 0.65) +
      ((Number(game?.time) || 8) / 24) * Math.PI * 2;
    const p1 = GameSimulation.seededUnit(s, 71) * Math.PI * 2;
    const p2 = GameSimulation.seededUnit(s, 72) * Math.PI * 2;
    const p3 = GameSimulation.seededUnit(s, 73) * Math.PI * 2;

    let angle =
      0.34 * Math.sin(px * 0.009 + pz * 0.012 + p1) +
      0.18 * Math.cos(dayPhase * 0.5 + p2);
    let strength =
      0.78 +
      0.26 * (0.5 + 0.5 * Math.sin(px * 0.007 - pz * 0.01 + p3));
    if (game?.rain) strength += 0.22;

    const stormPush = GameSimulation.getStormPush(game || {});
    if (stormPush.intensity > 0.001) {
      const stormWindAngle = Math.atan2(stormPush.z, stormPush.x);
      const blend = Util.clamp(stormPush.intensity * 0.78, 0, 0.85);
      const wx = Math.cos(angle) * (1 - blend) + Math.cos(stormWindAngle) * blend;
      const wz = Math.sin(angle) * (1 - blend) + Math.sin(stormWindAngle) * blend;
      angle = Math.atan2(wz, wx);
      strength = Math.max(strength, 1.15 + stormPush.intensity * 0.72);
    }

    if (game?.windOverride && typeof game.windOverride === 'object') {
      if (Number.isFinite(game.windOverride.angle)) {
        angle = Number(game.windOverride.angle);
      } else if (Number.isFinite(game.windOverride.x) ||
                 Number.isFinite(game.windOverride.z)) {
        angle = Math.atan2(
          Number(game.windOverride.z) || 0,
          Number(game.windOverride.x) || 0
        );
      }
      if (Number.isFinite(game.windOverride.strength)) {
        strength = Util.clamp(Number(game.windOverride.strength), 0, 2.2);
      }
    }

    strength = Util.clamp(strength, 0.25, 2.0);
    const x = Math.cos(angle) * strength;
    const z = Math.sin(angle) * strength;

    const heading = Util.clamp(
      Number(game?.navigationHeading) || 0,
      -NAVIGATION_BALANCE.maxHeading,
      NAVIGATION_BALANCE.maxHeading
    );
    const courseAngle = heading * 0.48;
    const relAngle = Math.abs(
      Math.atan2(Math.sin(angle - courseAngle), Math.cos(angle - courseAngle))
    );
    // Viento de popa / largo / través (relAngle pequeño o moderado) impulsa mejor
    // la vela; ceñir contra viento cruzado o de proa reduce el rendimiento.
    const sailAlignment = Math.cos(relAngle);
    const sailFactor = Util.clamp(1 + sailAlignment * 0.24, 0.68, 1.24);
    const label = strength >= 1.38
      ? 'vendaval'
      : relAngle < 0.58
        ? 'popa'
        : relAngle < 1.35
          ? 'través'
          : 'ceñida';

    const wind = {
      x,
      z,
      angle,
      strength,
      relAngle,
      sailAlignment,
      sailFactor,
      label
    };
    if (game) {
      game.windVector = wind;
      game.windAngle = angle;
      game.windStrength = strength;
      game.windX = x;
      game.windZ = z;
    }
    return wind;
  },

  computeChartVelocity(game) {
    const anchored = Boolean(
      game.anchorDeployed && game.raft && game.raft.countProvides('anchor') > 0
    );
    const current = GameSimulation.getCurrentAt(
      game.worldSeed,
      game.chartX,
      game.chartZ,
      game
    );
    const wind = GameSimulation.getWindAt(game);
    game.currentVector = current;
    if (anchored) {
      game.chartVx = 0;
      game.chartVz = 0;
      game.currentSpeed = 0;
      game.currentSpeedZ = 0;
      return { vx: 0, vz: 0, anchored: true, current, wind };
    }
    const driftBonus = typeof CrewManager !== 'undefined' && CrewManager.getDriftBonus
      ? CrewManager.getDriftBonus()
      : 0;
    const sailEfficiency = Util.clamp(game.raft.countProvides('sail'), 0, 1);
    const rudderEfficiency = Util.clamp(game.raft.countProvides('rudder'), 0, 1);
    const motorEfficiency = Util.clamp(game.raft.countProvides('motor'), 0, 1);
    const sailBonus = sailEfficiency * 0.5 * wind.sailFactor;
    const motorBonus = game.victoryCondition === 'island' &&
      (game.resources.fuel || 0) > 0
      ? motorEfficiency
      : 0;
    const loadMul = game.loadSpeedMultiplier();
    const stormPush = GameSimulation.getStormPush(game);
    const heading = Util.clamp(
      Number(game.navigationHeading) || 0,
      -NAVIGATION_BALANCE.maxHeading,
      NAVIGATION_BALANCE.maxHeading
    );
    const steeringAuthority =
      (sailBonus + motorBonus + (rudderEfficiency > 0 ? 0.45 : 0)) *
      rudderEfficiency;
    const steeringSpeedZ =
      steeringAuthority * heading * NAVIGATION_BALANCE.lateralSteering;
    const windLeewayZ = wind.z * (0.06 + sailEfficiency * 0.14 * (1 - rudderEfficiency * 0.45));

    // Si navegamos hacia la isla con vela y timón, orientamos parte del empuje
    // hacia el rumbo de la isla más el desvío del timón.
    let routeBiasZ = 0;
    if (game.victoryCondition === 'island' && sailEfficiency > 0 && rudderEfficiency > 0) {
      const dx = (Number(game.islandX) || 0) - (Number(game.chartX) || 0);
      const dz = (Number(game.islandZ) || 0) - (Number(game.chartZ) || 0);
      const dist = Math.hypot(dx, dz);
      if (dist > 1e-3) {
        routeBiasZ = (dz / dist) * (sailBonus + motorBonus) * rudderEfficiency * 0.45;
      }
    }

    const vx = (
      current.x +
      driftBonus * 0.75 +
      sailBonus +
      motorBonus +
      (Number(game.rowingBoost) || 0) +
      stormPush.x
    ) * loadMul;
    const vz = (
      current.z +
      windLeewayZ +
      (Number(game.rowingBoostZ) || 0) +
      steeringSpeedZ +
      routeBiasZ +
      stormPush.z
    ) * loadMul;

    game.chartVx = vx;
    game.chartVz = vz;
    game.currentSpeed = vx;
    game.currentSpeedZ = vz;
    return { vx, vz, anchored: false, current, wind, stormPush };
  },

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
    game.pendingDayResolution = null;
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
    const anchored = Boolean(
      game.anchorDeployed && game.raft.countProvides('anchor') > 0
    );
    game.rowingBoost = anchored ? 0 : 3.5 * Math.abs(push.x);
    game.rowingBoostZ = anchored ? 0 : 3.5 * push.z;
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
    if (!anchored) {
      if (game.victoryCondition === 'island' && game.islandDistance > 0) {
        const routeControl = 0.5 + rudderEfficiency * 0.5;
        const routeProgress =
          NAVIGATION_BALANCE.rowRouteMeters *
          routeControl *
          game.loadSpeedMultiplier();
        GameSimulation.setIslandDistance(
          game,
          Math.max(0, game.islandDistance - routeProgress)
        );
        GameSimulation.syncZoneFromChart(game);
        GameSimulation.checkRouteVictory(game);
      } else {
        const step = 1.4 * game.loadSpeedMultiplier();
        game.chartX = (Number(game.chartX) || 0) + Math.abs(push.x) * step;
        game.chartZ = (Number(game.chartZ) || 0) + push.z * step;
        GameSimulation.syncZoneFromChart(game);
      }
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
        const step = Math.min(distance, speed * dt);
        player.x += deltaX / distance * step;
        player.z += deltaZ / distance * step;
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
        const step = Math.min(distance, speed * dt);
        player.x += deltaX / distance * step;
        player.z += deltaZ / distance * step;
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
      // En primera persona el movimiento sigue la dirección de la vista
      // (fpYaw apunta al frente; la fórmula espera el yaw de la órbita).
      const cameraYaw = World.firstPerson
        ? World.fpYaw + Math.PI
        : (Number(World.cameraYaw) || 0);
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
            GameSimulation.revealAndFixIsland(game);
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
    const preservation = Util.clamp(
      game.raft.countProvides('preserve'),
      0,
      1
    );
    const seed = (
      Math.imul(Math.floor(game.day), 2654435761) ^
      Math.imul(Math.floor(game.stats?.rescued || 0) + 1, 2246822519)
    ) >>> 0;
    const roll = seed / 4294967296;
    if (roll >= 0.18 - preservation * 0.1) return null;
    const foodLost = Math.min(
      Math.max(0, game.resources.food || 0),
      Math.min(
        0.25,
        (game.resources.food || 0) * 0.12
      ) * (1 - preservation * 0.85)
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
      chart: Util.clamp(game.raft.countProvides('navigation'), 0, 1),
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
    if (game.anchorDeployed && game.raft.countProvides('anchor') > 0) {
      Log.add(
        'El viaje a la isla se detiene: el ancla mantiene fija la posición.'
      );
      return { moved: 0, fuelConsumed: 0, anchored: true };
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
      navigation.chart * 4 +
      CrewManager.getDriftBonus() *
        NAVIGATION_BALANCE.navigatorMetersPerDay;
    const moved =
      propulsion * steeringEfficiency * game.loadSpeedMultiplier();
    const distBefore = GameSimulation.getIslandDistance(game);
    const nextDist = Math.max(0, distBefore - moved);
    GameSimulation.setIslandDistance(game, nextDist);

    const lateralStep =
      moved *
      navigation.heading *
      NAVIGATION_BALANCE.lateralSteering *
      navigation.rudder;
    if (Math.abs(lateralStep) > 1e-6) {
      game.worldOffsetZ = (Number(game.worldOffsetZ) || 0) + lateralStep;
      if (nextDist > 1e-6) {
        const relX = game.chartX - game.islandX;
        const relZ = game.chartZ - game.islandZ;
        const angle = Math.atan2(lateralStep, Math.max(20, distBefore));
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);
        game.chartX = game.islandX + relX * cosA - relZ * sinA;
        game.chartZ = game.islandZ + relX * sinA + relZ * cosA;
      }
    }
    GameSimulation.syncZoneFromChart(game);
    if (game.islandDistance <= 0) game.triggerWin('island');
    return { moved, fuelConsumed, motorFuelRatio, lateralStep };
  }
});
