/*****************************************************
 * game-ui.js - Presentación DOM del estado de Game.
 *
 * Las funciones reciben el estado y no deciden reglas. game.js mantiene
 * adaptadores con los nombres históricos para no acoplar a los consumidores
 * actuales a esta primera fase de la separación.
 *****************************************************/

let eventMessageTimeout = null;
const chartState = {
  snapshot: null,
  viewport: null
};

const GameUI = Object.freeze({
  get lastChartSnapshot() {
    return chartState.snapshot;
  },
  get chartViewport() {
    return chartState.viewport;
  },
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
    const wind = typeof GameSimulation.getWindAt === 'function'
      ? GameSimulation.getWindAt(game)
      : game.windVector;
    const heading = navigation.heading < -0.1
      ? 'babor'
      : navigation.heading > 0.1
        ? 'estribor'
        : 'recto';
    const navigationStatus = document.getElementById('navigation-status');
    navigationStatus.textContent =
      `Rumbo: ${heading} · Combustible: ${Util.formatAmount(navigation.fuel)}` +
      (wind?.label ? ` · Viento: ${wind.label}` : '') +
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
    GameUI.updateInteraction(game);
  },

  updateInteraction(game) {
    const panel = document.getElementById('interaction-prompt');
    if (!panel) return;
    const hidden = game.state !== 'playing' || game.paused || BuildManager.placing;
    panel.classList.toggle('hidden', hidden);
    if (hidden) return;
    const action = game.getInteractionContext();
    if (!action) { panel.classList.add('hidden'); return; }
    const stamp = [action.kind, action.label, action.detail, action.available].join('|');
    if (panel.dataset.context === stamp) return;
    panel.dataset.context = stamp;
    panel.classList.toggle('unavailable', !action.available);
    panel.classList.toggle('destructive', action.kind === 'demolish');
    document.getElementById('interaction-label').textContent = action.label;
    document.getElementById('interaction-detail').textContent = action.detail;
    const button = document.getElementById('btn-context-action');
    button.disabled = !action.available;
    button.classList.toggle('hidden', action.key === '');
    button.setAttribute?.('aria-label', action.label);
    document.getElementById('interaction-key').textContent = action.kind === 'hook' ? 'Recoger' : 'E';
    const touch = document.getElementById('mobile-interact');
    if (touch) touch.textContent = action.kind === 'crew' ? 'Hablar' : action.kind === 'repair' ? 'Reparar' : 'Usar';
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
  },

  chartToCanvas(x, z, vp = chartState.viewport) {
    if (!vp) return { px: 0, py: 0 };
    return {
      px: vp.offsetX + (x - vp.minX) * vp.scale,
      py: vp.offsetY + (z - vp.minZ) * vp.scale
    };
  },

  canvasToChart(px, py, vp = chartState.viewport) {
    if (!vp || !vp.scale) return { x: 0, z: 0 };
    return {
      x: vp.minX + (px - vp.offsetX) / vp.scale,
      z: vp.minZ + (py - vp.offsetY) / vp.scale
    };
  },

  renderChartModal(game) {
    const snap = GameSimulation.getChartSnapshot(game);
    chartState.snapshot = snap;

    const canvas = document.getElementById('chart-canvas');
    const width = Number(canvas?.width) || 560;
    const height = Number(canvas?.height) || 340;
    const pad = 28;
    const { minX, maxX, minZ, maxZ } = snap.bounds;
    const spanX = Math.max(80, maxX - minX);
    const spanZ = Math.max(80, maxZ - minZ);
    const scale = Math.min(
      (width - pad * 2) / spanX,
      (height - pad * 2) / spanZ
    );
    const offsetX = (width - spanX * scale) * 0.5;
    const offsetY = (height - spanZ * scale) * 0.5;
    const vp = { pad, width, height, minX, maxX, minZ, maxZ, scale, offsetX, offsetY };
    chartState.viewport = vp;

    const summary = document.getElementById('chart-summary');
    const heading = snap.raft.heading < -0.15
      ? 'Babor'
      : snap.raft.heading > 0.15
        ? 'Estribor'
        : 'Recto';
    const hasRudder = game.raft.countProvides('rudder') > 0;
    const hasSail = game.raft.countProvides('sail') > 0;
    if (summary) {
      const distText = snap.island.revealed
        ? `Isla fijada a ${Math.max(0, snap.island.distance).toFixed(0)} m`
        : ` Sector estimado de tierra (±${Math.round(snap.island.coneHalfAngle * 180 / Math.PI)}° · ~${Math.max(0, snap.island.distance).toFixed(0)} m)`;
      summary.innerHTML =
        `<span><strong>Posición:</strong> (${snap.raft.x.toFixed(0)}, ${snap.raft.z.toFixed(0)}) m</span>` +
        `<span><strong>Rumbo:</strong> ${heading}${hasRudder ? '' : ' (sin timón)'}</span>` +
        `<span><strong>Viento:</strong> ${snap.wind?.label || 'calma'}</span>` +
        `<span><strong>Derrota:</strong> ${distText}</span>`;
    }

    const btnPort = document.getElementById('btn-chart-port');
    const btnStraight = document.getElementById('btn-chart-straight');
    const btnStarboard = document.getElementById('btn-chart-starboard');
    const btnRoute = document.getElementById('btn-chart-route');
    if (btnPort) {
      btnPort.disabled = !hasRudder;
      btnPort.classList.toggle('active', snap.raft.heading < -0.15);
    }
    if (btnStraight) {
      btnStraight.disabled = !hasRudder;
      btnStraight.classList.toggle(
        'active',
        snap.raft.heading >= -0.15 && snap.raft.heading <= 0.15
      );
    }
    if (btnStarboard) {
      btnStarboard.disabled = !hasRudder;
      btnStarboard.classList.toggle('active', snap.raft.heading > 0.15);
    }
    if (btnRoute) {
      if (game.victoryCondition === 'island') {
        btnRoute.textContent = `⛵ Ruta activa (${Math.max(0, snap.island.distance).toFixed(0)} m)`;
        btnRoute.disabled = true;
      } else if (hasSail && hasRudder) {
        btnRoute.textContent = '⛵ Fijar ruta a la isla';
        btnRoute.disabled = false;
      } else {
        btnRoute.textContent = '⛵ Requiere vela y timón';
        btnRoute.disabled = true;
      }
    }

    if (!canvas || typeof canvas.getContext !== 'function') return snap;
    const ctx = canvas.getContext('2d');
    if (!ctx) return snap;

    // Fondo estilo carta náutica oceánica
    ctx.clearRect(0, 0, width, height);
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, '#0c2333');
    bg.addColorStop(1, '#081824');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Retícula cartográfica cada 50 m
    ctx.strokeStyle = 'rgba(148, 210, 235, 0.11)';
    ctx.lineWidth = 1;
    const startGridX = Math.ceil(minX / 50) * 50;
    for (let gx = startGridX; gx <= maxX; gx += 50) {
      const { px } = GameUI.chartToCanvas(gx, 0, vp);
      ctx.beginPath();
      ctx.moveTo(px, 8);
      ctx.lineTo(px, height - 8);
      ctx.stroke();
    }
    const startGridZ = Math.ceil(minZ / 50) * 50;
    for (let gz = startGridZ; gz <= maxZ; gz += 50) {
      const { py } = GameUI.chartToCanvas(0, gz, vp);
      ctx.beginPath();
      ctx.moveTo(8, py);
      ctx.lineTo(width - 8, py);
      ctx.stroke();
    }

    // Vectores de corriente marina
    ctx.strokeStyle = 'rgba(103, 216, 255, 0.26)';
    ctx.fillStyle = 'rgba(103, 216, 255, 0.26)';
    ctx.lineWidth = 1.2;
    for (const cur of snap.currents) {
      const { px, py } = GameUI.chartToCanvas(cur.x, cur.z, vp);
      const len = Math.hypot(cur.vx, cur.vz) * 14;
      const ang = Math.atan2(cur.vz, cur.vx);
      const ex = px + Math.cos(ang) * len;
      const ey = py + Math.sin(ang) * len;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex - Math.cos(ang - 0.5) * 4.5, ey - Math.sin(ang - 0.5) * 4.5);
      ctx.lineTo(ex - Math.cos(ang + 0.5) * 4.5, ey - Math.sin(ang + 0.5) * 4.5);
      ctx.closePath();
      ctx.fill();
    }

    // Cono de incertidumbre hacia la isla o posición revelada
    const raftCanvas = GameUI.chartToCanvas(snap.raft.x, snap.raft.z, vp);
    const islandCanvas = GameUI.chartToCanvas(snap.island.x, snap.island.z, vp);
    if (!snap.island.revealed) {
      const coneLen = Math.max(95, snap.island.distance * scale);
      const b = snap.island.bearingFromRaft;
      const half = snap.island.coneHalfAngle;
      ctx.save();
      ctx.fillStyle = 'rgba(255, 213, 110, 0.11)';
      ctx.strokeStyle = 'rgba(255, 213, 110, 0.42)';
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(raftCanvas.px, raftCanvas.py);
      ctx.arc(raftCanvas.px, raftCanvas.py, coneLen, b - half, b + half);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    } else {
      ctx.save();
      ctx.strokeStyle = 'rgba(102, 230, 168, 0.55)';
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(raftCanvas.px, raftCanvas.py);
      ctx.lineTo(islandCanvas.px, islandCanvas.py);
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = '#66bb6a';
      ctx.strokeStyle = '#e8f5e9';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(islandCanvas.px, islandCanvas.py, 7.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#dff9e2';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('🏝 Isla', islandCanvas.px + 10, islandCanvas.py + 4);
    }

    // Regiones descubiertas o visitadas
    const regionColors = {
      debris: { stroke: '#ffb74d', fill: 'rgba(255, 183, 77, 0.14)' },
      fish: { stroke: '#4dd0e1', fill: 'rgba(77, 208, 225, 0.14)' },
      reef: { stroke: '#ff7043', fill: 'rgba(255, 112, 67, 0.18)' },
      polluted: { stroke: '#aed581', fill: 'rgba(174, 213, 129, 0.14)' },
      storm: { stroke: '#9575cd', fill: 'rgba(149, 117, 205, 0.18)' },
      ship: { stroke: '#ffd54f', fill: 'rgba(255, 213, 79, 0.16)' }
    };
    for (const reg of snap.regions) {
      const pos = GameUI.chartToCanvas(reg.x, reg.z, vp);
      const rad = Math.max(8, reg.radius * scale);
      const palette = regionColors[reg.type] || regionColors.debris;
      ctx.save();
      ctx.fillStyle = palette.fill;
      ctx.strokeStyle = palette.stroke;
      ctx.lineWidth = reg.active ? 2.2 : 1.3;
      if (!reg.visited) ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.arc(pos.px, pos.py, rad, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = '#e1f5fe';
      ctx.font = '600 10px sans-serif';
      ctx.fillText(reg.label, pos.px - rad * 0.55, pos.py - rad - 4);

      if (reg.poi) {
        const poiPos = GameUI.chartToCanvas(reg.poi.x, reg.poi.z, vp);
        ctx.fillStyle = reg.poi.explored ? '#90a4ae' : '#ffd54f';
        ctx.beginPath();
        ctx.arc(poiPos.px, poiPos.py, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = 'bold 9px sans-serif';
        ctx.fillText(
          reg.poi.type === 'shipwreck' ? '⚓ Pecio' : '📡 Boya',
          poiPos.px + 6,
          poiPos.py + 3
        );
      }
    }

    // Estela recorrida desde (0,0)
    if (snap.trail.length > 0) {
      const originPos = GameUI.chartToCanvas(0, 0, vp);
      ctx.fillStyle = '#90caf9';
      ctx.beginPath();
      ctx.arc(originPos.px, originPos.py, 3.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.strokeStyle = 'rgba(225, 245, 254, 0.82)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      snap.trail.forEach((pt, idx) => {
        const p = GameUI.chartToCanvas(pt.x, pt.z, vp);
        if (idx === 0) ctx.moveTo(p.px, p.py);
        else ctx.lineTo(p.px, p.py);
      });
      ctx.stroke();
      ctx.restore();
    }

    // Vector de rumbo deseado / velocidad desde la balsa
    const headingAngle =
      (game.victoryCondition === 'island' ? snap.island.bearingFromRaft : 0) +
      snap.raft.heading * 0.45;
    ctx.strokeStyle = '#ffca28';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(raftCanvas.px, raftCanvas.py);
    ctx.lineTo(
      raftCanvas.px + Math.cos(headingAngle) * 26,
      raftCanvas.py + Math.sin(headingAngle) * 26
    );
    ctx.stroke();

    // Marcador de la balsa
    ctx.fillStyle = '#ffca28';
    ctx.strokeStyle = '#081824';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(raftCanvas.px, raftCanvas.py, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Rosa de los vientos e indicador de viento en la esquina superior derecha
    const cxRose = width - 42;
    const cyRose = 42;
    ctx.strokeStyle = 'rgba(225, 245, 254, 0.45)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(cxRose, cyRose, 22, 0, Math.PI * 2);
    ctx.stroke();
    if (snap.wind) {
      const wa = Number(snap.wind.angle) || 0;
      ctx.strokeStyle = '#80deea';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cxRose - Math.cos(wa) * 14, cyRose - Math.sin(wa) * 14);
      ctx.lineTo(cxRose + Math.cos(wa) * 16, cyRose + Math.sin(wa) * 16);
      ctx.stroke();
    }
    ctx.fillStyle = '#b3e5fc';
    ctx.font = 'bold 9px sans-serif';
    ctx.fillText('VIENTO', cxRose - 18, cyRose + 34);

    return snap;
  }
});
