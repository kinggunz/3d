import * as THREE from 'three';

export const T = {};

function ct(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

let done = false;
export function initTextures() {
  if (done) return;
  done = true;

  T.wood = ct(128, 128, (g, w, h) => {
    g.fillStyle = '#a1703f';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? '#94642f' : '#ab7a47';
      g.fillRect(0, i * 16, w, 15);
      g.fillStyle = '#4e3118';
      g.fillRect(0, i * 16 + 15, w, 1);
    }
    for (let i = 0; i < 180; i++) {
      g.fillStyle = 'rgba(60,35,15,.25)';
      g.fillRect(Math.random() * w, Math.random() * h, 10 + Math.random() * 30, 1);
    }
  });

  T.stone = ct(128, 128, (g, w, h) => {
    g.fillStyle = '#8c8f94';
    g.fillRect(0, 0, w, h);
    for (let r = 0; r < 4; r++) {
      const off = r % 2 ? 16 : 0;
      for (let c = -1; c < 4; c++) {
        const shade = 120 + Math.floor(Math.random() * 40);
        g.fillStyle = `rgb(${shade},${shade + 2},${shade + 6})`;
        g.fillRect(c * 32 + off + 1, r * 32 + 1, 30, 30);
      }
    }
    g.strokeStyle = '#55585d';
    g.lineWidth = 2;
    for (let r = 0; r <= 4; r++) {
      g.beginPath();
      g.moveTo(0, r * 32);
      g.lineTo(w, r * 32);
      g.stroke();
    }
  });

  T.roof = ct(128, 128, (g, w, h) => {
    g.fillStyle = '#8a3b2a';
    g.fillRect(0, 0, w, h);
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const s = 130 + Math.floor(Math.random() * 30);
        g.fillStyle = `rgb(${s},${Math.floor(s * 0.42)},${Math.floor(s * 0.3)})`;
        g.fillRect(c * 16 + (r % 2 ? 8 : 0) - 8, r * 16, 15, 14);
      }
    }
  });


  T.rock = ct(128, 128, (g, w, h) => {
    g.fillStyle = '#4a4a50';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 420; i++) {
      const v = 50 + Math.floor(Math.random() * 60);
      g.fillStyle = `rgba(${v},${v},${v + 6},0.55)`;
      const s = 2 + Math.random() * 14;
      g.fillRect(Math.random() * w, Math.random() * h, s, s * (0.4 + Math.random()));
    }
    g.strokeStyle = 'rgba(15,15,18,.55)';
    g.lineWidth = 2;
    for (let i = 0; i < 9; i++) {
      g.beginPath();
      let x = Math.random() * w, y = Math.random() * h;
      g.moveTo(x, y);
      for (let k = 0; k < 4; k++) { x += (Math.random() - 0.5) * 40; y += (Math.random() - 0.5) * 40; g.lineTo(x, y); }
      g.stroke();
    }
  });

  T.floor = ct(128, 128, (g, w, h) => {
    g.fillStyle = '#3b3631';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 500; i++) {
      const v = 40 + Math.floor(Math.random() * 40);
      g.fillStyle = `rgba(${v + 8},${v + 2},${v - 4},0.5)`;
      g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 6, 2 + Math.random() * 6);
    }
  });

  T.water = ct(256, 256, (g, w, h) => {
    g.fillStyle = '#bfe3f7';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      const x = Math.random() * w, y = Math.random() * h;
      const rr = 6 + Math.random() * 22;
      g.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,.35)' : 'rgba(40,120,190,.22)';
      for (const ox of [-w, 0, w]) {
        for (const oy of [-h, 0, h]) {
          g.beginPath();
          g.ellipse(x + ox, y + oy, rr, rr * 0.45, 0, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
  });
}
