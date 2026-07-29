/*****************************************************
 * engine.js - Utilidades, input, bucle, log,
 *             textos flotantes y partículas 3D
 *****************************************************/

const Util = {
  clamp: (v, min, max) => Math.max(min, Math.min(max, v)),
  rand: (min, max) => Math.random() * (max - min) + min,
  randInt: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
  choice: (arr) => arr[Math.floor(Math.random() * arr.length)],
  dist2: (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz),
  lerp: (a, b, t) => a + (b - a) * t,
  formatTime: (hour) => {
    const h = Math.floor(hour);
    const m = Math.floor((hour - h) * 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  },
  formatAmount: (value, decimals = 1) => {
    const n = Number(value) || 0;
    const rounded = Number(n.toFixed(decimals));
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(decimals);
  },
  resourceName: (key) => ({
    wood: 'madera',
    plastic: 'plástico',
    cloth: 'tela',
    metal: 'metal',
    rope: 'cuerda',
    food: 'comida',
    water: 'agua',
    fuel: 'combustible'
  })[key] || key,
  pad: (s, n = 2) => String(s).padStart(n, '0'),
};

// Conversión de unidades del 2D (px) a unidades del mundo 3D
const WORLD_SCALE = 0.05; // 40 px = 2 unidades (1 celda)

// Input
const Input = {
  keys: {},
  held: {},
  mouse: { x: 0, y: 0, down: false, clicked: false, rightClicked: false },
  virtualPulses: new Set(),
  touchPointer: null,
  initialized: false,
  init: (canvas) => {
    if (Input.initialized) return;
    Input.initialized = true;
    Input.mouse.x = canvas.clientWidth / 2;
    Input.mouse.y = canvas.clientHeight / 2;
    window.addEventListener('keydown', e => {
      const interactive = e.target && (
        e.target.tagName === 'BUTTON' ||
        e.target.tagName === 'INPUT' ||
        e.target.tagName === 'SELECT' ||
        e.target.tagName === 'TEXTAREA'
      );
      if (interactive && (e.code === 'Space' || e.code === 'Enter')) return;
      // Las acciones discretas (pausa, construir, sonido...) solo deben
      // dispararse una vez por pulsación física, no con el auto-repeat.
      if (Input.held[e.code]) {
        if (e.code === 'Space' || e.code === 'KeyB' || e.code === 'KeyE') e.preventDefault();
        return;
      }
      Input.held[e.code] = true;
      Input.keys[e.code] = true;
      if (e.code === 'Space' || e.code === 'KeyB' || e.code === 'KeyE') e.preventDefault();
    });
    window.addEventListener('keyup', e => {
      Input.held[e.code] = false;
      Input.keys[e.code] = false;
    });
    const releaseAll = () => {
      Input.keys = {};
      Input.held = {};
      Input.virtualPulses.clear();
      Input.touchPointer = null;
      Input.mouse.down = false;
      Input.resetClick();
      document.querySelectorAll('[data-input-hold].is-held').forEach(
        button => button.classList.remove('is-held')
      );
    };
    window.addEventListener('blur', releaseAll);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) releaseAll();
    });
    canvas.addEventListener('mousemove', e => {
      const rect = canvas.getBoundingClientRect();
      Input.mouse.x = e.clientX - rect.left;
      Input.mouse.y = e.clientY - rect.top;
    });
    canvas.addEventListener('mousedown', e => { if (e.button === 0) Input.mouse.down = true; });
    canvas.addEventListener('mouseup', e => {
      if (e.button === 0) { Input.mouse.down = false; Input.mouse.clicked = true; }
    });
    canvas.addEventListener('contextmenu', e => {
      e.preventDefault();
      Input.mouse.rightClicked = true;
    });

    // Un toque corto sobre el mar equivale al clic principal existente:
    // apunta/lanzar gancho, caminar, construir o remar según el contexto.
    // Los desplazamientos sirven para apuntar sin activar una acción accidental.
    canvas.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'touch' || Input.touchPointer) return;
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      Input.mouse.x = e.clientX - rect.left;
      Input.mouse.y = e.clientY - rect.top;
      Input.mouse.down = true;
      Input.touchPointer = {
        id: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startedAt: Number.isFinite(e.timeStamp) ? e.timeStamp : performance.now(),
        moved: false
      };
      Input.capturePointer(canvas, e.pointerId);
    }, { passive: false });
    canvas.addEventListener('pointermove', e => {
      if (e.pointerType !== 'touch' || Input.touchPointer?.id !== e.pointerId) return;
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      Input.mouse.x = e.clientX - rect.left;
      Input.mouse.y = e.clientY - rect.top;
      if (Math.hypot(e.clientX - Input.touchPointer.startX, e.clientY - Input.touchPointer.startY) > 12) {
        Input.touchPointer.moved = true;
      }
    }, { passive: false });
    const finishTouch = e => {
      if (e.pointerType !== 'touch' || Input.touchPointer?.id !== e.pointerId) return;
      e.preventDefault();
      Input.mouse.down = false;
      if (!Input.touchPointer.moved && e.type === 'pointerup') {
        const endedAt = Number.isFinite(e.timeStamp) ? e.timeStamp : performance.now();
        if (endedAt - Input.touchPointer.startedAt >= 500) Input.mouse.rightClicked = true;
        else Input.mouse.clicked = true;
      }
      Input.touchPointer = null;
    };
    canvas.addEventListener('pointerup', finishTouch, { passive: false });
    canvas.addEventListener('pointercancel', finishTouch, { passive: false });

    Input.initVirtualControls(canvas);
  },
  setVirtualHeld: (code, down) => {
    if (!code) return;
    Input.held[code] = down;
    Input.keys[code] = down;
  },
  pulse: (code) => {
    if (!code) return;
    Input.keys[code] = true;
    Input.virtualPulses.add(code);
  },
  capturePointer: (target, pointerId) => {
    if (!target?.setPointerCapture) return;
    try { target.setPointerCapture(pointerId); }
    catch (_) {
      // Los eventos sintéticos de pruebas y algunos navegadores híbridos no
      // registran el puntero como activo; el control sigue funcionando.
    }
  },
  initVirtualControls: (canvas) => {
    const touchCapable = (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) ||
      (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0);
    document.documentElement.classList.toggle('touch-controls', touchCapable);

    const releaseButton = button => {
      const code = button.dataset.inputHold;
      if (code) Input.setVirtualHeld(code, false);
      button.classList.remove('is-held');
    };

    document.querySelectorAll('[data-input-hold]').forEach(button => {
      button.addEventListener('pointerdown', e => {
        e.preventDefault();
        Input.setVirtualHeld(button.dataset.inputHold, true);
        button.classList.add('is-held');
        Input.capturePointer(button, e.pointerId);
      });
      button.addEventListener('pointerup', e => {
        e.preventDefault();
        releaseButton(button);
      });
      button.addEventListener('pointercancel', () => releaseButton(button));
      button.addEventListener('lostpointercapture', () => releaseButton(button));
    });

    document.querySelectorAll('[data-input-press]').forEach(button => {
      button.addEventListener('pointerdown', e => {
        e.preventDefault();
        Input.pulse(button.dataset.inputPress);
        button.classList.add('is-held');
      });
      const release = () => button.classList.remove('is-held');
      button.addEventListener('pointerup', release);
      button.addEventListener('pointercancel', release);
      button.addEventListener('lostpointercapture', release);
    });

    document.querySelectorAll('[data-input-wheel]').forEach(button => {
      button.addEventListener('pointerdown', e => {
        e.preventDefault();
        const deltaY = Number(button.dataset.inputWheel) || 0;
        let wheelEvent;
        try {
          wheelEvent = new WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true });
        } catch (_) {
          wheelEvent = new Event('wheel', { bubbles: true, cancelable: true });
          Object.defineProperty(wheelEvent, 'deltaY', { value: deltaY });
        }
        canvas.dispatchEvent(wheelEvent);
        button.classList.add('is-held');
      });
      const release = () => button.classList.remove('is-held');
      button.addEventListener('pointerup', release);
      button.addEventListener('pointercancel', release);
      button.addEventListener('lostpointercapture', release);
    });
  },
  isDown: (code) => !!Input.held[code] || !!Input.keys[code],
  wasPressed: (code) => {
    if (Input.keys[code] === 'pressed') return false;
    if (Input.keys[code]) { Input.keys[code] = 'pressed'; return true; }
    return false;
  },
  resetClick: () => { Input.mouse.clicked = false; Input.mouse.rightClicked = false; },
  clearFrame: () => {
    for (const k in Input.keys) if (Input.keys[k] === 'pressed') Input.keys[k] = false;
    for (const code of Input.virtualPulses) Input.keys[code] = false;
    Input.virtualPulses.clear();
  }
};

