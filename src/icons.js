/* Ikon vektor digambar dengan canvas (pengganti emoji). Setiap ikon = fungsi gambar di kotak 64x64. */
const INK = '#1b1410';

/* ---- pembantu gambar ---- */
const st = (g) => { g.lineJoin = 'round'; g.lineCap = 'round'; g.strokeStyle = INK; g.lineWidth = 3; };
const fillStroke = (g, fill) => { if (fill) { g.fillStyle = fill; g.fill(); } g.stroke(); };
const poly = (g, pts, fill) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); fillStroke(g, fill); };
const rr = (g, x, y, w, h, r, fill) => {
  g.beginPath();
  g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath(); fillStroke(g, fill);
};
const ci = (g, x, y, r, fill) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); fillStroke(g, fill); };
const ln = (g, x1, y1, x2, y2, w, col) => {
  g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2);
  const ow = g.lineWidth, os = g.strokeStyle;
  g.lineWidth = w || ow; g.strokeStyle = col || os; g.stroke(); g.lineWidth = ow; g.strokeStyle = os;
};
const nostroke = (g, fn) => { const os = g.strokeStyle; g.strokeStyle = 'rgba(0,0,0,0)'; fn(); g.strokeStyle = os; };
const WOOD = '#a8743c', WOOD2 = '#7a4f24', STONE = '#9aa1a8', STONE2 = '#6c737a', IRON = '#c3cbd3', IRON2 = '#8794a0', RED = '#e0453a', GOLD = '#ffc247', GREEN = '#4caf50', BLUE = '#3fa0e8';

/* gagang + kepala alat: gagang diagonal dari kiri-bawah ke kanan-atas */
const handle = (g, col) => { ln(g, 12, 54, 46, 16, 9, INK); ln(g, 12, 54, 46, 16, 5, col || WOOD); };

