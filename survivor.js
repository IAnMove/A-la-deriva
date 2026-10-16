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

const CREW_JOBS = Object.freeze([
  { key: 'fish', name: 'Pescar', desc: 'Consigue una pequeña cantidad de comida.', skill: 'foodGain' },
  { key: 'water', name: 'Agua', desc: 'Recoge condensación y ayuda con los purificadores.', skill: 'foodCons' },
  { key: 'salvage', name: 'Recuperar', desc: 'Busca materiales aprovechables entre los restos.', skill: 'woodCost' },
  { key: 'repair', name: 'Reparar', desc: 'Mantiene el módulo más dañado de la balsa.', skill: 'durability' },
  { key: 'care', name: 'Cuidados', desc: 'Atiende heridas y reduce el estrés del grupo.', skill: 'heal' },
  { key: 'navigate', name: 'Navegar', desc: 'Mejora el avance de la ruta activa.', skill: 'drift' },
  { key: 'guard', name: 'Vigilar', desc: 'Detecta robos y reduce el riesgo de una crisis.', skill: null },
  { key: 'cook', name: 'Cocinar', desc: 'Aprovecha mejor las raciones disponibles.', skill: 'foodCons' },
  { key: 'rest', name: 'Descansar', desc: 'Recupera salud y reduce mucho el estrés.', skill: null }
]);

function getCrewJob(key) {
  return CREW_JOBS.find(job => job.key === key) || null;
}

function defaultCrewJob(skill) {
  return {
    foodGain: 'fish',
    woodCost: 'salvage',
    heal: 'care',
    drift: 'navigate',
    durability: 'repair',
    foodCons: 'cook'
  }[skill?.effect] || 'salvage';
}

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

function crewBehaviorRoll(member, day, salt = 0) {
  const text = `${member?.name || 'tripulante'}:${day}:${salt}`;
  let hash = 2166136261;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
}

function escapeSurvivorHtml(value) {
  return Util.escapeHtml(value);
}

// Figura low-poly articulada de una persona
// userData.parts: { legL, legR, armL, armR, head, body } (brazos y piernas con pivote)
function makeHumanoidMesh(shirtColor = 0xd84315, opts = {}) {
  const skin = opts.skin ?? 0xffcc80;
  const hairC = opts.hair ?? 0x4e342e;
  const pants = opts.pants ?? 0x37474f;
  const g = new THREE.Group();

  // Las botas alargan la silueta hacia delante y hacen más legible el paso.
  const legL = new THREE.Group();
  legL.position.set(-0.11, 0.36, 0);
  legL.add(box(0.16, 0.34, 0.18, pants, 0, -0.16, 0));
  const footL = box(0.18, 0.11, 0.29, 0x263238, 0, -0.35, 0.055);
  legL.add(footL);
  const legR = new THREE.Group();
  legR.position.set(0.11, 0.36, 0);
  legR.add(box(0.16, 0.34, 0.18, pants, 0, -0.16, 0));
  const footR = box(0.18, 0.11, 0.29, 0x263238, 0, -0.35, 0.055);
  legR.add(footR);

  const body = box(0.44, 0.52, 0.26, shirtColor, 0, 0.62, 0);
  const neck = cyl(0.075, 0.085, 0.1, skin, 0, 0.94, 0, 7);
  const belt = box(0.46, 0.08, 0.28, 0x263238, 0, 0.4, 0);
  const buckle = box(0.09, 0.07, 0.025, 0xffca28, 0, 0.4, 0.155);

  // Hombro y codo son pivotes distintos. Los NPC siguen pudiendo animar solo
  // el hombro, mientras el jugador puede sujetar herramientas con precisión.
  const makeArm = side => {
    const arm = new THREE.Group();
    arm.position.set(side * 0.29, 0.82, 0);
    arm.add(box(0.13, 0.24, 0.15, shirtColor, 0, -0.1, 0));
    const forearm = new THREE.Group();
    forearm.position.set(0, -0.21, 0);
    forearm.add(box(0.115, 0.22, 0.13, skin, 0, -0.09, 0));
    const hand = new THREE.Group();
    hand.position.set(0, -0.23, 0);
    const palm = new THREE.Mesh(
      new THREE.SphereGeometry(0.075, 7, 5),
      mat(skin)
    );
    palm.scale.set(0.9, 1.05, 0.9);
    palm.castShadow = true;
    hand.add(palm);
    forearm.add(hand);
    arm.add(forearm);
    return { arm, forearm, hand };
  };
  const leftArm = makeArm(-1);
  const rightArm = makeArm(1);
  const armL = leftArm.arm;
  const armR = rightArm.arm;
  const forearmL = leftArm.forearm;
  const forearmR = rightArm.forearm;
  const handL = leftArm.hand;
  const handR = rightArm.hand;

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
  const nose = new THREE.Mesh(
    new THREE.ConeGeometry(0.035, 0.09, 5),
    mat(skin)
  );
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, -0.035, 0.205);
  nose.castShadow = true;
  head.add(eyeL, eyeR, nose);

  g.add(legL, legR, body, neck, belt, buckle, armL, armR, head);
  g.userData.parts = {
    legL, legR, footL, footR,
    armL, armR, forearmL, forearmR, handL, handR,
    head, body
  };
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
    this.job = defaultCrewJob(this.skill);
    this.trust = this.trait.effect === 'moraleGain' ? 58 : 50;
    this.stress = this.trait.effect === 'conflict' ? 24 : 15;
    this.deprivationDays = 0;
    this.criticalDays = 0;
    this.hallucinating = false;
    this.hostile = false;
    this.restrainedDays = 0;
    this.incidentCooldown = 0;
    this.lastIncident = '';
    this.lastFoodRatio = 1;
    this.lastWaterRatio = 1;
    this.lastTalkDay = -1;
    this.gx = null;
    this.gy = null;
    this.mesh = null;
  }

  static fromData(data) {
    const s = new Survivor();
    Object.assign(s, data || {});
    s.mesh = null;
    s.name = typeof data?.name === 'string' && data.name.trim()
      ? data.name.trim().slice(0, 80)
      : s.name;
    s.skill = SKILLS.find(k => k.key === data?.skill?.key) || SKILLS[0];
    s.trait = TRAITS.find(k => k.key === data?.trait?.key) || TRAITS[0];
    const savedStory = getSurvivorStory(data?.story);
    s.story = savedStory ? savedStory.key : legacyStoryKey(s.name);
    s.storyResolved = data?.storyResolved === true;
    const defaultDelay = getSurvivorStory(s.story).delayDays;
    s.storyDaysRemaining = s.storyResolved
      ? 0
      : Util.clamp(Math.round(finiteNumber(data?.storyDaysRemaining, defaultDelay)), 0, 3);
    s.job = getCrewJob(data?.job)?.key || defaultCrewJob(s.skill);
    s.trust = Util.clamp(finiteNumber(data?.trust, 50), 0, 100);
    s.stress = Util.clamp(finiteNumber(data?.stress, 15), 0, 100);
    s.deprivationDays = Util.clamp(
      Math.floor(finiteNumber(data?.deprivationDays, 0)),
      0,
      30
    );
    s.criticalDays = Util.clamp(
      Math.floor(finiteNumber(data?.criticalDays, 0)),
      0,
      30
    );
    s.hallucinating = data?.hallucinating === true;
    s.hostile = data?.hostile === true;
    s.restrainedDays = Util.clamp(
      Math.floor(finiteNumber(data?.restrainedDays, 0)),
      0,
      3
    );
    s.incidentCooldown = Util.clamp(
      Math.floor(finiteNumber(data?.incidentCooldown, 0)),
      0,
      5
    );
    s.lastIncident = typeof data?.lastIncident === 'string'
      ? data.lastIncident.slice(0, 160)
      : '';
    s.lastFoodRatio = Util.clamp(finiteNumber(data?.lastFoodRatio, 1), 0, 1);
    s.lastWaterRatio = Util.clamp(finiteNumber(data?.lastWaterRatio, 1), 0, 1);
    s.lastTalkDay = Util.clamp(Math.floor(finiteNumber(data?.lastTalkDay, -1)), -1, 1000000);
    s.days = Util.clamp(Math.floor(finiteNumber(data?.days, 0)), 0, 1000000);
    s.gx = Number.isInteger(data?.gx) && Math.abs(data.gx) <= 1000
      ? data.gx
      : null;
    s.gy = Number.isInteger(data?.gy) && Math.abs(data.gy) <= 1000
      ? data.gy
      : null;
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
    const foodRatio = Util.clamp(consumedFood / Math.max(0.01, foodNeed), 0, 1);
    const waterRatio = Util.clamp(consumedWater / waterNeed, 0, 1);
    this.lastFoodRatio = foodRatio;
    this.lastWaterRatio = waterRatio;

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
      this.health -= (waterNeed - consumedWater) * 10;
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

    const shortage = (1 - foodRatio) * 12 + (1 - waterRatio) * 20;
    if (foodRatio >= 0.9 && waterRatio >= 0.9) {
      this.stress -= 10;
      this.trust += 2;
    } else {
      this.stress += shortage;
      this.trust -= (1 - Math.min(foodRatio, waterRatio)) * 5;
    }
    if (isStorm) this.stress += 5;
    if (this.hunger < 25 || this.thirst < 25) {
      this.deprivationDays++;
      this.stress += this.thirst < 25 ? 8 : 4;
    } else {
      this.deprivationDays = Math.max(0, this.deprivationDays - 1);
    }
    if (this.hunger < 10 || this.thirst < 10) {
      this.criticalDays++;
    } else {
      this.criticalDays = Math.max(0, this.criticalDays - 1);
    }
    this.hallucinating = this.deprivationDays >= 2 &&
      (this.hunger < 25 || this.thirst < 25);
    if (!this.hallucinating && this.hunger > 40 && this.thirst > 40) {
      this.hostile = false;
    }

    this.health = Util.clamp(this.health, 0, 100);
    this.hunger = Util.clamp(this.hunger, 0, 100);
    this.thirst = Util.clamp(this.thirst, 0, 100);
    this.morale = Util.clamp(this.morale, 0, 100);
    this.trust = Util.clamp(this.trust, 0, 100);
    this.stress = Util.clamp(this.stress, 0, 100);

    if (this.health <= 0) this.alive = false;
    this.days++;

    return { consumedFood, consumedWater, foodRatio, waterRatio };
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

  getCondition() {
    if (!this.alive) return { key: 'dead', label: 'Fallecido', level: 'critical' };
    if (this.hostile) return { key: 'hostile', label: 'Hostil', level: 'critical' };
    if (this.restrainedDays > 0) {
      return { key: 'restrained', label: 'Reducido', level: 'warning' };
    }
    if (this.hallucinating) {
      return { key: 'delirious', label: 'Alucinando', level: 'critical' };
    }
    if (this.health < 25) return { key: 'injured', label: 'Herido grave', level: 'critical' };
    if (this.health < 50) return { key: 'injured', label: 'Herido', level: 'warning' };
    if (this.thirst < 25 || this.hunger < 25 || this.stress >= 70) {
      return { key: 'desperate', label: 'Desesperado', level: 'warning' };
    }
    if (this.thirst < 50 || this.hunger < 50 || this.stress >= 45) {
      return { key: 'uneasy', label: 'Inquieto', level: 'caution' };
    }
    return { key: 'stable', label: 'Estable', level: 'stable' };
  }
}