// Bucle de juego
const Loop = {
  running: false,
  last: 0,
  dt: 0,
  callbacks: { update: null, draw: null },
  start: (update, draw) => {
    Loop.callbacks.update = update;
    Loop.callbacks.draw = draw;
    Loop.running = true;
    Loop.last = performance.now();
    requestAnimationFrame(Loop.tick);
  },
  stop: () => { Loop.running = false; },
  tick: (now) => {
    if (!Loop.running) return;
    Loop.dt = Math.min((now - Loop.last) / 1000, 0.05);
    Loop.last = now;
    try {
      if (Loop.callbacks.update) Loop.callbacks.update(Loop.dt);
      if (Loop.callbacks.draw) Loop.callbacks.draw(Loop.dt);
    } catch (e) { console.error(e); }
    Input.clearFrame();
    requestAnimationFrame(Loop.tick);
  }
};

// Textos flotantes 3D (sprites con textura de canvas)
const FloatingText = {
  items: [],
  scene: null,
  init: (scene) => { FloatingText.scene = scene; },
  clear: () => {
    for (const it of FloatingText.items) {
      if (it.sprite.material.map) it.sprite.material.map.dispose();
      it.sprite.material.dispose();
      FloatingText.scene.remove(it.sprite);
    }
    FloatingText.items = [];
  },
  add: (x, y, z, text, color = '#ffffff', life = 1.4) => {
    const cvs = document.createElement('canvas');
    cvs.width = 256; cvs.height = 64;
    const c = cvs.getContext('2d');
    c.font = 'bold 28px sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.strokeStyle = 'rgba(0,0,0,0.8)';
    c.lineWidth = 5;
    c.strokeText(text, 128, 32);
    c.fillStyle = color;
    c.fillText(text, 128, 32);
    const tex = new THREE.CanvasTexture(cvs);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(2.4, 0.6, 1);
    sprite.position.set(x, y, z);
    FloatingText.scene.add(sprite);
    FloatingText.items.push({ sprite, life, maxLife: life, vy: 0.8 });
  },
  update: (dt) => {
    for (let i = FloatingText.items.length - 1; i >= 0; i--) {
      const it = FloatingText.items[i];
      it.life -= dt;
      it.sprite.position.y += it.vy * dt;
      it.sprite.material.opacity = Math.max(0, it.life / it.maxLife);
      if (it.life <= 0) {
        it.sprite.material.map.dispose();
        it.sprite.material.dispose();
        FloatingText.scene.remove(it.sprite);
        FloatingText.items.splice(i, 1);
      }
    }
  }
};

