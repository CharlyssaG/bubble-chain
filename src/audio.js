// ═══════════════════════════════════════════════════════════
//  AUDIO — Synthesized pop sounds per bubble type
//  Uses Web Audio API. Each type has a distinct timbre.
//  Stereo-panned based on screen x position.
// ═══════════════════════════════════════════════════════════

let ctx = null;
let masterGain = null;
let enabled = true;

// Lazy-init audio context (must be created after a user gesture)
function getCtx() {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.35;
    masterGain.connect(ctx.destination);
  } catch (e) {
    return null;
  }
  return ctx;
}

// Resume context (needed on mobile after first gesture)
export function resumeAudio() {
  const c = getCtx();
  if (c && c.state === "suspended") c.resume();
}

export function setAudioEnabled(v) {
  enabled = v;
  if (masterGain) masterGain.gain.value = v ? 0.35 : 0;
}

export function isAudioEnabled() {
  return enabled;
}

// Create a panner for stereo positioning based on x/width (0..1)
function makePanner(panValue) {
  const c = getCtx();
  if (!c) return null;
  // StereoPannerNode is widely supported but fall back if not
  if (c.createStereoPanner) {
    const p = c.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, panValue));
    return p;
  }
  // Fallback: just return gain (no panning)
  return c.createGain();
}

// Utility: make a quick gain envelope
function envelope(gainNode, attack, hold, release, peak = 1) {
  const c = getCtx();
  const t = c.currentTime;
  gainNode.gain.setValueAtTime(0, t);
  gainNode.gain.linearRampToValueAtTime(peak, t + attack);
  gainNode.gain.setValueAtTime(peak, t + attack + hold);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
}

// Build a noise buffer
let noiseBuffer = null;
function getNoiseBuffer() {
  const c = getCtx();
  if (!c) return null;
  if (noiseBuffer) return noiseBuffer;
  const length = c.sampleRate * 0.5;
  noiseBuffer = c.createBuffer(1, length, c.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return noiseBuffer;
}

// ── Per-type synth functions ─────────────────────────────

// Classic bubble pop — descending bloop
function playNormal(pan) {
  const c = getCtx();
  if (!c || !enabled) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  const filter = c.createBiquadFilter();
  const p = makePanner(pan);

  osc.type = "sine";
  const t = c.currentTime;
  osc.frequency.setValueAtTime(680 + Math.random() * 80, t);
  osc.frequency.exponentialRampToValueAtTime(120, t + 0.12);

  filter.type = "lowpass";
  filter.frequency.value = 1800;

  envelope(gain, 0.002, 0.01, 0.11, 0.7);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(p);
  p.connect(masterGain);
  osc.start(t);
  osc.stop(t + 0.2);
}

// Tiny version of normal for small bubbles
function playSmall(pan) {
  const c = getCtx();
  if (!c || !enabled) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  const p = makePanner(pan);

  osc.type = "sine";
  const t = c.currentTime;
  osc.frequency.setValueAtTime(1400 + Math.random() * 200, t);
  osc.frequency.exponentialRampToValueAtTime(500, t + 0.06);

  envelope(gain, 0.001, 0.005, 0.05, 0.35);

  osc.connect(gain);
  gain.connect(p);
  p.connect(masterGain);
  osc.start(t);
  osc.stop(t + 0.08);
}

// Airy breath/whisper for ghosts
function playGhost(pan) {
  const c = getCtx();
  if (!c || !enabled) return;
  const src = c.createBufferSource();
  src.buffer = getNoiseBuffer();
  const gain = c.createGain();
  const filter = c.createBiquadFilter();
  const p = makePanner(pan);

  filter.type = "bandpass";
  filter.frequency.value = 2200;
  filter.Q.value = 2;

  const t = c.currentTime;
  filter.frequency.setValueAtTime(3000, t);
  filter.frequency.exponentialRampToValueAtTime(800, t + 0.25);

  envelope(gain, 0.03, 0.05, 0.2, 0.3);

  src.connect(filter);
  filter.connect(gain);
  gain.connect(p);
  p.connect(masterGain);
  src.start(t);
  src.stop(t + 0.3);
}

// Deep thunk for heavy
function playHeavy(pan) {
  const c = getCtx();
  if (!c || !enabled) return;
  const osc = c.createOscillator();
  const osc2 = c.createOscillator();
  const gain = c.createGain();
  const filter = c.createBiquadFilter();
  const p = makePanner(pan);

  osc.type = "sine";
  osc2.type = "triangle";
  const t = c.currentTime;
  osc.frequency.setValueAtTime(120, t);
  osc.frequency.exponentialRampToValueAtTime(55, t + 0.18);
  osc2.frequency.setValueAtTime(240, t);
  osc2.frequency.exponentialRampToValueAtTime(110, t + 0.18);

  filter.type = "lowpass";
  filter.frequency.value = 600;

  envelope(gain, 0.003, 0.02, 0.22, 0.9);

  osc.connect(filter);
  osc2.connect(filter);
  filter.connect(gain);
  gain.connect(p);
  p.connect(masterGain);
  osc.start(t); osc2.start(t);
  osc.stop(t + 0.28); osc2.stop(t + 0.28);
}

// Crystal chime cluster for splitter
function playSplitter(pan) {
  const c = getCtx();
  if (!c || !enabled) return;
  const t = c.currentTime;
  const notes = [880, 1175, 1480]; // A5, D6, F#6 — major-ish chord
  for (let i = 0; i < notes.length; i++) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    const p = makePanner(pan + (i - 1) * 0.15);
    osc.type = "sine";
    osc.frequency.value = notes[i] + (Math.random() - 0.5) * 10;
    gain.gain.setValueAtTime(0, t + i * 0.025);
    gain.gain.linearRampToValueAtTime(0.28, t + i * 0.025 + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.025 + 0.4);
    osc.connect(gain);
    gain.connect(p);
    p.connect(masterGain);
    osc.start(t + i * 0.025);
    osc.stop(t + i * 0.025 + 0.45);
  }
}

