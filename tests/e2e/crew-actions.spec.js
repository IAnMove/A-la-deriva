const { test, expect } = require('@playwright/test');

async function start(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && !message.text().includes('Failed to load resource:')) errors.push(message.text()); });
  await page.goto('/');
  await page.locator('#btn-new-game').click();
  return errors;
}
async function addCrew(page) {
  await page.evaluate(() => {
    Game.zoneTimer = -1000;
    Game.resources.food = 5; Game.resources.water = 5;
    const member = new Survivor();
    member.name = 'Lucía'; member.job = 'fish'; member.trust = 40;
    member.stress = 55; member.hunger = 50; member.thirst = 40;
    CrewManager.add(member); CrewManager.assignPosition(member, Game.raft);
  });
}

test('hablar, compartir y descansar funcionan desde la tripulación y persisten', async ({ page }) => {
  const errors = await start(page); await addCrew(page);
  await page.locator('#btn-crew').click();
  await page.locator('[data-crew-action="talk"]').click();
  await expect(page.locator('[data-crew-action="talk"]')).toBeDisabled();
  expect(await page.evaluate(() => CrewManager.members[0].trust)).toBe(45);
  await page.locator('[data-crew-action="ration"]').click();
  expect(await page.evaluate(() => ({food: Game.resources.food, water: Game.resources.water, hunger: CrewManager.members[0].hunger, thirst: CrewManager.members[0].thirst}))).toEqual({food: 4.5, water: 4.35, hunger: 68, thirst: 64});
  await page.locator('[data-crew-action="rest"]').click();
  await expect(page.locator('[data-crew-action="rest"]')).toBeDisabled();
  expect(await page.evaluate(() => CrewManager.members[0].job)).toBe('rest');
  await page.reload(); await page.locator('#btn-continue').click();
  await page.locator('#btn-crew').click();
  await expect(page.locator('[data-crew-action="talk"]')).toBeDisabled();
  expect(await page.evaluate(() => CrewManager.members[0].job)).toBe('rest');
  expect(errors).toEqual([]);
});

test('E permite hablar con un compañero próximo y volver sin gastar recursos', async ({ page }) => {
  const errors = await start(page); await addCrew(page);
  await expect(page.locator('#interaction-label')).toContainText('Lucía');
  await page.keyboard.press('e');
  await expect(page.locator('#decision-title')).toContainText('Lucía');
  await page.getByRole('button', {name:'Volver a cubierta'}).click();
  expect(await page.evaluate(() => ({paused: Game.paused, food: Game.resources.food, water: Game.resources.water}))).toEqual({paused:false, food:5, water:5});
  expect(errors).toEqual([]);
});

test('la reparación muestra coste y beber consume sólo las reservas necesarias', async ({ page }) => {
  const errors = await start(page);
  await page.evaluate(() => {
    Game.raft.get(0,0).health = 25;
    Game.resources.wood = 1;
  });
  await expect(page.locator('#interaction-label')).toContainText('Reparar');
  await expect(page.locator('#interaction-detail')).toContainText('1 madera');
  await page.locator('#btn-context-action').click();
  expect(await page.evaluate(() => Game.raft.get(0,0).health)).toBe(40);
  await expect(page.locator('#btn-context-action')).toBeDisabled();
  await page.evaluate(() => {
    const cell = Game.raft.get(0,0); cell.buildingKey='purifier';cell.health=40;cell.maxHealth=40;
    Game.player.thirst=60;Game.resources.water=1;Game.updateProduction=()=>{};
  });
  await expect(page.locator('#interaction-label')).toBeVisible();
  await expect(page.locator('#interaction-label')).toHaveText('Beber agua');
  await page.keyboard.press('e');
  await expect.poll(() => page.evaluate(() => ({thirst:Game.player.thirst,water:Game.resources.water}))).toEqual({thirst:80,water:.5});
  await page.keyboard.press('e');
  await expect.poll(() => page.evaluate(() => ({thirst:Game.player.thirst,water:Game.resources.water}))).toEqual({thirst:100,water:0});
  await expect(page.locator('#btn-context-action')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('los náufragos y las olas se detienen durante la pausa', async ({ page }) => {
  const errors = await start(page); await addCrew(page);
  await page.waitForTimeout(600);
  await page.locator('#btn-pause').click();
  const sample = () => page.evaluate(() => ({
    elapsed:Game.elapsed,
    position:CrewManager.members[0].mesh.position.toArray(),
    rotation:CrewManager.members[0].mesh.rotation.toArray(),
    sea:World.seaGeo.attributes.position.array[1]
  }));
  const before = await sample(); await page.waitForTimeout(250);
  expect(await sample()).toEqual(before);
  expect(errors).toEqual([]);
});

test('caminar converge al destino incluso con pasos largos de simulación', async ({ page }) => {
  const errors = await start(page);
  const result = await page.evaluate(() => {
    Game.raft.placeAt(1,0,'floor',true);
    Game.player.x=1;Game.player.z=1;
    Game.planPlayerPath(1,0);
    for(let i=0;i<20;i++) GameSimulation.updatePlayer(Game,.1);
    return {x:Game.player.x,z:Game.player.z,target:Game.player.moveTarget};
  });
  expect(result).toEqual({x:3,z:1,target:null});
  expect(errors).toEqual([]);
});
