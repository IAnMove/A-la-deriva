const { test, expect } = require('@playwright/test');

async function openOffline(page) {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1:4173)/, route => route.abort());
  await page.goto('/');
  await expect(page.locator('#start-screen')).toHaveClass(/active/);
  return pageErrors;
}

test('arranca sin red gracias a Three local y crea una partida', async ({ page }) => {
  const errors = await openOffline(page);
  await expect(page.locator('h1').first()).toHaveText('A la Deriva 3D');
  expect(await page.evaluate(() => typeof THREE)).toBe('object');

  await page.locator('#btn-new-game').click();
  await expect(page.locator('#ui')).not.toHaveClass(/hidden/);
  await expect(page.locator('#day-label')).toContainText('Día 1');
  expect(errors).toEqual([]);
});

test('migra un guardado v1 y conserva la continuación', async ({ page }) => {
  const errors = await openOffline(page);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('aladeriva3d_save_v1', JSON.stringify({
      day: 3,
      time: 9,
      zone: 'calm',
      player: { x: 1, z: 1, health: 75 },
      resources: { food: 2, water: 2 },
      raftGrid: [['0,0', { buildingKey: 'floor', health: 50, maxHealth: 50 }]]
    }));
  });
  await page.reload();
  await expect(page.locator('#btn-continue')).toBeEnabled();
  await page.locator('#btn-continue').click();
  await expect(page.locator('#day-label')).toContainText('Día 3');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('aladeriva3d_save_v3')));
  expect(saved.schemaVersion).toBe(3);
  expect(await page.evaluate(() => localStorage.getItem('aladeriva3d_save_v1'))).toBeNull();
  expect(errors).toEqual([]);
});

test('autoguarda al ocultar la página y tolera preferencias dañadas', async ({ page }) => {
  const errors = await openOffline(page);
  await page.evaluate(() => {
    localStorage.setItem('aladeriva3d_prefs_v2', 'null');
    localStorage.setItem('aladeriva3d_prefs_v1', '{roto');
  });
  await page.reload();
  await page.locator('#btn-new-game').click();
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('aladeriva3d_save_v3')));
  expect(saved.schemaVersion).toBe(3);
  expect(saved.day).toBe(1);
  expect(errors).toEqual([]);
});

test('renderiza peces, congela el mundo al pescar y recoge la captura', async ({ page }) => {
  const errors = await openOffline(page);
  await page.locator('#btn-new-game').click();

  const initial = await page.evaluate(() => {
    EntityManager.spawnFishBank(Game.raft.getCenter());
    const bank = EntityManager.fishBanks.at(-1);
    Game.player.hook = {
      x: bank.x,
      z: bank.z,
      vx: 0,
      vz: 0,
      distance: 0,
      life: 0,
      returning: false,
      fishing: false,
      object: null,
      maxRange: Game.player.hookRange
    };
    const started = Game.startFishing(bank, Game.player.hook);
    return {
      started,
      fishCount: bank.fishCount,
      hasFishModel: bank.fish.some(fish => fish.userData.isLowPolyFish),
      elapsed: Game.elapsed,
      time: Game.time,
      worldOffset: Game.worldOffset,
      food: Game.resources.food
    };
  });

  expect(initial.started).toBe(true);
  expect(initial.hasFishModel).toBe(true);
  await expect(page.locator('#fishing-panel')).toBeVisible();
  await page.waitForTimeout(200);

  const paused = await page.evaluate(() => ({
    elapsed: Game.elapsed,
    time: Game.time,
    worldOffset: Game.worldOffset,
    active: Game.fishing.active
  }));
  expect(paused.active).toBe(true);
  expect(paused.elapsed).toBe(initial.elapsed);
  expect(paused.time).toBe(initial.time);
  expect(paused.worldOffset).toBe(initial.worldOffset);

  const result = await page.evaluate(() => {
    Game.fishing.marker = Game.fishing.targetCenter;
    Game.requestFishingPull();
    Game.updateFishing(0);
    Game.fishing.cooldown = 0;
    Game.fishing.marker = Game.fishing.targetCenter;
    Game.requestFishingPull();
    Game.updateFishing(0);
    const bank = EntityManager.fishBanks.at(-1);
    return {
      active: Game.fishing.active,
      paused: Game.paused,
      fishCount: bank.fishCount,
      food: Game.resources.food,
      caughtVisible: !!HookVis.catchMesh && HookVis.catchMesh.visible,
      returning: Game.player.hook.returning
    };
  });
  expect(result.active).toBe(false);
  expect(result.paused).toBe(false);
  expect(result.fishCount).toBe(initial.fishCount - 1);
  expect(result.food).toBeGreaterThan(initial.food);
  expect(result.caughtVisible).toBe(true);
  expect(result.returning).toBe(true);
  expect(errors).toEqual([]);
});

