import * as MQ from 'mqtt';
import { hashStr } from './util.js';

/* Jaringan global tanpa server sendiri: pub/sub lewat broker MQTT publik (WebSocket). */
const connectFn = MQ.connect || (MQ.default && MQ.default.connect);
const BROKERS = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt',
  'wss://test.mosquitto.org:8081',
];
const NS = 'gunzdev/santay/v1';
export const MAXP = 4;
export const WORLD_MAX = 6;
export const OW_MAX = 12;
export const OW_SEED = 20260101;
const STALE = 45000;
const rid = () => Math.random().toString(36).slice(2, 8);
const enc = (o) => JSON.stringify(o);
const dec = (b) => {
  try { return JSON.parse(b.toString()); } catch (e) { return null; }
};

function openClient(extra) {
  return new Promise((resolve, reject) => {
    if (!connectFn) { reject(new Error('Modul online tidak tersedia.')); return; }
    let i = 0;
    const next = () => {
      if (i >= BROKERS.length) { reject(new Error('Tidak bisa terhubung ke server online. Cek internet.')); return; }
      const url = BROKERS[i++];
      let c;
      try {
        c = connectFn(url, Object.assign({ clientId: 'ps_' + rid() + rid(), clean: true, reconnectPeriod: 0, connectTimeout: 6000, keepalive: 30 }, extra || {}));
      } catch (e) { next(); return; }
      let done = false;
      const to = setTimeout(() => { if (done) return; done = true; try { c.end(true); } catch (e) { /* abaikan */ } next(); }, 7500);
      c.once('connect', () => {
        if (done) return;
        done = true;
        clearTimeout(to);
        c.options.reconnectPeriod = 2500;
        resolve(c);
      });
      c.once('error', () => {
        if (done) return;
        done = true;
        clearTimeout(to);
        try { c.end(true); } catch (e) { /* abaikan */ }
        next();
      });
    };
    next();
  });
}

/* ================= Daftar room global ================= */
export class Browse {
  constructor(onChange) {
    this.rooms = new Map();
    this.onChange = onChange;
    this.c = null;
    this.closed = false;
    this.timer = null;
  }

  async start() {
    this.c = await openClient();
    if (this.closed) { this.c.end(true); return; }
    this.c.on('message', (topic, buf) => {
      const id = topic.split('/').pop();
      const m = buf.length ? dec(buf) : null;
      if (!m) this.rooms.delete(id);
      else { m._seen = Date.now(); this.rooms.set(id, m); }
      this.emit();
    });
    this.c.subscribe(`${NS}/rooms/+`);
    this.timer = setInterval(() => this.emit(), 3000);
  }

  list() {
    const now = Date.now();
    const out = [];
    for (const r of this.rooms.values()) {
      if (!r.pub || r.started) continue;
      if (now - (r.ts || 0) > STALE) continue;
      out.push(r);
    }
    out.sort((a, b) => b.ts - a.ts);
    return out;
  }

  emit() { if (!this.closed) this.onChange(this.list()); }

  close() {
    this.closed = true;
    clearInterval(this.timer);
    try { this.c && this.c.end(true); } catch (e) { /* abaikan */ }
  }
}

/* ================= Sesi room / Open World ================= */
export class Net {
  constructor() {
    this.c = null;
    this.myId = 'u' + rid();
    this.roomId = '';
    this.isHost = false;
    this.me = null;
    this.info = null;
    this.roster = new Map();
    this.started = false;
    this.open = false;
    this.hb = null;
    this.onLobby = () => {};
    this.onStart = () => {};
    this.onMsg = () => {};
    this.onClosed = () => {};
    this.closing = false;
  }

  get players() {
    return [...this.roster.values()].sort((a, b) => a.t - b.t);
  }

  static privId(name, pw) { return 'x' + hashStr(name.trim().toLowerCase() + '|' + pw); }

  _wire() {
    const c = this.c;
    c.on('message', (topic, buf) => {
      const tail = topic.slice(NS.length + 1);
      if (tail === `r/${this.roomId}/ev`) {
        const m = dec(buf);
        if (!m || m.f === this.myId) return;
        if (m.t === 'start') { this.started = true; this.onStart(m); return; }
        this.onMsg(m);
      } else if (tail.startsWith(`r/${this.roomId}/p/`)) {
        const id = tail.split('/').pop();
        if (id === this.myId) return;
        if (!buf.length) {
          if (this.roster.delete(id)) {
            this._lobbyChanged();
            if (this.started || this.open) this.onMsg({ t: 'left', f: id });
            else if (this.info && id === this.info.host && !this.isHost && !this.closing) this.onClosed();
          }
        } else {
          const m = dec(buf);
          if (!m) return;
          const had = this.roster.has(id);
          this.roster.set(id, { id, name: m.name, skin: m.skin, t: m.t || 0 });
          if (!had) this._lobbyChanged();
        }
      } else if (tail === `rooms/${this.roomId}`) {
        if (!buf.length) {
          if (!this.isHost && !this.closing) { this.info = null; this.onClosed(); }
        } else {
          const m = dec(buf);
          if (m) {
            this.info = m;
            if (m.started && !this.started && !this.isHost && !this.open) { /* start dikirim lewat ev */ }
          }
        }
      }
    });
    c.on('connect', () => { if (this.announced && !this.closing) this._announce(); });
  }

  _lobbyChanged() {
    if (this.isHost) this._publishInfo();
    this.onLobby(this.players);
  }

  _publishInfo() {
    if (!this.isHost || !this.c || this.closing) return;
    const i = this.info;
    i.n = this.roster.size;
    i.ts = Date.now();
    this.c.publish(`${NS}/rooms/${this.roomId}`, enc(i), { retain: true });
  }

