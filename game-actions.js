/** Acciones contextuales y cuidado de la tripulación. */
const GameActions = Object.freeze({
  nearestCrew(game) {
    let nearest = null;
    let distance = game.raft.cellSize * 0.85;
    for (const member of CrewManager.members) {
      if (!member.alive || member.hostile) continue;
      const x = member.mesh?.position.x ?? (member.gx + 0.5) * game.raft.cellSize;
      const z = member.mesh?.position.z ?? (member.gy + 0.5) * game.raft.cellSize;
      const d = Math.hypot(x - game.player.x, z - game.player.z);
      if (d < distance) { nearest = member; distance = d; }
    }
    return nearest;
  },

  context(game) {
    const p = game.player;
    const selection = game.raft.selected;
    if (selection) {
      const cell = game.raft.get(selection.gx, selection.gy);
      if (cell) {
        const building = BUILDINGS[cell.buildingKey];
        const protectedCell = selection.gx === 0 && selection.gy === 0;
        const connected = game.raft.isConnectedWithout(game.raft.key(selection.gx, selection.gy));
        const refund = Object.entries(building.cost).filter(([, value]) => Math.floor(value / 2) > 0)
          .map(([key, value]) => Math.floor(value / 2) + ' ' + Util.resourceName(key)).join(' · ');
        return { kind: 'demolish', label: 'Desmontar ' + building.name.toLowerCase(),
          detail: protectedCell ? 'La tabla inicial sostiene la balsa.' : !connected ? 'Ese módulo mantiene la balsa unida.' : 'Recuperas ' + (refund || '0 materiales') + ' · Esc cancela',
          available: !protectedCell && connected };
      }
    }
    if (p.hook) return { kind: 'hook', label: p.hook.returning ? 'Recogiendo el sedal' : 'Recoger el gancho', detail: 'Clic sobre el mar o la balsa', key: 'Clic', available: !p.hook.returning };
    const {gx, gy} = game.raft.worldToGrid(p.x, p.z);
    const cell = game.raft.get(gx, gy);
    if (!cell) return null;
    const b = BUILDINGS[cell.buildingKey];
    const max = cell.maxHealth || b.health;
    if (cell.health < max) return { kind: 'repair', label: 'Reparar ' + b.name.toLowerCase(),
      detail: Math.ceil(cell.health) + '/' + max + ' estructura · + ' + Math.min(15, max - cell.health).toFixed(0) + ' por 1 madera', available: game.resources.wood >= 1 };
    const actions = {
      fire: ['Cocinar una ración', '1 comida · recupera hambre y salud', game.resources.food >= 1],
      kitchen: ['Preparar una comida', '1 comida · recupera hambre y salud', game.resources.food >= 1],
      smokehouse: ['Ahumar una ración', '1 comida + 0,2 combustible · reserva para hoy', game.resources.food >= 1 && game.resources.fuel >= 0.2],
      medkit: ['Curar heridas', '1 tela · recupera hasta 25 salud', p.health < 100 && game.resources.cloth >= 1],
      infirmary: [game.infectionDays > 0 ? 'Tratar infección' : 'Curar heridas', game.infectionDays > 0 ? '1 tela + 0,5 agua' : '1 tela · recupera hasta 34 salud', game.resources.cloth >= 1 && (game.infectionDays > 0 ? game.resources.water >= 0.5 : p.health < 100)],
      anchor: [game.anchorDeployed ? 'Recoger el ancla' : 'Echar el ancla', 'Reduce la deriva mientras está desplegada', true],
      beacon: [game.beaconLit ? 'Apagar el faro' : 'Encender el faro', 'Necesita combustible para mantener la señal', game.beaconLit || game.resources.fuel >= 0.25],
      sail: ['Fijar ruta a la isla', 'Necesitas un timón operativo', true],
      rudder: ['Cambiar el rumbo', 'Alterna babor, recto y estribor', true],
      motor: [game.resources.fuel < 0.5 ? 'Preparar combustible' : 'Consultar navegación', game.resources.fuel < 0.5 ? '1 plástico → 2 combustible' : 'Vela y timón permiten navegar', game.resources.fuel >= 0.5 || game.resources.plastic >= 1],
      radio: ['Emitir una señal de socorro', 'Consulta los requisitos del rescate', true],
      chart: ['Consultar la carta', 'Comprueba la distancia a tierra', true],
      harpoon: ['Defender la balsa', 'Ahuyenta al tiburón más cercano · desgasta 6 estructura', true],
      containment: ['Comprobar la vigilancia', 'Estado de los tripulantes bajo vigilancia', true],
      rain: ['Beber agua', '0,5 agua · recupera hasta 20 de sed', p.thirst < 100 && game.resources.water >= 0.5],
      purifier: ['Beber agua', '0,5 agua · recupera hasta 20 de sed', p.thirst < 100 && game.resources.water >= 0.5]
    };
    if (actions[b.key]) {
      const [label, detail, available] = actions[b.key];
      return { kind: 'structure', label, detail, available };
    }
    const member = GameActions.nearestCrew(game);
    if (member) return { kind: 'crew', member, label: 'Hablar con ' + member.name,
      detail: 'Hablar · compartir una ración · dar descanso', available: true };
    if (b.key !== 'floor') return {kind: 'info', label: b.name, detail: b.desc, available: false, key: ''};
    return { kind: 'idle', label: 'A la deriva', detail: 'Clic en el mar: gancho · Clic en cubierta: caminar · Shift: remar', key: '', available: false };
  },

  crewReply(member) {
    if (member.restrainedDays > 0) return 'Necesito un poco de espacio para recuperarme. Gracias por seguir aquí.';
    if (member.thirst < 35) return 'Me cuesta concentrarme. Lo que más necesito ahora es agua.';
    if (member.hunger < 35) return 'Llevo demasiado tiempo sin comer. Una ración me ayudaría a seguir.';
    if (member.health < 45) return 'Las heridas me están pasando factura. Me vendría bien descansar.';
    if (member.stress > 60) return 'Estoy al límite. Hablar contigo me ayuda a no perder la calma.';
    if (member.job === 'rest') return 'Voy recuperando fuerzas. Pronto podré volver a echar una mano.';
    if (member.trust < 35) return 'Todavía me cuesta confiar, pero podemos ayudarnos a salir de esta.';
    return 'Cuenta conmigo. Me encargo de ' + (getCrewJob(member.job)?.name || 'ayudar').toLowerCase() + ' mientras seguimos a flote.';
  },

  interactWithCrew(game, member, kind) {
    if (!member?.alive || member.hostile || !CrewManager.members.includes(member) || game.state !== 'playing' || game.crewConflict?.active) return false;
    let note;
    if (kind === 'talk') {
      if (member.lastTalkDay === game.day) {
        game.showEventMessage(member.name + ': Ya hemos hablado hoy. Gracias por escucharme.');
        return false;
      }
      member.lastTalkDay = game.day;
      member.trust = Util.clamp(member.trust + 5, 0, 100);
      member.stress = Math.max(0, member.stress - 9);
      member.morale = Util.clamp(member.morale + 4, 0, 100);
      note = 'Has escuchado a ' + member.name + ' (+5 confianza, −9 estrés).';
      game.showEventMessage(member.name + ': ' + GameActions.crewReply(member));
    } else if (kind === 'ration') {
      if (game.resources.food < 0.5 || game.resources.water < 0.65) {
        game.showEventMessage('Necesitas 0,5 comida y 0,65 agua para compartir una ración.');
        return false;
      }
      if (member.hunger >= 95 && member.thirst >= 95) {
        game.showEventMessage(member.name + ' ya ha comido y bebido suficiente.');
        return false;
      }
      game.resources.food = Math.max(0, game.resources.food - 0.5);
      game.resources.water = Math.max(0, game.resources.water - 0.65);
      member.hunger = Util.clamp(member.hunger + 18, 0, 100);
      member.thirst = Util.clamp(member.thirst + 24, 0, 100);
      member.stress = Math.max(0, member.stress - 8);
      member.trust = Util.clamp(member.trust + 3, 0, 100);
      note = 'Compartiste una ración con ' + member.name + ' (0,5 comida y 0,65 agua).';
      game.showEventMessage(member.name + ': Gracias. Esto me ayudará a recuperar fuerzas.');
    } else if (kind === 'rest') {
      if (member.job === 'rest') return false;
      CrewManager.setJob(member, 'rest');
      note = member.name + ' descansará hasta que le asignes otra tarea.';
      game.showEventMessage(note);
    } else return false;
    member.lastIncident = note;
    CrewManager.signalInteraction?.(member, kind, game.player, 5);
    Log.add(note);
    AudioSys.play('conflict-calm');
    game.updateUI();
    Save.save(game.getSaveData());
    return true;
  },

  openCrew(game, member) {
    if (!member?.alive) return;
    game.player.moveTarget = null;
    game.player.movePath = [];
    game.player.moveDestination = null;
    game.player.rowTarget = null;
    game.player.vx = game.player.vz = 0;
    const condition = member.getCondition?.() || { label: 'A bordo' };
    game.showDecision(member.name + ' · ' + condition.label,
      '«' + GameActions.crewReply(member) + '»', [
        {label: member.lastTalkDay === game.day ? 'Ya habéis hablado hoy' : 'Escuchar · +5 confianza, −9 estrés', disabled: member.lastTalkDay === game.day, action: () => GameActions.interactWithCrew(game, member, 'talk')},
        {label: 'Compartir ración · 0,5 comida + 0,65 agua', disabled: game.resources.food < 0.5 || game.resources.water < 0.65 || (member.hunger >= 95 && member.thirst >= 95), action: () => GameActions.interactWithCrew(game, member, 'ration')},
        {label: member.job === 'rest' ? 'Ya está descansando' : 'Dar descanso · dejará su tarea', disabled: member.job === 'rest', action: () => GameActions.interactWithCrew(game, member, 'rest')},
        {label: 'Volver a cubierta', action: () => {}}
      ]);
  }
});
