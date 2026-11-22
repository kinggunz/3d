/* Daftar dunia buatan pemain (disimpan di perangkat). Tiap dunia punya save sendiri. */
const LIST_KEY = 'ps_worlds_v1';
const SAVE_PREFIX = 'ps_world_';
const LEGACY_KEY = 'ps_save_v1';
export const MAX_WORLDS = 10;

const rd = (k, d) => {
  try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; }
};
const wr = (k, v) => {
  try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; }
};

export function listWorlds() {
  let list = rd(LIST_KEY, null);
  if (!Array.isArray(list)) {
    list = [];
    /* pindahkan save lama (mode Offline versi sebelumnya) jadi satu dunia */
    const old = rd(LEGACY_KEY, null);
    if (old && typeof old === 'object') {
      const w = { id: 'w' + Date.now().toString(36), name: 'Dunia Lama', seed: old.seed || ((Math.random() * 1e9) | 0), created: Date.now(), last: Date.now(), day: old.day || 1 };
      if (wr(SAVE_PREFIX + w.id, old)) {
        list.push(w);
        try { localStorage.removeItem(LEGACY_KEY); } catch (e) { /* abaikan */ }
      }
    }
    wr(LIST_KEY, list);
  }
  return list.slice().sort((a, b) => (b.last || 0) - (a.last || 0));
}

export function createWorld(name, mode) {
  const list = listWorlds();
  if (list.length >= MAX_WORLDS) throw new Error('Maksimal ' + MAX_WORLDS + ' dunia. Hapus satu dulu.');
  const w = {
    id: 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    name: name.trim().slice(0, 16),
    seed: ((Math.random() * 1e9) | 0) + 1,
    mode: mode === 'creative' ? 'creative' : 'survival',
    created: Date.now(),
    last: Date.now(),
    day: 1,
  };
  list.push(w);
  if (!wr(LIST_KEY, list)) throw new Error('Penyimpanan penuh / tidak bisa menyimpan dunia.');
  return w;
}

export function deleteWorld(id) {
  const list = listWorlds().filter((w) => w.id !== id);
  wr(LIST_KEY, list);
  try { localStorage.removeItem(SAVE_PREFIX + id); } catch (e) { /* abaikan */ }
}

export function loadSave(id) {
  return rd(SAVE_PREFIX + id, null);
}

export function writeSave(id, data, day) {
  const ok = wr(SAVE_PREFIX + id, data);
  const list = rd(LIST_KEY, []);
  const w = list.find((x) => x.id === id);
  if (w) {
    w.last = Date.now();
    if (day) w.day = day;
    wr(LIST_KEY, list);
  }
  return ok;
}
