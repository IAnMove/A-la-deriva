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

// Las historias contienen solo datos: en el guardado se conserva su clave y
// la cuenta atras. Asi pueden balancearse o traducirse sin migrar cada partida.
const SURVIVOR_STORIES = [
  {
    key: 'coast_guard',
    title: 'La mochila del guardacostas',
    tale: 'Asegura que perdió una mochila estanca mientras auxiliaba a otra tripulación.',
    riskBenefit: 'Beneficio probable: suministros médicos y una noticia que levante el ánimo.',
    delayDays: 1,
    impact: 'La mochila aparece atada bajo una tabla: aún contiene material útil.',
    outcome: {
      resources: { cloth: 1, water: 0.5 },
      player: { health: 5, morale: 4 },
      memberHealth: 6
    }
  },
  {
    key: 'thirsty_deserter',
    title: 'El desertor sediento',
    tale: 'Evita explicar por qué abandonó su anterior balsa y vigila demasiado las reservas.',
    riskBenefit: 'Riesgo alto: podría ocultar o consumir víveres del grupo.',
    delayDays: 1,
    impact: 'Durante la noche saquea parte de las reservas antes de ser descubierto.',
    outcome: {
      resources: { food: -1, water: -1.5 },
      player: { morale: -6 },
      crewMorale: -3
    }
  },
  {
    key: 'folded_chart',
    title: 'La carta doblada',
    tale: 'Una antigua cartógrafa conserva de memoria boyas, corrientes y frecuencias de rescate.',
    riskBenefit: 'Beneficio incierto: puede acortar una ruta o mejorar una señal futura.',
    delayDays: 2,
    impact: 'Reconstruye una ruta segura y anota una frecuencia de emergencia fiable.',
    outcome: {
      progress: { rescuedSignal: 5, islandDistance: -20 },
      player: { morale: 3 }
    }
  },
  {
    key: 'salt_fever',
    title: 'La fiebre salina',
    tale: 'Dice que solo está agotado, aunque sus manos tiemblan y la fiebre no remite.',
    riskBenefit: 'Riesgo médico: puede empeorar y contagiar el desánimo a bordo.',
    delayDays: 1,
    impact: 'La fiebre se agrava. La tripulación dedica el día a contenerla.',
    outcome: {
      memberHealth: -16,
      crewHealth: -3,
      player: { health: -3, morale: -4 },
      crewMorale: -3
    }
  },
  {
    key: 'seed_keeper',
    title: 'El tarro de semillas',
    tale: 'Protege un tarro oxidado y promete que algunas semillas aún pueden germinar.',
    riskBenefit: 'Beneficio a medio plazo: alimento escaso, pero renovable y esperanzador.',
    delayDays: 3,
    impact: 'Abre el tarro y aprovecha brotes comestibles que habían sobrevivido dentro.',
    outcome: {
      resources: { food: 2 },
      player: { morale: 5 },
      crewMorale: 4,
      stats: { gathered: 1 }
    }
  },
  {
    key: 'hidden_toolbox',
    title: 'La caja bajo el casco',
    tale: 'Una mecánica naval insiste en que marcó dónde se hundió su pequeña caja de herramientas.',
    riskBenefit: 'Beneficio técnico: una reparación y quizá alguna pieza recuperable.',
    delayDays: 2,
    impact: 'Encuentra la caja siguiendo la deriva y refuerza la estructura más dañada.',
    outcome: {
      resources: { metal: 1 },
      repair: 10
    }
  },
  {
    key: 'radio_listener',
    title: 'Voces entre la estática',
    tale: 'Un radioaficionado repite una secuencia que oyó antes de que su receptor se apagara.',
    riskBenefit: 'Beneficio potencial: un avance importante en la búsqueda de rescate.',
    delayDays: 3,
    impact: 'Descifra la secuencia: es una baliza de rescate todavía activa.',
    outcome: {
      progress: { rescuedSignal: 12 },
      player: { morale: 4 },
      crewMorale: 2
    }
  },
  {
    key: 'false_salvager',
    title: 'El falso recuperador',
    tale: 'Presume de conocer depósitos flotantes, pero cambia de versión cada vez que le preguntan.',
    riskBenefit: 'Riesgo alto: su historia puede ser una excusa para apropiarse de materiales.',
    delayDays: 2,
    impact: 'Sus coordenadas eran falsas y faltan materiales de la reserva.',
    outcome: {
      resources: { wood: -2, metal: -1 },
      player: { morale: -5 },
      crewMorale: -4
    }
  },
  {
    key: 'storm_mediator',
    title: 'La promesa del faro',
    tale: 'Sobrevivió manteniendo unido a un grupo durante una tormenta y recuerda sus nombres.',
    riskBenefit: 'Beneficio social: podría fortalecer la moral si logra contar toda la historia.',
    delayDays: 2,
    impact: 'Comparte por fin su relato y consigue que la tripulación vuelva a hablar como un equipo.',
    outcome: {
      player: { morale: 7, sanity: 3 },
      crewMorale: 7
    }
  },
  {
    key: 'wreck_diver',
    title: 'La campana sumergida',
    tale: 'Un buzo afirma haber visto una campana de carga bajo los restos cercanos.',
    riskBenefit: 'Riesgo y beneficio: puede traer material, pero la inmersión castigará su salud.',
    delayDays: 2,
    impact: 'Regresa exhausto de la inmersión, arrastrando cabos y piezas aprovechables.',
    outcome: {
      resources: { plastic: 2, rope: 1 },
      memberHealth: -10,
      stats: { gathered: 2 }
    }
  }
];