const D = {
  /* ---------- UI ---------- */
  heart(g) { g.beginPath(); g.moveTo(32, 56); g.bezierCurveTo(4, 36, 6, 10, 24, 12); g.bezierCurveTo(29, 13, 32, 17, 32, 20); g.bezierCurveTo(32, 17, 35, 13, 40, 12); g.bezierCurveTo(58, 10, 60, 36, 32, 56); g.closePath(); fillStroke(g, RED); ci(g, 20, 22, 4, 'rgba(255,255,255,.55)'); },
  drop(g) { g.beginPath(); g.moveTo(32, 6); g.bezierCurveTo(48, 28, 54, 36, 54, 42); g.arc(32, 42, 22, 0, Math.PI, false); g.bezierCurveTo(10, 36, 16, 28, 32, 6); g.closePath(); fillStroke(g, BLUE); ci(g, 24, 44, 4, 'rgba(255,255,255,.6)'); },
  meat(g) { ln(g, 26, 38, 12, 52, 7, INK); ln(g, 26, 38, 12, 52, 3.5, '#f4ecd8'); ci(g, 9, 49, 5, '#f4ecd8'); ci(g, 14, 55, 5, '#f4ecd8'); g.beginPath(); g.ellipse(38, 27, 20, 17, -0.7, 0, Math.PI * 2); fillStroke(g, '#c9573a'); g.beginPath(); g.ellipse(34, 23, 8, 5, -0.7, 0, Math.PI * 2); g.fillStyle = 'rgba(255,200,170,.55)'; g.fill(); },
  bag(g) {
    rr(g, 14, 6, 36, 12, 6, '#b3322a');
    rr(g, 10, 14, 44, 44, 12, RED);
    rr(g, 16, 36, 32, 16, 5, '#b3322a');
    ln(g, 32, 40, 32, 48, 3, INK); ci(g, 32, 44, 2.5, GOLD);
    g.beginPath(); g.moveTo(14, 28); g.quadraticCurveTo(32, 36, 50, 28); g.stroke();
    rr(g, 26, 2, 12, 8, 4, null);
  },
  pause(g) { rr(g, 14, 10, 14, 44, 4, '#fff'); rr(g, 36, 10, 14, 44, 4, '#fff'); },
  mic(g) { rr(g, 22, 6, 20, 32, 10, '#e9edf2'); ln(g, 26, 16, 38, 16, 2.5); ln(g, 26, 22, 38, 22, 2.5); ln(g, 26, 28, 38, 28, 2.5); g.beginPath(); g.moveTo(14, 28); g.bezierCurveTo(14, 52, 50, 52, 50, 28); g.stroke(); ln(g, 32, 46, 32, 56, 3); ln(g, 22, 57, 42, 57, 3); },
  chat(g) { g.beginPath(); g.moveTo(10, 14); g.lineTo(54, 14); g.quadraticCurveTo(58, 14, 58, 18); g.lineTo(58, 40); g.quadraticCurveTo(58, 44, 54, 44); g.lineTo(32, 44); g.lineTo(18, 56); g.lineTo(20, 44); g.lineTo(10, 44); g.quadraticCurveTo(6, 44, 6, 40); g.lineTo(6, 18); g.quadraticCurveTo(6, 14, 10, 14); g.closePath(); fillStroke(g, '#fff'); ci(g, 20, 29, 3.5, INK); ci(g, 32, 29, 3.5, INK); ci(g, 44, 29, 3.5, INK); },
  fist(g) {
    rr(g, 12, 26, 38, 28, 9, '#f2c28f');
    for (let i = 0; i < 4; i++) rr(g, 13 + i * 9, 14 + (i % 2 ? 1 : 0), 9, 20, 4.5, '#f2c28f');
    rr(g, 44, 28, 14, 10, 5, '#f2c28f');
    ln(g, 20, 36, 46, 36, 2, 'rgba(120,70,30,.6)');
  },
  jump(g) { g.beginPath(); g.moveTo(12, 52); g.bezierCurveTo(12, 30, 26, 24, 42, 24); g.stroke(); g.lineWidth = 6; g.strokeStyle = '#fff'; g.stroke(); st(g); poly(g, [[40, 8], [58, 24], [40, 40]], '#fff'); },
  crouch(g) { ci(g, 36, 12, 8, '#f2c28f'); g.lineWidth = 8; g.strokeStyle = INK; g.beginPath(); g.moveTo(34, 22); g.lineTo(30, 38); g.lineTo(46, 42); g.lineTo(46, 56); g.stroke(); g.beginPath(); g.moveTo(30, 38); g.lineTo(18, 56); g.stroke(); g.lineWidth = 4.5; g.strokeStyle = '#ff9d3c'; g.beginPath(); g.moveTo(34, 22); g.lineTo(30, 38); g.stroke(); g.strokeStyle = '#3f6fd0'; g.beginPath(); g.moveTo(30, 38); g.lineTo(46, 42); g.lineTo(46, 56); g.stroke(); g.beginPath(); g.moveTo(30, 38); g.lineTo(18, 56); g.stroke(); st(g); },
  hammer(g) { handle(g, WOOD); poly(g, [[30, 6], [56, 20], [50, 32], [24, 18]], IRON); ln(g, 30, 10, 52, 22, 2, 'rgba(255,255,255,.7)'); },
  rotate(g) { g.beginPath(); g.arc(32, 32, 20, Math.PI * 0.15, Math.PI * 1.55); g.stroke(); g.lineWidth = 6; g.strokeStyle = '#fff'; g.stroke(); st(g); poly(g, [[42, 4], [58, 20], [38, 24]], '#fff'); },
  book(g) { g.beginPath(); g.moveTo(32, 14); g.quadraticCurveTo(20, 8, 6, 12); g.lineTo(6, 52); g.quadraticCurveTo(20, 48, 32, 56); g.quadraticCurveTo(44, 48, 58, 52); g.lineTo(58, 12); g.quadraticCurveTo(44, 8, 32, 14); g.closePath(); fillStroke(g, '#f6eccb'); ln(g, 32, 14, 32, 56, 3); for (let i = 0; i < 3; i++) { ln(g, 12, 22 + i * 8, 26, 24 + i * 8, 2.5, '#8a6a3a'); ln(g, 38, 24 + i * 8, 52, 22 + i * 8, 2.5, '#8a6a3a'); } },
  gear(g) { g.beginPath(); for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, b = a + Math.PI / 8; g.lineTo(32 + Math.cos(a - 0.2) * 22, 32 + Math.sin(a - 0.2) * 22); g.lineTo(32 + Math.cos(a + 0.2) * 22, 32 + Math.sin(a + 0.2) * 22); g.lineTo(32 + Math.cos(b - 0.2) * 16, 32 + Math.sin(b - 0.2) * 16); g.lineTo(32 + Math.cos(b + 0.2) * 16, 32 + Math.sin(b + 0.2) * 16); } g.closePath(); fillStroke(g, '#b7c0c9'); ci(g, 32, 32, 7, '#5b6670'); },
  globe(g) { ci(g, 32, 32, 24, '#3d8fe0'); g.save(); g.beginPath(); g.arc(32, 32, 24, 0, 7); g.clip(); g.fillStyle = '#58b86a'; g.beginPath(); g.moveTo(14, 20); g.quadraticCurveTo(26, 10, 30, 22); g.quadraticCurveTo(24, 34, 18, 32); g.closePath(); g.fill(); g.beginPath(); g.moveTo(38, 34); g.quadraticCurveTo(54, 28, 52, 44); g.quadraticCurveTo(42, 54, 36, 46); g.closePath(); g.fill(); g.restore(); ci(g, 32, 32, 24, null); },
  chest(g) { rr(g, 8, 24, 48, 30, 5, WOOD); g.beginPath(); g.moveTo(8, 26); g.quadraticCurveTo(8, 8, 32, 8); g.quadraticCurveTo(56, 8, 56, 26); g.closePath(); fillStroke(g, '#c08a4a'); ln(g, 8, 28, 56, 28, 3); rr(g, 27, 24, 10, 12, 3, GOLD); },
  save(g) { rr(g, 8, 8, 48, 48, 6, '#4a7bd6'); rr(g, 16, 8, 30, 18, 2, '#e6ecf5'); rr(g, 36, 11, 6, 11, 1, '#4a7bd6'); rr(g, 14, 34, 36, 22, 3, '#f4f6fa'); ln(g, 20, 42, 44, 42, 2.5, '#9aa6b8'); ln(g, 20, 48, 40, 48, 2.5, '#9aa6b8'); },
  sliders(g) { for (let i = 0; i < 3; i++) { const y = 14 + i * 18; ln(g, 8, y, 56, y, 4); ci(g, [20, 42, 28][i], y, 7, '#ffc247'); } },
  close(g) { g.lineWidth = 9; g.strokeStyle = INK; g.beginPath(); g.moveTo(16, 16); g.lineTo(48, 48); g.moveTo(48, 16); g.lineTo(16, 48); g.stroke(); g.lineWidth = 5; g.strokeStyle = '#fff'; g.stroke(); st(g); },
  play(g) { poly(g, [[16, 8], [54, 32], [16, 56]], '#fff'); },
  trash(g) { rr(g, 14, 20, 36, 38, 6, '#c7cdd4'); rr(g, 10, 12, 44, 8, 3, '#9da6af'); rr(g, 24, 5, 16, 8, 3, '#9da6af'); for (let i = 0; i < 3; i++) ln(g, 24 + i * 8, 28, 24 + i * 8, 50, 3); },
  plus(g) { g.lineWidth = 11; g.strokeStyle = INK; g.beginPath(); g.moveTo(32, 10); g.lineTo(32, 54); g.moveTo(10, 32); g.lineTo(54, 32); g.stroke(); g.lineWidth = 6; g.strokeStyle = '#fff'; g.stroke(); st(g); },
  back(g) { g.lineWidth = 10; g.strokeStyle = INK; g.beginPath(); g.moveTo(40, 10); g.lineTo(18, 32); g.lineTo(40, 54); g.stroke(); g.lineWidth = 5; g.strokeStyle = '#fff'; g.stroke(); st(g); },
  sun(g) { for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; ln(g, 32 + Math.cos(a) * 20, 32 + Math.sin(a) * 20, 32 + Math.cos(a) * 28, 32 + Math.sin(a) * 28, 4, '#ffb61e'); } ci(g, 32, 32, 14, '#ffd54a'); },
  moon(g) { g.beginPath(); g.arc(32, 32, 24, 0.6, Math.PI * 2 - 0.6); g.bezierCurveTo(30, 40, 30, 22, 46, 16); g.closePath(); fillStroke(g, '#f2eecb'); },
  dusk(g) { g.save(); g.beginPath(); g.rect(0, 0, 64, 42); g.clip(); for (let i = 0; i < 7; i++) { const a = Math.PI + (i / 6) * Math.PI; ln(g, 32 + Math.cos(a) * 18, 42 + Math.sin(a) * 18, 32 + Math.cos(a) * 28, 42 + Math.sin(a) * 28, 4, '#ff9a3c'); } ci(g, 32, 42, 13, '#ff8a3c'); g.restore(); ln(g, 4, 43, 60, 43, 4); },
  users(g) { ci(g, 22, 20, 9, '#f2c28f'); g.beginPath(); g.moveTo(6, 54); g.quadraticCurveTo(6, 32, 22, 32); g.quadraticCurveTo(38, 32, 38, 54); g.closePath(); fillStroke(g, '#4a7bd6'); ci(g, 44, 24, 8, '#f2c28f'); g.beginPath(); g.moveTo(34, 54); g.quadraticCurveTo(36, 36, 46, 36); g.quadraticCurveTo(58, 36, 58, 54); g.closePath(); fillStroke(g, '#e0883a'); },
  cave(g) { poly(g, [[2, 56], [24, 10], [34, 28], [42, 18], [62, 56]], '#7a8590'); g.beginPath(); g.moveTo(22, 56); g.lineTo(22, 40); g.quadraticCurveTo(32, 26, 42, 40); g.lineTo(42, 56); g.closePath(); fillStroke(g, '#14101c'); },
  arrow(g) { poly(g, [[32, 4], [54, 34], [40, 34], [40, 58], [24, 58], [24, 34], [10, 34]], '#ffd36b'); },
  cart(g) { poly(g, [[6, 20], [58, 20], [50, 42], [14, 42]], WOOD); ln(g, 6, 20, 0, 12, 3.5); ci(g, 24, 50, 8, '#5a3a1c'); ci(g, 24, 50, 2.5, '#d9b27a'); ln(g, 14, 28, 50, 28, 2, WOOD2); },
  eat(g) { D.meat(g); },
  wake(g) { rr(g, 4, 34, 56, 14, 4, '#d8584c'); rr(g, 4, 28, 18, 12, 6, '#f4ecd8'); rr(g, 4, 48, 6, 8, 2, WOOD2); rr(g, 54, 48, 6, 8, 2, WOOD2); },
  door(g) { rr(g, 14, 4, 36, 56, 4, WOOD); rr(g, 20, 10, 24, 20, 2, '#c08a4a'); rr(g, 20, 34, 24, 20, 2, '#c08a4a'); ci(g, 42, 34, 3, GOLD); },
  anchor(g) { ci(g, 32, 12, 6, null); ln(g, 32, 18, 32, 54, 5); ln(g, 22, 26, 42, 26, 5); g.beginPath(); g.arc(32, 38, 20, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke(); g.lineWidth = 6; g.stroke(); st(g); g.lineWidth = 3; },
  wheel(g) { ci(g, 32, 32, 20, null); g.lineWidth = 7; g.strokeStyle = INK; g.beginPath(); g.arc(32, 32, 20, 0, 7); g.stroke(); g.lineWidth = 3.5; g.strokeStyle = WOOD; g.stroke(); st(g); for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; ln(g, 32 + Math.cos(a) * 20, 32 + Math.sin(a) * 20, 32 + Math.cos(a) * 29, 32 + Math.sin(a) * 29, 5, INK); ln(g, 32 + Math.cos(a) * 20, 32 + Math.sin(a) * 20, 32 + Math.cos(a) * 28, 32 + Math.sin(a) * 28, 2.5, WOOD); } ci(g, 32, 32, 7, GOLD); },
  fire(g) { g.beginPath(); g.moveTo(32, 4); g.bezierCurveTo(40, 18, 56, 26, 52, 42); g.bezierCurveTo(50, 56, 38, 60, 32, 60); g.bezierCurveTo(24, 60, 12, 54, 12, 40); g.bezierCurveTo(12, 30, 20, 26, 22, 16); g.bezierCurveTo(28, 22, 30, 14, 32, 4); g.closePath(); fillStroke(g, '#ff8a2a'); g.beginPath(); g.moveTo(32, 30); g.bezierCurveTo(38, 38, 44, 42, 40, 50); g.bezierCurveTo(38, 56, 26, 56, 24, 48); g.bezierCurveTo(22, 42, 30, 38, 32, 30); g.closePath(); g.fillStyle = '#ffe27a'; g.fill(); },
  home(g) { poly(g, [[4, 32], [32, 8], [60, 32]], '#c4452e'); rr(g, 12, 30, 40, 28, 2, '#e8c690'); rr(g, 26, 40, 12, 18, 2, WOOD2); },

  /* ---------- BAHAN ---------- */
  kayu(g) { g.beginPath(); g.ellipse(32, 44, 22, 8, 0, 0, Math.PI * 2); g.fillStyle = WOOD2; g.fill(); rr(g, 10, 22, 44, 22, 2, WOOD); g.beginPath(); g.ellipse(32, 22, 22, 9, 0, 0, Math.PI * 2); fillStroke(g, '#d9a566'); g.beginPath(); g.ellipse(32, 22, 11, 4.5, 0, 0, Math.PI * 2); g.stroke(); ln(g, 14, 32, 50, 32, 2, WOOD2); },
  batu(g) { poly(g, [[6, 50], [10, 28], [26, 12], [44, 16], [58, 34], [54, 52]], STONE); poly(g, [[26, 12], [44, 16], [58, 34], [36, 30]], '#c3c9cf'); ln(g, 14, 44, 30, 38, 2, STONE2); },
  serat(g) { for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(32, 58); g.quadraticCurveTo(32 + (i - 2) * 12, 34, 32 + (i - 2) * 18, 8 + Math.abs(i - 2) * 4); g.lineWidth = 6; g.strokeStyle = INK; g.stroke(); g.lineWidth = 3; g.strokeStyle = ['#7cc24f', '#9ad45e', '#6bb040', '#8bcf56', '#7cc24f'][i]; g.stroke(); } st(g); },
  tali(g) { g.lineWidth = 9; g.strokeStyle = INK; g.beginPath(); g.arc(32, 32, 18, 0, 7); g.stroke(); g.lineWidth = 5; g.strokeStyle = '#d9b77a'; g.stroke(); g.lineWidth = 2; g.strokeStyle = '#8a6a3a'; g.setLineDash([3, 5]); g.stroke(); g.setLineDash([]); st(g); },
  papan(g) { rr(g, 6, 8, 52, 14, 2, '#d2995a'); rr(g, 6, 25, 52, 14, 2, '#c2874a'); rr(g, 6, 42, 52, 14, 2, '#d2995a'); ln(g, 14, 15, 30, 15, 2, WOOD2); ln(g, 30, 32, 48, 32, 2, WOOD2); ln(g, 12, 49, 26, 49, 2, WOOD2); },
  tanah(g) { g.beginPath(); g.moveTo(6, 54); g.quadraticCurveTo(10, 16, 32, 14); g.quadraticCurveTo(54, 16, 58, 54); g.closePath(); fillStroke(g, '#8a5a34'); ci(g, 26, 40, 3, '#5a3a1c'); ci(g, 40, 34, 3, '#5a3a1c'); ci(g, 34, 48, 3, '#5a3a1c'); },
  bijih(g) { D.batu(g); ci(g, 24, 30, 5, '#e8863a'); ci(g, 40, 38, 6, '#e8863a'); ci(g, 20, 44, 4, '#c4631f'); },
  batubara(g) { poly(g, [[8, 48], [12, 26], [28, 10], [46, 16], [58, 34], [52, 52]], '#3a3d44'); poly(g, [[28, 10], [46, 16], [58, 34], [38, 30]], '#5a5e68'); ln(g, 18, 40, 28, 34, 2.5, '#8a8e98'); },
  besi(g) { poly(g, [[6, 34], [18, 22], [58, 22], [46, 34]], '#dfe6ec'); poly(g, [[6, 34], [46, 34], [46, 48], [6, 48]], IRON2); poly(g, [[46, 34], [58, 22], [58, 36], [46, 48]], '#6b7a87'); },
  buah(g) { ci(g, 22, 40, 12, '#5a4fd6'); ci(g, 42, 38, 12, '#6a5fe0'); ci(g, 32, 22, 11, '#4a40c0'); ci(g, 19, 36, 3, 'rgba(255,255,255,.6)'); poly(g, [[28, 8], [38, 4], [40, 12], [32, 14]], '#4caf50'); },
  daging(g) { g.beginPath(); g.moveTo(8, 32); g.bezierCurveTo(8, 12, 36, 6, 52, 18); g.bezierCurveTo(62, 30, 50, 56, 28, 54); g.bezierCurveTo(14, 52, 8, 44, 8, 32); g.closePath(); fillStroke(g, '#d94b5a'); g.beginPath(); g.ellipse(30, 28, 11, 6, -0.5, 0, 7); g.fillStyle = '#f6b6bf'; g.fill(); },
  matang(g) { D.meat(g); },
  ikan(g) { g.beginPath(); g.ellipse(28, 32, 22, 13, 0, 0, Math.PI * 2); fillStroke(g, '#6fb3e8'); poly(g, [[46, 32], [62, 18], [62, 46]], '#4a90c8'); ci(g, 16, 28, 3, INK); ln(g, 28, 22, 28, 42, 2, '#4a90c8'); },
  ikanmatang(g) { g.beginPath(); g.ellipse(28, 32, 22, 13, 0, 0, Math.PI * 2); fillStroke(g, '#e0903a'); poly(g, [[46, 32], [62, 18], [62, 46]], '#c0702a'); ci(g, 16, 28, 3, INK); ln(g, 22, 32, 40, 32, 2, '#8a4a12'); ln(g, 24, 26, 38, 26, 2, '#8a4a12'); ln(g, 24, 38, 38, 38, 2, '#8a4a12'); },
  sup(g) { g.beginPath(); g.moveTo(6, 28); g.lineTo(58, 28); g.quadraticCurveTo(56, 56, 32, 56); g.quadraticCurveTo(8, 56, 6, 28); g.closePath(); fillStroke(g, '#d8d2c4'); g.beginPath(); g.ellipse(32, 28, 26, 7, 0, 0, 7); fillStroke(g, '#e8962e'); ci(g, 24, 28, 3, '#6bb040'); ci(g, 38, 27, 3, '#c4452e'); ln(g, 24, 8, 24, 18, 3, '#b8b0a0'); ln(g, 38, 6, 38, 16, 3, '#b8b0a0'); },
  cacing(g) { g.lineWidth = 9; g.strokeStyle = INK; g.beginPath(); g.moveTo(10, 42); g.bezierCurveTo(18, 14, 30, 54, 38, 28); g.bezierCurveTo(42, 14, 54, 20, 54, 30); g.stroke(); g.lineWidth = 5; g.strokeStyle = '#e08a9a'; g.stroke(); st(g); ci(g, 54, 30, 1.5, INK); },
  obor(g) { ln(g, 20, 58, 38, 28, 9, INK); ln(g, 20, 58, 38, 28, 5, WOOD); g.beginPath(); g.moveTo(42, 4); g.bezierCurveTo(50, 14, 54, 20, 50, 28); g.bezierCurveTo(48, 34, 36, 34, 34, 28); g.bezierCurveTo(32, 20, 40, 16, 42, 4); g.closePath(); fillStroke(g, '#ff8a2a'); ci(g, 42, 26, 4, '#ffe27a'); },

  /* ---------- ALAT ---------- */
  kapak(g) { handle(g, WOOD); g.beginPath(); g.moveTo(30, 10); g.lineTo(56, 8); g.quadraticCurveTo(60, 24, 50, 34); g.lineTo(34, 30); g.closePath(); fillStroke(g, STONE); },
  kapakbesi(g) { handle(g, WOOD); g.beginPath(); g.moveTo(30, 10); g.lineTo(56, 8); g.quadraticCurveTo(60, 24, 50, 34); g.lineTo(34, 30); g.closePath(); fillStroke(g, IRON); ln(g, 38, 14, 52, 14, 2, '#fff'); },
  beliung(g) { handle(g, WOOD); g.beginPath(); g.moveTo(10, 24); g.quadraticCurveTo(32, 2, 58, 26); g.lineTo(52, 30); g.quadraticCurveTo(32, 14, 16, 30); g.closePath(); fillStroke(g, STONE); },
  beliungbesi(g) { handle(g, WOOD); g.beginPath(); g.moveTo(10, 24); g.quadraticCurveTo(32, 2, 58, 26); g.lineTo(52, 30); g.quadraticCurveTo(32, 14, 16, 30); g.closePath(); fillStroke(g, IRON); },
  sekop(g) { ln(g, 40, 6, 26, 36, 8, INK); ln(g, 40, 6, 26, 36, 4, WOOD); rr(g, 34, 2, 14, 6, 3, WOOD2); g.beginPath(); g.moveTo(26, 34); g.lineTo(40, 40); g.quadraticCurveTo(38, 58, 22, 58); g.quadraticCurveTo(10, 50, 14, 38); g.closePath(); fillStroke(g, IRON); },
  pedang(g) { poly(g, [[48, 6], [56, 8], [52, 18], [24, 44], [18, 38]], '#c9ced3'); ln(g, 22, 34, 34, 46, 7, INK); ln(g, 22, 34, 34, 46, 3.5, WOOD2); ln(g, 12, 52, 20, 44, 7, INK); ln(g, 12, 52, 20, 44, 3.5, WOOD); },
  pedangbesi(g) { poly(g, [[48, 6], [56, 8], [52, 18], [24, 44], [18, 38]], '#eef3f8'); ln(g, 26, 38, 50, 12, 2, '#9db0c4'); ln(g, 22, 34, 34, 46, 7, INK); ln(g, 22, 34, 34, 46, 3.5, GOLD); ln(g, 12, 52, 20, 44, 7, INK); ln(g, 12, 52, 20, 44, 3.5, WOOD); },
  tombak(g) { ln(g, 8, 56, 46, 18, 7, INK); ln(g, 8, 56, 46, 18, 3.5, WOOD); poly(g, [[44, 6], [58, 6], [58, 20], [48, 22], [40, 14]], '#c9ced3'); },
  pancing(g) { ln(g, 10, 56, 44, 8, 6, INK); ln(g, 10, 56, 44, 8, 3, WOOD); g.beginPath(); g.moveTo(44, 8); g.quadraticCurveTo(60, 24, 54, 42); g.lineWidth = 2; g.stroke(); ci(g, 54, 46, 4, RED); g.lineWidth = 3; },
  ember(g) { g.beginPath(); g.moveTo(12, 20); g.lineTo(52, 20); g.lineTo(46, 56); g.lineTo(18, 56); g.closePath(); fillStroke(g, '#8a97a4'); g.beginPath(); g.ellipse(32, 20, 20, 5, 0, 0, 7); fillStroke(g, '#5a6670'); g.beginPath(); g.moveTo(12, 20); g.quadraticCurveTo(32, -6, 52, 20); g.stroke(); ln(g, 14, 34, 50, 34, 2.5, '#5a6670'); },
  panci(g) { rr(g, 12, 22, 40, 30, 6, '#4a525a'); g.beginPath(); g.ellipse(32, 22, 20, 5, 0, 0, 7); fillStroke(g, '#2e343a'); rr(g, 2, 28, 10, 6, 3, '#4a525a'); rr(g, 52, 28, 10, 6, 3, '#4a525a'); rr(g, 26, 12, 12, 8, 3, '#2e343a'); },
  gerobak(g) { D.cart(g); },

  /* ---------- BANGUNAN (b_*) ---------- */
  b_lantai(g) { poly(g, [[32, 14], [60, 28], [32, 42], [4, 28]], '#d2995a'); poly(g, [[4, 28], [32, 42], [32, 52], [4, 38]], '#a8743c'); poly(g, [[60, 28], [32, 42], [32, 52], [60, 38]], '#8a5a28'); },
  b_dinding(g) { rr(g, 6, 12, 52, 42, 3, '#b8553a'); for (let r = 0; r < 4; r++) { ln(g, 6, 22 + r * 10, 58, 22 + r * 10, 2, '#6a2a1a'); for (let c = 0; c < 3; c++) ln(g, 14 + c * 16 + (r % 2) * 8, 12 + r * 10, 14 + c * 16 + (r % 2) * 8, 22 + r * 10, 2, '#6a2a1a'); } },
  b_batu(g) { rr(g, 6, 12, 52, 42, 3, '#8d949b'); for (let r = 0; r < 3; r++) { ln(g, 6, 26 + r * 14, 58, 26 + r * 14, 2.5, '#4a5058'); ln(g, 20 + r * 12, 12 + r * 14, 20 + r * 12, 26 + r * 14, 2.5, '#4a5058'); } },
  b_pintu(g) { D.door(g); },
  b_atap(g) { poly(g, [[2, 38], [32, 10], [62, 38], [52, 38], [32, 22], [12, 38]], '#c4452e'); poly(g, [[12, 38], [32, 22], [52, 38], [52, 54], [12, 54]], '#e8c690'); rr(g, 26, 40, 12, 14, 2, WOOD2); },
  b_tangga(g) { ln(g, 18, 4, 18, 60, 7, INK); ln(g, 18, 4, 18, 60, 3.5, WOOD); ln(g, 46, 4, 46, 60, 7, INK); ln(g, 46, 4, 46, 60, 3.5, WOOD); for (let i = 0; i < 5; i++) { ln(g, 18, 12 + i * 11, 46, 12 + i * 11, 6, INK); ln(g, 18, 12 + i * 11, 46, 12 + i * 11, 3, '#c08a4a'); } },
  b_kasur(g) { D.wake(g); },
  b_api(g) { D.fire(g); },
  b_obor(g) { D.obor(g); },
  b_lampu(g) { g.beginPath(); g.moveTo(32, 6); g.bezierCurveTo(54, 6, 56, 34, 42, 42); g.lineTo(42, 48); g.lineTo(22, 48); g.lineTo(22, 42); g.bezierCurveTo(8, 34, 10, 6, 32, 6); g.closePath(); fillStroke(g, '#ffe27a'); rr(g, 22, 48, 20, 10, 3, '#8794a0'); ln(g, 26, 52, 38, 52, 2); },
  b_kompor(g) { rr(g, 8, 24, 48, 32, 5, '#7a828a'); rr(g, 8, 20, 48, 8, 3, '#3a4048'); ci(g, 22, 12, 7, '#ff8a2a'); ci(g, 42, 12, 7, '#ffb347'); rr(g, 16, 36, 32, 14, 3, '#3a4048'); ci(g, 24, 43, 3, '#c0c8d0'); ci(g, 40, 43, 3, '#c0c8d0'); },
  b_tungku(g) { g.beginPath(); g.moveTo(8, 56); g.lineTo(14, 20); g.lineTo(22, 10); g.lineTo(42, 10); g.lineTo(50, 20); g.lineTo(56, 56); g.closePath(); fillStroke(g, '#8d949b'); g.beginPath(); g.moveTo(22, 56); g.lineTo(22, 40); g.quadraticCurveTo(32, 28, 42, 40); g.lineTo(42, 56); g.closePath(); fillStroke(g, '#ff8a2a'); ci(g, 32, 48, 5, '#ffe27a'); },
  b_dermaga(g) { for (let i = 0; i < 4; i++) rr(g, 4 + i * 15, 18, 13, 28, 2, i % 2 ? '#c2874a' : '#d2995a'); ln(g, 12, 46, 12, 60, 6, INK); ln(g, 12, 46, 12, 60, 3, WOOD2); ln(g, 52, 46, 52, 60, 6, INK); ln(g, 52, 46, 52, 60, 3, WOOD2); g.beginPath(); g.moveTo(2, 56); g.quadraticCurveTo(10, 50, 20, 56); g.quadraticCurveTo(30, 62, 40, 56); g.quadraticCurveTo(50, 50, 62, 56); g.strokeStyle = BLUE; g.stroke(); st(g); },
  b_mesin(g) { D.gear(g); rr(g, 24, 24, 16, 16, 3, '#e0453a'); },
  b_setir(g) { D.wheel(g); },
  b_bongkar(g) { D.hammer(g); },
};