// Partículas 3D simples (un único THREE.Points reutilizado)
const Particles = {
  MAX: 600,
  points: null,
  data: [],
  init: (scene) => {
    Particles.data = [];
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(Particles.MAX * 3);
    const colors = new Float32Array(Particles.MAX * 3);
    for (let i = 0; i < Particles.MAX; i++) positions[i * 3 + 1] = -999;
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({ size: 0.14, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false });
    Particles.points = new THREE.Points(geo, mat);
    Particles.points.frustumCulled = false;
    scene.add(Particles.points);
  },
  clear: () => {
    Particles.data = [];
    if (Particles.points) {
      const pos = Particles.points.geometry.attributes.position.array;
      for (let i = 0; i < Particles.MAX; i++) pos[i * 3 + 1] = -999;
      Particles.points.geometry.attributes.position.needsUpdate = true;
    }
  },
  emit: (x, y, z, color, count = 8, speed = 2) => {
    const col = new THREE.Color(color);
    for (let i = 0; i < count; i++) {
      if (Particles.data.length >= Particles.MAX) Particles.data.shift();
      const a = Math.random() * Math.PI * 2;
      const s = Util.rand(speed * 0.3, speed);
      Particles.data.push({
        x, y, z,
        vx: Math.cos(a) * s,
        vy: Util.rand(0.5, 2.2),
        vz: Math.sin(a) * s,
        life: Util.rand(0.4, 0.9),
        r: col.r, g: col.g, b: col.b
      });
    }
  },
  update: (dt) => {
    const pos = Particles.points.geometry.attributes.position.array;
    const col = Particles.points.geometry.attributes.color.array;
    for (let i = 0; i < Particles.MAX; i++) { pos[i * 3 + 1] = -999; }
    for (let i = Particles.data.length - 1; i >= 0; i--) {
      const p = Particles.data[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vy -= 4.5 * dt; // gravedad
      p.life -= dt;
      if (p.life <= 0) { Particles.data.splice(i, 1); continue; }
      pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
      col[i * 3] = p.r; col[i * 3 + 1] = p.g; col[i * 3 + 2] = p.b;
    }
    Particles.points.geometry.attributes.position.needsUpdate = true;
    Particles.points.geometry.attributes.color.needsUpdate = true;
  }
};

// Registro de eventos
const Log = {
  entries: [],
  add: (text) => {
    Log.entries.unshift({ text, time: Date.now() });
    if (Log.entries.length > 60) Log.entries.pop();
  },
  clear: () => Log.entries = [],
  render: (container) => {
    container.innerHTML = Log.entries.map(e => {
      const d = new Date(e.time);
      const t = `${Util.pad(d.getHours())}:${Util.pad(d.getMinutes())}`;
      return `<div class="log-entry"><span class="time">${t}</span>${e.text}</div>`;
    }).join('');
  }
};
