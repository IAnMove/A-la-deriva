const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const pendingTimers = new Map();
let nextTimerId = 1;

const eventMessage = {
  textContent: '',
  visible: false,
  classes: new Set(),
  classList: {
    add(...names) {
      names.forEach(name => eventMessage.classes.add(name));
      if (names.includes('show')) eventMessage.visible = true;
    },
    remove(...names) {
      names.forEach(name => eventMessage.classes.delete(name));
      if (names.includes('show')) eventMessage.visible = false;
    }
  }
};

const sandbox = {
  document: {
    getElementById(id) {
      assert.equal(id, 'event-message');
      return eventMessage;
    }
  },
  setTimeout(callback, delay) {
    assert.equal(delay, 2500);
    const id = nextTimerId++;
    pendingTimers.set(id, callback);
    return id;
  },
  clearTimeout(id) {
    pendingTimers.delete(id);
  }
};

vm.createContext(sandbox);
vm.runInContext(
  fs.readFileSync(path.join(root, 'game-ui.js'), 'utf8'),
  sandbox,
  { filename: 'game-ui.js' }
);

vm.runInContext('GameUI.showEventMessage({}, "Primer aviso")', sandbox);
const firstTimerId = nextTimerId - 1;
vm.runInContext('GameUI.showEventMessage({}, "Aviso más reciente")', sandbox);
const secondTimerId = nextTimerId - 1;

assert.equal(pendingTimers.has(firstTimerId), false);
assert.equal(eventMessage.textContent, 'Aviso más reciente');
assert.equal(eventMessage.visible, true);
assert.equal(eventMessage.classes.has('warning'), true);

pendingTimers.get(secondTimerId)();
assert.equal(eventMessage.visible, false);

vm.runInContext(
  'GameUI.showEventMessage({}, "¡Tiburón al ataque, peligro mortal!")',
  sandbox
);
assert.equal(eventMessage.classes.has('danger'), true);
assert.equal(eventMessage.classes.has('warning'), false);

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
assert.match(
  html,
  /<span>Energía<\/span>[\s\S]*?id="value-stamina"[\s\S]*?id="bar-stamina"/
);
assert.doesNotMatch(html, /<span>Cansancio<\/span>[\s\S]*?id="bar-stamina"/);
assert.match(html, /id="threat-panel"[\s\S]*?id="threat-detail"/);
assert.match(
  html,
  /id="crew-conflict-panel"[\s\S]*?id="btn-conflict-ration"[\s\S]*?id="btn-conflict-push"/
);
assert.match(html, /id="reserve-status"/);
assert.match(html, /id="crew-overview"/);
assert.match(html, /class="panel hero-panel"/);
assert.match(css, /#threat-panel\.critical/);
assert.match(css, /\.crew-condition\.critical/);
assert.match(css, /#crew-conflict-track/);
assert.match(css, /\.build-desc/);
assert.match(css, /\.build-risk/);
assert.match(css, /\.build-drawback/);
assert.match(css, /backdrop-filter:\s*blur\(14px\)/);

console.log('✓ feedback por severidad, HUD profesional y avisos de amenazas');