/* ---------- ikon emote ---------- */
const limb = (g, x, y, a, len, col) => {
  const r = (a * Math.PI) / 180;
  const ex = x + Math.sin(r) * len, ey = y + Math.cos(r) * len;
  ln(g, x, y, ex, ey, 9, INK); ln(g, x, y, ex, ey, 5, col);
  return [ex, ey];
};
/* orang-orangan: sudut 0 = lurus ke bawah, 90 = ke kanan layar, 180 = ke atas */
const fig = (g, o) => {
  const sx = o.x || 32, sy = o.y || 0;
  const cl = '#4a7bd6', cs = '#f2c28f';
  limb(g, sx, 40 + sy, o.lL === undefined ? -12 : o.lL, 20, '#2f4f9f');
  limb(g, sx, 40 + sy, o.lR === undefined ? 12 : o.lR, 20, '#2f4f9f');
  ln(g, sx, 24 + sy, sx, 42 + sy, 12, INK); ln(g, sx, 24 + sy, sx, 42 + sy, 8, cl);
  const aL = limb(g, sx, 27 + sy, o.aL === undefined ? -10 : o.aL, 18, cs);
  const aR = limb(g, sx, 27 + sy, o.aR === undefined ? 10 : o.aR, 18, cs);
  ci(g, sx, 15 + sy, 8, cs);
  return [aL, aR];
};
Object.assign(D, {
  e_wave(g) { fig(g, { aR: 150, aL: -15 }); g.lineWidth = 2.5; g.beginPath(); g.arc(50, 8, 7, -1.2, 0.6); g.stroke(); g.beginPath(); g.arc(50, 8, 12, -1.0, 0.4); g.stroke(); g.lineWidth = 3; },
  e_dance(g) { fig(g, { aR: 140, aL: -140, lL: -28, lR: 22, x: 32 }); ln(g, 10, 52, 16, 58, 3); ln(g, 54, 52, 48, 58, 3); },
  e_clap(g) { fig(g, { aL: -150 + 150 - 30 + 148, aR: 148 - 148 + 30 }); const x = 32; ln(g, x - 2, 30, x + 2, 30, 1, INK); for (const a of [-0.7, 0, 0.7]) ln(g, 32 + Math.sin(a) * 6, 22 + -Math.cos(a) * 2, 32 + Math.sin(a) * 14, 14 - Math.cos(a) * 4, 3, GOLD); },
  e_bow(g) { limb(g, 24, 44, -10, 20, '#2f4f9f'); limb(g, 24, 44, 10, 20, '#2f4f9f'); ln(g, 24, 44, 40, 30, 12, INK); ln(g, 24, 44, 40, 30, 8, '#4a7bd6'); limb(g, 40, 32, 150, 16, '#f2c28f'); ci(g, 48, 24, 8, '#f2c28f'); },
  e_cheer(g) { fig(g, { aR: 165, aL: -165, lL: -22, lR: 22 }); for (const a of [20, 40, 60]) ln(g, a, 8, a - 4, 2, 3, GOLD); },
  e_point(g) { const [, aR] = fig(g, { aR: 90, aL: -10 }); poly(g, [[aR[0] + 2, aR[1] - 6], [aR[0] + 12, aR[1]], [aR[0] + 2, aR[1] + 6]], GOLD); },
  e_sit(g) { rr(g, 8, 44, 26, 14, 2, WOOD); ln(g, 22, 22, 22, 42, 12, INK); ln(g, 22, 22, 22, 42, 8, '#4a7bd6'); ln(g, 22, 42, 46, 42, 9, INK); ln(g, 22, 42, 46, 42, 5, '#2f4f9f'); ln(g, 46, 42, 46, 56, 9, INK); ln(g, 46, 42, 46, 56, 5, '#2f4f9f'); limb(g, 22, 27, 40, 16, '#f2c28f'); ci(g, 22, 13, 8, '#f2c28f'); },
  e_spin(g) { fig(g, { aR: 100, aL: -100 }); g.beginPath(); g.arc(32, 32, 27, 0.3, 2.2); g.lineWidth = 4; g.strokeStyle = GOLD; g.stroke(); g.beginPath(); g.arc(32, 32, 27, 3.5, 5.3); g.stroke(); st(g); },
  e_sleep(g) { rr(g, 4, 40, 56, 14, 4, '#d8584c'); rr(g, 6, 32, 16, 12, 5, '#f4ecd8'); ci(g, 14, 32, 8, '#f2c28f'); g.font = 'bold 20px sans-serif'; g.fillStyle = '#fff'; g.lineWidth = 3; g.strokeText('z', 38, 22); g.fillText('z', 38, 22); g.font = 'bold 14px sans-serif'; g.strokeText('z', 50, 12); g.fillText('z', 50, 12); },
  e_kick(g) { limb(g, 28, 40, -8, 22, '#2f4f9f'); limb(g, 28, 40, 80, 24, '#2f4f9f'); ln(g, 28, 24, 28, 42, 12, INK); ln(g, 28, 24, 28, 42, 8, '#4a7bd6'); limb(g, 28, 27, -50, 16, '#f2c28f'); limb(g, 28, 27, 130, 16, '#f2c28f'); ci(g, 28, 15, 8, '#f2c28f'); ln(g, 56, 38, 62, 34, 3, GOLD); ln(g, 56, 46, 63, 48, 3, GOLD); },
  e_laugh(g) { ci(g, 32, 32, 25, '#ffd54a'); g.beginPath(); g.arc(22, 26, 5, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); g.beginPath(); g.arc(42, 26, 5, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); g.beginPath(); g.moveTo(16, 36); g.quadraticCurveTo(32, 62, 48, 36); g.closePath(); fillStroke(g, '#7a1f1f'); g.beginPath(); g.moveTo(22, 40); g.quadraticCurveTo(32, 44, 42, 40); g.quadraticCurveTo(32, 50, 22, 40); g.fillStyle = '#fff'; g.fill(); },
  e_angry(g) { ci(g, 32, 32, 25, '#ff6a4a'); ln(g, 14, 20, 28, 26, 4); ln(g, 50, 20, 36, 26, 4); ci(g, 22, 31, 3, INK); ci(g, 42, 31, 3, INK); g.beginPath(); g.arc(32, 52, 10, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); },
  e_cry(g) { ci(g, 32, 32, 25, '#ffd54a'); ci(g, 22, 27, 3, INK); ci(g, 42, 27, 3, INK); g.beginPath(); g.arc(32, 52, 9, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); for (const x of [18, 46]) { g.beginPath(); g.moveTo(x, 34); g.quadraticCurveTo(x + 5, 44, x, 52); g.quadraticCurveTo(x - 5, 44, x, 34); g.closePath(); fillStroke(g, BLUE); } },
  e_q(g) { ci(g, 32, 32, 26, '#7aa7ff'); g.font = 'bold 44px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.lineWidth = 4; g.strokeText('?', 32, 34); g.fillText('?', 32, 34); },
  e_ex(g) { ci(g, 32, 32, 26, '#ff6a5a'); g.font = 'bold 44px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.lineWidth = 4; g.strokeText('!', 32, 34); g.fillText('!', 32, 34); },
  e_star(g) { const p = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 12 : 28; p.push([32 + Math.cos(a) * r, 34 + Math.sin(a) * r]); } poly(g, p, '#ffd54a'); ci(g, 32, 34, 4, '#fff6c0'); },
  e_thumb(g) { rr(g, 8, 30, 14, 26, 3, '#4a7bd6'); g.beginPath(); g.moveTo(24, 32); g.lineTo(34, 8); g.quadraticCurveTo(42, 8, 40, 20); g.lineTo(38, 28); g.lineTo(54, 28); g.quadraticCurveTo(60, 30, 58, 36); g.lineTo(56, 52); g.quadraticCurveTo(54, 58, 48, 58); g.lineTo(24, 58); g.closePath(); fillStroke(g, '#f2c28f'); },
  e_sweat(g) { ci(g, 30, 34, 24, '#ffd54a'); g.beginPath(); g.arc(20, 30, 4, 0, 7); g.stroke(); ln(g, 38, 28, 48, 28, 3); ln(g, 20, 48, 40, 46, 3); g.beginPath(); g.moveTo(52, 8); g.quadraticCurveTo(60, 20, 52, 26); g.quadraticCurveTo(44, 20, 52, 8); g.closePath(); fillStroke(g, BLUE); },
  e_music(g) { ln(g, 24, 46, 24, 12, 4); ln(g, 48, 40, 48, 8, 4); ln(g, 24, 12, 48, 8, 6); ci(g, 18, 48, 8, '#fff'); ci(g, 42, 42, 8, '#fff'); },
  emote(g) { ci(g, 32, 32, 25, '#ffd54a'); ci(g, 23, 26, 3.5, INK); ci(g, 41, 26, 3.5, INK); g.beginPath(); g.arc(32, 36, 13, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke(); },
  person(g) { ci(g, 32, 18, 10, '#f0c8a0'); poly(g, [[16, 56], [18, 34], [46, 34], [48, 56]], '#2e8b57'); poly(g, [[20, 56], [20, 44], [44, 44], [44, 56]], '#4aa8e0'); },
  page(g) { poly(g, [[14, 10], [50, 10], [50, 54], [14, 54]], '#f6eccb'); for (let i = 0; i < 4; i++) ln(g, 20, 20 + i * 9, 44, 20 + i * 9, 2.5, '#8a6a3a'); },
});

/* nama lain yang dipakai sama */
D.makan = D.eat;
D.setting = D.gear;
D.online = D.globe;
D.world = D.globe;
D.vault = D.chest;
D.hud = D.sliders;
D.simpan = D.save;
D.panduan = D.book;
D.keluar = D.back;
D.bangun = D.hammer;
D.tas = D.bag;
D.tangan = D.fist;

const cache = new Map();
const SIZE = 96;

export function hasIcon(name) { return !!D[name]; }

/* URL gambar (data:) ikon; digambar sekali lalu disimpan */
export function iconURL(name) {
  let u = cache.get(name);
  if (u) return u;
  const fn = D[name];
  const cv = document.createElement('canvas');
  cv.width = cv.height = SIZE;
  const g = cv.getContext('2d');
  g.scale(SIZE / 64, SIZE / 64);
  st(g);
  if (fn) { try { fn(g); } catch (e) { /* abaikan */ } }
  u = cv.toDataURL('image/png');
  cache.set(name, u);
  return u;
}

/* potongan HTML <img> ikon */
export function ico(name, cls) {
  return `<img class="ic${cls ? ' ' + cls : ''}" src="${iconURL(name)}" alt="">`;
}

/* isi semua elemen [data-ic]: ikon di depan, teks asli jadi label */
export function hydrate(root) {
  const els = (root || document).querySelectorAll('[data-ic]');
  els.forEach((el) => {
    if (el.dataset.icDone) return;
    el.dataset.icDone = '1';
    const t = el.textContent.trim();
    el.innerHTML = ico(el.dataset.ic) + (t ? '<span class="lb">' + t.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</span>' : '');
  });
}

/* ganti ikon sebuah elemen (dan label opsional) */
export function setIcon(el, name, label) {
  if (!el) return;
  const key = name + '|' + (label || '');
  if (el.dataset.icKey === key) return;
  el.dataset.icKey = key;
  el.innerHTML = ico(name) + (label ? '<span class="lb">' + label.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</span>' : '');
}

/* ikon + teks yang sering berubah: struktur dibuat sekali, hanya isi yang diganti */
export function setIconText(el, name, text) {
  if (!el) return;
  if (!el._ti) {
    el.innerHTML = '<img class="ic" alt=""><span class="lb"></span>';
    el._ti = el.firstChild; el._tt = el.lastChild; el._tn = '';
  }
  if (el._tn !== name) { el._tn = name; el._ti.src = iconURL(name); }
  if (el._tx !== text) { el._tx = text; el._tt.textContent = text; }
}

/* biaya (mis. {kayu:2}) -> HTML angka + ikon; have = inventaris untuk pewarnaan */
export function costIcons(cost, have) {
  return Object.keys(cost).map((k) => {
    const cls = have ? ((have[k] || 0) >= cost[k] ? 'ok' : 'no') : '';
    return `<em class="${cls}">${cost[k]}${ico(k, 'sm')}</em>`;
  }).join(' ');
}

export const ICON_NAMES = Object.keys(D);
