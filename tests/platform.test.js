const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

class Target {
  constructor() {
    this.listeners = new Map();
  }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }
  dispatchEvent(event) {
    event.target ||= this;
    event.preventDefault ||= () => { event.defaultPrevented = true; };
    for (const listener of this.listeners.get(event.type) || []) listener(event);
    return !event.defaultPrevented;
  }
}

function makeClassList() {
  const values = new Set();
  return {
    add: (...names) => names.forEach(name => values.add(name)),
    remove: (...names) => names.forEach(name => values.delete(name)),
    toggle(name, force) {
      if (force === undefined ? !values.has(name) : force) values.add(name);
      else values.delete(name);
    },
    contains: name => values.has(name)
  };
}

class Element extends Target {
  constructor(dataset = {}) {
    super();
    this.dataset = dataset;
    this.classList = makeClassList();
    this.clientWidth = 800;
    this.clientHeight = 600;
    this.style = {};
    this.pointerCapture = null;
  }
  getBoundingClientRect() { return { left: 10, top: 20, width: 800, height: 600 }; }
  setPointerCapture(id) { this.pointerCapture = id; }
}

function createStorage() {
  const values = new Map();
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
    clear: () => values.clear()
  };
}

function createSandbox() {
  const canvas = new Element();
  const move = new Element({ inputHold: 'KeyW' });
  const interact = new Element({ inputPress: 'KeyE' });
  const zoom = new Element({ inputWheel: '-120' });
  const windowTarget = new Target();
  const documentTarget = new Target();
  const documentElement = new Element();
  const selectors = {
    '[data-input-hold]': [move],
    '[data-input-press]': [interact],
    '[data-input-wheel]': [zoom],
    '[data-input-hold].is-held': [move].filter(el => el.classList.contains('is-held'))
  };
  Object.assign(documentTarget, {
    hidden: false,
    visibilityState: 'visible',
    documentElement,
    querySelectorAll(selector) {
      if (selector === '[data-input-hold].is-held') {
        return [move].filter(el => el.classList.contains('is-held'));
      }
      return selectors[selector] || [];
    },
    createElement: () => new Element()
  });
  Object.assign(windowTarget, {
    innerWidth: 800,
    innerHeight: 600,
    devicePixelRatio: 1
  });

  class MockEvent {
    constructor(type, init = {}) { Object.assign(this, init, { type }); }
    preventDefault() { this.defaultPrevented = true; }
  }
  class MockWheelEvent extends MockEvent {}

  const sandbox = {
    console: {
      log: (...args) => console.log(...args),
      error: (...args) => console.error(...args),
      warn() {}
    },
    localStorage: createStorage(),
    window: windowTarget,
    document: documentTarget,
    navigator: { maxTouchPoints: 1 },
    matchMedia: () => ({ matches: true }),
    Event: MockEvent,
    WheelEvent: MockWheelEvent,
    performance: { now: () => 0 },
    requestAnimationFrame() {},
    setTimeout(fn) { fn(); },
    clearTimeout() {},
    Date
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  return { sandbox, canvas, move, interact, zoom, windowTarget, documentTarget, documentElement };
}

function load(sandbox, file) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), sandbox, { filename: file });
}

function run(sandbox, source) {
  return vm.runInContext(source, sandbox);
}

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

test('guardado v2 migra v1, sanea valores y recupera preferencias corruptas', () => {
  const { sandbox } = createSandbox();
  load(sandbox, 'save.js');
  sandbox.localStorage.setItem('aladeriva3d_save_v1', JSON.stringify({
    day: 4,
    player: { health: 80 },
    resources: { water: 3 }
  }));

  assert.equal(run(sandbox, 'Save.exists()'), true);
  const loaded = run(sandbox, 'Save.load()');
  assert.equal(loaded.day, 4);
  assert.equal(loaded.schemaVersion, 2);
  assert.ok(sandbox.localStorage.getItem('aladeriva3d_save_v2'));
  assert.equal(sandbox.localStorage.getItem('aladeriva3d_save_v1'), null);

  assert.equal(run(sandbox, 'Save.save({ day: Infinity, note: "ok" })'), true);
  assert.equal(JSON.parse(sandbox.localStorage.getItem('aladeriva3d_save_v2')).day, 0);

  sandbox.localStorage.setItem('aladeriva3d_prefs_v2', 'null');
  sandbox.localStorage.setItem('aladeriva3d_prefs_v1', '{dañado');
  assert.deepEqual({ ...run(sandbox, 'Save.loadPrefs()') }, { sound: true });

  sandbox.localStorage.setItem('aladeriva3d_save_v2', '{"schemaVersion":999,"day":8}');
  assert.equal(run(sandbox, 'Save.load()'), null);
});

