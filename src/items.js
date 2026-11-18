/* Data item, alat, dan resep crafting */

export const ITEMS = {
  kayu: 'Kayu', batu: 'Batu', serat: 'Serat', tali: 'Tali', papan: 'Papan', tanah: 'Tanah',
  bijih: 'Bijih Besi', batubara: 'Batu Bara', besi: 'Besi',
  buah: 'Buah Beri', daging: 'Daging Mentah', matang: 'Daging Matang', ikan: 'Ikan Mentah', ikanmatang: 'Ikan Bakar', sup: 'Sup Lezat',
  cacing: 'Umpan Cacing', obor: 'Obor',
  kapak: 'Kapak', kapakbesi: 'Kapak Besi', beliung: 'Beliung', beliungbesi: 'Beliung Besi', sekop: 'Sekop',
  pedang: 'Pedang Batu', pedangbesi: 'Pedang Besi', tombak: 'Tombak', pancing: 'Pancing', ember: 'Ember', panci: 'Panci',
};

export const ICON = {
  kayu: '🪵', batu: '🪨', serat: '🌿', tali: '🧵', papan: '🟫', tanah: '🟤',
  bijih: '🟠', batubara: '⚫', besi: '🔩',
  buah: '🫐', daging: '🥩', matang: '🍖', ikan: '🐟', ikanmatang: '🍤', sup: '🍲',
  cacing: '🪱', obor: '🔦',
  kapak: '🪓', kapakbesi: '🪓', beliung: '⛏️', beliungbesi: '⛏️', sekop: '🥄',
  pedang: '🗡️', pedangbesi: '⚔️', tombak: '🔱', pancing: '🎣', ember: '🪣', panci: '🍳',
};

/* item yang menumpuk & dihitung ke kapasitas tas */
export const STACK = ['kayu', 'batu', 'serat', 'tali', 'papan', 'tanah', 'bijih', 'batubara', 'besi', 'buah', 'daging', 'matang', 'ikan', 'ikanmatang', 'sup', 'cacing', 'obor'];
/* alat (dimiliki 0/1) */
export const TOOLS = ['kapak', 'kapakbesi', 'beliung', 'beliungbesi', 'sekop', 'pedang', 'pedangbesi', 'tombak', 'pancing', 'ember', 'panci'];
/* yang bisa dipegang di tangan (hotbar) */
export const EQUIP = ['kapak', 'kapakbesi', 'beliung', 'beliungbesi', 'sekop', 'pedang', 'pedangbesi', 'tombak', 'pancing', 'ember', 'obor'];

export const CAP_BAG = 120;
export const CAP_CART = 400;

/* kekuatan tiap alat: tree/rock/ore = damage ke node, animal = damage ke hewan, dig = bisa menggali */
export const TOOL = {
  tangan: { tree: 1.5, rock: 1, ore: 0, animal: 1 },
  kapak: { tree: 3, rock: 2, ore: 0, animal: 2 },
  kapakbesi: { tree: 5, rock: 3, ore: 0, animal: 3 },
  beliung: { tree: 1.5, rock: 3, ore: 3, animal: 1.5 },
  beliungbesi: { tree: 2, rock: 5, ore: 5, animal: 2 },
  sekop: { tree: 1.5, rock: 1, ore: 0, animal: 1.5, dig: 1 },
  pedang: { tree: 1.5, rock: 1, ore: 0, animal: 6 },
  pedangbesi: { tree: 2, rock: 1, ore: 0, animal: 9 },
  tombak: { tree: 1.5, rock: 1, ore: 0, animal: 4 },
  pancing: { tree: 1, rock: 1, ore: 0, animal: 1 },
  ember: { tree: 1, rock: 1, ore: 0, animal: 1 },
  obor: { tree: 1, rock: 1, ore: 0, animal: 2 },
};

/* resep crafting (tab di Tas) */
export const CRAFT = [
  { id: 'tali', cat: 'Bahan', n: 'Tali', give: { tali: 1 }, cost: { serat: 3 } },
  { id: 'papan', cat: 'Bahan', n: 'Papan x2', give: { papan: 2 }, cost: { kayu: 3 } },
  { id: 'obor', cat: 'Cahaya', n: 'Obor x2', give: { obor: 2 }, cost: { kayu: 1, serat: 1 } },

  { id: 'kapak', cat: 'Alat', tool: true, n: 'Kapak', cost: { kayu: 5, batu: 3 } },
  { id: 'beliung', cat: 'Alat', tool: true, n: 'Beliung (tambang)', cost: { kayu: 3, batu: 3, tali: 1 } },
  { id: 'sekop', cat: 'Alat', tool: true, n: 'Sekop', cost: { kayu: 3, batu: 2, tali: 1 } },
  { id: 'pancing', cat: 'Alat', tool: true, n: 'Pancing', cost: { kayu: 2, tali: 3 } },
  { id: 'ember', cat: 'Alat', tool: true, n: 'Ember', cost: { papan: 3, tali: 1 } },
  { id: 'panci', cat: 'Alat', tool: true, n: 'Panci', cost: { besi: 3 } },
  { id: 'kapakbesi', cat: 'Alat', tool: true, n: 'Kapak Besi', cost: { kayu: 2, besi: 3, tali: 1 } },
  { id: 'beliungbesi', cat: 'Alat', tool: true, n: 'Beliung Besi', cost: { kayu: 2, besi: 3, tali: 1 } },

  { id: 'tombak', cat: 'Senjata', tool: true, n: 'Tombak', cost: { kayu: 4, batu: 2, serat: 2 } },
  { id: 'pedang', cat: 'Senjata', tool: true, n: 'Pedang Batu', cost: { kayu: 2, batu: 4, tali: 1 } },
  { id: 'pedangbesi', cat: 'Senjata', tool: true, n: 'Pedang Besi', cost: { kayu: 1, besi: 4, tali: 1 } },

  { id: 'gerobak', cat: 'Angkut', cart: true, n: 'Gerobak', cost: { papan: 6, besi: 2, tali: 2 } },
];

export const CRAFT_CATS = ['Bahan', 'Alat', 'Senjata', 'Cahaya', 'Angkut', 'Bangun'];

export const costText = (cost) => {
  const s = Object.keys(cost).map((k) => `${cost[k]} ${ITEMS[k] || k}`).join(', ');
  return s || 'Gratis';
};