test('mantiene niebla válida y amplía el zoom máximo con la balsa', async ({ page }) => {
  const errors = await openOffline(page);
  await page.locator('#btn-new-game').click();
  const result = await page.evaluate(() => {
    Game.fog = true;
    World.updateDayNight(Game.time, false, true, 0.1);
    const smallLimit = World.cameraMaxZoomOut;
    for (let gx = 1; gx <= 8; gx++) {
      Game.raft.placeAt(gx, 0, 'floor', true);
    }
    World.updateCamera(
      Game.raft.getCenter(),
      Game.raft.getBounds(),
      0.1,
      Game.raft.cellSize
    );
    return {
      fogNear: World.scene.fog.near,
      fogFar: World.scene.fog.far,
      viewDistance: World.camera.position.distanceTo(World.camTarget),
      smallLimit,
      largeLimit: World.cameraMaxZoomOut
    };
  });
  expect(result.fogNear).toBeLessThan(result.fogFar);
  expect(result.fogFar).toBeGreaterThan(result.viewDistance);
  expect(result.smallLimit).toBe(1);
  expect(result.largeLimit).toBeGreaterThan(result.smallLimit);
  expect(errors).toEqual([]);
});

test('guarda el progreso antes de volver al menú', async ({ page }) => {
  const errors = await openOffline(page);
  await page.locator('#btn-new-game').click();
  await page.evaluate(() => {
    Game.resources.wood = 37;
    Game.day = 6;
  });
  await page.locator('#btn-pause').click();
  await expect(page.locator('#pause-screen')).toHaveClass(/active/);
  await page.locator('#btn-pause-menu').click();
  await expect(page.locator('#start-screen')).toHaveClass(/active/);
  await page.locator('#btn-continue').click();
  const restored = await page.evaluate(() => ({
    day: Game.day,
    wood: Game.resources.wood
  }));
  expect(restored).toEqual({ day: 6, wood: 37 });
  expect(errors).toEqual([]);
});

test('protege un guardado futuro sin sustituirlo por el legacy', async ({ page }) => {
  const errors = await openOffline(page);
  const futureRaw = '{"schemaVersion":999,"day":99,"futureOnly":42}';
  const legacyRaw = '{"day":4,"resources":{"wood":8}}';
  await page.evaluate(({ futureRaw, legacyRaw }) => {
    localStorage.clear();
    localStorage.setItem('aladeriva3d_save_v3', futureRaw);
    localStorage.setItem('aladeriva3d_save_v1', legacyRaw);
  }, { futureRaw, legacyRaw });
  await page.reload();
  await expect(page.locator('#btn-continue')).toBeDisabled();
  await expect(page.locator('#btn-continue')).toContainText('versión más reciente');
  const stored = await page.evaluate(() => ({
    current: localStorage.getItem('aladeriva3d_save_v3'),
    legacy: localStorage.getItem('aladeriva3d_save_v1')
  }));
  expect(stored).toEqual({ current: futureRaw, legacy: legacyRaw });
  expect(errors).toEqual([]);
});