  _announce() {
    this.announced = true;
    this.c.publish(`${NS}/r/${this.roomId}/p/${this.myId}`, enc({ name: this.me.name, skin: this.me.skin, t: this.joinT }), { retain: true });
  }

  async _open(roomId, me, willRoom) {
    this.roomId = roomId;
    this.me = me;
    this.joinT = Date.now();
    const wills = { topic: `${NS}/r/${roomId}/p/${this.myId}`, payload: '', retain: true, qos: 0 };
    this.c = await openClient({ will: wills });
    this._wire();
    this.roster.set(this.myId, { id: this.myId, name: me.name, skin: me.skin, t: this.joinT });
  }

  /* host: buat room. pw kosong = publik (muncul di daftar global), pw terisi = private */
  async host(name, pw, me, extra) {
    const isPub = !pw;
    const roomId = isPub ? 'p' + hashStr(name.toLowerCase()) + rid().slice(0, 3) : Net.privId(name, pw);
    this.isHost = true;
    await this._open(roomId, me);
    /* cek room private dengan nama+pw yang sama sudah ada */
    if (!isPub) {
      const exists = await this._peek(roomId);
      if (exists) { this.close(); throw new Error('Room dengan nama & password itu sudah ada.'); }
    }
    this.info = { id: roomId, name, host: this.myId, hostName: me.name, n: 1, max: MAXP, seed: (Math.random() * 1e9) | 0, started: false, pub: isPub, ts: Date.now() };
    if (extra) Object.assign(this.info, extra); /* mis. dunia buatan: world:true, seed, max */
    if (extra && extra.world) this.started = true; /* dunia berjalan terus; pemain keluar/masuk kapan saja */
    await this._subAll();
    this._announce();
    this._publishInfo();
    this.hb = setInterval(() => this._publishInfo(), 12000);
  }

  _peek(roomId) {
    return new Promise((resolve) => {
      let found = false;
      const h = (topic, buf) => {
        if (topic === `${NS}/rooms/${roomId}` && buf.length) {
          const m = dec(buf);
          if (m && Date.now() - (m.ts || 0) < STALE) found = true;
        }
      };
      this.c.on('message', h);
      this.c.subscribe(`${NS}/rooms/${roomId}`);
      setTimeout(() => {
        this.c.off('message', h);
        this.c.unsubscribe(`${NS}/rooms/${roomId}`);
        resolve(found);
      }, 1300);
    });
  }

  _subAll() {
    return new Promise((resolve) => {
      this.c.subscribe([`${NS}/r/${this.roomId}/ev`, `${NS}/r/${this.roomId}/p/+`, `${NS}/rooms/${this.roomId}`], () => resolve());
      setTimeout(resolve, 2500);
    });
  }

  /* join room by id (dari daftar) atau private (nama+pw) */
  async join(roomId, me) {
    this.isHost = false;
    await this._open(roomId, me);
    await this._subAll();
    await new Promise((r) => setTimeout(r, 1300));
    const inf = this.info;
    if (!inf || Date.now() - (inf.ts || 0) > STALE) { this.close(); throw new Error('Room tidak ditemukan atau password salah.'); }
    if (inf.started && !inf.world) { this.close(); throw new Error('Permainan di room ini sudah dimulai.'); }
    if (this.roster.size > (inf.max || MAXP)) { this.close(); throw new Error('Dunia/room sudah penuh.'); }
    /* dunia buatan pemain: langsung masuk tanpa menunggu host menekan GAS */
    if (inf.world) this.started = true;
    this._announce();
    this.onLobby(this.players);
  }

  async joinPrivate(name, pw, me) { return this.join(Net.privId(name, pw), me); }

  /* Open World: shard otomatis, ketemu pemain lain */
  async joinOpen(me) {
    this.open = true;
    this.isHost = false;
    for (let k = 1; k <= 8; k++) {
      const roomId = 'ow' + k;
      if (this.c) { try { this.c.end(true); } catch (e) { /* abaikan */ } this.c = null; }
      this.roster.clear();
      await this._open(roomId, me);
      await this._subAll();
      await new Promise((r) => setTimeout(r, 1200));
      if (this.roster.size <= OW_MAX) {
        this.info = { seed: OW_SEED };
        this.started = true;
        this._announce();
        return k;
      }
    }
    this.close();
    throw new Error('Semua Open World penuh. Coba lagi nanti.');
  }

  start(seed) {
    this.started = true;
    this.info.started = true;
    this._publishInfo();
    this.c.publish(`${NS}/r/${this.roomId}/ev`, enc({ t: 'start', seed, f: this.myId }));
  }

  send(m) {
    if (!this.c || !this.c.connected) return;
    m.f = this.myId;
    this.c.publish(`${NS}/r/${this.roomId}/ev`, enc(m));
  }

  leave() { this.close(); }

  close() {
    if (this.closing) return;
    this.closing = true;
    clearInterval(this.hb);
    const c = this.c;
    this.c = null;
    if (!c) return;
    try {
      if (c.connected) {
        c.publish(`${NS}/r/${this.roomId}/p/${this.myId}`, '', { retain: true });
        if (this.isHost) c.publish(`${NS}/rooms/${this.roomId}`, '', { retain: true });
        c.publish(`${NS}/r/${this.roomId}/ev`, enc({ t: 'left', f: this.myId }));
      }
    } catch (e) { /* abaikan */ }
    setTimeout(() => { try { c.end(true); } catch (e) { /* abaikan */ } }, 400);
  }
}