// Whoosh/zip for fast
function playFast(pan) {
  const c = getCtx();
  if (!c || !enabled) return;
  const src = c.createBufferSource();
  src.buffer = getNoiseBuffer();
  const gain = c.createGain();
  const filter = c.createBiquadFilter();
  const p = makePanner(pan);

  filter.type = "bandpass";
  filter.Q.value = 6;
  const t = c.currentTime;
  filter.frequency.setValueAtTime(400, t);
  filter.frequency.exponentialRampToValueAtTime(4000, t + 0.12);

  envelope(gain, 0.005, 0.01, 0.12, 0.4);

  src.connect(filter);
  filter.connect(gain);
  gain.connect(p);
  p.connect(masterGain);
  src.start(t);
  src.stop(t + 0.18);
}

// Wooden knock for anchor
function playAnchor(pan) {
  const c = getCtx();
  if (!c || !enabled) return;
  const src = c.createBufferSource();
  src.buffer = getNoiseBuffer();
  const osc = c.createOscillator();
  const gain = c.createGain();
  const filter = c.createBiquadFilter();
  const p = makePanner(pan);

  osc.type = "triangle";
  const t = c.currentTime;
  osc.frequency.setValueAtTime(220, t);
  osc.frequency.exponentialRampToValueAtTime(90, t + 0.08);

  filter.type = "lowpass";
  filter.frequency.value = 900;

  envelope(gain, 0.001, 0.003, 0.09, 0.55);

  src.connect(filter);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(p);
  p.connect(masterGain);
  osc.start(t); src.start(t);
  osc.stop(t + 0.12); src.stop(t + 0.12);
}

// Metallic ping with tail for magnet
function playMagnet(pan) {
  const c = getCtx();
  if (!c || !enabled) return;
  const t = c.currentTime;
  const freqs = [520, 780, 1300]; // inharmonic metallic partials
  for (let i = 0; i < freqs.length; i++) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    const p = makePanner(pan);
    osc.type = "sine";
    osc.frequency.value = freqs[i];
    const peak = 0.25 / (i + 1);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(peak, t + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5 - i * 0.05);
    osc.connect(gain);
    gain.connect(p);
    p.connect(masterGain);
    osc.start(t);
    osc.stop(t + 0.55);
  }
}

// Glass tap for shield
function playShield(pan) {
  const c = getCtx();
  if (!c || !enabled) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  const filter = c.createBiquadFilter();
  const p = makePanner(pan);

  osc.type = "sine";
  const t = c.currentTime;
  osc.frequency.value = 1850;

  filter.type = "highpass";
  filter.frequency.value = 1200;

  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.4, t + 0.001);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(p);
  p.connect(masterGain);
  osc.start(t);
  osc.stop(t + 0.3);
}

// Warble/glitch for teleporter
function playTeleporter(pan) {
  const c = getCtx();
  if (!c || !enabled) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  const p = makePanner(pan);

  osc.type = "square";
  const t = c.currentTime;
  // Stutter through random pitches
  const steps = 5;
  for (let i = 0; i < steps; i++) {
    const f = 400 + Math.random() * 1400;
    osc.frequency.setValueAtTime(f, t + i * 0.025);
  }

  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.15, t + 0.005);
  gain.gain.setValueAtTime(0.15, t + 0.11);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);

  osc.connect(gain);
  gain.connect(p);
  p.connect(masterGain);
  osc.start(t);
  osc.stop(t + 0.2);
}

// Deep boom with crackle for bomb
function playBomb(pan) {
  const c = getCtx();
  if (!c || !enabled) return;
  const osc = c.createOscillator();
  const src = c.createBufferSource();
  src.buffer = getNoiseBuffer();
  const oscGain = c.createGain();
  const noiseGain = c.createGain();
  const noiseFilter = c.createBiquadFilter();
  const p = makePanner(pan);

  osc.type = "sine";
  const t = c.currentTime;
  osc.frequency.setValueAtTime(80, t);
  osc.frequency.exponentialRampToValueAtTime(35, t + 0.35);

  noiseFilter.type = "lowpass";
  noiseFilter.frequency.value = 2000;

  envelope(oscGain, 0.005, 0.03, 0.35, 1);
  envelope(noiseGain, 0.001, 0.02, 0.15, 0.35);

  osc.connect(oscGain);
  src.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  oscGain.connect(p);
  noiseGain.connect(p);
  p.connect(masterGain);
  osc.start(t); src.start(t);
  osc.stop(t + 0.45); src.stop(t + 0.2);
}

// ── Public API ───────────────────────────────────────────
const SOUNDS = {
  normal: playNormal,
  small: playSmall,
  ghost: playGhost,
  heavy: playHeavy,
  splitter: playSplitter,
  fast: playFast,
  anchor: playAnchor,
  magnet: playMagnet,
  shield: playShield,
  teleporter: playTeleporter,
  bomb: playBomb,
};

// Play the pop sound for a bubble type, with pan based on x position (0..1)
export function playPop(type, xNormalized) {
  const fn = SOUNDS[type] || playNormal;
  // Pan range: -0.7 to +0.7 (subtle, not fully left/right)
  const pan = (xNormalized - 0.5) * 1.4;
  try { fn(pan); } catch (e) { /* ignore */ }
}
