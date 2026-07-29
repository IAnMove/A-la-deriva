/*****************************************************
 * survivor.js - Supervivientes y tripulación (3D)
 *****************************************************/

const NAMES = [
  'Ana', 'Luis', 'Marta', 'Pedro', 'Sofía', 'Juan', 'Elena', 'Carlos',
  'Lucía', 'Diego', 'Paula', 'Andrés', 'Nerea', 'Hugo', 'Clara', 'Mario',
  'Sara', 'Pablo', 'Irene', 'Daniel', 'Valeria', 'Alejandro', 'Emma', 'Javier'
];

const SURNAMES = [
  'Ruiz', 'Santos', 'Vega', 'Torres', 'Marín', 'Gil', 'Molina', 'Ortega',
  'Delgado', 'Moreno', 'Castro', 'Rubio', 'Navarro', 'Herrera', 'Medina', 'Ramos'
];

const SKILLS = [
  { key: 'fisher', name: 'Pescador', desc: '+30% de comida obtenida al pescar', effect: 'foodGain', value: 0.30 },
  { key: 'carpenter', name: 'Carpintero', desc: '-15% de coste de madera al construir', effect: 'woodCost', value: -0.15 },
  { key: 'medic', name: 'Médico', desc: 'Cura 2 de salud a toda la tripulación al acabar el día', effect: 'heal', value: 2 },
  { key: 'navigator', name: 'Navegante', desc: 'Aumenta la velocidad de deriva un 15%', effect: 'drift', value: 0.15 },
  { key: 'mechanic', name: 'Mecánico', desc: 'Las estructuras avanzadas duran un 25% más', effect: 'durability', value: 0.25 },
  { key: 'cook', name: 'Cocinero', desc: '-10% de consumo de comida', effect: 'foodCons', value: -0.10 },
];

const TRAITS = [
  { key: 'optimist', name: 'Optimista', desc: '+10% de moral', effect: 'moraleGain', value: 0.10 },
  { key: 'selfish', name: 'Egoísta', desc: '-5% de moral del grupo', effect: 'moraleLoss', value: -0.05 },
  { key: 'worker', name: 'Trabajador', desc: '+10% de recursos al recoger', effect: 'gather', value: 0.10 },
  { key: 'sick', name: 'Enfermo', desc: 'Pierde salud lentamente', effect: 'healthDrain', value: 0.03 },
  { key: 'fearful', name: 'Miedoso', desc: '-10% de moral durante tormentas', effect: 'stormMorale', value: -0.10 },
  { key: 'generous', name: 'Generoso', desc: '+5% de moral del grupo', effect: 'moraleGain', value: 0.05 },
  { key: 'conflictive', name: 'Conflictivo', desc: 'Puede provocar discusiones', effect: 'conflict', value: 0.15 },
];

// Figura low-poly articulada de una persona
// userData.parts: { legL, legR, armL, armR, head, body } (brazos y piernas con pivote)
function makeHumanoidMesh(shirtColor = 0xd84315, opts = {}) {
  const skin = opts.skin ?? 0xffcc80;
  const hairC = opts.hair ?? 0x4e342e;
  const pants = opts.pants ?? 0x37474f;
  const g = new THREE.Group();

  // Piernas con pivote en la cadera
  const legL = new THREE.Group();
  legL.position.set(-0.11, 0.36, 0);
  legL.add(box(0.15, 0.36, 0.17, pants, 0, -0.18, 0));
  const legR = new THREE.Group();
  legR.position.set(0.11, 0.36, 0);
  legR.add(box(0.15, 0.36, 0.17, pants, 0, -0.18, 0));

  // Torso
  const body = box(0.44, 0.52, 0.26, shirtColor, 0, 0.62, 0);
  // Cinturón
  const belt = box(0.46, 0.08, 0.28, 0x263238, 0, 0.4, 0);

  // Brazos con pivote en el hombro
  const armL = new THREE.Group();
  armL.position.set(-0.29, 0.82, 0);
  armL.add(box(0.12, 0.4, 0.14, shirtColor, 0, -0.17, 0));
  armL.add(box(0.1, 0.1, 0.11, skin, 0, -0.4, 0));
  const armR = new THREE.Group();
  armR.position.set(0.29, 0.82, 0);
  armR.add(box(0.12, 0.4, 0.14, shirtColor, 0, -0.17, 0));
  armR.add(box(0.1, 0.1, 0.11, skin, 0, -0.4, 0));

  // Cabeza con pelo y ojos
  const head = new THREE.Group();
  head.position.set(0, 1.05, 0);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 10), mat(skin));
  skull.castShadow = true;
  head.add(skull);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 10), mat(hairC));
  hair.scale.set(1, 0.72, 1);
  hair.position.set(0, 0.07, -0.03);
  hair.castShadow = true;
  head.add(hair);
  const eyeL = box(0.035, 0.05, 0.02, 0x212121, -0.07, 0.0, 0.18);
  const eyeR = box(0.035, 0.05, 0.02, 0x212121, 0.07, 0.0, 0.18);
  head.add(eyeL, eyeR);

  g.add(legL, legR, body, belt, armL, armR, head);
  g.userData.parts = { legL, legR, armL, armR, head, body };
  return g;
}

