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
  classList: {
    add(name) {
      if (name === 'show') eventMessage.visible = true;
    },
    remove(name) {
      if (name === 'show') eventMessage.visible = false;
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

pendingTimers.get(secondTimerId)();
assert.equal(eventMessage.visible, false);

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert.match(html, /<span>Energía<\/span>[\s\S]*?id="bar-stamina"/);
assert.doesNotMatch(html, /<span>Cansancio<\/span>[\s\S]*?id="bar-stamina"/);

console.log('✓ mensajes recientes conservan su temporizador y la barra indica Energía');