const CrewManager = {
  MAX_MEMBERS: 64,
  members: [],
  pendingInteractions: new WeakMap(),

  reset: () => {
    for (const m of CrewManager.members) CrewManager.removeMesh(m);
    CrewManager.members = [];
    CrewManager.pendingInteractions = new WeakMap();
  },

  add: (survivor) => {
    if (!survivor || CrewManager.members.length >= CrewManager.MAX_MEMBERS) {
      return false;
    }
    CrewManager.members.push(survivor);
    return true;
  },

  removeMesh: (m) => {
    if (m.mesh) {
      if (m.mesh.parent) m.mesh.parent.remove(m.mesh);
      // Las figuras de tripulación usan materiales compartidos (MatLib), pero
      // sus geometrías eran únicas y quedaban vivas tras morir/cargar partida.
      // Los clones GLB comparten geometría con la biblioteca: no se disponen.
      const shared = m.mesh.userData.glbCrew;
      if (m.mesh.userData.glbRig) {
        m.mesh.userData.glbRig.mixer.stopAllAction();
      }
      if (!shared || m.mesh.userData.workProps) {
        m.mesh.traverse(o => {
          if (o.geometry && o.geometry.dispose && (!shared || o === m.mesh.userData.workProps || o.parent?.userData.crewOwned || o.parent?.parent?.userData.crewOwned)) o.geometry.dispose();
        });
      }
    }
    m.mesh = null;
  },

  getVisualOffset: (member, raft, cellOccupants = null) => {
    const occupants = cellOccupants || CrewManager.members.filter(
      candidate => candidate.alive &&
        candidate.gx === member.gx &&
        candidate.gy === member.gy
    );
    const index = Math.max(0, occupants.indexOf(member));
    const playerCell = typeof Game !== 'undefined' && Game.player &&
      Game.raft === raft
      ? raft.worldToGrid(Game.player.x, Game.player.z)
      : null;
    const sharesWithPlayer = playerCell?.gx === member.gx &&
      playerCell?.gy === member.gy;
    if (!sharesWithPlayer && occupants.length <= 1) return { x: 0, z: 0 };

    const count = Math.max(occupants.length, 1);
    const angle = -Math.PI * 0.75 + index * (Math.PI * 2 / count);
    const radius = sharesWithPlayer ? 0.58 : 0.42;
    return {
      x: Math.cos(angle) * radius,
      z: Math.sin(angle) * radius
    };
  },

  // Las rutas solo cruzan bordes de tablas conectadas: nunca agua ni diagonales.
  findDeckPath: (raft, start, goal) => {
    if (!raft?.has(start?.gx, start?.gy) || !raft.has(goal?.gx, goal?.gy)) return [];
    const origin = `${start.gx},${start.gy}`;
    const destination = `${goal.gx},${goal.gy}`;
    const queue = [origin];
    const parents = new Map([[origin, null]]);
    for (let index = 0; index < queue.length; index++) {
      const key = queue[index];
      if (key === destination) {
        const path = [];
        let cursor = destination;
        while (cursor !== origin) {
          const [gx, gy] = cursor.split(',').map(Number);
          path.unshift({ gx, gy });
          cursor = parents.get(cursor);
        }
        return path;
      }
      const [gx, gy] = key.split(',').map(Number);
      for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
        const next = `${gx + dx},${gy + dy}`;
        if (raft.has(gx + dx, gy + dy) && !parents.has(next)) {
          parents.set(next, key);
          queue.push(next);
        }
      }
    }
    return [];
  },

  // Una tarea tiene un lugar y una dirección: atendemos el equipo desde su
  // costado y dejamos el centro libre, en vez de atravesar hogueras o camas.
  getDeckPoint: (raft, node) => {
    const cell = raft.grid.get(`${node.gx},${node.gy}`);
    const margin = cell && !['floor', 'armor'].includes(cell.buildingKey) ? -raft.cellSize * 0.28 : 0;
    return { x: (node.gx + 0.5) * raft.cellSize + margin, z: (node.gy + 0.5) * raft.cellSize + margin };
  },

  getWorkPlan: (member, raft, cycle = 0) => {
    const cs = raft.cellSize;
    const job = member.health < 25 || member.restrainedDays > 0 || member.hallucinating
      ? 'rest' : member.job;
    const stations = {
      fish: ['net'], water: ['purifier', 'rain'], salvage: ['storage', 'net'],
      repair: [], care: ['infirmary'], navigate: ['rudder', 'chart', 'radio'],
      guard: ['lookout'], cook: ['fire', 'smokehouse'], rest: ['bed', 'bunk']
    }[job] || [];
    const entries = Array.from(raft.grid.entries()).map(([key, cell]) => {
      const [gx, gy] = key.split(',').map(Number);
      return { gx, gy, cell };
    });
    const patient = job === 'care'
      ? CrewManager.members.filter(other => other !== member && other.alive && other.health < 85)
        .sort((a, b) => a.health - b.health)[0] : null;
    const distances = new Map([[`${member.gx},${member.gy}`, 0]]);
    const queue = [{ gx: member.gx, gy: member.gy }];
    for (let index = 0; index < queue.length; index++) {
      const node = queue[index];
      const distance = distances.get(`${node.gx},${node.gy}`);
      for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
        const gx = node.gx + dx, gy = node.gy + dy, key = `${gx},${gy}`;
        if (raft.has(gx, gy) && !distances.has(key)) {
          distances.set(key, distance + 1); queue.push({ gx, gy });
        }
      }
    }
    let best = null;
    for (const candidate of entries) {
      const { gx, gy, cell } = candidate;
      const distance = distances.get(`${gx},${gy}`);
      if (distance == null) continue;
      const emptyDeck = ['floor', 'armor'].includes(cell.buildingKey);
      let score = emptyDeck ? 3 : -3;
      let face = null;
      let offset = emptyDeck ? { x: 0, z: 0 } : { x: -cs * 0.32, z: -cs * 0.32 };
      let stationScore = -Infinity;
      const occupied = CrewManager.members.filter(other => other.alive && other !== member &&
        ((other.gx === gx && other.gy === gy) ||
         (other.mesh?.userData.routine?.goal?.gx === gx && other.mesh?.userData.routine?.goal?.gy === gy))).length;
      score -= occupied * 6;
      score -= distance * 0.3;
      score += crewBehaviorRoll(member, cycle, `${gx},${gy}`) * 1.3;
      for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1], [0, 0]]) {
        const adjacent = raft.grid.get(`${gx + dx},${gy + dy}`);
        if (!adjacent) {
          if (['fish', 'salvage', 'guard', 'navigate', 'water'].includes(job) && stationScore < 4) {
            stationScore = 4;
            face = { x: (gx + 0.5 + dx) * cs, z: (gy + 0.5 + dy) * cs };
            offset = { x: dx * cs * 0.16, z: dy * cs * 0.16 };
          }
          continue;
        }
        let relevance = stations.includes(adjacent.buildingKey) ? 9 : -Infinity;
        if (job === 'repair' && adjacent.health < (adjacent.maxHealth || adjacent.health)) {
          relevance = 8 + (1 - adjacent.health / adjacent.maxHealth) * 6;
        }
        if (relevance > stationScore) {
          stationScore = relevance;
          face = { x: (gx + dx + 0.5) * cs, z: (gy + dy + 0.5) * cs };
          offset = dx || dy ? { x: dx * cs * 0.16, z: dy * cs * 0.16 }
            : { x: -cs * 0.33, z: -cs * 0.33 };
        }
      }
      if (Number.isFinite(stationScore)) score += stationScore;
      if (patient && Number.isFinite(patient.gx) && Number.isFinite(patient.gy)) {
        const distance = Math.abs(gx - patient.gx) + Math.abs(gy - patient.gy);
        score += Math.max(0, 18 - distance * 6);
        face = patient;
      }
      if (job === 'rest' && !face) score += emptyDeck ? 2 : 0;
      if (!best || score > best.score) best = { gx, gy, path: [], face, offset, job, score };
    }
    if (best) best.path = CrewManager.findDeckPath(raft, member, best);
    return best;
  },

  getActivity: member => {
    if (!member?.alive) return 'Fallecido';
    if (member.hostile) return 'En crisis';
    if (member.restrainedDays > 0) return 'Bajo vigilancia';
    const routine = member.mesh?.userData.routine;
    if (routine?.interaction) {
      return { talk: 'Conversando', ration: 'Compartiendo provisiones', care: 'Recibiendo cuidados',
        rest: 'Tomando un respiro', welcome: 'Saludando a bordo' }[routine.interaction.kind] || 'Colaborando';
    }
    if (routine?.moving) return 'Yendo a su puesto';
    return {
      fish: 'Pescando junto al borde', water: 'Recogiendo agua', salvage: 'Buscando materiales',
      repair: 'Revisando las tablas', care: 'Atendiendo a sus compañeros', navigate: 'Observando el rumbo',
      guard: 'Vigilando el horizonte', cook: 'Preparando raciones', rest: 'Descansando'
    }[routine?.job || member.job] || 'A bordo';
  },

  signalInteraction: (member, kind = 'talk', target = null, duration = 5) => {
    if (!member?.alive) return false;
    const interaction = { kind, target: target || (typeof Game !== 'undefined' ? Game.player : null),
      remaining: Util.clamp(finiteNumber(duration, 5), 0.5, 12) };
    const routine = member.mesh?.userData.routine;
    if (!routine) {
      CrewManager.pendingInteractions.set(member, interaction);
      return true;
    }
    routine.interaction = interaction;
    routine.moving = false;
    return true;
  },
  syncMeshes: (raft, dt = 0, time = 0) => {
    if (!raft?.group) return;
    const safeDt = Util.clamp(finiteNumber(dt), 0, 0.1);
    const cs = raft.cellSize;
    const crew = CrewManager.members.filter(member => member.alive);
    for (const member of CrewManager.members) {
      if (!member.alive) { CrewManager.removeMesh(member); continue; }
      if (member.gx == null || !raft.has(member.gx, member.gy)) {
        CrewManager.assignPosition(member, raft);
        if (member.mesh) member.mesh.userData.routine = null;
      }
      if (member.gx == null) { CrewManager.removeMesh(member); continue; }
      if (!member.mesh) {
        const index = CrewManager.members.indexOf(member);
        const glb = typeof NaufragoGLB !== 'undefined' && NaufragoGLB.createCrewMember
          ? NaufragoGLB.createCrewMember(index) : null;
        const shirts = [0xd85f40, 0x3e8291, 0xc6a14b, 0x738452, 0x756895, 0xe4b896];
        member.mesh = glb || makeHumanoidMesh(shirts[index % shirts.length], {
          hair: [0x4e342e, 0x212121, 0x8d6e63, 0x6d4c41][index % 4]
        });
        member.mesh.userData.phase = crewBehaviorRoll(member, 0) * Math.PI * 2;
        member.mesh.userData.crewMemberIndex = index;
        raft.group.add(member.mesh);
        CrewManager.addWorkProps(member.mesh);
      }
      const mesh = member.mesh;
      if (!mesh.userData.routine) {
        const offset = CrewManager.getVisualOffset(member, raft);
        mesh.position.set((member.gx + 0.5) * cs + offset.x, 0.35, (member.gy + 0.5) * cs + offset.z);
        mesh.userData.routine = { job: '', goal: null, path: [], timer: 0, cycle: 0,
          moving: false, socialCooldown: 10 + crewBehaviorRoll(member, 0, 9) * 12, interaction: null };
      }
      const routine = mesh.userData.routine;
      const pendingInteraction = CrewManager.pendingInteractions.get(member);
      if (pendingInteraction) {
        routine.interaction = pendingInteraction;
        CrewManager.pendingInteractions.delete(member);
      }
      routine.timer -= safeDt;
      routine.socialCooldown -= safeDt;
      if (routine.interaction) {
        routine.interaction.remaining -= safeDt;
        if (routine.interaction.remaining <= 0) routine.interaction = null;
      }
      if (member.hostile || member.restrainedDays > 0) routine.interaction = null;
      const urgentRest = member.health < 25 || member.restrainedDays > 0 || member.hallucinating;
      const expectedJob = urgentRest ? 'rest' : member.job;
      const invalidPath = routine.path.some(node => !raft.has(node.gx, node.gy));
      if (routine.job !== expectedJob || invalidPath || (!routine.path.length && routine.timer <= 0)) {
        const plan = CrewManager.getWorkPlan(member, raft, routine.cycle++);
        if (plan) {
          routine.goal = plan;
          routine.path = plan.path.slice();
          routine.job = plan.job;
          routine.timer = 14 + crewBehaviorRoll(member, routine.cycle, 4) * 14;
        }
      }
      routine.moving = false;
      let target = null;
      if (!routine.interaction && !member.hostile && member.restrainedDays <= 0 && routine.goal) {
        const node = routine.path[0];
        // Cada esquina se alcanza antes del siguiente segmento. El margen
        // del destino permite trabajar desde un lateral del módulo ocupado.
        target = node ? CrewManager.getDeckPoint(raft, node)
          : { x: (routine.goal.gx + 0.5) * cs + routine.goal.offset.x,
            z: (routine.goal.gy + 0.5) * cs + routine.goal.offset.z };
        const dx = target.x - mesh.position.x;
        const dz = target.z - mesh.position.z;
        const distance = Math.hypot(dx, dz);
        if (distance > 0.045 && safeDt > 0) {
          const speed = (member.health < 40 ? 0.43 : 0.8) * safeDt;
          const step = Math.min(distance, speed);
          const x = mesh.position.x + dx / distance * step;
          const z = mesh.position.z + dz / distance * step;
          const nextCell = raft.worldToGrid(x, z);
          if (raft.has(nextCell.gx, nextCell.gy)) {
            mesh.position.x = x; mesh.position.z = z;
            member.gx = nextCell.gx; member.gy = nextCell.gy;
            routine.moving = true;
          }
        } else if (node && distance <= 0.045) routine.path.shift();
      }
      // Dos compañeros estables se detienen unos segundos y se responden.
      // Los beneficios sociales se resuelven al terminar el día, nunca por frame.
      if (safeDt > 0 && !routine.moving && !routine.interaction && routine.socialCooldown <= 0 &&
          !member.hostile && !member.hallucinating && member.restrainedDays <= 0 && routine.job !== 'rest') {
        routine.socialCooldown = 20 + crewBehaviorRoll(member, routine.cycle, 8) * 16;
        const companion = crew.find(other => {
          const state = other.mesh?.userData.routine;
          return other !== member && state && !state.interaction && !state.moving &&
            !other.hostile && !other.hallucinating && other.restrainedDays <= 0 &&
            Math.hypot(other.mesh.position.x - mesh.position.x, other.mesh.position.z - mesh.position.z) < 2.6;
        });
        if (companion) {
          const caring = member.job === 'care' && companion.health < 85;
          CrewManager.signalInteraction(member, caring ? 'care' : 'talk', companion, 4.5);
          CrewManager.signalInteraction(companion, caring ? 'care' : 'talk', member, 4.5);
          companion.mesh.userData.routine.socialCooldown = 26;
        }
      }
      CrewManager.separateOnDeck(member, crew, raft, safeDt);
      let face = routine.moving ? target : routine.interaction?.target || routine.goal?.face;
      if (member.hostile && typeof Game !== 'undefined') face = Game.player;
      let faceX = face?.mesh?.position?.x ?? face?.x;
      let faceZ = face?.mesh?.position?.z ?? face?.z;
      if (!Number.isFinite(faceX) && Number.isFinite(face?.gx)) {
        faceX = (face.gx + 0.5) * cs; faceZ = (face.gy + 0.5) * cs;
      }
      const angle = Number.isFinite(faceX) && Number.isFinite(faceZ)
        ? Math.atan2(faceX - mesh.position.x, faceZ - mesh.position.z)
        : mesh.userData.phase + Math.PI;
      const delta = Math.atan2(Math.sin(angle - mesh.rotation.y), Math.cos(angle - mesh.rotation.y));
      mesh.rotation.y += delta * (1 - Math.exp(-safeDt * 7));
      CrewManager.animateMember(member, safeDt, finiteNumber(time));
    }
  },

  addWorkProps: mesh => {
    const props = new THREE.Group();
    props.name = 'crew-work-props';
    props.userData.crewOwned = true;
    mesh.add(props);
    const rod = new THREE.Group();
    rod.name = 'fish';
    const shaft = cyl(0.019, 0.03, 1.15, 0x8d6e45, 0, 0.42, 0.32, 6);
    shaft.rotation.x = 0.65;
    rod.add(shaft, cyl(0.006, 0.006, 1.5, 0xdac8a2, 0, 0.08, 0.68, 4));
    props.add(rod);
    const hammer = new THREE.Group();
    hammer.name = 'repair';
    hammer.add(cyl(0.028, 0.032, 0.35, 0x795548, 0, 0.1, 0, 6));
    hammer.add(box(0.23, 0.12, 0.13, 0x647179, 0, 0.3, 0));
    props.add(hammer);
    const cup = new THREE.Group();
    cup.name = 'water';
    cup.add(cyl(0.1, 0.075, 0.2, 0x78a8bb, 0, 0.08, 0.02, 8));
    props.add(cup);
    const ration = new THREE.Group();
    ration.name = 'cook';
    ration.add(box(0.26, 0.045, 0.24, 0x916540, 0, 0.01, 0.1));
    ration.add(box(0.12, 0.09, 0.12, 0xdcb56e, 0, 0.07, 0.1));
    props.add(ration);
    const medical = new THREE.Group();
    medical.name = 'care';
    medical.add(box(0.24, 0.19, 0.13, 0xebeadc, 0, 0.04, 0));
    medical.add(box(0.12, 0.035, 0.015, 0xc9554d, 0, 0.04, 0.075));
    medical.add(box(0.035, 0.12, 0.015, 0xc9554d, 0, 0.04, 0.078));
    props.add(medical);
    const chart = new THREE.Group();
    chart.name = 'navigate';
    chart.add(box(0.28, 0.02, 0.3, 0xe8dab6, 0, 0, 0.12));
    chart.add(box(0.15, 0.005, 0.025, 0x628d98, 0.02, 0.013, 0.13));
    props.add(chart);
    props.children.forEach(prop => { prop.visible = false; });
    mesh.userData.workProps = props;
    mesh.userData.handPosition = new THREE.Vector3();
  },

  // Los GLB originales tienen una pose de brazos abiertos incluso en Idle.
  // Alineamos el eje longitudinal del hueso conservando su giro para que
  // descansar, escuchar o sujetar una herramienta tenga una silueta natural.
  aimLimb: (mesh, rig, name, x, y, z) => {
    const bone = rig.bone?.(name);
    if (!bone?.parent) return;
    const scratch = mesh.userData.poseScratch || (mesh.userData.poseScratch = {
      parentRotation: new THREE.Quaternion(), rootRotation: new THREE.Quaternion(),
      correction: new THREE.Quaternion(), direction: new THREE.Vector3(), axis: new THREE.Vector3()
    });
    bone.parent.getWorldQuaternion(scratch.parentRotation).invert();
    mesh.getWorldQuaternion(scratch.rootRotation);
    scratch.direction.set(x, y, z).normalize().applyQuaternion(scratch.rootRotation)
      .applyQuaternion(scratch.parentRotation);
    scratch.axis.set(0, 1, 0).applyQuaternion(bone.quaternion).normalize();
    scratch.correction.setFromUnitVectors(scratch.axis, scratch.direction);
    bone.quaternion.premultiply(scratch.correction);
  },

  animateMember: (member, dt, time) => {
    if (dt <= 0) return;
    const mesh = member.mesh;
    const routine = mesh.userData.routine;
    const phase = mesh.userData.phase;
    const t = time + phase;
    const walking = routine.moving;
    const interaction = routine.interaction?.kind;
    const resting = routine.job === 'rest' || member.restrainedDays > 0;
    const job = routine.job;
    const working = !walking && !interaction && !resting && !member.hostile;
    const breath = Math.sin(t * 2.1) * 0.01;
    mesh.position.y = 0.35 + (walking ? Math.abs(Math.sin(t * 8)) * 0.035 : breath);
    mesh.rotation.z = member.hostile ? Math.sin(t * 10) * 0.035
      : walking ? Math.sin(t * 8) * 0.025 : Math.sin(t * 1.6) * 0.015;
    const rig = mesh.userData.glbRig;
    if (rig) {
      const pulse = (t % 7) < 2;
      const fishing = working && ['fish', 'salvage'].includes(job);
      const clip = walking ? 'Walk' : member.hostile ? 'Reel' : fishing && pulse ? 'Reel' : 'Idle';
      rig.play(clip, { timeScale: member.hostile ? 1.1 : walking ? 0.7 : 0.35 });
      rig.update(dt);
      if (!member.hostile) {
        const swing = walking ? Math.sin(t * 8) * 0.35 : 0;
        const speaking = !!interaction;
        let rightY = -1, rightZ = 0.06 + swing, leftY = -1, leftZ = 0.06 - swing;
        if (fishing) { rightY = -0.35; rightZ = 0.9; leftY = -0.5; leftZ = 0.65; }
        else if (interaction === 'welcome') { rightY = 0.85; rightZ = 0.25 + Math.sin(t * 6) * 0.12; }
        else if (speaking) { rightY = -0.55; rightZ = 0.6 + Math.sin(t * 2.5) * 0.06; }
        else if (working && ['repair', 'cook', 'care', 'water', 'navigate'].includes(job)) {
          rightY = -0.65; rightZ = 0.65 + (pulse ? Math.sin(t * 3) * 0.1 : 0);
        }
        CrewManager.aimLimb(mesh, rig, 'RightArm', 0.08, rightY, rightZ);
        CrewManager.aimLimb(mesh, rig, 'LeftArm', -0.08, leftY, leftZ);
        CrewManager.aimLimb(mesh, rig, 'RightForeArm', -0.04, rightY, rightZ + (speaking ? 0.25 : 0));
        CrewManager.aimLimb(mesh, rig, 'LeftForeArm', 0.04, leftY, leftZ);
        if (!walking && !resting) {
          CrewManager.aimLimb(mesh, rig, 'RightUpLeg', 0.04, -1, 0.015);
          CrewManager.aimLimb(mesh, rig, 'LeftUpLeg', -0.04, -1, 0.015);
          CrewManager.aimLimb(mesh, rig, 'RightLeg', 0, -1, 0);
          CrewManager.aimLimb(mesh, rig, 'LeftLeg', 0, -1, 0);
        }
        if (resting) {
          CrewManager.aimLimb(mesh, rig, 'RightUpLeg', 0.12, -0.12, 1);
          CrewManager.aimLimb(mesh, rig, 'LeftUpLeg', -0.12, -0.12, 1);
          CrewManager.aimLimb(mesh, rig, 'RightLeg', 0.02, -1, 0.12);
          CrewManager.aimLimb(mesh, rig, 'LeftLeg', -0.02, -1, 0.12);
          CrewManager.aimLimb(mesh, rig, 'RightForeArm', -0.1, -0.5, 0.65);
          CrewManager.aimLimb(mesh, rig, 'LeftForeArm', 0.1, -0.5, 0.65);
        }
        if (!walking) {
          const feet = ['LeftFoot', 'RightFoot'].map(name => rig.bone?.(name)).filter(Boolean);
          const footPosition = mesh.userData.footPosition || (mesh.userData.footPosition = new THREE.Vector3());
          let lowest = Infinity;
          for (const foot of feet) {
            foot.getWorldPosition(footPosition);
            lowest = Math.min(lowest, mesh.worldToLocal(footPosition).y);
          }
          if (Number.isFinite(lowest)) mesh.position.y = 0.4 - lowest;
        }
      }
      const head = rig.bone?.('Head');
      if (head) {
        if (interaction) head.rotation.x += Math.sin(t * 3.6) * 0.045;
        if (resting) head.rotation.x += 0.1;
        if (member.hallucinating) head.rotation.z += Math.sin(t * 5) * 0.1;
      }
    }    const parts = mesh.userData.parts;
    if (parts) {
      const swing = Math.sin(t * 8);
      parts.legL.rotation.x = walking ? swing * 0.45 : resting ? -0.9 : 0;
      parts.legR.rotation.x = walking ? -swing * 0.45 : resting ? -0.9 : 0;
      parts.armL.rotation.set(walking ? -swing * 0.35 : 0, 0, 0.04);
      parts.armR.rotation.set(walking ? swing * 0.35 : 0, 0, -0.04);
      parts.forearmL.rotation.x = 0;
      parts.forearmR.rotation.x = 0;
      parts.head.rotation.set(resting ? 0.16 : 0, Math.sin(t * 0.7) * 0.07, 0);
      parts.body.rotation.x = resting ? 0.09 : 0;
      if (resting) mesh.position.y -= 0.18;
      if (member.hostile) {
        parts.armL.rotation.x = -1.1 + Math.sin(t * 10) * 0.2;
        parts.armR.rotation.x = -1.1 - Math.sin(t * 10) * 0.2;
        parts.head.rotation.y = Math.sin(t * 9) * 0.3;
      } else if (interaction) {
        parts.armR.rotation.x = -0.7 + Math.sin(t * 3.5) * 0.17;
        parts.forearmR.rotation.x = -0.5;
        parts.head.rotation.x = Math.sin(t * 3.5) * 0.08;
        if (interaction === 'welcome') {
          parts.armR.rotation.z = -2.3 + Math.sin(t * 7) * 0.15;
        }
      } else if (working) {
        if (['fish', 'salvage', 'repair', 'cook', 'care'].includes(job)) {
          parts.armR.rotation.x = -0.75 + Math.sin(t * (job === 'repair' ? 5 : 2.8)) * 0.25;
          parts.armL.rotation.x = -0.6;
          parts.forearmL.rotation.x = -0.4;
          parts.forearmR.rotation.x = -0.5;
        } else if (job === 'navigate' || job === 'water') {
          parts.armR.rotation.x = -0.75;
          parts.forearmR.rotation.x = -0.7;
        } else if (job === 'guard') {
          parts.armR.rotation.x = -2.3;
          parts.forearmR.rotation.x = -0.5;
          parts.head.rotation.y = Math.sin(t * 0.6) * 0.4;
        }
      }
      if (member.hallucinating) parts.head.rotation.z = Math.sin(t * 6) * 0.15;
    }
    const props = mesh.userData.workProps;
    if (props) {
      const propJob = interaction === 'ration' ? 'cook'
        : working ? (job === 'salvage' ? 'fish' : job) : '';
      props.children.forEach(prop => { prop.visible = prop.name === propJob; });
      props.visible = props.children.some(prop => prop.visible);
      if (props.visible) {
        const hand = rig?.bone?.('RightHand') || parts?.handR;
        if (hand) {
          hand.getWorldPosition(mesh.userData.handPosition);
          props.position.copy(mesh.worldToLocal(mesh.userData.handPosition));
        } else props.position.set(0.3, 0.66, 0.24);
        props.rotation.x = job === 'repair' ? Math.sin(t * 5) * 0.3 : 0;
      }
    }
  },
  separateOnDeck: (member, crew, raft, dt) => {
    if (!dt) return;
    const position = member.mesh.position;
    const neighbors = crew.filter(other => other !== member && other.mesh).map(other => other.mesh.position);
    if (typeof Game !== 'undefined' && Game.raft === raft && Game.player) {
      neighbors.push({ x: Game.player.x, z: Game.player.z });
    }
    let pushX = 0, pushZ = 0;
    for (const other of neighbors) {
      const dx = position.x - other.x, dz = position.z - other.z;
      const distance = Math.hypot(dx, dz);
      if (distance >= 0.53) continue;
      const angle = member.mesh.userData.phase;
      const pressure = (0.53 - distance) * Math.min(1, dt * 7);
      pushX += (distance > 0.001 ? dx / distance : Math.cos(angle)) * pressure;
      pushZ += (distance > 0.001 ? dz / distance : Math.sin(angle)) * pressure;
    }
    const x = position.x + pushX, z = position.z + pushZ;
    const cell = raft.worldToGrid(x, z);
    // El rechazo solo se aplica al empuje, nunca bloquea el cruce de tablas.
    if (raft.has(cell.gx, cell.gy)) {
      const cs = raft.cellSize;
      position.x = x; position.z = z;
      if (!raft.has(cell.gx - 1, cell.gy)) position.x = Math.max(position.x, cell.gx * cs + 0.32);
      if (!raft.has(cell.gx + 1, cell.gy)) position.x = Math.min(position.x, (cell.gx + 1) * cs - 0.32);
      if (!raft.has(cell.gx, cell.gy - 1)) position.z = Math.max(position.z, cell.gy * cs + 0.32);
      if (!raft.has(cell.gx, cell.gy + 1)) position.z = Math.min(position.z, (cell.gy + 1) * cs - 0.32);
      member.gx = cell.gx; member.gy = cell.gy;
    }
  },

  assignPosition: (survivor, raft) => {
    let best = null;
    let bestScore = Infinity;
    const player = typeof Game !== 'undefined' && Game.raft === raft && Game.player
      ? raft.worldToGrid(Game.player.x, Game.player.z) : null;
    for (const [key, cell] of raft.grid.entries()) {
      const [gx, gy] = key.split(',').map(Number);
      const occupied = CrewManager.members.filter(m => m.alive && m !== survivor && m.gx === gx && m.gy === gy).length;
      const score = occupied * 10 + (player?.gx === gx && player?.gy === gy ? 5 : 0) +
        (['floor', 'armor'].includes(cell.buildingKey) ? 0 : 2);
      if (score < bestScore) { best = { gx, gy }; bestScore = score; }
    }
    survivor.gx = best?.gx ?? null;
    survivor.gy = best?.gy ?? null;
    return !!best;
  },
  count: () => CrewManager.members.filter(m => m.alive).length,

  totalWeight: () => CrewManager.members.filter(m => m.alive).length * 1.0,

  setJob: (member, jobKey) => {
    if (!member?.alive || !getCrewJob(jobKey)) return false;
    member.job = jobKey;
    member.lastIncident = `Tarea asignada: ${getCrewJob(jobKey).name}.`;
    if (member.mesh?.userData.routine) member.mesh.userData.routine.timer = 0;
    return true;
  },

  workEfficiency: (member) => {
    if (!member?.alive || member.hostile || member.restrainedDays > 0) return 0;
    let efficiency = 0.62;
    efficiency *= Util.clamp(member.health / 70, 0.25, 1);
    efficiency *= Util.clamp(member.hunger / 60, 0.2, 1);
    efficiency *= Util.clamp(member.thirst / 60, 0.15, 1);
    efficiency *= Util.clamp((120 - member.stress) / 80, 0.25, 1);
    efficiency *= Util.clamp((70 + member.trust) / 120, 0.55, 1.2);
    const job = getCrewJob(member.job);
    if (job?.skill && member.skill?.effect === job.skill) efficiency *= 1.35;
    if (member.trait?.effect === 'gather' &&
        ['fish', 'water', 'salvage'].includes(member.job)) {
      efficiency *= 1.12;
    }
    return Util.clamp(efficiency, 0, 1.15);
  },

  guardStrength: () => CrewManager.members
    .filter(member => member.alive && member.job === 'guard')
    .reduce(
      (sum, member) => sum + CrewManager.workEfficiency(member) * 0.32,
      0
    ),

  conflictSupport: (hostileMember = null) => Util.clamp(
    CrewManager.guardStrength() +
    (
      typeof Game !== 'undefined' &&
      Game.raft?.countProvides
        ? Game.raft.countProvides('containment') * 0.18
        : 0
    ) +
    CrewManager.members
      .filter(member =>
        member.alive &&
        member !== hostileMember &&
        !member.hostile &&
        member.job !== 'guard' &&
        member.trust >= 60 &&
        member.stress < 65
      )
      .reduce(
        (sum, member) =>
          sum + CrewManager.workEfficiency(member) * member.trust / 1000,
        0
      ),
    0,
    0.8
  ),

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
      if (!m.alive || m.hostile) continue;
      if (m.trait.effect === 'moraleGain') bonus += m.trait.value;
      if (m.trait.effect === 'moraleLoss') bonus += m.trait.value;
    }
    return bonus;
  },

  getResourceBonus: () => {
    let bonus = 0;
    for (const m of CrewManager.members) {
      if (m.alive && m.job === 'salvage' &&
          m.trait.effect === 'gather') {
        bonus += m.trait.value * CrewManager.workEfficiency(m);
      }
    }
    return bonus;
  },

  getDriftBonus: () => {
    let bonus = 0;
    for (const m of CrewManager.members) {
      if (m.alive && m.job === 'navigate' &&
          m.skill.effect === 'drift') {
        bonus += m.skill.value * CrewManager.workEfficiency(m);
      }
    }
    return bonus;
  },

  getFishingBonus: () => {
    let bonus = 0;
    for (const m of CrewManager.members) {
      if (m.alive && m.job === 'fish' &&
          m.skill.effect === 'foodGain') {
        bonus += m.skill.value * CrewManager.workEfficiency(m);
      }
    }
    return bonus;
  },

  getDurabilityBonus: () => {
    const mechanic = CrewManager.members.find(m =>
      m.alive && m.job === 'repair' && m.skill.effect === 'durability'
    );
    return mechanic
      ? 0.25 * CrewManager.workEfficiency(mechanic)
      : 0;
  },

  getConstructionDiscount: () => {
    const carpenter = CrewManager.members.find(m =>
      m.alive && m.job === 'repair' && m.skill.effect === 'woodCost'
    );
    return carpenter
      ? -0.15 * CrewManager.workEfficiency(carpenter)
      : 0;
  },

  getConflictChance: () => {
    let chance = 0;
    for (const m of CrewManager.members) {
      if (!m.alive || m.hostile) continue;
      if (m.trait.effect === 'conflict') {
        chance += m.trait.value * (0.35 + m.stress / 100);
      }
    }
    return Util.clamp(chance * (1 - CrewManager.guardStrength()), 0, 0.55);
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
      const harmfulOutcome =
        Object.values(outcome.resources || {}).some(amount => amount < 0) ||
        finiteNumber(outcome.memberHealth) < 0 ||
        finiteNumber(outcome.crewHealth) < 0 ||
        finiteNumber(outcome.crewMorale) < 0;
      member.trust = Util.clamp(
        member.trust + (harmfulOutcome ? -7 : 5),
        0,
        100
      );
      member.stress = Util.clamp(
        member.stress + (harmfulOutcome ? 8 : -5),
        0,
        100
      );
      member.lastIncident = story.impact;
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
      if (!getCrewJob(member.job)) member.job = defaultCrewJob(member.skill);
      const efficiency = CrewManager.workEfficiency(member);
      if (efficiency <= 0) continue;
      let didUsefulWork = false;

      if (member.job === 'fish') {
        const zoneBonus = game.zone === 'fish' ? 1.25 : 1;
        const food = 0.34 * efficiency * zoneBonus;
        game.resources.food = Math.max(
          0,
          finiteNumber(game.resources.food) + food
        );
        messages.push(`${member.name} pescó ${food.toFixed(1)} de comida.`);
        didUsefulWork = true;
      } else if (member.job === 'water') {
        const equipment = Util.clamp(
          game.raft?.totalAutoWater?.() || 0,
          0,
          1.5
        );
        const water = 0.36 * efficiency * (1 + equipment * 0.25);
        game.resources.water = Math.max(
          0,
          finiteNumber(game.resources.water) + water
        );
        messages.push(`${member.name} reunió ${water.toFixed(1)} de agua.`);
        didUsefulWork = true;
      } else if (member.job === 'salvage') {
        const key = game.zone === 'polluted'
          ? 'plastic'
          : Util.choice(['wood', 'plastic', 'rope']);
        const amount = 0.24 * efficiency;
        game.resources[key] = Math.max(
          0,
          finiteNumber(game.resources[key]) + amount
        );
        messages.push(
          `${member.name} recuperó ${amount.toFixed(1)} de ${Util.resourceName(key)}.`
        );
        didUsefulWork = true;
      } else if (member.job === 'repair') {
        const advancedOnly = member.skill.effect === 'durability';
        const repaired = repairMostDamaged(4.5 * efficiency, advancedOnly) || (advancedOnly ? repairMostDamaged(4.5 * efficiency) : 0);
        if (repaired > 0) {
          messages.push(
            `${member.name} reparó ${repaired.toFixed(0)} de estructura.`
          );
          didUsefulWork = true;
        }
      } else if (member.job === 'care') {
        const candidates = [game.player, ...CrewManager.members.filter(m => m.alive)];
        const target = candidates.sort((a, b) => a.health - b.health)[0];
        const before = finiteNumber(target.health);
        target.health = Util.clamp(before + 3 * efficiency, 0, 100);
        const healed = target.health - before;
        if (healed > 0) {
          messages.push(`${member.name} atendió a ${target === game.player ? 'ti' : target.name} (+${healed.toFixed(0)} salud).`);
          if (target !== game.player && target !== member) {
            target.trust = Util.clamp(finiteNumber(target.trust) + 2, 0, 100);
            target.lastIncident = `${member.name} le ayudó a curar sus heridas.`;
            CrewManager.signalInteraction(target, 'care', member);
          }
          CrewManager.signalInteraction(member, 'care', target);
          didUsefulWork = true;
        }
        for (const crewMember of CrewManager.members) {
          if (crewMember.alive) {
            crewMember.stress = Math.max(
              0,
              finiteNumber(crewMember.stress) - 2 * efficiency
            );
          }
        }
      } else if (member.job === 'navigate') {
        if (game.victoryCondition === 'island') {
          const advance = 3 * efficiency;
          game.islandDistance = Math.max(0, finiteNumber(game.islandDistance) - advance);
          messages.push(`${member.name} corrigió el rumbo y avanzó ${advance.toFixed(1)} de distancia.`);
          didUsefulWork = true;
        } else if (game.victoryCondition === 'radio') {
          const signal = 0.6 * efficiency;
          game.rescuedSignal = Util.clamp(finiteNumber(game.rescuedSignal) + signal, 0, 100);
          messages.push(`${member.name} afinó la posición de la señal (+${signal.toFixed(1)}%).`);
          didUsefulWork = true;
        }
      } else if (member.job === 'guard') {
        member.stress = Math.max(0, member.stress - 5 * efficiency);
        messages.push(`${member.name} vigiló las reservas y a la tripulación.`);
        didUsefulWork = true;
      } else if (member.job === 'cook') {
        const food = 0.14 * efficiency;
        game.resources.food = Math.max(0, finiteNumber(game.resources.food) + food);
        messages.push(`${member.name} aprovechó las sobras y conservó ${food.toFixed(1)} de comida.`);
        didUsefulWork = true;
      } else if (member.job === 'rest') {
        const healed = 4 * efficiency;
        member.health = Util.clamp(member.health + healed, 0, 100);
        member.stress = Math.max(0, member.stress - 24);
        member.morale = Util.clamp(member.morale + 5, 0, 100);
        messages.push(`${member.name} descansó y recuperó la compostura.`);
        didUsefulWork = true;
      }

      if (didUsefulWork && member.job !== 'rest') {
        member.stress = Math.max(0, member.stress - 2);
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

  resolveDailyBehavior: (game, random = null) => {
    const messages = [];
    let conflict = null;
    if (!game?.resources || !game?.player) return { messages, conflict };
    const guard = Util.clamp(CrewManager.guardStrength(), 0, 0.65);

    for (const member of CrewManager.members) {
      if (!member.alive) continue;
      let rollIndex = 0;
      const roll = () => typeof random === 'function'
        ? random()
        : crewBehaviorRoll(member, game.day, rollIndex++);
      member.incidentCooldown = Math.max(
        0,
        Math.floor(finiteNumber(member.incidentCooldown)) - 1
      );
      if (member.restrainedDays > 0) {
        member.restrainedDays--;
        member.stress = Math.max(0, member.stress - 8);
        if (member.restrainedDays === 0 && !member.hallucinating) {
          member.hostile = false;
        }
      }

      if (member.hallucinating) {
        const need = member.thirst < member.hunger ? 'agua' : 'comida';
        messages.push(
          `${member.name} alucina por la falta de ${need}; necesita ayuda urgente.`
        );
      }

      const crisisChance = Util.clamp(
        0.22 +
        member.criticalDays * 0.14 +
        member.stress / 250 -
        member.trust / 400 -
        guard,
        0,
        1
      );
      if (!conflict && member.hallucinating && member.criticalDays >= 1 &&
          member.restrainedDays <= 0 &&
          (member.criticalDays >= 3 || roll() < crisisChance)) {
        member.hostile = true;
        member.lastIncident =
          'Ha perdido el control por privación y amenaza a la tripulación.';
        conflict = {
          member,
          cause: member.thirst < member.hunger
            ? 'delirio por deshidratación'
            : 'delirio por hambre'
        };
        messages.push(
          `${member.name} entra en crisis y se vuelve hostil.`
        );
        continue;
      }

      if (member.incidentCooldown > 0 || member.hostile) continue;
      const stable = member.hunger >= 50 && member.thirst >= 50 &&
        member.stress < 45;
      const helpChance = stable
        ? Util.clamp(0.08 + member.trust / 500, 0.08, 0.28)
        : 0;
      if (roll() < helpChance) {
        const helpRoll = roll();
        if (helpRoll < 0.34) {
          const amount = 0.15;
          game.resources.water += amount;
          member.lastIncident = 'Compartió agua que había reservado.';
          messages.push(`${member.name} compartió ${amount} de agua.`);
        } else if (helpRoll < 0.68) {
          game.player.morale = Util.clamp(game.player.morale + 3, 0, 100);
          const companion = CrewManager.members.filter(other => other.alive && other !== member && !other.hostile)
            .sort((a, b) => a.morale - b.morale)[0];
          if (companion) {
            companion.morale = Util.clamp(companion.morale + 3, 0, 100);
            companion.stress = Math.max(0, companion.stress - 3);
            companion.trust = Util.clamp(companion.trust + 1, 0, 100);
            member.lastIncident = `Escuchó a ${companion.name} y le animó a seguir.`;
            companion.lastIncident = `Encontró apoyo hablando con ${member.name}.`;
            messages.push(`${member.name} escuchó a ${companion.name}: recuperaron el ánimo juntos.`);
            CrewManager.signalInteraction(member, 'talk', companion);
            CrewManager.signalInteraction(companion, 'talk', member);
          } else {
            member.lastIncident = 'Levantó el ánimo del grupo.';
            messages.push(`${member.name} consiguió levantar el ánimo del grupo.`);
          }
        } else {
          member.trust = Util.clamp(member.trust + 3, 0, 100);
          for (const crewMember of CrewManager.members) {
            if (crewMember.alive) {
              crewMember.stress = Math.max(0, crewMember.stress - 3);
            }
          }
          member.lastIncident = 'Ayudó espontáneamente a organizar la balsa.';
          messages.push(`${member.name} ayudó a organizar la jornada.`);
        }
        member.incidentCooldown = 2;
        continue;
      }

      const troubleChance = Util.clamp(
        0.035 +
        member.stress / 420 +
        (member.trait.effect === 'conflict' ? 0.09 : 0) +
        (member.trait.effect === 'moraleLoss' ? 0.04 : 0) -
        guard,
        0,
        0.48
      );
      if (roll() >= troubleChance) continue;

      const troubleRoll = roll();
      if (troubleRoll < 0.38 &&
          (game.resources.food > 0 || game.resources.water > 0)) {
        const stealWater =
          game.resources.water > 0 &&
          (game.resources.food <= 0 || member.thirst < member.hunger);
        const key = stealWater ? 'water' : 'food';
        const amount = Math.min(
          game.resources[key],
          key === 'water' ? 0.5 : 0.35
        );
        game.resources[key] = Math.max(0, game.resources[key] - amount);
        member.stress = Math.max(0, member.stress - 7);
        member.trust = Math.max(0, member.trust - 4);
        member.lastIncident = `Ocultó ${Util.formatAmount(amount)} de ${Util.resourceName(key)}.`;
        messages.push(
          `${member.name} ocultó ${Util.formatAmount(amount)} de ${Util.resourceName(key)}.`
        );
      } else if (troubleRoll < 0.72 && game.raft?.grid?.size) {
        const damage = game.raft.takeDamage(3);
        member.lastIncident = 'Cometió un error y dañó la balsa.';
        messages.push(
          `${member.name} cometió un error bajo presión (-${damage.toFixed(0)} estructura).`
        );
      } else {
        game.player.morale = Math.max(0, game.player.morale - 4);
        for (const crewMember of CrewManager.members) {
          if (crewMember.alive) {
            crewMember.morale = Math.max(0, crewMember.morale - 2);
          }
        }
        member.lastIncident = 'Provocó una discusión a bordo.';
        messages.push(`${member.name} provocó una discusión a bordo.`);
      }
      member.incidentCooldown = 2;
    }

    return { messages, conflict };
  },

  getReserveEstimate: (game) => {
    const foodNeed = 1 + CrewManager.getDailyFoodNeed();
    const waterNeed = 1.3 + CrewManager.count() * 1.3;
    return {
      foodDays: foodNeed > 0 ? finiteNumber(game?.resources?.food) / foodNeed : 0,
      waterDays: waterNeed > 0 ? finiteNumber(game?.resources?.water) / waterNeed : 0
    };
  },

  renderList: (container, onJobChange = null, onInteraction = null) => {
    container.innerHTML = '';
    if (CrewManager.members.length === 0) {
      container.innerHTML = '<p style="color:var(--muted)">No hay otros supervivientes a bordo.</p>';
      return;
    }
    for (let index = 0; index < CrewManager.members.length; index++) {
      const m = CrewManager.members[index];
      const alive = m.alive ? '' : ' (Fallecido)';
      const story = typeof m.getStory === 'function'
        ? m.getStory()
        : (getSurvivorStory(m.story) || SURVIVOR_STORIES[0]);
      const condition = typeof m.getCondition === 'function'
        ? m.getCondition()
        : { label: m.alive ? 'Estable' : 'Fallecido', level: 'stable' };
      const efficiency = Math.round(CrewManager.workEfficiency(m) * 100);
      const storyState = m.storyResolved
        ? 'Historia resuelta'
        : `Se sabrá más en ${Math.max(0, finiteNumber(m.storyDaysRemaining, story.delayDays))} día(s)`;
      const div = document.createElement('div');
      div.className = `crew-member crew-${condition.level}`;
      const jobOptions = CREW_JOBS.map(job => `
        <option value="${job.key}" ${m.job === job.key ? 'selected' : ''}>
          ${escapeSurvivorHtml(job.name)}
        </option>
      `).join('');
      div.innerHTML = `
        <div class="crew-card-heading">
          <div class="crew-name">${escapeSurvivorHtml(m.name)}${alive}</div>
          <span class="crew-condition ${condition.level}">${escapeSurvivorHtml(condition.label)}</span>
        </div>
        <div class="crew-role">${escapeSurvivorHtml(m.skill.name)} · ${escapeSurvivorHtml(m.trait.name)}</div>
        <div class="crew-activity">${escapeSurvivorHtml(CrewManager.getActivity(m))}</div>
        ${m.alive && typeof onInteraction === 'function' ? `<div class="crew-interactions">
          <button type="button" data-crew-action="talk" ${typeof Game !== 'undefined' && m.lastTalkDay === Game.day ? 'disabled' : ''}>Hablar</button>
          <button type="button" data-crew-action="ration" ${typeof Game !== 'undefined' && ((Game.resources?.food || 0) < 0.5 || (Game.resources?.water || 0) < 0.65 || (m.hunger >= 95 && m.thirst >= 95)) ? 'disabled' : ''}>Compartir ración<small>0,5 comida · 0,65 agua</small></button>
          <button type="button" data-crew-action="rest" ${m.job === 'rest' ? 'disabled' : ''}>Dar descanso</button>
        </div>` : ''}
        <div class="crew-skill-detail">${escapeSurvivorHtml(m.skill.desc)} · ${escapeSurvivorHtml(m.trait.desc)}</div>
        <label class="crew-job">
          <span>Tarea asignada</span>
          <select data-crew-index="${index}" ${m.alive ? '' : 'disabled'}>
            ${jobOptions}
          </select>
          <small>Eficiencia estimada: ${efficiency}%</small>
        </label>
        ${m.lastIncident ? `<div class="crew-incident">${escapeSurvivorHtml(m.lastIncident)}</div>` : ''}
        ${m.alive && m.restrainedDays > 0
          ? `<button class="crew-expel" data-expel-index="${index}" type="button">Expulsar de la balsa</button>`
          : ''}
        <div class="crew-story"><strong>${escapeSurvivorHtml(story.title)}</strong> · ${escapeSurvivorHtml(storyState)}</div>
        <div class="crew-story-detail">${escapeSurvivorHtml(m.storyResolved ? story.impact : story.riskBenefit)}</div>
        <div class="crew-bars">
          <div class="bar"><span>Salud</span><div class="track"><div class="fill health" style="width:${m.health}%;${m.health < 25 ? 'background:var(--danger)' : ''}"></div></div></div>
          <div class="bar"><span>Hambre</span><div class="track"><div class="fill hunger" style="width:${m.hunger}%;${m.hunger < 25 ? 'background:var(--danger)' : ''}"></div></div></div>
          <div class="bar"><span>Sed</span><div class="track"><div class="fill thirst" style="width:${m.thirst}%;${m.thirst < 25 ? 'background:var(--danger)' : ''}"></div></div></div>
          <div class="bar"><span>Moral</span><div class="track"><div class="fill morale" style="width:${m.morale}%;${m.morale < 25 ? 'background:var(--danger)' : ''}"></div></div></div>
          <div class="bar"><span>Confianza</span><div class="track"><div class="fill trust" style="width:${m.trust}%"></div></div></div>
          <div class="bar"><span>Estrés</span><div class="track"><div class="fill stress" style="width:${m.stress}%;${m.stress > 70 ? 'background:var(--danger)' : ''}"></div></div></div>
        </div>
      `;
      container.appendChild(div);
      if (typeof onInteraction === 'function') {
        for (const button of div.querySelectorAll?.('[data-crew-action]') || []) {
          button.onclick = () => onInteraction(m, button.dataset.crewAction);
        }
      }
      const select = div.querySelector?.('select[data-crew-index]');
      if (select) {
        select.onchange = () => {
          CrewManager.setJob(m, select.value);
          if (typeof onJobChange === 'function') onJobChange(m, 'job');
        };
      }
      const expel = div.querySelector?.('button[data-expel-index]');
      if (expel) {
        expel.onclick = () => {
          if (typeof onJobChange === 'function') onJobChange(m, 'expel');
        };
      }
    }
  }
};