class Survivor {
  constructor() {
    this.name = `${Util.choice(NAMES)} ${Util.choice(SURNAMES)}`;
    this.health = 100;
    this.hunger = 80;
    this.thirst = 80;
    this.morale = 70;
    this.skill = Util.choice(SKILLS);
    this.trait = Util.choice(TRAITS);
    this.alive = true;
    this.deathLogged = false;
    this.days = 0;
    this.gx = null;
    this.gy = null;
    this.mesh = null;
  }

  static fromData(data) {
    const s = new Survivor();
    Object.assign(s, data || {});
    s.mesh = null;
    s.skill = SKILLS.find(k => k.key === data?.skill?.key) || SKILLS[0];
    s.trait = TRAITS.find(k => k.key === data?.trait?.key) || TRAITS[0];
    s.health = Util.clamp(Number.isFinite(Number(s.health)) ? Number(s.health) : 100, 0, 100);
    s.hunger = Util.clamp(Number.isFinite(Number(s.hunger)) ? Number(s.hunger) : 80, 0, 100);
    s.thirst = Util.clamp(Number.isFinite(Number(s.thirst)) ? Number(s.thirst) : 80, 0, 100);
    s.morale = Util.clamp(Number.isFinite(Number(s.morale)) ? Number(s.morale) : 70, 0, 100);
    s.alive = s.alive !== false && s.health > 0;
    s.deathLogged = s.deathLogged === true;
    return s;
  }

  updateDaily(foodAvailable, waterAvailable, isStorm) {
    if (!this.alive) return { consumedFood: 0, consumedWater: 0 };

    const foodNeed = this.dailyFoodNeed();
    let waterNeed = 1.3;

    let consumedFood = Math.min(foodAvailable, foodNeed);
    let consumedWater = Math.min(waterAvailable, waterNeed);

    this.hunger = Math.min(100, this.hunger + consumedFood * 12);
    this.thirst = Math.min(100, this.thirst + consumedWater * 15);

    if (consumedFood >= foodNeed * 0.9 && consumedWater >= waterNeed * 0.9) {
      this.health = Math.min(100, this.health + 2);
      this.morale = Math.min(100, this.morale + 3);
    }

    if (consumedFood < foodNeed) {
      this.health -= (foodNeed - consumedFood) * 8;
      this.morale -= 4;
      this.hunger = Math.max(0, this.hunger - (foodNeed - consumedFood) * 8);
    } else {
      this.hunger = Math.max(0, this.hunger - 3);
    }

    if (consumedWater < waterNeed) {
      this.health -= (waterNeed - consumedWater) * 12;
      this.morale -= 6;
      this.thirst = Math.max(0, this.thirst - (waterNeed - consumedWater) * 10);
    } else {
      this.thirst = Math.max(0, this.thirst - 4);
    }

    if (this.trait.effect === 'healthDrain') this.health -= 3;
    if (this.trait.effect === 'moraleGain') this.morale = Math.min(100, this.morale + 3);
    if (this.trait.effect === 'moraleLoss') this.morale -= 1;
    if (isStorm && this.trait.effect === 'stormMorale') this.morale -= 5;

    if (this.thirst < 20) this.health -= 2;
    if (this.hunger < 15) this.health -= 1;

    this.health = Util.clamp(this.health, 0, 100);
    this.hunger = Util.clamp(this.hunger, 0, 100);
    this.thirst = Util.clamp(this.thirst, 0, 100);
    this.morale = Util.clamp(this.morale, 0, 100);

    if (this.health <= 0) this.alive = false;
    this.days++;

    return { consumedFood, consumedWater };
  }

