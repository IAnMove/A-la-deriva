/*****************************************************
 * save.js - Guardado local versionado y saneado
 *****************************************************/

const Save = {
  SCHEMA_VERSION: 4,
  KEY: 'aladeriva3d_save_v4',
  LEGACY_KEYS: [
    'aladeriva3d_save_v3',
    'aladeriva3d_save_v2',
    'aladeriva3d_save_v1'
  ],
  BEST: 'aladeriva3d_best_v1',
  PREFS: 'aladeriva3d_prefs_v2',
  LEGACY_PREFS: ['aladeriva3d_prefs_v1'],
  MAX_BYTES: 512 * 1024,
  MAX_DEPTH: 12,
  MAX_ITEMS: 5000,
  autosaveBound: false,
  autosaveProvider: null,
  autosaveAllowed: null,
  autosaveInProgress: false,

  isPlainObject: (value) => {
    if (!value || Object.prototype.toString.call(value) !== '[object Object]') return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
  },

  // Solo deja pasar datos JSON simples. Evita prototipos, valores no finitos,
  // cargas desmesuradas y cadenas que puedan agotar localStorage o la UI.
  sanitize: (value, depth = 0, budget = { items: 0 }) => {
    if (depth > Save.MAX_DEPTH || budget.items++ > Save.MAX_ITEMS) {
      throw new Error('El guardado supera los límites permitidos.');
    }
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (typeof value === 'string') return value.slice(0, 2000);
    if (Array.isArray(value)) {
      return value.slice(0, Save.MAX_ITEMS).map(item => Save.sanitize(item, depth + 1, budget));
    }
    if (Save.isPlainObject(value)) {
      const clean = {};
      for (const [key, item] of Object.entries(value)) {
        if (key === '__proto__' || key === 'prototype' || key === 'constructor') continue;
        clean[String(key).slice(0, 120)] = Save.sanitize(item, depth + 1, budget);
      }
      return clean;
    }
    return null;
  },

  prepare: (data) => {
    if (!Save.isPlainObject(data)) throw new Error('Formato de guardado inválido.');
    const clean = Save.sanitize(data);
    clean.schemaVersion = Save.SCHEMA_VERSION;
    clean.savedAt = new Date().toISOString();
    return clean;
  },

  migrate: (data) => {
    if (!Save.isPlainObject(data)) return null;
    const version = Number(data.schemaVersion) || 1;
    if (version > Save.SCHEMA_VERSION) {
      console.warn(`El guardado usa una versión futura (${version}).`);
      return null;
    }
    const clean = Save.sanitize(data);
    // Las versiones anteriores conservan la forma de los datos de juego para
    // que Game.loadFromSave siga siendo el único responsable de reconstruirlos.
    clean.schemaVersion = Save.SCHEMA_VERSION;
    clean.savedAt = typeof clean.savedAt === 'string' ? clean.savedAt : null;
    return clean;
  },

  inspect: (raw) => {
    if (raw === null) return { status: 'absent', data: null };
    if (typeof raw !== 'string' || raw.length === 0) {
      return { status: 'corrupt', data: null };
    }
    // No se analiza un slot desmesurado, pero tampoco se trata como basura:
    // puede pertenecer a una versión futura con un límite mayor. Conservarlo
    // evita que una versión antigua lo sustituya por un fallback legacy.
    if (raw.length > Save.MAX_BYTES) {
      return { status: 'oversize', data: null, bytes: raw.length };
    }
    try {
      const parsed = JSON.parse(raw);
      if (!Save.isPlainObject(parsed)) return { status: 'corrupt', data: null };
      const version = Number(parsed.schemaVersion) || 1;
      if (version > Save.SCHEMA_VERSION) {
        console.warn(`El guardado usa una versión futura (${version}).`);
        return { status: 'future', data: null, version };
      }
      const migrated = Save.migrate(parsed);
      return migrated
        ? { status: 'valid', data: migrated, version }
        : { status: 'corrupt', data: null };
    } catch (e) {
      console.warn('Se ignoró un guardado dañado:', e);
      return { status: 'corrupt', data: null };
    }
  },

  inspectCurrent: () => {
    try {
      return Save.inspect(localStorage.getItem(Save.KEY));
    } catch (e) {
      return { status: 'corrupt', data: null };
    }
  },

  hasIncompatibleCurrent: () => {
    const status = Save.inspectCurrent().status;
    return status === 'future' || status === 'oversize';
  },

  parse: (raw) => Save.inspect(raw).data,

  save: (data) => {
    try {
      // Un cliente antiguo no debe destruir un guardado creado por una
      // versión más nueva, ni siquiera mediante el autoguardado.
      if (Save.hasIncompatibleCurrent()) {
        console.warn('No se sobrescribió el guardado de una versión futura.');
        return false;
      }
      const encoded = JSON.stringify(Save.prepare(data));
      if (encoded.length > Save.MAX_BYTES) throw new Error('El guardado es demasiado grande.');
      localStorage.setItem(Save.KEY, encoded);
      return true;
    } catch (e) {
      console.warn('No se pudo guardar:', e);
      return false;
    }
  },

  load: () => {
    try {
      const current = Save.inspectCurrent();
      if (current.status === 'valid') return current.data;
      // Un formato futuro es un slot válido pero incompatible. No se intenta
      // recuperar desde legacy porque eso sobrescribiría datos más recientes.
      if (current.status === 'future' || current.status === 'oversize') {
        return null;
      }

      for (const key of Save.LEGACY_KEYS) {
        const migrated = Save.parse(localStorage.getItem(key));
        if (!migrated) continue;
        // La migración es recuperable: solo se elimina la copia antigua cuando
        // la escritura del nuevo formato ha terminado correctamente.
        if (Save.save(migrated)) {
          try { localStorage.removeItem(key); } catch (_) {}
        }
        return migrated;
      }
      return null;
    } catch (e) {
      console.warn('No se pudo cargar:', e);
      return null;
    }
  },

  exists: () => {
    try {
      const current = Save.inspectCurrent();
      if (current.status === 'valid' ||
          current.status === 'future' ||
          current.status === 'oversize') return true;
      return Save.LEGACY_KEYS.some(key => !!Save.parse(localStorage.getItem(key)));
    } catch (e) {
      return false;
    }
  },

  clear: () => {
    try {
      localStorage.removeItem(Save.KEY);
      for (const key of Save.LEGACY_KEYS) localStorage.removeItem(key);
    } catch (e) {
      console.warn('No se pudo borrar el guardado:', e);
    }
  },

  saveBest: (score) => {
    try {
      const cleanScore = Math.max(0, Number(score) || 0);
      const prev = Save.loadBest();
      if (cleanScore > prev) localStorage.setItem(Save.BEST, String(cleanScore));
    } catch (e) {
      console.warn('No se pudo guardar la puntuación:', e);
    }
  },

  loadBest: () => {
    try {
      const score = Number(localStorage.getItem(Save.BEST));
      return Number.isFinite(score) && score > 0 ? score : 0;
    } catch (e) {
      return 0;
    }
  },

  normalizePrefs: (prefs) => ({
    sound: Save.isPlainObject(prefs) ? prefs.sound !== false : true
  }),

  savePrefs: (prefs) => {
    try {
      localStorage.setItem(Save.PREFS, JSON.stringify(Save.normalizePrefs(prefs)));
      return true;
    } catch (e) {
      console.warn('No se pudieron guardar las preferencias:', e);
      return false;
    }
  },

  loadPrefs: () => {
    const keys = [Save.PREFS, ...Save.LEGACY_PREFS];
    for (const key of keys) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw || raw.length > 4096) continue;
        const parsed = JSON.parse(raw);
        if (!Save.isPlainObject(parsed)) continue;
        const prefs = Save.normalizePrefs(parsed);
        if (key !== Save.PREFS) Save.savePrefs(prefs);
        return prefs;
      } catch (_) {
        // Se prueba la siguiente versión y, si ninguna sirve, los valores seguros.
      }
    }
    return { sound: true };
  },

  autosave: () => {
    if (Save.autosaveInProgress ||
        typeof Save.autosaveProvider !== 'function' ||
        (typeof Save.autosaveAllowed === 'function' && !Save.autosaveAllowed())) return false;
    Save.autosaveInProgress = true;
    try {
      return Save.save(Save.autosaveProvider());
    } catch (e) {
      console.warn('No se pudo realizar el autoguardado:', e);
      return false;
    } finally {
      Save.autosaveInProgress = false;
    }
  },

  // Hook desacoplado: main.js aporta el proveedor; Save no conoce a Game.
  bindAutosave: (provider, allowed) => {
    Save.autosaveProvider = provider;
    Save.autosaveAllowed = allowed;
    if (Save.autosaveBound || typeof window === 'undefined' || typeof document === 'undefined') return;
    Save.autosaveBound = true;
    window.addEventListener('pagehide', Save.autosave);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' || document.hidden) Save.autosave();
    });
  }
};
