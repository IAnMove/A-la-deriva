/*****************************************************
 * game-renderer.js - Presentación 3D del estado.
 *
 * Este módulo no decide reglas de juego: recibe el estado y sincroniza
 * cámara, océano, personajes y ayudas visuales. Mantenerlo fuera de Game
 * evita mezclar simulación con objetos THREE y permite sustituir el render
 * sin alterar las mecánicas.
 *****************************************************/

const GameRenderer = {
  highlightCellSize: 0,
  rowGeometry: null,
  validGeometry: null,
  rowMaterial: null,
  validMaterial: null,
  visualElapsed: 0,

  ensureHighlightResources(cellSize) {
    if (GameRenderer.highlightCellSize === cellSize &&
        GameRenderer.rowGeometry && GameRenderer.validGeometry) return;

    if (GameRenderer.rowGeometry) GameRenderer.rowGeometry.dispose();
    if (GameRenderer.validGeometry) GameRenderer.validGeometry.dispose();
    GameRenderer.highlightCellSize = cellSize;
    GameRenderer.rowGeometry = new THREE.BoxGeometry(
      cellSize - 0.15, 0.1, cellSize - 0.15
    );
    GameRenderer.validGeometry = new THREE.BoxGeometry(
      cellSize - 0.15, 0.1, cellSize - 0.15
    );
    if (!GameRenderer.rowMaterial) {
      GameRenderer.rowMaterial = new THREE.MeshBasicMaterial({
        color: 0x4fc3f7,
        transparent: true,
        opacity: 0.10
      });
    }
    if (!GameRenderer.validMaterial) {
      GameRenderer.validMaterial = new THREE.MeshBasicMaterial({
        color: 0x66bb6a,
        transparent: true,
        opacity: 0.18
      });
    }
  },

  clearGroup(group) {
    if (!group) return;
    while (group.children.length) group.remove(group.children[0]);
  },

  updateHighlights(game) {
    const cs = game.raft.cellSize;

    if (game.highlightsDirty) {
      game.highlightsDirty = false;
      GameRenderer.ensureHighlightResources(cs);
      GameRenderer.clearGroup(game.rowGroup);
      GameRenderer.clearGroup(game.highlightGroup);

      const bounds = game.raft.getBounds();
      for (let gx = bounds.minX - 1; gx <= bounds.maxX + 1; gx++) {
        for (let gy = bounds.minY - 1; gy <= bounds.maxY + 1; gy++) {
          if (game.raft.has(gx, gy) || !game.raft.isConnected(gx, gy)) continue;

          const rowMesh = new THREE.Mesh(
            GameRenderer.rowGeometry,
            GameRenderer.rowMaterial
          );
          rowMesh.position.set((gx + 0.5) * cs, 0.05, (gy + 0.5) * cs);
          game.rowGroup.add(rowMesh);

          const validMesh = new THREE.Mesh(
            GameRenderer.validGeometry,
            GameRenderer.validMaterial
          );
          validMesh.position.set((gx + 0.5) * cs, 0.06, (gy + 0.5) * cs);
          game.highlightGroup.add(validMesh);
        }
      }
    }

    const placing = BuildManager.placing && BuildManager.selected;
    game.highlightGroup.visible = !!placing;
    game.rowGroup.visible = !placing && game.state === 'playing';

    game.ghostMesh.visible = false;
    game.hoverRowMesh.visible = false;
    if (game.mouseWorld) {
      const { gx, gy } = game.raft.worldToGrid(
        game.mouseWorld.x,
        game.mouseWorld.z
      );
      if (placing) {
        game.ghostMesh.visible = true;
        const valid = !game.raft.has(gx, gy) && game.raft.isConnected(gx, gy);
        game.ghostMesh.material.color.setHex(valid ? 0x66bb6a : 0xef5350);
        game.ghostMesh.position.set(
          (gx + 0.5) * cs,
          0.35,
          (gy + 0.5) * cs
        );
      } else if (game.isRowingCell(gx, gy)) {
        game.hoverRowMesh.visible = true;
        game.hoverRowMesh.position.set(
          (gx + 0.5) * cs,
          0.12,
          (gy + 0.5) * cs
        );
      }
    }

    if (game.raft.selected) {
      game.selectionMesh.visible = true;
      game.selectionMesh.position.set(
        (game.raft.selected.gx + 0.5) * cs,
        0.4,
        (game.raft.selected.gy + 0.5) * cs
      );
    } else {
      game.selectionMesh.visible = false;
    }
  },

  draw(game, dt) {
    const worldRunning = game.state === 'playing' && !game.paused;
    const worldDt = worldRunning ? dt : 0;
    game.elapsed += worldDt;
    GameRenderer.visualElapsed += dt;
    const worldTime = game.elapsed;
    const characterTime = game.fishing?.active
      ? GameRenderer.visualElapsed
      : worldTime;
    const characterDt = worldRunning || game.fishing?.active ? dt : 0;
    const center = game.raft.getCenter();

    if (game.raft.group) {
      const wave = World.waveHeight(
        center.x,
        center.z,
        worldTime,
        game.worldOffset,
        game.worldOffsetZ
      );
      game.raft.group.position.y = wave * World.waveAmp * 0.6;
      const rockMultiplier = game.storm ? 2.2 : 1;
      game.raft.group.rotation.x =
        Math.sin(worldTime * 0.9) * 0.015 * rockMultiplier;
      game.raft.group.rotation.z =
        Math.cos(worldTime * 0.7) * 0.018 * rockMultiplier;

      game.raft.group.traverse(object => {
        if (object.name === 'flame') {
          const scale = 0.9 + Math.sin(worldTime * 12 + object.id) * 0.2;
          object.scale.set(
            scale,
            1 + Math.sin(worldTime * 15 + object.id) * 0.25,
            scale
          );
        } else if (object.name === 'prop') {
          object.rotation.x += worldDt * 6;
        }
      });
    }

    PlayerVis.sync(game.player, characterDt, characterTime);
    PlayerVis.updateAim(
      game.player,
      BuildManager.placing ? null : game.mouseWorld
    );
    if (game.fishing?.active && game.player.hook) {
      HookVis.show(
        game.player.x,
        game.player.z,
        game.player.hook.x,
        game.player.hook.z
      );
    }
    CrewManager.syncMeshes(game.raft);

    World.updateCamera(
      center,
      game.raft.getBounds(),
      dt,
      game.raft.cellSize
    );
    World.updateSea(
      worldTime,
      game.worldOffset,
      game.worldOffsetZ,
      game.storm
    );
    World.updateDayNight(game.time, game.storm, game.fog, worldDt);
    World.updateRain(worldDt, game.rain);
    World.render();
  }
};
