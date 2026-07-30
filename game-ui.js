/*****************************************************
 * game-ui.js - Presentación DOM del estado de Game.
 *
 * Las funciones reciben el estado y no deciden reglas. game.js mantiene
 * adaptadores con los nombres históricos para no acoplar a los consumidores
 * actuales a esta primera fase de la separación.
 *****************************************************/

let eventMessageTimeout = null;

const GameUI = Object.freeze({
  setSoundButton(enabled) {
    const button = document.getElementById('btn-sound');
    if (button) button.textContent = enabled ? '🔊' : '🔇';
  },

  setObjective(text) {
    const objective = document.getElementById('objective-text');
    if (objective) objective.textContent = text;
  },

  updateFishingUI(game) {
    const fishing = game.fishing;
    if (!fishing?.active) return;
    const marker = document.getElementById('fishing-marker');
    const target = document.getElementById('fishing-target');
    const timer = document.getElementById('fishing-timer');
    const progress = document.getElementById('fishing-progress');
    const instruction = document.getElementById('fishing-instruction');
    const button = document.getElementById('btn-fishing-pull');
    const panel = document.getElementById('fishing-panel');

    if (marker) {
      marker.style.left = `${(fishing.marker * 100).toFixed(2)}%`;
    }
    if (target) {
      target.style.left =
        `${((fishing.targetCenter - fishing.targetWidth * 0.5) * 100).toFixed(2)}%`;
      target.style.width = `${(fishing.targetWidth * 100).toFixed(2)}%`;
    }
    if (timer) {
      timer.textContent = `Tiempo: ${fishing.timeLeft.toFixed(1)} s`;
    }
    if (progress) {
      progress.textContent =
        `Tirones ${fishing.hits}/2 · Fallos ${fishing.misses}/2`;
    }
    if (instruction) instruction.textContent = fishing.instruction;
    if (button) button.disabled = fishing.cooldown > 0;
    if (panel) {
      panel.classList.toggle('success', fishing.feedback === 'hit');
      panel.classList.toggle('failure', fishing.feedback === 'miss');
    }
    const track = document.getElementById('fishing-track');
    if (track) {
      track.classList.toggle('success', fishing.feedback === 'hit');
      track.classList.toggle('failure', fishing.feedback === 'miss');
    }
  },

  updateCrewConflictUI(game) {
    const conflict = game.crewConflict;
    if (!conflict?.active) return;
    const member = conflict.member;
    const title = document.getElementById('crew-conflict-title');
    const text = document.getElementById('crew-conflict-text');
    const timer = document.getElementById('crew-conflict-timer');
    const stamina = document.getElementById('crew-conflict-stamina');
    const fill = document.getElementById('crew-conflict-fill');
    const feedback = document.getElementById('crew-conflict-feedback');
    const push = document.getElementById('btn-conflict-push');
    const ration = document.getElementById('btn-conflict-ration');
    if (title) title.textContent = `${member?.name || 'Un tripulante'} ha perdido el control`;
    if (text) {
      const targetName = conflict.target === game.player
        ? 'al personaje principal'
        : `a ${conflict.target?.name || 'otro tripulante'}`;
      text.textContent =
        `${conflict.cause}. Está amenazando ${targetName}; si el peligro llega al máximo puede matarlo.`;
    }
    if (timer) timer.textContent = `Tiempo: ${Math.max(0, conflict.timeLeft).toFixed(1)} s`;
    if (stamina) stamina.textContent = `Energía: ${Math.round(game.player.stamina)}`;
    if (fill) fill.style.width = `${Util.clamp(conflict.tension, 0, 100)}%`;
    if (feedback) feedback.textContent = conflict.feedback;
    if (push) push.disabled =
      conflict.pushCooldown > 0 || game.player.stamina < 8;
    if (ration) {
      ration.disabled =
        (game.resources.food || 0) < 0.5 ||
        (game.resources.water || 0) < 0.65;
    }
  },

  updateCrewOverview(game) {
    const overview = document.getElementById('crew-overview');
    if (!overview) return;
    const reserves = CrewManager.getReserveEstimate(game);
    const critical = CrewManager.members.filter(member =>
      member.alive &&
      (member.hallucinating || member.hostile || member.stress >= 70)
    ).length;
    overview.innerHTML = `
      <strong>${CrewManager.count()} a bordo</strong> ·
      Reservas para ${reserves.foodDays.toFixed(1)} días de comida y
      ${reserves.waterDays.toFixed(1)} de agua ·
      ${critical > 0
        ? `<span style="color:var(--danger)">${critical} en crisis</span>`
        : '<span style="color:var(--success)">grupo estable</span>'}
    `;
  },

  showEventMessage(game, text) {
    const element = document.getElementById('event-message');
    element.textContent = text;
    const normalized = String(text).toLowerCase();
    const severity = /tibur|coral|encall|devor|muert|ataque|golpe|tormenta|ola|hostil|crisis|incend|mot[ií]n|brote|infecc/.test(normalized)
      ? 'danger'
      : /aviso|calor|daño|hambre|sed|cansad|corriente|contamin/.test(normalized)
        ? 'warning'
        : 'info';
    element.classList.remove('danger', 'warning', 'info');
    element.classList.add(severity);
    element.classList.add('show');
    if (eventMessageTimeout !== null) {
      clearTimeout(eventMessageTimeout);
    }
    eventMessageTimeout = setTimeout(() => {
      element.classList.remove('show');
      eventMessageTimeout = null;
    }, 2500);
  },

  showDaySummary(game, food, water, events, crewNotes = []) {
    const panel = document.getElementById('day-summary');
    const content = document.getElementById('summary-content');
    let html = `
      <div class="summary-line"><strong>Recursos consumidos:</strong> ${food.toFixed(1)} comida, ${water.toFixed(1)} agua</div>
      <div class="summary-line"><strong>Tripulación:</strong> ${CrewManager.count()} supervivientes</div>
      <div class="summary-line"><strong>Balsa:</strong> ${game.raft.totalArea()} módulos</div>
    `;
    if (game.victoryCondition === 'radio') {
      html += `<div class="summary-line"><strong>Señal de socorro:</strong> ${game.rescuedSignal.toFixed(0)}%</div>`;
    }
    if (game.victoryCondition === 'island') {
      html += `<div class="summary-line"><strong>Distancia a la isla:</strong> ${Math.max(0, game.islandDistance).toFixed(0)} m</div>`;
    }
    if (events.length) {
      html += `<div class="summary-line"><strong>Sucesos:</strong> ${events.map(game.eventName).join(', ')}</div>`;
    }
    if (crewNotes.length) {
      const safe = crewNotes.map(note =>
        typeof escapeSurvivorHtml === 'function'
          ? escapeSurvivorHtml(note)
          : String(note)
      );
      html += `<div class="summary-line"><strong>Tripulación:</strong><ul>${safe.map(note => `<li>${note}</li>`).join('')}</ul></div>`;
    }
    content.innerHTML = html;
    panel.classList.remove('hidden');
  },

  endStatsHtml(game, win, score) {
    return `
      <div class="summary-line">Días sobrevividos: <strong>${game.day}</strong></div>
      <div class="summary-line">Personas rescatadas: <strong>${game.stats.rescued}</strong></div>
      <div class="summary-line">Personas abandonadas: <strong>${game.stats.abandoned}</strong></div>
      <div class="summary-line">Recursos recogidos: <strong>${game.stats.gathered}</strong></div>
      <div class="summary-line">Tamaño máximo de la balsa: <strong>${game.stats.maxRaftSize}</strong></div>
      <div class="summary-line">Mejor puntuación: <strong>${Save.loadBest()}</strong></div>
      <div class="summary-line">Puntuación final: <strong>${score}</strong></div>
    `;
  },

  updateUI(game) {
    if (game.state !== 'playing') return;
    document.getElementById('day-label').textContent = `Día ${game.day}`;
    document.getElementById('time-label').textContent =
      Util.formatTime(game.time);
    const phase = game.time < 6
      ? 'Noche'
      : game.time < 12
        ? 'Mañana'
        : game.time < 18
          ? 'Tarde'
          : 'Noche';
    document.getElementById('phase-label').textContent =
      `${phase} · ${game.zoneName(game.zone)}`;

    GameUI.setBar('bar-health', game.player.health);
    GameUI.setBar('bar-hunger', game.player.hunger);
    GameUI.setBar('bar-thirst', game.player.thirst);
    GameUI.setBar('bar-morale', game.player.morale);
    GameUI.setBar('bar-stamina', game.player.stamina);
    GameUI.setBar('bar-sanity', game.player.sanity);
    const crewCount = CrewManager.count();
    const crewCountElement = document.getElementById('crew-count');
    if (crewCountElement) {
      crewCountElement.textContent =
        crewCount > 0 ? `${crewCount} a bordo` : 'Solo';
    }

    document.getElementById('food-label').textContent =
      `🍖 ${Util.formatAmount(game.resources.food)}`;
    document.getElementById('water-label').textContent =
      `💧 ${Util.formatAmount(game.resources.water)}`;
    const totalWeight = game.totalWeight();
    const maxWeight = game.raft.maxWeight();
    const weightLabel = document.getElementById('weight-label');
    weightLabel.textContent =
      `⚖ ${totalWeight.toFixed(1)}/${maxWeight.toFixed(1)}`;
    weightLabel.style.color =
      totalWeight > maxWeight ? 'var(--danger)' : '';

    document.getElementById('res-wood').textContent =
      Util.formatAmount(game.resources.wood);
    document.getElementById('res-plastic').textContent =
      Util.formatAmount(game.resources.plastic);
    document.getElementById('res-cloth').textContent =
      Util.formatAmount(game.resources.cloth);
    document.getElementById('res-metal').textContent =
      Util.formatAmount(game.resources.metal);
    document.getElementById('res-rope').textContent =
      Util.formatAmount(game.resources.rope);
    document.getElementById('res-fuel').textContent =
      Util.formatAmount(game.resources.fuel);

    const navigation = GameSimulation.getNavigationState(game);
    const heading = navigation.heading < -0.1
      ? 'babor'
      : navigation.heading > 0.1
        ? 'estribor'
        : 'recto';
    const navigationStatus = document.getElementById('navigation-status');
    navigationStatus.textContent =
      `Rumbo: ${heading} · Combustible: ${Util.formatAmount(navigation.fuel)}` +
      (game.anchorDeployed ? ' · Ancla desplegada' : '') +
      (game.beaconLit ? ' · Faro encendido' : '') +
      (game.infectionDays > 0
        ? ` · Infección ${game.infectionDays} d`
        : '') +
      (game.victoryCondition === 'island'
        ? ` · Isla: ${Math.max(0, game.islandDistance).toFixed(0)} m`
        : '');

    const needs = GameSimulation.getDailyNeeds(game);
    document.getElementById('daily-food').textContent =
      (needs.playerFoodFromStores + needs.crewFood).toFixed(1);
    document.getElementById('daily-water').textContent =
      (needs.playerWater + needs.crewWater).toFixed(1);
    const reserves = CrewManager.getReserveEstimate(game);
    const reserveStatus = document.getElementById('reserve-status');
    if (reserveStatus) {
      reserveStatus.textContent =
        `${reserves.foodDays.toFixed(1)} d 🍖 · ${reserves.waterDays.toFixed(1)} d 💧`;
      const minimumReserve = Math.min(reserves.foodDays, reserves.waterDays);
      reserveStatus.style.color = minimumReserve < 0.75
        ? 'var(--danger)'
        : minimumReserve < 1.5
          ? 'var(--warning)'
          : 'var(--success)';
    }
    let totalHealth = 0;
    let totalMax = 0;
    for (const cell of game.raft.grid.values()) {
      totalHealth += cell.health;
      totalMax +=
        cell.maxHealth || BUILDINGS[cell.buildingKey].health;
    }
    const structuralPercent =
      totalMax > 0 ? Math.floor(totalHealth / totalMax * 100) : 0;
    const structuralHealth =
      document.getElementById('structural-health');
    structuralHealth.textContent = `${structuralPercent}%`;
    structuralHealth.style.color = structuralPercent < 40
      ? 'var(--danger)'
      : structuralPercent < 70
        ? 'var(--warning)'
        : 'var(--success)';
    const statusPanel = document.getElementById('status-panel');
    if (statusPanel) {
      statusPanel.classList.toggle('critical', structuralPercent < 40);
      statusPanel.classList.toggle(
        'warning',
        structuralPercent >= 40 && structuralPercent < 70
      );
    }

    const rowingStatus = document.getElementById('rowing-status');
    if (game.rowingCooldown > 0) {
      rowingStatus.textContent = `${game.rowingCooldown.toFixed(1)}s`;
      rowingStatus.style.color = 'var(--warning)';
    } else {
      rowingStatus.textContent = 'listo';
      rowingStatus.style.color = 'var(--success)';
    }

    document.getElementById('fx-heat').style.opacity =
      game.heat ? 1 : 0;
    const sanity = game.player.sanity;
    document.getElementById('fx-hallucination').style.opacity =
      sanity < 50 ? (50 - sanity) / 50 * 0.9 : 0;
    GameUI.updateThreat(game);
  },

  updateThreat(game) {
    const panel = document.getElementById('threat-panel');
    if (!panel) return;
    const center = game.raft.getCenter();
    const worldThreat =
      typeof EntityManager !== 'undefined' &&
      typeof EntityManager.getThreatSummary === 'function'
        ? EntityManager.getThreatSummary(center)
        : null;
    const threat = worldThreat || (game.infectionDays > 0
      ? {
          icon: '🦠',
          title: 'Infección activa',
          detail: `${game.infectionDays} día(s) restantes · usa una enfermería`,
          level: game.player.health < 35 ? 'critical' : 'warning'
        }
      : null);
    const vignette = document.getElementById('fx-danger');
    if (!threat) {
      panel.classList.add('hidden');
      panel.classList.remove('critical', 'warning', 'caution');
      if (vignette) vignette.style.opacity = 0;
      return;
    }

    panel.classList.remove('hidden', 'critical', 'warning', 'caution');
    panel.classList.add(threat.level || 'warning');
    const icon = document.getElementById('threat-icon');
    const title = document.getElementById('threat-title');
    const detail = document.getElementById('threat-detail');
    if (icon) icon.textContent = threat.icon || '⚠';
    if (title) title.textContent = threat.title || 'Amenaza cercana';
    if (detail) detail.textContent = threat.detail || '';
    if (vignette) {
      vignette.style.opacity =
        threat.level === 'critical' ? 0.52 : threat.level === 'warning' ? 0.2 : 0;
    }
  },

  setBar(id, value) {
    const element = document.getElementById(id);
    const safeValue = Util.clamp(Number(value) || 0, 0, 100);
    element.style.width = `${safeValue}%`;
    element.classList.toggle('low', safeValue < 25);
    const valueElement = document.getElementById(
      `value-${id.replace(/^bar-/, '')}`
    );
    if (valueElement) valueElement.textContent = Math.round(safeValue);
  }
});