test('recorre balsas cóncavas y permite partir solo con vela y timón', async ({ page }) => {
  const errors = await openOffline(page);
  await page.locator('#btn-new-game').click();
  const arrival = await page.evaluate(() => {
    for (const cell of Game.raft.grid.values()) Game.raft.disposeMesh(cell);
    Game.raft.grid.clear();
    for (const [gx, gy] of [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]]) {
      Game.raft.placeAt(gx, gy, 'floor', true);
    }
    Game.resetPlayerState({ x: 1, z: 1 });
    Game.planPlayerPath(2, 2);
    for (let frame = 0; frame < 180; frame++) Game.updatePlayer(0.05);
    return Game.raft.worldToGrid(Game.player.x, Game.player.z);
  });
  expect(arrival).toEqual({ gx: 2, gy: 2 });

  await page.evaluate(() => {
    for (const cell of Game.raft.grid.values()) Game.raft.disposeMesh(cell);
    Game.raft.grid.clear();
    Game.raft.placeAt(0, 0, 'sail', true);
    Game.raft.placeAt(1, 0, 'rudder', true);
    Game.resetPlayerState({ x: 1, z: 1 });
    Game.resources.fuel = 0;
    Game.resources.plastic = 0;
    Game.victoryCondition = null;
    Game.islandDistance = 2000;
    Game.interact();
  });
  await expect(page.locator('#decision-panel')).toBeVisible();
  await page.locator('#decision-buttons button').first().click();
  expect(await page.evaluate(() => Game.victoryCondition)).toBe('island');
  expect(await page.evaluate(() => Game.islandDistance)).toBe(300);
  expect(errors).toEqual([]);
});

test.describe('móvil', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true
  });

  test('mueve, abre construcción y controla la cámara con el mando táctil', async ({ page }) => {
    const errors = await openOffline(page);
    await page.locator('#btn-new-game').tap();
    await expect(page.locator('#mobile-controls')).toBeVisible();

    const initialZ = await page.evaluate(() => Game.player.z);
    await page.locator('#mobile-up').dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch' });
    await page.waitForTimeout(120);
    await page.locator('#mobile-up').dispatchEvent('pointerup', { pointerId: 1, pointerType: 'touch' });
    expect(await page.evaluate(() => Game.player.z)).toBeLessThan(initialZ - 0.05);

    const initialZoom = await page.evaluate(() => World.cameraZoomTarget);
    await page.locator('#mobile-zoom-in').dispatchEvent('pointerdown', { pointerId: 2, pointerType: 'touch' });
    await page.locator('#mobile-zoom-in').dispatchEvent('pointerup', { pointerId: 2, pointerType: 'touch' });
    expect(await page.evaluate(() => World.cameraZoomTarget)).toBeLessThan(initialZoom);

    await page.locator('#mobile-build').dispatchEvent('pointerdown', { pointerId: 3, pointerType: 'touch' });
    await page.locator('#mobile-build').dispatchEvent('pointerup', { pointerId: 3, pointerType: 'touch' });
    await expect(page.locator('#build-menu')).not.toHaveClass(/hidden/);
    expect(errors).toEqual([]);
  });

  test('mantiene mando y acciones dentro de la pantalla sin solaparse', async ({ page }) => {
    await openOffline(page);
    await page.locator('#btn-new-game').tap();
    const layout = await page.evaluate(() => {
      const move = document.querySelector('#mobile-move').getBoundingClientRect();
      const actions = document.querySelector('#mobile-actions').getBoundingClientRect();
      const bar = document.querySelector('#action-bar').getBoundingClientRect();
      return {
        viewport: { width: innerWidth, height: innerHeight },
        move: { left: move.left, right: move.right, top: move.top, bottom: move.bottom },
        actions: { left: actions.left, right: actions.right, top: actions.top, bottom: actions.bottom },
        bar: { top: bar.top, bottom: bar.bottom }
      };
    });
    expect(layout.move.left).toBeGreaterThanOrEqual(0);
    expect(layout.actions.right).toBeLessThanOrEqual(layout.viewport.width);
    expect(layout.move.right).toBeLessThan(layout.actions.left);
    expect(layout.bar.bottom).toBeLessThanOrEqual(Math.min(layout.move.top, layout.actions.top));
    expect(layout.move.bottom).toBeLessThanOrEqual(layout.viewport.height);
  });
});