test('autoguardado desacoplado responde a pagehide/visibility y respeta el estado', () => {
  const { sandbox, windowTarget, documentTarget } = createSandbox();
  load(sandbox, 'save.js');
  run(sandbox, `
    var autosaveAllowedFixture = true;
    var autosaveDayFixture = 7;
    Save.bindAutosave(
      () => ({ day: autosaveDayFixture }),
      () => autosaveAllowedFixture
    );
  `);
  windowTarget.dispatchEvent({ type: 'pagehide' });
  assert.equal(JSON.parse(sandbox.localStorage.getItem('aladeriva3d_save_v2')).day, 7);

  run(sandbox, 'autosaveAllowedFixture = false; autosaveDayFixture = 8;');
  documentTarget.hidden = true;
  documentTarget.visibilityState = 'hidden';
  documentTarget.dispatchEvent({ type: 'visibilitychange' });
  assert.equal(JSON.parse(sandbox.localStorage.getItem('aladeriva3d_save_v2')).day, 7);
});

test('Input táctil mantiene acciones continuas y evita clic al arrastrar', () => {
  const env = createSandbox();
  env.sandbox.canvasFixture = env.canvas;
  load(env.sandbox, 'engine.js');
  run(env.sandbox, 'Input.init(canvasFixture)');
  assert.equal(env.documentElement.classList.contains('touch-controls'), true);

  env.move.dispatchEvent({ type: 'pointerdown', pointerId: 1 });
  assert.equal(run(env.sandbox, 'Input.isDown("KeyW")'), true);
  env.move.dispatchEvent({ type: 'pointerup', pointerId: 1 });
  assert.equal(run(env.sandbox, 'Input.isDown("KeyW")'), false);

  env.interact.dispatchEvent({ type: 'pointerdown', pointerId: 2 });
  env.interact.dispatchEvent({ type: 'pointerup', pointerId: 2 });
  assert.equal(run(env.sandbox, 'Input.wasPressed("KeyE")'), true);
  run(env.sandbox, 'Input.clearFrame()');
  assert.equal(run(env.sandbox, 'Input.isDown("KeyE")'), false);

  let wheelDelta = 0;
  env.canvas.addEventListener('wheel', event => { wheelDelta = event.deltaY; });
  env.zoom.dispatchEvent({ type: 'pointerdown', pointerId: 3 });
  assert.equal(wheelDelta, -120);

  env.canvas.dispatchEvent({
    type: 'pointerdown', pointerType: 'touch', pointerId: 4, clientX: 110, clientY: 220, timeStamp: 100
  });
  env.canvas.dispatchEvent({
    type: 'pointerup', pointerType: 'touch', pointerId: 4, clientX: 110, clientY: 220, timeStamp: 180
  });
  assert.equal(run(env.sandbox, 'Input.mouse.clicked'), true);
  assert.equal(run(env.sandbox, 'Input.mouse.x'), 100);
  assert.equal(run(env.sandbox, 'Input.mouse.y'), 200);

  run(env.sandbox, 'Input.resetClick()');
  env.canvas.dispatchEvent({
    type: 'pointerdown', pointerType: 'touch', pointerId: 5, clientX: 110, clientY: 220, timeStamp: 200
  });
  env.canvas.dispatchEvent({
    type: 'pointerup', pointerType: 'touch', pointerId: 5, clientX: 110, clientY: 220, timeStamp: 800
  });
  assert.equal(run(env.sandbox, 'Input.mouse.rightClicked'), true);

  run(env.sandbox, 'Input.resetClick()');
  env.canvas.dispatchEvent({
    type: 'pointerdown', pointerType: 'touch', pointerId: 6, clientX: 110, clientY: 220, timeStamp: 900
  });
  env.canvas.dispatchEvent({
    type: 'pointermove', pointerType: 'touch', pointerId: 6, clientX: 150, clientY: 260, timeStamp: 940
  });
  env.canvas.dispatchEvent({
    type: 'pointerup', pointerType: 'touch', pointerId: 6, clientX: 150, clientY: 260, timeStamp: 980
  });
  assert.equal(run(env.sandbox, 'Input.mouse.clicked'), false);
});

test('HTML declara controles, Three local y fallback CDN con SRI', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const three = fs.readFileSync(path.join(root, 'vendor', 'three.min.js'));
  const integrity = `sha384-${crypto.createHash('sha384').update(three).digest('base64')}`;
  assert.match(html, /id="mobile-controls"/);
  assert.match(html, /data-input-hold="KeyW"/);
  assert.match(html, /src="vendor\/three\.min\.js"/);
  const simulationIndex = html.indexOf('src="game-simulation.js"');
  const uiIndex = html.indexOf('src="game-ui.js"');
  const rendererIndex = html.indexOf('src="game-renderer.js"');
  const gameIndex = html.indexOf('src="game.js"');
  assert.ok(simulationIndex > 0 && simulationIndex < gameIndex);
  assert.ok(uiIndex > simulationIndex && uiIndex < gameIndex);
  assert.ok(rendererIndex > uiIndex && rendererIndex < gameIndex);
  assert.equal(integrity, 'sha384-RRHfJ6w1mTlKUBMYT/hvnRiOzEB/vyRV3DrQOseb6oYfvaZSfdd0byS4bHps0k2R');
  assert.ok(html.includes(`integrity="${integrity}"`));
  assert.ok(three.length > 500000);
});