function getSurvivorStory(key) {
  const normalizedKey = typeof key === 'object' && key ? key.key : key;
  return SURVIVOR_STORIES.find(story => story.key === normalizedKey) || null;
}

function legacyStoryKey(name) {
  const text = String(name || 'superviviente');
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = ((hash * 31) + text.charCodeAt(i)) >>> 0;
  return SURVIVOR_STORIES[hash % SURVIVOR_STORIES.length].key;
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function escapeSurvivorHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

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
    const story = Util.choice(SURVIVOR_STORIES);
    this.story = story.key;
    this.storyResolved = false;
    this.storyDaysRemaining = story.delayDays;
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
    const savedStory = getSurvivorStory(data?.story);
    s.story = savedStory ? savedStory.key : legacyStoryKey(s.name);
    s.storyResolved = data?.storyResolved === true;
    const defaultDelay = getSurvivorStory(s.story).delayDays;
    s.storyDaysRemaining = s.storyResolved
      ? 0
      : Util.clamp(Math.round(finiteNumber(data?.storyDaysRemaining, defaultDelay)), 0, 3);
    s.health = Util.clamp(Number.isFinite(Number(s.health)) ? Number(s.health) : 100, 0, 100);
    s.hunger = Util.clamp(Number.isFinite(Number(s.hunger)) ? Number(s.hunger) : 80, 0, 100);
    s.thirst = Util.clamp(Number.isFinite(Number(s.thirst)) ? Number(s.thirst) : 80, 0, 100);
    s.morale = Util.clamp(Number.isFinite(Number(s.morale)) ? Number(s.morale) : 70, 0, 100);
    s.alive = s.alive !== false && s.health > 0;
    s.deathLogged = s.deathLogged === true;
    return s;
  }

  static getStoryByKey(key) {
    return getSurvivorStory(key);
  }

  static getStories() {
    return SURVIVOR_STORIES;
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

  getStory() {
    return getSurvivorStory(this.story) || SURVIVOR_STORIES[0];
  }

  getStoryOfferText() {
    const story = this.getStory();
    return `${story.title}\n${story.tale}\n${story.riskBenefit}`;
  }

  getStoryImpactText() {
    return this.getStory().impact;
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
    if (alive.length === 0) {
      for (const m of CrewManager.members) {
        if (!m.alive && !m.deathLogged) {
          Log.add(`${m.name} ha fallecido.`);
          m.deathLogged = true;
        }
        if (!m.alive && m.mesh) CrewManager.removeMesh(m);
      }
      return { consumedFood: 0, consumedWater: 0 };
    }
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

  // Resuelve una vez las historias pendientes. Se espera una llamada por dia.
  resolveStoryEvents: (game) => {
    const messages = [];
    if (!game || !game.resources || !game.player) return messages;

    for (const member of CrewManager.members) {
      if (!member.alive || member.storyResolved) continue;
      let story = getSurvivorStory(member.story);
      if (!story) {
        member.story = legacyStoryKey(member.name);
        story = getSurvivorStory(member.story);
        member.storyDaysRemaining = story.delayDays;
      }

      member.storyDaysRemaining = Math.max(0, Math.round(finiteNumber(
        member.storyDaysRemaining,
        story.delayDays
      )) - 1);
      if (member.storyDaysRemaining > 0) continue;

      const outcome = story.outcome || {};
      for (const [key, amount] of Object.entries(outcome.resources || {})) {
        game.resources[key] = Math.max(0, finiteNumber(game.resources[key]) + finiteNumber(amount));
      }
      for (const [key, amount] of Object.entries(outcome.player || {})) {
        game.player[key] = Util.clamp(finiteNumber(game.player[key]) + finiteNumber(amount), 0, 100);
      }
      for (const [key, amount] of Object.entries(outcome.stats || {})) {
        if (!game.stats) game.stats = {};
        game.stats[key] = Math.max(0, finiteNumber(game.stats[key]) + finiteNumber(amount));
      }

      if (outcome.memberHealth) {
        member.health = Util.clamp(member.health + finiteNumber(outcome.memberHealth), 0, 100);
      }
      if (outcome.crewHealth || outcome.crewMorale) {
        for (const crewMember of CrewManager.members) {
          if (!crewMember.alive) continue;
          if (outcome.crewHealth) {
            crewMember.health = Util.clamp(
              crewMember.health + finiteNumber(outcome.crewHealth),
              0,
              100
            );
          }
          if (outcome.crewMorale) {
            crewMember.morale = Util.clamp(
              crewMember.morale + finiteNumber(outcome.crewMorale),
              0,
              100
            );
          }
        }
      }

      if (outcome.repair && game.raft?.grid && typeof game.raft.repairAt === 'function') {
        const damaged = Array.from(game.raft.grid.entries())
          .filter(([, cell]) => cell.health < (cell.maxHealth || cell.health))
          .sort((a, b) => (
            a[1].health / (a[1].maxHealth || a[1].health)
          ) - (
            b[1].health / (b[1].maxHealth || b[1].health)
          ))[0];
        if (damaged) {
          const [gx, gy] = damaged[0].split(',').map(Number);
          game.raft.repairAt(gx, gy, finiteNumber(outcome.repair));
        }
      }

      const progress = outcome.progress || {};
      if (progress.rescuedSignal) {
        const signal = Math.max(0, finiteNumber(progress.rescuedSignal));
        if (game.victoryCondition === 'radio') {
          game.rescuedSignal = Util.clamp(finiteNumber(game.rescuedSignal) + signal, 0, 100);
        } else {
          game.radioIntel = Util.clamp(finiteNumber(game.radioIntel) + signal, 0, 40);
        }
      }
      if (progress.islandDistance) {
        const distance = finiteNumber(progress.islandDistance);
        if (game.victoryCondition === 'island') {
          game.islandDistance = Math.max(0, finiteNumber(game.islandDistance) + distance);
        } else {
          game.navigationIntel = Util.clamp(
            finiteNumber(game.navigationIntel) + Math.max(0, -distance),
            0,
            120
          );
        }
      }

      for (const key of Object.keys(game.resources)) {
        game.resources[key] = Math.max(0, finiteNumber(game.resources[key]));
      }
      for (const key of ['health', 'hunger', 'thirst', 'morale', 'stamina', 'sanity']) {
        game.player[key] = Util.clamp(finiteNumber(game.player[key]), 0, 100);
      }
      if (game.stats) {
        for (const key of Object.keys(game.stats)) {
          if (typeof game.stats[key] === 'number') {
            game.stats[key] = Math.max(0, finiteNumber(game.stats[key]));
          }
        }
      }

      member.health = Util.clamp(finiteNumber(member.health), 0, 100);
      member.morale = Util.clamp(finiteNumber(member.morale), 0, 100);
      if (member.health <= 0) member.alive = false;
      member.storyResolved = true;
      member.storyDaysRemaining = 0;
      messages.push(`${member.name} · ${story.title}: ${story.impact}`);
    }
    return messages;
  },

  // Trabajo diario visible y moderado de cada especialidad. Devuelve textos
  // para que Game decida si mostrarlos en el diario o en el resumen del dia.
  applyDailyWork: (game) => {
    const messages = [];
    if (!game || !game.resources || !game.player) return messages;

    const repairMostDamaged = (amount, advancedOnly = false) => {
      if (!game.raft?.grid || typeof game.raft.repairAt !== 'function') return 0;
      const damaged = Array.from(game.raft.grid.entries())
        .filter(([, cell]) => {
          const maxHealth = cell.maxHealth || cell.health;
          if (cell.health >= maxHealth) return false;
          const definition = typeof BUILDINGS === 'undefined' ? null : BUILDINGS[cell.buildingKey];
          return !advancedOnly || definition?.category === 'advanced';
        })
        .sort((a, b) => (
          a[1].health / (a[1].maxHealth || a[1].health)
        ) - (
          b[1].health / (b[1].maxHealth || b[1].health)
        ))[0];
      if (!damaged) return 0;
      const [coords, cell] = damaged;
      const before = cell.health;
      const [gx, gy] = coords.split(',').map(Number);
      game.raft.repairAt(gx, gy, amount);
      return Math.max(0, cell.health - before);
    };

    for (const member of CrewManager.members) {
      if (!member.alive || !member.skill) continue;
      const value = finiteNumber(member.skill.value);

      if (member.skill.effect === 'foodGain') {
        const food = Util.clamp(value, 0, 0.5);
        game.resources.food = Math.max(0, finiteNumber(game.resources.food) + food);
        messages.push(`${member.name} pescó ${food.toFixed(1)} de comida.`);
      } else if (member.skill.effect === 'woodCost') {
        const repaired = repairMostDamaged(Math.abs(value) * 20);
        if (repaired > 0) messages.push(`${member.name} reparó ${repaired.toFixed(0)} de estructura.`);
      } else if (member.skill.effect === 'heal') {
        const candidates = [game.player, ...CrewManager.members.filter(m => m.alive)];
        const target = candidates.sort((a, b) => a.health - b.health)[0];
        const before = finiteNumber(target.health);
        target.health = Util.clamp(before + Math.max(0, value), 0, 100);
        const healed = target.health - before;
        if (healed > 0) {
          messages.push(`${member.name} atendió a la persona más herida (+${healed.toFixed(0)} salud).`);
        }
      } else if (member.skill.effect === 'drift') {
        if (game.victoryCondition === 'island') {
          const advance = Math.max(0, value * 8);
          game.islandDistance = Math.max(0, finiteNumber(game.islandDistance) - advance);
          messages.push(`${member.name} corrigió el rumbo y avanzó ${advance.toFixed(1)} de distancia.`);
        } else if (game.victoryCondition === 'radio') {
          const signal = Math.max(0, value * 4);
          game.rescuedSignal = Util.clamp(finiteNumber(game.rescuedSignal) + signal, 0, 100);
          messages.push(`${member.name} afinó la posición de la señal (+${signal.toFixed(1)}%).`);
        }
      } else if (member.skill.effect === 'durability') {
        const repaired = repairMostDamaged(Math.max(0, value) * 12, true);
        if (repaired > 0) {
          messages.push(`${member.name} puso a punto una estructura avanzada (+${repaired.toFixed(0)}).`);
        }
      } else if (member.skill.effect === 'foodCons') {
        const food = Util.clamp(Math.abs(value), 0, 0.25);
        game.resources.food = Math.max(0, finiteNumber(game.resources.food) + food);
        messages.push(`${member.name} aprovechó las sobras y conservó ${food.toFixed(1)} de comida.`);
      }
    }

    for (const key of Object.keys(game.resources)) {
      game.resources[key] = Math.max(0, finiteNumber(game.resources[key]));
    }
    for (const key of ['health', 'hunger', 'thirst', 'morale', 'stamina', 'sanity']) {
      game.player[key] = Util.clamp(finiteNumber(game.player[key]), 0, 100);
    }
    return messages;
  },

  renderList: (container) => {
    container.innerHTML = '';
    if (CrewManager.members.length === 0) {
      container.innerHTML = '<p style="color:var(--muted)">No hay otros supervivientes a bordo.</p>';
      return;
    }
    for (const m of CrewManager.members) {
      const alive = m.alive ? '' : ' (Fallecido)';
      const story = typeof m.getStory === 'function'
        ? m.getStory()
        : (getSurvivorStory(m.story) || SURVIVOR_STORIES[0]);
      const storyState = m.storyResolved
        ? 'Historia resuelta'
        : `Se sabrá más en ${Math.max(0, finiteNumber(m.storyDaysRemaining, story.delayDays))} día(s)`;
      const div = document.createElement('div');
      div.className = 'crew-member';
      div.innerHTML = `
        <div class="crew-name">${escapeSurvivorHtml(m.name)}${alive}</div>
        <div class="crew-role">${escapeSurvivorHtml(m.skill.name)} · ${escapeSurvivorHtml(m.trait.name)}</div>
        <div class="crew-skill-detail">${escapeSurvivorHtml(m.skill.desc)} · ${escapeSurvivorHtml(m.trait.desc)}</div>
        <div class="crew-story"><strong>${escapeSurvivorHtml(story.title)}</strong> · ${escapeSurvivorHtml(storyState)}</div>
        <div class="crew-story-detail">${escapeSurvivorHtml(m.storyResolved ? story.impact : story.riskBenefit)}</div>
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
