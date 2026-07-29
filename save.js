/*****************************************************
 * save.js - Guardado en localStorage
 *****************************************************/

const Save = {
  KEY: 'aladeriva3d_save_v1',
  BEST: 'aladeriva3d_best_v1',
  PREFS: 'aladeriva3d_prefs_v1',
  save: (data) => {
    try { localStorage.setItem(Save.KEY, JSON.stringify(data)); return true; }
    catch (e) { console.warn('No se pudo guardar:', e); return false; }
  },
  load: () => {
    try { const raw = localStorage.getItem(Save.KEY); return raw ? JSON.parse(raw) : null; }
    catch (e) { console.warn('No se pudo cargar:', e); return null; }
  },
  exists: () => {
    try { return !!localStorage.getItem(Save.KEY); }
    catch (e) { return false; }
  },
  clear: () => {
    try { localStorage.removeItem(Save.KEY); }
    catch (e) { console.warn('No se pudo borrar el guardado:', e); }
  },
  saveBest: (score) => {
    try {
      const prev = Save.loadBest();
      if (score > prev) localStorage.setItem(Save.BEST, String(score));
    } catch (e) { console.warn('No se pudo guardar la puntuación:', e); }
  },
  loadBest: () => {
    try {
      const v = localStorage.getItem(Save.BEST);
      const score = v ? Number(v) : 0;
      return Number.isFinite(score) ? score : 0;
    } catch (e) { return 0; }
  },
  savePrefs: (prefs) => {
    try { localStorage.setItem(Save.PREFS, JSON.stringify(prefs)); }
    catch (e) { console.warn('No se pudieron guardar las preferencias:', e); }
  },
  loadPrefs: () => {
    try { const raw = localStorage.getItem(Save.PREFS); return raw ? JSON.parse(raw) : { sound: true }; }
    catch (e) { return { sound: true }; }
  }
};
