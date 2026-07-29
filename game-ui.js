/*****************************************************
 * game-ui.js - Presentación DOM del estado de Game.
 *
 * Las funciones reciben el estado y no deciden reglas. game.js mantiene
 * adaptadores con los nombres históricos para no acoplar a los consumidores
 * actuales a esta primera fase de la separación.
 *****************************************************/

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

  showEventMessage(game, text) {
    const element = document.getElementById('event-message');
    element.textContent = text;
    element.classList.add('show');
    setTimeout(() => element.classList.remove('show'), 2500);
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
      (game.victoryCondition === 'island'
        ? ` · Isla: ${Math.max(0, game.islandDistance).toFixed(0)} m`
        : '');

    const needs = GameSimulation.getDailyNeeds(game);
    document.getElementById('daily-food').textContent =
      (needs.playerFoodFromStores + needs.crewFood).toFixed(1);
    document.getElementById('daily-water').textContent =
      (needs.playerWater + needs.crewWater).toFixed(1);
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
  },

  setBar(id, value) {
    const element = document.getElementById(id);
    const safeValue = Util.clamp(Number(value) || 0, 0, 100);
    element.style.width = `${safeValue}%`;
    element.classList.toggle('low', safeValue < 25);
  }
});