  heal(amount) {
    if (!this.alive) return;
    this.health = Math.min(100, this.health + amount);
  }

  dailyFoodNeed() {
    return this.skill.effect === 'foodCons' ? 1 + this.skill.value : 1;
  }

  getFullDesc() {
    return `${this.name} · ${this.skill.name} · ${this.trait.name}`;
  }
}

const CrewManager = {
  members: [],

  reset: () => {
    for (const m of CrewManager.members) CrewManager.removeMesh(m);
    CrewManager.members = [];
  },

  add: (survivor) => {
    CrewManager.members.push(survivor);
  },

  removeMesh: (m) => {
    if (m.mesh && m.mesh.parent) m.mesh.parent.remove(m.mesh);
    m.mesh = null;
  },

  // Crea/actualiza las figuras 3D de la tripulación sobre la balsa
  syncMeshes: (raft) => {
    const cs = raft.cellSize;
    for (const m of CrewManager.members) {
      if (!m.alive) { CrewManager.removeMesh(m); continue; }
      if (m.gx == null || !raft.has(m.gx, m.gy)) CrewManager.assignPosition(m, raft);
      if (m.gx == null) continue;
      if (!m.mesh) {
        m.mesh = makeHumanoidMesh(0xd84315, { hair: Util.choice([0x4e342e, 0x212121, 0x8d6e63, 0x6d4c41, 0x5d4037]) });
        raft.group.add(m.mesh);
        m.mesh.userData.phase = Math.random() * Math.PI * 2;
      }
      // Balanceo suave en reposo
      const sway = Math.sin(performance.now() / 600 + m.mesh.userData.phase) * 0.02;
      m.mesh.position.set((m.gx + 0.5) * cs, 0.35 + Math.abs(sway), (m.gy + 0.5) * cs);
      m.mesh.rotation.y += (m.mesh.userData.phase + Math.PI - m.mesh.rotation.y) * 0.01;
    }
  },

  assignPosition: (survivor, raft) => {
    // Buscar una celda ocupada de la balsa sin otro tripulante
    for (const [k] of raft.grid.entries()) {
      const [gx, gy] = k.split(',').map(Number);
      const occupied = CrewManager.members.some(m => m.alive && m !== survivor && m.gx === gx && m.gy === gy);
      const isPlayer = Game.player && Game.raft === raft &&
        (() => { const pg = raft.worldToGrid(Game.player.x, Game.player.z); return pg.gx === gx && pg.gy === gy; })();
      if (!occupied && !isPlayer) { survivor.gx = gx; survivor.gy = gy; return true; }
    }
    if (raft.grid.size === 0) {
      survivor.gx = null;
      survivor.gy = null;
      return false;
    }
    const center = raft.getCenter();
    const { gx, gy } = raft.worldToGrid(center.x, center.z);
    survivor.gx = gx; survivor.gy = gy;
    return true;
  },

  count: () => CrewManager.members.filter(m => m.alive).length,

  totalWeight: () => CrewManager.members.filter(m => m.alive).length * 1.0,

  dailyUpdateByShare: (foodShare, waterShare, isStorm) => {
    const alive = CrewManager.members.filter(m => m.alive);
    if (alive.length === 0) return { consumedFood: 0, consumedWater: 0 };
    const totalFoodNeed = alive.reduce((sum, m) => sum + m.dailyFoodNeed(), 0);
    const waterPer = waterShare / alive.length;
    let totalFood = 0, totalWater = 0;
    for (const m of alive) {
      const foodPer = totalFoodNeed > 0 ? foodShare * (m.dailyFoodNeed() / totalFoodNeed) : 0;
      const r = m.updateDaily(foodPer, waterPer, isStorm);
      totalFood += r.consumedFood;
      totalWater += r.consumedWater;
    }
    const hasMedic = alive.some(m => m.skill.effect === 'heal');
    if (hasMedic) {
      for (const m of alive) m.heal(2);
    }
    for (const m of CrewManager.members) {
      if (!m.alive && !m.deathLogged) {
        Log.add(`${m.name} ha fallecido.`);
        m.deathLogged = true;
      }
      if (!m.alive && m.mesh) {
        CrewManager.removeMesh(m);
      }
    }
    return { consumedFood: totalFood, consumedWater: totalWater };
  },

  getMoraleBonus: () => {
    let bonus = 0;
    for (const m of CrewManager.members) {
      if (!m.alive) continue;
      if (m.trait.effect === 'moraleGain') bonus += m.trait.value;
      if (m.trait.effect === 'moraleLoss') bonus += m.trait.value;
    }
    return bonus;
  },

  getResourceBonus: () => {
    let bonus = 0;
    for (const m of CrewManager.members) {
      if (m.alive && m.trait.effect === 'gather') bonus += m.trait.value;
    }
    return bonus;
  },

  getDriftBonus: () => {
    let bonus = 0;
    for (const m of CrewManager.members) {
      if (m.alive && m.skill.effect === 'drift') bonus += m.skill.value;
    }
    return bonus;
  },

  getFishingBonus: () => {
    let bonus = 0;
    for (const m of CrewManager.members) {
      if (m.alive && m.skill.effect === 'foodGain') bonus += m.skill.value;
    }
    return bonus;
  },

  getDurabilityBonus: () => {
    return CrewManager.members.some(m => m.alive && m.skill.effect === 'durability') ? 0.25 : 0;
  },

  getConflictChance: () => {
    let chance = 0;
    for (const m of CrewManager.members) {
      if (m.alive && m.trait.effect === 'conflict') chance += m.trait.value;
    }
    return Util.clamp(chance, 0, 0.75);
  },

  getDailyFoodNeed: () => {
    return CrewManager.members
      .filter(m => m.alive)
      .reduce((sum, m) => sum + m.dailyFoodNeed(), 0);
  },

  renderList: (container) => {
    container.innerHTML = '';
    if (CrewManager.members.length === 0) {
      container.innerHTML = '<p style="color:var(--muted)">No hay otros supervivientes a bordo.</p>';
      return;
    }
    for (const m of CrewManager.members) {
      const alive = m.alive ? '' : ' (Fallecido)';
      const div = document.createElement('div');
      div.className = 'crew-member';
      div.innerHTML = `
        <div class="crew-name">${m.name}${alive}</div>
        <div class="crew-role">${m.skill.name} · ${m.trait.name}</div>
        <div class="crew-bars">
          <div class="bar"><span>Salud</span><div class="track"><div class="fill health" style="width:${m.health}%;${m.health < 25 ? 'background:var(--danger)' : ''}"></div></div></div>
          <div class="bar"><span>Hambre</span><div class="track"><div class="fill hunger" style="width:${m.hunger}%;${m.hunger < 25 ? 'background:var(--danger)' : ''}"></div></div></div>
          <div class="bar"><span>Sed</span><div class="track"><div class="fill thirst" style="width:${m.thirst}%;${m.thirst < 25 ? 'background:var(--danger)' : ''}"></div></div></div>
          <div class="bar"><span>Moral</span><div class="track"><div class="fill morale" style="width:${m.morale}%;${m.morale < 25 ? 'background:var(--danger)' : ''}"></div></div></div>
        </div>
      `;
      container.appendChild(div);
    }
  }
};
