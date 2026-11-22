/* Model alat yang dipegang (dipakai tampilan orang pertama, orang ketiga, dan pemain lain) */
import * as THREE from 'three';

const M = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.8 }, o || {}));
const bx = (w, h, d, mat, x, y, z) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
};

/* mengembalikan { group, flame, tip } — sumbu alat memanjang ke arah -z */
export function buildHeld(eq, embFull) {
  const h = new THREE.Group();
  let flame = null, tip = null;
  const wood = M(0x7a5230, { roughness: 1 });
  const stone = M(0x9aa0a6, { roughness: 0.6, metalness: 0.4 });
  const iron = M(0xd2d8de, { roughness: 0.4, metalness: 0.7 });
  switch (eq) {
    case 'tombak': {
      h.add(bx(0.04, 0.04, 1.0, wood, 0, 0, -0.25));
      const t = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.2, 4), stone);
      t.rotation.x = -Math.PI / 2;
      t.position.z = -0.85;
      h.add(t);
      break;
    }
    case 'kapak': case 'kapakbesi':
      h.add(bx(0.04, 0.04, 0.6, wood, 0, 0, 0));
      h.add(bx(0.04, 0.16, 0.2, eq === 'kapak' ? stone : iron, 0, 0.06, -0.28));
      break;
    case 'beliung': case 'beliungbesi': {
      const hd = eq === 'beliung' ? stone : iron;
      h.add(bx(0.04, 0.04, 0.65, wood, 0, 0, -0.02));
      h.add(bx(0.42, 0.05, 0.06, hd, 0, 0.0, -0.34));
      const l = bx(0.1, 0.05, 0.05, hd, -0.24, -0.04, -0.34); l.rotation.z = 0.5;
      const r = bx(0.1, 0.05, 0.05, hd, 0.24, -0.04, -0.34); r.rotation.z = -0.5;
      h.add(l, r);
      break;
    }
    case 'sekop':
      h.add(bx(0.04, 0.04, 0.75, wood, 0, 0, -0.1));
      h.add(bx(0.15, 0.03, 0.22, stone, 0, 0, -0.5));
      h.add(bx(0.1, 0.05, 0.04, wood, 0, 0, 0.27));
      break;
    case 'pedang': case 'pedangbesi':
      h.add(bx(0.04, 0.04, 0.16, wood, 0, 0, 0.05));
      h.add(bx(0.2, 0.03, 0.04, wood, 0, 0, -0.04));
      h.add(bx(0.012, 0.075, 0.62, eq === 'pedang' ? stone : iron, 0, 0, -0.38));
      break;
    case 'pancing': {
      const rod = new THREE.Group();
      rod.rotation.x = 0.45;
      rod.add(bx(0.022, 0.022, 1.2, wood, 0, 0, -0.45));
      rod.add(bx(0.07, 0.07, 0.05, M(0x444a52), 0, -0.04, 0.0));
      tip = new THREE.Object3D();
      tip.position.set(0, 0, -1.05);
      rod.add(tip);
      h.add(rod);
      break;
    }
    case 'ember': {
      const wm = M(0x8a5a2b, { side: THREE.DoubleSide });
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.08, 0.18, 12, 1, true), wm);
      b.position.set(0, -0.02, -0.28);
      h.add(b);
      h.add(bx(0.17, 0.01, 0.17, wm, 0, -0.11, -0.28));
      if (embFull) {
        const w = new THREE.Mesh(new THREE.CylinderGeometry(0.098, 0.098, 0.01, 12), new THREE.MeshBasicMaterial({ color: 0x4aa3dc }));
        w.position.set(0, 0.04, -0.28);
        h.add(w);
      }
      const hd = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.008, 4, 10, Math.PI), M(0x444a52));
      hd.position.set(0, 0.06, -0.28);
      h.add(hd);
      break;
    }
    case 'obor': {
      h.add(bx(0.045, 0.045, 0.5, wood, 0, 0, -0.18));
      const fl = new THREE.Group();
      const f1 = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.24, 6), new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.92 }));
      f1.position.y = 0.12;
      const f2 = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.16, 6), new THREE.MeshBasicMaterial({ color: 0xffd36b }));
      f2.position.y = 0.09;
      fl.add(f1, f2);
      fl.position.set(0, 0.03, -0.46);
      h.add(fl);
      flame = fl;
      break;
    }
    default: break;
  }
  return { group: h, flame, tip };
}
