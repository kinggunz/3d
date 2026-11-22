/* TEMAN: kode teman, cari, kirim/terima permintaan, status online, masuk ke dunia teman.
   Tanpa server sendiri: memakai broker MQTT publik yang sama dengan mabar (pesan 'retained'). */
import { openClient, NS } from './net.js';

const enc = (o) => JSON.stringify(o);
const dec = (b) => { try { return JSON.parse(b.toString()); } catch (e) { return null; } };
const KEY = 'ps_friends';
const rd = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
const wr = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* abaikan */ } };

export function newFid() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += A[(Math.random() * A.length) | 0];
  return s;
}

export class Friends {
  constructor(me, onChange) {
    this.me = me; /* { fid, name } */
    this.onChange = onChange || (() => {});
    this.list = rd();
    this.reqs = new Map(); /* permintaan masuk */
    this.st = new Map(); /* status teman */
    this.found = new Map();
    this.searching = false;
    this.c = null;
    this.hb = null;
    this.room = ''; this.rname = '';
    this.err = '';
  }

  get online() { return !!(this.c && this.c.connected); }

  async start() {
    if (this.c || this.starting) return;
    this.starting = true;
    try {
      this.c = await openClient({ will: { topic: `${NS}/f/${this.me.fid}/st`, payload: '', retain: true, qos: 0 } });
    } catch (e) {
      this.starting = false; this.c = null; this.err = e.message;
      this.onChange();
      this.retry = setTimeout(() => this.start(), 20000);
      return;
    }
    this.starting = false; this.err = '';
    this.c.on('message', (t, b) => this._msg(t, b));
    this.c.on('connect', () => { this._sub(); this._pub(); this.onChange(); });
    this._sub(); this._pub();
    this.hb = setInterval(() => this._pub(), 20000);
    this.onChange();
  }

  _sub() {
    if (!this.c) return;
    const f = this.me.fid;
    const topics = [`${NS}/f/${f}/req/+`, `${NS}/f/${f}/acc/+`, ...this.list.map((x) => `${NS}/f/${x.id}/st`)];
    this.c.subscribe(topics);
  }

  _pub() {
    if (!this.c || !this.c.connected) return;
    const f = this.me.fid;
    this.c.publish(`${NS}/f/${f}/st`, enc({ n: this.me.name, room: this.room, rn: this.rname, ts: Date.now() }), { retain: true });
    this.c.publish(`${NS}/f/${f}/pf`, enc({ n: this.me.name }), { retain: true });
  }

  setName(n) { this.me.name = n; this._pub(); }
  setPlaying(room, rname) { this.room = room || ''; this.rname = rname || ''; this._pub(); }
  setIdle() { this.setPlaying('', ''); }

  _msg(topic, buf) {
    const tail = topic.slice(NS.length + 1).split('/');
    if (tail[0] !== 'f') return;
    const id = tail[1], kind = tail[2];
    const f = this.me.fid;
    if (kind === 'req' && id === f) {
      const from = tail[3];
      if (!buf.length) { this.reqs.delete(from); }
      else {
        const m = dec(buf);
        if (!m || from === f) return;
        if (this.list.some((x) => x.id === from)) this.accept(from, m.n);
        else this.reqs.set(from, { id: from, name: String(m.n || 'Pemain').slice(0, 14) });
      }
      this.onChange();
    } else if (kind === 'acc' && id === f) {
      const from = tail[3];
      if (!buf.length) return;
      const m = dec(buf);
      if (m) this._add(from, m.n);
      this.c.publish(`${NS}/f/${f}/acc/${from}`, '', { retain: true });
    } else if (kind === 'st') {
      if (!buf.length) this.st.delete(id);
      else { const m = dec(buf); if (m) this.st.set(id, m); }
      this.onChange();
    } else if (kind === 'pf' && this.searching) {
      const m = dec(buf);
      if (m && id !== f) this.found.set(id, { id, name: String(m.n || '').slice(0, 14) });
    }
  }

  _add(id, name) {
    const ex = this.list.find((x) => x.id === id);
    if (ex) { if (name) ex.name = String(name).slice(0, 14); }
    else this.list.push({ id, name: String(name || 'Teman').slice(0, 14) });
    wr(this.list);
    this._sub();
    this.onChange();
  }

  /* cari berdasarkan nama atau kode teman */
  search(q) {
    q = String(q || '').trim();
    return new Promise((resolve) => {
      if (!this.c || !this.c.connected) { resolve(null); return; }
      this.found = new Map(); this.searching = true;
      this.c.subscribe(`${NS}/f/+/pf`);
      setTimeout(() => {
        this.searching = false;
        try { this.c.unsubscribe(`${NS}/f/+/pf`); } catch (e) { /* abaikan */ }
        const up = q.toUpperCase(), lo = q.toLowerCase();
        const out = [...this.found.values()].filter((x) => x.id === up || (lo && x.name.toLowerCase().includes(lo)));
        resolve(out.slice(0, 12));
      }, 2200);
    });
  }

  isFriend(id) { return this.list.some((x) => x.id === id); }

  request(id) {
    if (!this.c || !this.c.connected) return false;
    this.c.publish(`${NS}/f/${id}/req/${this.me.fid}`, enc({ n: this.me.name }), { retain: true });
    return true;
  }

  accept(id, name) {
    const r = this.reqs.get(id);
    this._add(id, name || (r && r.name));
    this.reqs.delete(id);
    if (this.c && this.c.connected) {
      this.c.publish(`${NS}/f/${id}/acc/${this.me.fid}`, enc({ n: this.me.name }), { retain: true });
      this.c.publish(`${NS}/f/${this.me.fid}/req/${id}`, '', { retain: true });
    }
    this.onChange();
  }

  reject(id) {
    this.reqs.delete(id);
    if (this.c && this.c.connected) this.c.publish(`${NS}/f/${this.me.fid}/req/${id}`, '', { retain: true });
    this.onChange();
  }

  remove(id) {
    this.list = this.list.filter((x) => x.id !== id);
    this.st.delete(id);
    wr(this.list);
    if (this.c) { try { this.c.unsubscribe(`${NS}/f/${id}/st`); } catch (e) { /* abaikan */ } }
    this.onChange();
  }

  /* status teman: offline | online | playing (dengan id room untuk masuk) */
  status(id) {
    const m = this.st.get(id);
    if (!m || Date.now() - (m.ts || 0) > 90000) return { s: 'offline' };
    if (m.room) return { s: 'playing', room: m.room, rn: m.rn || '' };
    return { s: 'online' };
  }

  close() {
    clearInterval(this.hb); clearTimeout(this.retry);
    if (this.c) { try { this.c.publish(`${NS}/f/${this.me.fid}/st`, '', { retain: true }); this.c.end(true); } catch (e) { /* abaikan */ } }
    this.c = null;
  }
}
