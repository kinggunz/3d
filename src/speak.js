/* SUARA BICARA bahasa Indonesia memakai mesin suara (TTS) bawaan HP.
   Android: plugin Capacitor Text-to-Speech (id-ID). Cadangan: speechSynthesis browser.
   Bila tidak ada mesin suara sama sekali, tidak ada suara (teks tetap tampil) — tidak ada bunyi acak. */
import { Capacitor } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';

let mode = null; /* 'native' | 'web' | 'none' */
function detect() {
  if (mode) return mode;
  try { if (Capacitor.isNativePlatform()) { mode = 'native'; return mode; } } catch (e) { /* abaikan */ }
  mode = (typeof window !== 'undefined' && window.speechSynthesis && typeof SpeechSynthesisUtterance !== 'undefined') ? 'web' : 'none';
  return mode;
}
export function ttsAvailable() { return detect() !== 'none'; }

/* tokoh: pitch & kecepatan berbeda */
const VOICE = {
  0: { pitch: 0.75, rate: 0.95 }, /* kopilot */
  1: { pitch: 1.0, rate: 1.0 }, /* pemain (disesuaikan jenis kelamin) */
  2: { pitch: 1.35, rate: 1.0 }, /* petugas / penumpang wanita */
  3: { pitch: 1.2, rate: 1.0 }, /* pengumuman */
  4: { pitch: 0.55, rate: 0.9 }, /* kapten */
};

export function say(text, kind = 0, opt = {}) {
  const m = detect();
  if (m === 'none' || !text) return;
  const v = Object.assign({}, VOICE[kind] || VOICE[0]);
  if (kind === 1) v.pitch = opt.gender === 'P' ? 1.3 : 0.85;
  const pitch = v.pitch, rate = (opt.rate || 1) * v.rate * (opt.shout ? 1.12 : 1), volume = opt.volume == null ? 1 : opt.volume;
  if (m === 'native') {
    TextToSpeech.stop().catch(() => {}).then(() => TextToSpeech.speak({ text, lang: 'id-ID', rate, pitch, volume, category: 'ambient' })).catch(() => {});
  } else {
    try {
      const ss = window.speechSynthesis;
      ss.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'id-ID';
      const vo = (ss.getVoices() || []).find((x) => /^id/i.test(x.lang));
      if (vo) u.voice = vo;
      u.pitch = pitch; u.rate = rate; u.volume = volume;
      ss.speak(u);
    } catch (e) { /* abaikan */ }
  }
}

export function stopSay() {
  const m = detect();
  if (m === 'native') TextToSpeech.stop().catch(() => {});
  else if (m === 'web') { try { window.speechSynthesis.cancel(); } catch (e) { /* abaikan */ } }
}
