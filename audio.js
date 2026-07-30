/*****************************************************
 * audio.js - Efectos de sonido con Web Audio API
 *****************************************************/

const AudioSys = (() => {
  let ctx = null;
  let enabled = true;
  function ensure() {
    if (!enabled) return null;
    if (!ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        ctx = new AC();
      } catch (e) { enabled = false; return null; }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function beep(freq, duration, type = 'sine', vol = 0.1) {
    const c = ensure(); if (!c) return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, c.currentTime);
    g.gain.setValueAtTime(vol, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    o.connect(g);
    g.connect(c.destination);
    o.start();
    o.stop(c.currentTime + duration);
  }
  function noise(duration, vol = 0.1) {
    const c = ensure(); if (!c) return;
    const bufferSize = c.sampleRate * duration;
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buffer;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    src.connect(g);
    g.connect(c.destination);
    src.start();
    src.stop(c.currentTime + duration);
  }
  return {
    setEnabled: (v) => { enabled = v; },
    isEnabled: () => enabled,
    play: (name) => {
      if (!enabled) return;
      switch (name) {
        case 'collect': beep(880, 0.12, 'sine', 0.08); break;
        case 'hook': beep(440, 0.2, 'triangle', 0.08); break;
        case 'build': beep(330, 0.3, 'square', 0.06); break;
        case 'damage': beep(160, 0.35, 'sawtooth', 0.12); break;
        case 'storm': noise(0.8, 0.15); break;
        case 'fish-bite': beep(720, 0.16, 'triangle', 0.09); break;
        case 'fish-tug': beep(920, 0.1, 'sine', 0.08); break;
        case 'fish-miss': beep(260, 0.14, 'triangle', 0.07); break;
        case 'fish-success': beep(1046, 0.28, 'sine', 0.1); break;
        case 'fish-fail': beep(180, 0.35, 'sawtooth', 0.07); break;
        case 'shark-warning':
          beep(210, 0.18, 'sawtooth', 0.1);
          setTimeout(() => beep(170, 0.24, 'sawtooth', 0.11), 150);
          break;
        case 'shark-repel':
          beep(760, 0.1, 'square', 0.09);
          beep(980, 0.16, 'triangle', 0.08);
          break;
        case 'shark-bite':
          noise(0.28, 0.18);
          beep(95, 0.45, 'sawtooth', 0.14);
          break;
        case 'reef-hit':
          noise(0.42, 0.18);
          beep(125, 0.5, 'square', 0.12);
          break;
        case 'conflict-warning':
          beep(240, 0.14, 'sawtooth', 0.09);
          setTimeout(() => beep(190, 0.2, 'sawtooth', 0.1), 130);
          break;
        case 'conflict-shove':
          noise(0.12, 0.08);
          beep(145, 0.12, 'square', 0.08);
          break;
        case 'conflict-calm':
          beep(440, 0.15, 'sine', 0.07);
          beep(660, 0.22, 'sine', 0.08);
          break;
        case 'alert': beep(600, 0.15, 'square', 0.1); beep(600, 0.15, 'square', 0.1); break;
        case 'day': beep(523, 0.3, 'sine', 0.08); beep(659, 0.4, 'sine', 0.08); break;
        case 'win': beep(523, 0.2, 'sine', 0.1); beep(659, 0.2, 'sine', 0.1); beep(784, 0.4, 'sine', 0.1); break;
        case 'lose': beep(392, 0.4, 'sawtooth', 0.12); beep(330, 0.6, 'sawtooth', 0.12); break;
      }
    }
  };
})();
