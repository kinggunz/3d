import Peer from 'peerjs';
import { hashStr } from './util.js';

export const MAXP = 4;

export class Net {
  constructor() {
    this.peer = null;
    this.conn = null;
    this.conns = new Map();
    this.isHost = false;
    this.players = [];
    this.myId = '';
    this.started = false;
    this.seq = 0;
    this.onLobby = () => {};
    this.onStart = () => {};
    this.onMsg = () => {};
    this.onClosed = () => {};
  }

  static idFor(room, pw) {
    return 'psantay-' + hashStr(room.trim().toLowerCase() + '|' + pw);
  }

  host(room, pw, me) {
    return new Promise((resolve, reject) => {
      this.isHost = true;
      this.myId = 'h';
      this.players = [{ id: 'h', name: me.name, skin: me.skin }];
      let opened = false;
      const peer = new Peer(Net.idFor(room, pw));
      this.peer = peer;
      peer.on('open', () => { opened = true; resolve(); });
      peer.on('error', (e) => {
        if (!opened) {
          reject(new Error(e.type === 'unavailable-id' ? 'Room dengan nama & password itu sudah ada.' : 'Gagal terhubung ke server (' + e.type + ').'));
        } else console.warn(e);
      });
      peer.on('connection', (c) => this._accept(c));
      setTimeout(() => { if (!opened) reject(new Error('Server timeout. Cek koneksi internet.')); }, 12000);
    });
  }

  _accept(c) {
    c.on('data', (m) => this._hostData(c, m));
    c.on('close', () => this._drop(c));
    c.on('error', () => this._drop(c));
  }

  _hostData(c, m) {
    if (m.t === 'join') {
      if (this.started) { c.send({ t: 'closed' }); setTimeout(() => c.close(), 300); return; }
      if (this.players.length >= MAXP) { c.send({ t: 'full' }); setTimeout(() => c.close(), 300); return; }
      const id = 'c' + (++this.seq);
      c._pid = id;
      this.conns.set(id, c);
      this.players.push({ id, name: m.name, skin: m.skin });
      c.send({ t: 'welcome', id });
      this._bc({ t: 'lobby', players: this.players });
      this.onLobby(this.players);
      return;
    }
    if (c._pid) {
      for (const [id, o] of this.conns) if (id !== c._pid && o.open) o.send(m);
      this.onMsg(m);
    }
  }

  _drop(c) {
    if (!c._pid) return;
    const id = c._pid;
    c._pid = null;
    this.conns.delete(id);
    this.players = this.players.filter((p) => p.id !== id);
    if (this.started) {
      this._bc({ t: 'left', id });
      this.onMsg({ t: 'left', id });
    } else {
      this._bc({ t: 'lobby', players: this.players });
      this.onLobby(this.players);
    }
  }

  _bc(m) {
    for (const o of this.conns.values()) if (o.open) o.send(m);
  }

  join(room, pw, me) {
    return new Promise((resolve, reject) => {
      const peer = new Peer();
      this.peer = peer;
      let done = false;
      const fail = (msg) => {
        if (done) return;
        done = true;
        reject(new Error(msg));
        try { peer.destroy(); } catch (e) { /* abaikan */ }
      };
      peer.on('open', () => {
        const c = peer.connect(Net.idFor(room, pw), { reliable: true });
        this.conn = c;
        const to = setTimeout(() => fail('Room tidak ditemukan atau password salah.'), 9000);
        c.on('open', () => {
          clearTimeout(to);
          c.send({ t: 'join', name: me.name, skin: me.skin });
        });
        c.on('data', (m) => {
          if (m.t === 'welcome') {
            this.myId = m.id;
            if (!done) { done = true; resolve(); }
          } else if (m.t === 'full') fail('Room sudah penuh.');
          else if (m.t === 'closed') fail('Permainan di room ini sudah dimulai.');
          else if (m.t === 'lobby') { this.players = m.players; this.onLobby(m.players); }
          else if (m.t === 'start') { this.started = true; this.onStart(m); }
          else this.onMsg(m);
        });
        c.on('close', () => { if (done) this.onClosed(); else fail('Koneksi terputus.'); });
        c.on('error', () => fail('Koneksi gagal.'));
      });
      peer.on('error', (e) => {
        if (!done) fail(e.type === 'peer-unavailable' ? 'Room tidak ditemukan atau password salah.' : 'Gagal terhubung (' + e.type + ').');
      });
      setTimeout(() => fail('Server timeout. Cek koneksi internet.'), 15000);
    });
  }

  start(seed) {
    this.started = true;
    this._bc({ t: 'start', seed, players: this.players });
  }

  send(m) {
    if (this.isHost) this._bc(m);
    else if (this.conn && this.conn.open) this.conn.send(m);
  }

  close() {
    this.onClosed = () => {};
    try { this.peer && this.peer.destroy(); } catch (e) { /* abaikan */ }
    this.peer = null;
    this.conns.clear();
  }
}
