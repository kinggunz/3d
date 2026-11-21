/* Sistem map berbasis FILE.
   Semua map ada di folder  maps/  (di dalam APK: assets/public/maps/).
   - maps/index.json  : daftar nama file map
   - maps/<nama>.json : satu file = satu map
   Untuk update/tambah map lewat ZArchiver: buka APK, masuk assets/public/maps/, letakkan file .json baru
   (atau ganti yang lama), tambahkan namanya di index.json, lalu pasang ulang APK. Map langsung muncul di daftar. */
const BUILTIN = [
  { id: 'war', type: 'war', name: 'PETUALANGAN WAR', desc: 'Map istana · PvP · Server resmi', bots: {} },
  { id: 'drig', type: 'drig', name: 'DRIG BIGE 3D SANTAY', desc: 'Balap motor · kota besar · modif motor', seed: 52026111, shard: 'drig', city: {} },
];
export let MAPS = BUILTIN.slice();

const str = (v, d, n) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : d);
const num = (v, a, b, d) => (typeof v === 'number' && isFinite(v) ? Math.max(a, Math.min(b, v)) : d);
const arr = (v, max) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, max) : null);

function norm(m, file) {
  if (!m || typeof m !== 'object') return null;
  const type = m.type === 'war' || m.type === 'drig' ? m.type : null;
  if (!type) return null;
  const id = str(m.id, file.replace(/\.json$/i, ''), 24).replace(/[^a-z0-9_-]/gi, '').toLowerCase() || 'map';
  const o = { id, file, type, name: str(m.name, id.toUpperCase(), 40), desc: str(m.desc, '', 70) };
  if (type === 'war') {
    const b = m.bots || {};
    o.bots = {
      count: num(b.count, 0, 16, 8), dmgPlayer: num(b.dmgPlayer, 0, 40, 6), dmgBot: num(b.dmgBot, 0, 40, 10),
      reward: num(b.reward, 0, 5000, 150), chatEvery: [num(b.chatEvery && b.chatEvery[0], 4, 300, 18), num(b.chatEvery && b.chatEvery[1], 5, 600, 48)],
      names: arr(b.names, 60), tails: arr(b.tails, 30), say: arr(b.say, 60), hi: arr(b.hi, 20), ok: arr(b.ok, 20),
    };
  } else {
    o.seed = Math.floor(num(m.seed, 1, 2e9, 52026111));
    o.shard = str(m.shard, 'drig', 10).replace(/[^a-z0-9]/gi, '').toLowerCase() || 'drig';
    o.hour = num(m.hour, 0.3, 0.46, 0.38); /* siang saja */
    o.speedMul = num(m.speedMul, 0.6, 1.6, 1);
    const c = m.city || {};
    o.city = {
      seed: Math.floor(num(c.seed, 1, 2e9, 5201)), heightMul: num(c.heightMul, 0.3, 2, 1),
      treeEvery: c.treeEvery === 0 ? 0 : num(c.treeEvery, 12, 120, 30), cars: num(c.cars, 0, 1, 0.7),
      colors: c.colors && typeof c.colors === 'object' ? c.colors : {},
      styles: Array.isArray(c.styles) ? c.styles.filter((s) => Array.isArray(s) && s.length >= 3).slice(0, 12) : null,
    };
  }
  return o;
}

export async function loadMaps() {
  try {
    const base = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) || './';
    const idx = await (await fetch(base + 'maps/index.json', { cache: 'no-store' })).json();
    const out = [], seen = new Set();
    for (const f of (idx.maps || []).slice(0, 24)) {
      if (typeof f !== 'string' || !/^[\w.-]+\.json$/.test(f)) continue;
      try {
        const m = norm(await (await fetch(base + 'maps/' + f, { cache: 'no-store' })).json(), f);
        if (m && !seen.has(m.id)) { seen.add(m.id); out.push(m); }
      } catch (e) { /* file rusak: lewati */ }
    }
    if (out.length) MAPS = out;
  } catch (e) { /* pakai bawaan */ }
  return MAPS;
}
export const mapById = (id) => MAPS.find((m) => m.id === id);
