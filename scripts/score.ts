// The film's original score and sound design, synthesised from nothing.
//
// Every sound is generated here sample by sample and placed on the same cue
// sheet the picture uses (src/film/timeline.ts), so music, effects and frames
// cannot drift apart: move a cue there, run this again, and the sound moves
// with the picture. The only recorded material is the eight short effects
// carried over from the first Sulcus film (public/audio/sfx), layered under
// the synthesised ones.
//
//   node --experimental-strip-types scripts/score.ts
//
// Writes public/audio/sulcus-score.wav (48 kHz, 24-bit stereo) and prints a
// loudness report.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BAR, bar, BEAT, connectAt, FILM_SECONDS, T } from "../src/film/timeline.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SR = 48000;
const N = Math.round(FILM_SECONDS * SR);
const TAU = Math.PI * 2;

// ── basics ──────────────────────────────────────────────────────────────

type Bus = { L: Float32Array; R: Float32Array };
const bus = (): Bus => ({ L: new Float32Array(N), R: new Float32Array(N) });
const db = (x: number) => Math.pow(10, x / 20);
const toDb = (x: number) => 20 * Math.log10(Math.max(x, 1e-12));
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

let seed = 1234567;
const rnd = () => {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const noise = () => rnd() * 2 - 1;

// Smooth interpolation through [time, value] keys.
const env = (keys: number[][], t: number) => {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      const [t0, v0] = keys[i - 1];
      const [t1, v1] = keys[i];
      const x = (t - t0) / (t1 - t0);
      return v0 + (v1 - v0) * (0.5 - 0.5 * Math.cos(Math.PI * x));
    }
  }
  return keys[keys.length - 1][1];
};

const panGains = (pan: number): [number, number] => {
  const a = ((clamp01((pan + 1) / 2)) * Math.PI) / 2;
  return [Math.cos(a), Math.sin(a)];
};

// State-variable filter (TPT form): stable under fast cutoff sweeps.
class SVF {
  ic1 = 0;
  ic2 = 0;
  a1 = 0;
  a2 = 0;
  a3 = 0;
  k = 1;
  lp = 0;
  bp = 0;
  hp = 0;
  set(fc: number, q: number) {
    const g = Math.tan(Math.PI * Math.min(fc, SR * 0.45) / SR);
    this.k = 1 / q;
    this.a1 = 1 / (1 + g * (g + this.k));
    this.a2 = g * this.a1;
    this.a3 = g * this.a2;
  }
  run(x: number) {
    const v3 = x - this.ic2;
    const v1 = this.a1 * this.ic1 + this.a2 * v3;
    const v2 = this.ic2 + this.a2 * this.ic1 + this.a3 * v3;
    this.ic1 = 2 * v1 - this.ic1;
    this.ic2 = 2 * v2 - this.ic2;
    this.lp = v2;
    this.bp = v1;
    this.hp = x - this.k * v1 - v2;
    return v2;
  }
}

// Band-limited sawtooth.
const blep = (p: number, dt: number) => {
  if (p < dt) {
    const x = p / dt;
    return x + x - x * x - 1;
  }
  if (p > 1 - dt) {
    const x = (p - 1) / dt;
    return x * x + x + x + 1;
  }
  return 0;
};
const saw = (p: number, dt: number) => 2 * p - 1 - blep(p, dt);

// ── voices ──────────────────────────────────────────────────────────────

// A plucked synth note: two detuned saws through a closing filter.
const pluck = (
  out: Bus,
  t: number,
  freq: number,
  decay: number,
  gain: number,
  pan: number,
  cutoff: number,
) => {
  const i0 = Math.round(t * SR);
  const len = Math.min(N - i0, Math.round((decay * 5 + 0.02) * SR));
  if (i0 < 0 || len <= 0) return;
  const f = new SVF();
  const [gl, gr] = panGains(pan);
  let p1 = rnd();
  let p2 = rnd();
  const d1 = (freq * 1.004) / SR;
  const d2 = (freq * 0.996) / SR;
  for (let i = 0; i < len; i++) {
    const x = i / SR;
    if (i % 24 === 0)
      f.set(cutoff * (0.35 + 0.65 * Math.exp(-x / (decay * 0.55))) + 120, 1.4);
    p1 += d1;
    if (p1 >= 1) p1 -= 1;
    p2 += d2;
    if (p2 >= 1) p2 -= 1;
    const a = Math.min(1, x / 0.003) * Math.exp(-x / decay);
    const s = f.run(saw(p1, d1) + saw(p2, d2)) * a * gain * 0.5;
    out.L[i0 + i] += s * gl;
    out.R[i0 + i] += s * gr;
  }
};

// A sustained pad note: four detuned saws, slow attack, moving filter.
const padNote = (
  out: Bus,
  t0: number,
  t1: number,
  freq: number,
  gain: number,
  cutoff: (t: number) => number,
  attack = 0.5,
  release = 0.9,
) => {
  const i0 = Math.max(0, Math.round(t0 * SR));
  const i1 = Math.min(N, Math.round((t1 + release) * SR));
  const cents = [-12, -4, 5, 11];
  const ph = cents.map(() => rnd());
  const dt = cents.map((c) => (freq * Math.pow(2, c / 1200)) / SR);
  const pans = [-0.7, 0.3, -0.25, 0.75];
  const fl = new SVF();
  const fr = new SVF();
  for (let i = i0; i < i1; i++) {
    const t = i / SR;
    if ((i - i0) % 32 === 0) {
      const c = cutoff(t);
      fl.set(c, 0.8);
      fr.set(c * 1.03, 0.8);
    }
    let l = 0;
    let r = 0;
    for (let v = 0; v < 4; v++) {
      ph[v] += dt[v];
      if (ph[v] >= 1) ph[v] -= 1;
      const s = saw(ph[v], dt[v]);
      l += s * (0.5 - 0.5 * pans[v]);
      r += s * (0.5 + 0.5 * pans[v]);
    }
    const a =
      Math.min(1, (t - t0) / attack) *
      (t > t1 ? Math.max(0, 1 - (t - t1) / release) : 1);
    const g = a * a * gain * 0.25;
    out.L[i] += fl.run(l) * g;
    out.R[i] += fr.run(r) * g;
  }
};

// Bass: a saw with a sine under it, short and filtered.
const bassNote = (
  out: Bus,
  t: number,
  freq: number,
  dur: number,
  gain: number,
  cutoff: number,
) => {
  const i0 = Math.round(t * SR);
  const len = Math.min(N - i0, Math.round((dur + 0.08) * SR));
  if (i0 < 0 || len <= 0) return;
  const f = new SVF();
  let p = 0;
  const dt = freq / SR;
  for (let i = 0; i < len; i++) {
    const x = i / SR;
    if (i % 24 === 0) f.set(cutoff * (1 + 2.2 * Math.exp(-x / 0.07)), 1.1);
    p += dt;
    if (p >= 1) p -= 1;
    const a =
      Math.min(1, x / 0.004) *
      (0.55 + 0.45 * Math.exp(-x / 0.12)) *
      (x > dur ? Math.max(0, 1 - (x - dur) / 0.06) : 1);
    const s =
      (f.run(saw(p, dt)) * 0.7 + Math.sin(TAU * p) * 0.75) * a * gain;
    out.L[i0 + i] += s;
    out.R[i0 + i] += s;
  }
};

const kick = (out: Bus, t: number, gain: number, deep = 1) => {
  const i0 = Math.round(t * SR);
  const len = Math.min(N - i0, Math.round(0.5 * SR));
  if (i0 < 0 || len <= 0) return;
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const x = i / SR;
    const f = 44 * deep + 120 * Math.exp(-x / 0.028);
    ph += f / SR;
    const s =
      (Math.sin(TAU * ph) * Math.exp(-x / 0.19) +
        (x < 0.003 ? noise() * 0.5 * (1 - x / 0.003) : 0)) *
      gain;
    out.L[i0 + i] += s;
    out.R[i0 + i] += s;
  }
};

// Filtered noise burst: hats, snaps, ticks, crashes.
const burst = (
  out: Bus,
  t: number,
  decay: number,
  gain: number,
  pan: number,
  fc: number,
  q: number,
  mode: "bp" | "hp" | "lp",
  sweep = 1,
) => {
  const i0 = Math.round(t * SR);
  const len = Math.min(N - i0, Math.round((decay * 6 + 0.01) * SR));
  if (i0 < 0 || len <= 0) return;
  const f = new SVF();
  const [gl, gr] = panGains(pan);
  f.set(fc, q);
  for (let i = 0; i < len; i++) {
    const x = i / SR;
    if (sweep !== 1 && i % 32 === 0)
      f.set(fc * Math.pow(sweep, Math.min(1, x / (decay * 4))), q);
    f.run(noise());
    const v = mode === "bp" ? f.bp : mode === "hp" ? f.hp : f.lp;
    const s = v * Math.min(1, x / 0.0008) * Math.exp(-x / decay) * gain;
    out.L[i0 + i] += s * gl;
    out.R[i0 + i] += s * gr;
  }
};

// A clean pitched tone with a few partials: pings, blips, bells.
const tone = (
  out: Bus,
  t: number,
  freq: number,
  decay: number,
  gain: number,
  pan: number,
  partials: number[] = [1, 0.3, 0.1],
  glide = 1,
) => {
  const i0 = Math.round(t * SR);
  const len = Math.min(N - i0, Math.round((decay * 7 + 0.01) * SR));
  if (i0 < 0 || len <= 0) return;
  const [gl, gr] = panGains(pan);
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const x = i / SR;
    ph += (freq * Math.pow(glide, Math.min(1, x / (decay * 2)))) / SR;
    let s = 0;
    for (let k = 0; k < partials.length; k++)
      s += partials[k] * Math.sin(TAU * ph * (k + 1)) * Math.exp((-x * k) / decay);
    s *= Math.min(1, x / 0.002) * Math.exp(-x / decay) * gain;
    out.L[i0 + i] += s * gl;
    out.R[i0 + i] += s * gr;
  }
};

// Low impact: a sine falling in pitch, with a thump of noise on top.
const boom = (
  out: Bus,
  t: number,
  f0: number,
  f1: number,
  decay: number,
  gain: number,
) => {
  const i0 = Math.round(t * SR);
  const len = Math.min(N - i0, Math.round(decay * 5 * SR));
  if (i0 < 0 || len <= 0) return;
  const f = new SVF();
  f.set(160, 0.7);
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const x = i / SR;
    ph += (f1 + (f0 - f1) * Math.exp(-x / 0.09)) / SR;
    const s =
      (Math.sin(TAU * ph) * Math.exp(-x / decay) +
        f.run(noise()) * 1.6 * Math.exp(-x / 0.12)) *
      Math.min(1, x / 0.002) *
      gain;
    out.L[i0 + i] += s;
    out.R[i0 + i] += s;
  }
};

// Noise swept through a band: risers, whooshes, the collapse.
const sweep = (
  out: Bus,
  t0: number,
  t1: number,
  f0: number,
  f1: number,
  gain: number,
  shape: (x: number) => number,
  q = 1.6,
) => {
  const i0 = Math.max(0, Math.round(t0 * SR));
  const i1 = Math.min(N, Math.round(t1 * SR));
  const fl = new SVF();
  const fr = new SVF();
  for (let i = i0; i < i1; i++) {
    const x = (i - i0) / (i1 - i0);
    if ((i - i0) % 32 === 0) {
      const fc = f0 * Math.pow(f1 / f0, x);
      fl.set(fc, q);
      fr.set(fc * 1.07, q);
    }
    const a = shape(x) * gain;
    fl.run(noise());
    fr.run(noise());
    out.L[i] += fl.bp * a;
    out.R[i] += fr.bp * a;
  }
};

// A saw whose pitch glides: the tonal half of a riser.
const glideSaw = (
  out: Bus,
  t0: number,
  t1: number,
  f0: number,
  f1: number,
  gain: number,
  shape: (x: number) => number,
  cutoff: number,
) => {
  const i0 = Math.max(0, Math.round(t0 * SR));
  const i1 = Math.min(N, Math.round(t1 * SR));
  const f = new SVF();
  let p1 = 0;
  let p2 = 0.4;
  for (let i = i0; i < i1; i++) {
    const x = (i - i0) / (i1 - i0);
    const fr = f0 * Math.pow(f1 / f0, x * x);
    if ((i - i0) % 32 === 0) f.set(cutoff * (0.4 + 1.6 * x), 1.2);
    p1 += fr / SR;
    if (p1 >= 1) p1 -= 1;
    p2 += (fr * 1.007) / SR;
    if (p2 >= 1) p2 -= 1;
    const s = f.run(saw(p1, fr / SR) + saw(p2, fr / SR)) * shape(x) * gain * 0.5;
    out.L[i] += s;
    out.R[i] += s;
  }
};

// ── recorded effects ────────────────────────────────────────────────────

const clipCache = new Map<string, Bus & { n: number }>();
const loadWav = (name: string) => {
  const hit = clipCache.get(name);
  if (hit) return hit;
  const b = fs.readFileSync(path.join(ROOT, "public/audio/sfx", `${name}.wav`));
  const fmt = b.indexOf("fmt ");
  const ch = b.readUInt16LE(fmt + 10);
  const rate = b.readUInt32LE(fmt + 12);
  const data = b.indexOf("data") + 8;
  const frames = Math.floor((b.length - data) / (2 * ch));
  const n = Math.floor((frames * SR) / rate);
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const at = (i: number, c: number) =>
    i < frames ? b.readInt16LE(data + (i * ch + c) * 2) / 32768 : 0;
  for (let i = 0; i < n; i++) {
    const x = (i * rate) / SR;
    const j = Math.floor(x);
    const fr = x - j;
    L[i] = at(j, 0) * (1 - fr) + at(j + 1, 0) * fr;
    R[i] = at(j, ch - 1) * (1 - fr) + at(j + 1, ch - 1) * fr;
  }
  const clip = { L, R, n };
  clipCache.set(name, clip);
  return clip;
};

// Places a recorded effect, normalised so its peak lands at `peakDb`.
const sample = (out: Bus, name: string, t: number, peakDb: number) => {
  const c = loadWav(name);
  let p = 0;
  for (let i = 0; i < c.n; i++) p = Math.max(p, Math.abs(c.L[i]), Math.abs(c.R[i]));
  const g = db(peakDb) / (p || 1);
  const i0 = Math.round(t * SR);
  for (let i = 0; i < c.n && i0 + i < N; i++) {
    out.L[i0 + i] += c.L[i] * g;
    out.R[i0 + i] += c.R[i] * g;
  }
};

// ── space ───────────────────────────────────────────────────────────────

// Feedback delay network reverb: eight lines, Householder feedback, damped.
const reverb = (input: Bus, rt60: number, damp: number, predelay = 0.02): Bus => {
  const out = bus();
  const lens = [1423, 1777, 1973, 2099, 2543, 2879, 3251, 3511];
  const lines = lens.map((l) => new Float32Array(l));
  const idx = lens.map(() => 0);
  const gains = lens.map((l) => Math.pow(10, (-3 * l) / (rt60 * SR)));
  const lp = lens.map(() => 0);
  // Input diffusion.
  const apLens = [113, 337, 541];
  const ap = apLens.map((l) => [new Float32Array(l), new Float32Array(l)]);
  const apIdx = apLens.map(() => 0);
  const pd = Math.round(predelay * SR);
  const vals = new Float32Array(8);
  for (let i = 0; i < N; i++) {
    let l = i >= pd ? input.L[i - pd] : 0;
    let r = i >= pd ? input.R[i - pd] : 0;
    for (let a = 0; a < apLens.length; a++) {
      const j = apIdx[a];
      const bl = ap[a][0][j];
      const br = ap[a][1][j];
      const xl = l + bl * 0.6;
      const xr = r + br * 0.6;
      ap[a][0][j] = xl;
      ap[a][1][j] = xr;
      l = bl - xl * 0.6;
      r = br - xr * 0.6;
      apIdx[a] = (j + 1) % apLens[a];
    }
    let sum = 0;
    for (let k = 0; k < 8; k++) {
      vals[k] = lines[k][idx[k]];
      sum += vals[k];
    }
    const fb = sum * 0.25;
    let ol = 0;
    let or = 0;
    for (let k = 0; k < 8; k++) {
      const v = vals[k];
      if (k % 2 === 0) ol += v;
      else or += v;
      lp[k] += (1 - damp) * ((v - fb) * gains[k] - lp[k]);
      lines[k][idx[k]] = lp[k] + (k % 2 === 0 ? l : r);
      idx[k] = (idx[k] + 1) % lens[k];
    }
    out.L[i] = ol * 0.35;
    out.R[i] = or * 0.35;
  }
  return out;
};

// Tempo-synced ping-pong delay.
const pingPong = (input: Bus, time: number, feedback: number): Bus => {
  const out = bus();
  const d = Math.round(time * SR);
  let lpL = 0;
  let lpR = 0;
  for (let i = d; i < N; i++) {
    const inL = (input.L[i - d] + input.R[i - d]) * 0.5;
    lpL += 0.35 * (inL + out.R[i - d] * feedback - lpL);
    lpR += 0.35 * (out.L[i - d] * feedback - lpR);
    out.L[i] = lpL;
    out.R[i] = lpR;
  }
  return out;
};

const mixInto = (dst: Bus, src: Bus, gain: number | ((t: number) => number)) => {
  if (typeof gain === "number") {
    for (let i = 0; i < N; i++) {
      dst.L[i] += src.L[i] * gain;
      dst.R[i] += src.R[i] * gain;
    }
    return;
  }
  let g = 0;
  for (let i = 0; i < N; i++) {
    if (i % 64 === 0) g = gain(i / SR);
    dst.L[i] += src.L[i] * g;
    dst.R[i] += src.R[i] * g;
  }
};

// ── the score ───────────────────────────────────────────────────────────
//
// D minor at 96 BPM. Bars are 2.5 s; scenes change on bar lines.
//
//   bars  1– 4   0.0–10.0   The Agents        hum, air, sparse events
//   bars  5– 8  10.0–20.0   Complexity        pulse → rhythm → riser
//   bar   9     20.0–22.5   CONTROL ISN'T.    cut to near-silence
//   bar  10     22.5–25.0   two pulses on the first agent; a reversed swell
//   bars 11–16  25.0–40.0   Into Sulcus, see, inspect     the groove returns
//   bars 17–20  40.0–50.0   step in, boundaries           brighter
//   bar  21     50.0–52.5   the run is stopped            the band drops out
//   bars 22–26  52.5–65.0   many agents, the workspace
//   bars 27–31  65.0–77.5   integrations, one place       lead line, the build
//   bars 32–35  77.5–87.5   Scale                         the peak, then collapse
//               88.1–94.0   End card                      one impact, long tail

const D = {
  drone: bus(),
  pad: bus(),
  bass: bus(),
  arp: bus(),
  lead: bus(),
  drums: bus(),
  hats: bus(),
  fx: bus(), // synthesised sound design
  rise: bus(), // risers, swells, the collapse
  rec: bus(), // recorded effects from the first film
  hits: bus(), // impacts
  ping: bus(), // pitched pings (delay + long reverb)
};

// Chords from bar 11 on: i – VI – III – VII, one bar each.
type Chord = { root: number; tones: number[]; pad: number[] };
const DM: Chord = { root: 38, tones: [62, 65, 69, 72, 74, 77], pad: [50, 57, 62, 65, 69] };
const BB: Chord = { root: 34, tones: [58, 62, 65, 70, 74, 77], pad: [46, 53, 58, 62, 65] };
const FM: Chord = { root: 41, tones: [60, 65, 69, 72, 77, 81], pad: [53, 57, 60, 65, 69] };
const CM: Chord = { root: 36, tones: [60, 64, 67, 72, 76, 79], pad: [48, 55, 60, 64, 67] };
const LOOP = [DM, BB, FM, CM];
const FIRST = 11; // the groove's first bar
const chordAt = (b: number) => LOOP[(b - FIRST) % 4];

// The structure of the score itself: the big downbeats, and the bar where
// the band stops with the run.
const HITS = [bar(17), bar(23), bar(27), bar(31), bar(32), bar(34)];
const PEAK = bar(32);
const STOP = 21; // bar(21) = T.limitHit
const MID = 17; // brighter from here
const LEAD = 27; // the lead line enters
const level = (b: number) => (b < MID ? 0 : b < PEAK_BAR ? 1 : 2);
const PEAK_BAR = 32;

const FREEZE = T.freeze;
const ONLINE = T.online;
const COLLAPSE = T.collapse;

// ── drone and air (the whole film sits on this) ─────────────────────────
{
  const level = (t: number) =>
    env(
      [
        [0, 0],
        [2.2, 0.5],
        [10, 0.7],
        [FREEZE - 0.1, 1],
        [FREEZE + 0.05, 0.32],
        [ONLINE - 0.1, 0.3],
        [ONLINE + 0.1, 0.5],
        [T.limitHit, 0.5],
        [T.limitHit + 0.1, 0.62],
        [bar(22), 0.5],
        [PEAK, 0.55],
        [COLLAPSE - 0.05, 0.6],
        [T.dark, 0],
        [T.logo - 0.03, 0],
        [T.logo + 0.27, 0.55],
        [T.endFade - 0.4, 0.2],
        [T.endDark - 0.1, 0],
      ],
      t,
    );
  const f = new SVF();
  f.set(170, 0.6);
  const air = new SVF();
  let brown = 0;
  let g = 0;
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    if (i % 64 === 0) {
      g = level(t);
      air.set(2600 + 1400 * Math.sin(t * 0.21), 0.5);
    }
    // A machine hum on D: the fundamental beating slowly against itself.
    const hum =
      Math.sin(TAU * 36.71 * t) * 0.5 +
      Math.sin(TAU * 73.42 * t) * 0.42 +
      Math.sin(TAU * 73.9 * t + 1) * 0.3 +
      Math.sin(TAU * 110 * t) * 0.16 * (0.6 + 0.4 * Math.sin(t * 0.7)) +
      Math.sin(TAU * 146.83 * t) * 0.1 +
      Math.sin(TAU * 220.3 * t) * 0.04 * (0.5 + 0.5 * Math.sin(t * 0.43 + 1));
    brown = (brown + noise() * 0.04) * 0.996;
    const rumble = f.run(brown) * 2.2;
    air.run(noise());
    const hiss = air.bp * 0.012 * (0.5 + 0.5 * Math.sin(t * 0.33 + 2));
    D.drone.L[i] = (hum * 0.2 + rumble) * g + hiss * g * (1 + 0.4 * Math.sin(t * 0.9));
    D.drone.R[i] = (hum * 0.2 + rumble * 0.9) * g + hiss * g * (1 - 0.4 * Math.sin(t * 0.9));
  }
}

// ── pad ─────────────────────────────────────────────────────────────────
{
  // The Agents / Complexity: one chord that slowly opens, then sours.
  const open = (t: number) =>
    env(
      [
        [4, 260],
        [10, 520],
        [15, 1000],
        [FREEZE, 2300],
      ],
      t,
    );
  for (const m of [50, 57, 65]) padNote(D.pad, 4.2, FREEZE - 0.02, midi(m), 0.3, open, 3.5, 0.03);
  padNote(D.pad, 11.5, FREEZE - 0.02, midi(62), 0.24, open, 3, 0.03);
  // Tension: a flat second, then the tritone.
  padNote(D.pad, 15, FREEZE - 0.02, midi(63), 0.24, open, 2.2, 0.03);
  padNote(D.pad, 17.5, FREEZE - 0.02, midi(56), 0.3, open, 1.5, 0.03);
  padNote(D.pad, 17.5, FREEZE - 0.02, midi(75), 0.16, open, 1.5, 0.03);

  // Sulcus onward: the progression, brighter with each act.
  const bright = (t: number) =>
    env(
      [
        [ONLINE, 1500],
        [ONLINE + 1.5, 1000],
        [bar(MID), 1300],
        [bar(LEAD), 1900],
        [PEAK, 2500],
        [T.climax, 3400],
        [COLLAPSE, 3600],
      ],
      t,
    ) * (1.25 + 0.1 * Math.sin(t * 1.3));
  for (let b = FIRST; b <= 35; b++) {
    const c = chordAt(b);
    const t0 = bar(b);
    const t1 = Math.min(COLLAPSE, t0 + BAR);
    if (t0 >= COLLAPSE) break;
    // When the run is stopped the pad holds, darker, on its own.
    const stopped = b === STOP;
    const g = stopped ? 0.3 : [0.36, 0.44, 0.54][level(b)];
    const cut = stopped ? () => 700 : bright;
    for (const m of c.pad) padNote(D.pad, t0, t1 - 0.05, midi(m), g, cut, stopped ? 0.05 : 0.22, 0.5);
    // An octave of air on top from the build on.
    if (b >= LEAD) padNote(D.pad, t0, t1 - 0.05, midi(c.pad[2] + 12), g * 0.5, bright, 0.3, 0.5);
  }

  // End card: an open fifth on D that just rings.
  const end = (t: number) => env([[T.logo, 2600], [T.logo + 4, 700]], t);
  for (const [m, g] of [[38, 0.3], [45, 0.3], [50, 0.38], [57, 0.34], [62, 0.32], [69, 0.2]])
    padNote(D.pad, T.logo, T.logo + 0.6, midi(m), g, end, 0.02, 4.4);
}

// ── bass ────────────────────────────────────────────────────────────────
{
  // Complexity: an eighth-note pulse on D that starts almost inaudible.
  for (let t = 10; t < FREEZE - 0.01; t += BEAT / 2) {
    const g = env([[10, 0.1], [13.5, 0.34], [17.5, 0.5], [FREEZE, 0.62]], t);
    const c = env([[10, 90], [13.5, 150], [FREEZE, 330]], t);
    bassNote(D.bass, t, midi(38), BEAT * 0.36, g, c);
    // Late in the act a second voice joins a sixteenth behind.
    if (t >= 15) bassNote(D.bass, t + BEAT / 4, midi(50), BEAT * 0.18, g * 0.4, c * 1.5);
  }
  // Sulcus onward: eighths on the root, the off-beats lighter.
  for (let b = FIRST; b <= 35; b++) {
    if (b === STOP) continue;
    const c = chordAt(b);
    for (let s = 0; s < 8; s++) {
      const t = bar(b) + (s * BEAT) / 2;
      if (t >= COLLAPSE) break;
      const g = (s % 2 === 0 ? 0.72 : 0.5) * [0.85, 1, 1.12][level(b)];
      const cut = [190, 250, 340][level(b)];
      bassNote(D.bass, t, midi(c.root), BEAT * 0.4, g, cut);
      if (b >= PEAK_BAR && s % 2 === 1) bassNote(D.bass, t, midi(c.root + 12), BEAT * 0.2, g * 0.35, cut * 1.6);
    }
  }
  // While the band is out, one long low D under the stopped run.
  bassNote(D.bass, bar(STOP), midi(38), BAR * 0.9, 0.55, 120);
}

// ── arpeggio ────────────────────────────────────────────────────────────
{
  const PATTERN = [0, 2, 1, 3, 2, 4, 3, 2, 0, 2, 1, 3, 2, 4, 3, 5];
  const ACCENT = [1, 0.5, 0.6, 0.85, 0.5, 0.6, 0.9, 0.5, 1, 0.5, 0.6, 0.85, 0.5, 0.6, 0.9, 0.6];
  // Complexity, from bar 6: D minor seventh, then diminished for the riser.
  const TENSE = [62, 65, 69, 72, 74, 77];
  const DIM = [62, 65, 68, 71, 74, 77];
  for (let b = 6; b <= 8; b++)
    for (let s = 0; s < 16; s++) {
      const t = bar(b) + (s * BEAT) / 4;
      const tones = b === 8 ? DIM : TENSE;
      const g = env([[12.5, 0.12], [15, 0.3], [FREEZE, 0.5]], t) * ACCENT[s];
      const cut = env([[12.5, 500], [17.5, 1300], [FREEZE, 2600]], t);
      pluck(D.arp, t, midi(tones[PATTERN[s]]), 0.11, g, s % 2 ? 0.45 : -0.45, cut);
      // The last bar doubles up: 32nds, an octave higher.
      if (b === 8 && s >= 8)
        pluck(D.arp, t + BEAT / 8, midi(tones[PATTERN[s]] + 12), 0.07, g * 0.6, s % 2 ? -0.6 : 0.6, cut);
    }
  // Sulcus onward: the same figure, now on the progression and in time.
  for (let b = FIRST; b <= 35; b++) {
    if (b === STOP) continue;
    const c = chordAt(b);
    for (let s = 0; s < 16; s++) {
      const t = bar(b) + (s * BEAT) / 4;
      if (t >= COLLAPSE) break;
      // It enters after the impact has cleared.
      if (b === FIRST && s < 8) continue;
      const g = [0.26, 0.34, 0.42][level(b)] * ACCENT[s];
      const cut = [1500, 2300, 3600][level(b)];
      pluck(D.arp, t, midi(c.tones[PATTERN[s]]), 0.13, g, s % 2 ? 0.4 : -0.4, cut);
      if (b >= PEAK_BAR) pluck(D.arp, t, midi(c.tones[PATTERN[(s + 5) % 16]] + 12), 0.1, g * 0.5, s % 2 ? -0.65 : 0.65, cut);
    }
  }
}

// ── lead: half notes over the build and the peak ────────────────────────
{
  const LINE: Record<string, number[]> = {
    D: [77, 81],
    B: [74, 77],
    F: [72, 81],
    C: [79, 76],
  };
  const key = (c: Chord) => (c === DM ? "D" : c === BB ? "B" : c === FM ? "F" : "C");
  for (let b = LEAD; b <= 35; b++) {
    const notes = LINE[key(chordAt(b))];
    for (let h = 0; h < 2; h++) {
      const t0 = bar(b) + h * BEAT * 2;
      if (t0 >= COLLAPSE) break;
      const t1 = Math.min(COLLAPSE, t0 + BEAT * 2);
      const up = b >= PEAK_BAR ? 12 : 0;
      const g = b >= PEAK_BAR ? 0.4 : 0.26;
      padNote(D.lead, t0, t1 - 0.08, midi(notes[h] + up), g, () => (b >= PEAK_BAR ? 4200 : 2600), 0.09, 0.45);
      if (b >= PEAK_BAR) padNote(D.lead, t0, t1 - 0.08, midi(notes[h]), g * 0.7, () => 3000, 0.09, 0.45);
    }
  }
}

// ── drums ───────────────────────────────────────────────────────────────
const kicks: number[] = [];
{
  const K = (t: number, g: number) => {
    kick(D.drums, t, g);
    kicks.push(t);
  };
  const snap = (t: number, g: number) => {
    burst(D.drums, t, 0.07, g * 1.5, 0, 1700, 1.1, "bp");
    burst(D.drums, t, 0.035, g * 0.7, 0, 4200, 0.9, "hp");
    tone(D.drums, t, 196, 0.035, g * 0.45, 0, [1]);
  };
  const hat = (t: number, g: number, open = false) =>
    burst(D.hats, t, open ? 0.09 : 0.016, g, (rnd() - 0.5) * 0.5, 8200, 0.9, "hp");

  // Complexity: a heartbeat, then a kick, then hats crowding in.
  for (let t = 10; t < 12.5; t += BEAT) tone(D.drums, t, 52, 0.09, env([[10, 0.1], [12.5, 0.3]], t), 0, [1]);
  for (let b = 6; b <= 8; b++)
    for (let q = 0; q < 4; q++) {
      const t = bar(b) + q * BEAT;
      if (b < 8 ? q % 2 === 0 : true) K(t, b === 8 ? 0.85 : 0.7);
    }
  for (let t = 11.25; t < FREEZE - 0.01; t += BEAT / 4) {
    const step = Math.round((t - 11.25) / (BEAT / 4));
    const dense = t >= 15;
    if (!dense && step % 2 === 1) continue;
    hat(t, env([[11.25, 0.03], [15, 0.1], [FREEZE, 0.2]], t) * (step % 4 === 2 ? 1.5 : 1));
  }
  // The roll into the cut: sixteenths, then thirty-seconds.
  for (let t = FREEZE - 1.25; t < FREEZE - 0.01; t += t < FREEZE - 0.625 ? BEAT / 4 : BEAT / 8)
    snap(t, env([[FREEZE - 1.25, 0.12], [FREEZE, 0.5]], t));

  // Sulcus onward: half-time. Kick on one, a push before three, snap on three.
  for (let b = FIRST; b <= 35; b++) {
    const t0 = bar(b);
    if (b === STOP) {
      K(t0, 1); // the stop itself
      continue;
    }
    const big = b >= PEAK_BAR;
    const mid = b >= MID;
    for (const [beat, g] of [
      [0, 1],
      [1.5, 0.72],
      ...(mid ? [[3.5, 0.6]] : []),
      ...(big ? [[2.5, 0.66]] : []),
    ]) {
      const t = t0 + beat * BEAT;
      if (t < COLLAPSE) K(t, g * (big ? 1 : 0.9));
    }
    const ts = t0 + 2 * BEAT;
    if (ts < COLLAPSE) snap(ts, big ? 0.62 : mid ? 0.52 : 0.42);
    for (let s = 0; s < 16; s++) {
      const t = t0 + (s * BEAT) / 4;
      if (t >= COLLAPSE) break;
      if (b === FIRST && s < 8) continue;
      // Coming back after the stop, the hats wait for the second half.
      if (b === STOP + 1 && s < 8) continue;
      const accent = s % 4 === 2 ? 1.6 : s % 2 === 0 ? 1 : 0.6;
      hat(t, (big ? 0.15 : mid ? 0.12 : 0.085) * accent, mid && s % 8 === 6);
    }
  }
  // Fills into the downbeats that open each act.
  for (const [end, from] of [[bar(MID), bar(MID) - 1.25], [bar(23), bar(23) - 1.25], [bar(LEAD), bar(LEAD) - 1.25], [PEAK, PEAK - 2.5]])
    for (let t = from; t < end - 0.01; t += t < end - BEAT ? BEAT / 4 : BEAT / 8)
      snap(t, env([[from, 0.08], [end, 0.5]], t));
  for (const t of [bar(MID) - BEAT, bar(MID) - BEAT / 2, PEAK - BEAT, PEAK - BEAT / 2])
    tone(D.drums, t, 82, 0.16, 0.5, 0, [1, 0.3], 0.7);
}

// ── impacts ─────────────────────────────────────────────────────────────
{
  const crash = (t: number, g: number, decay = 1.4) =>
    burst(D.hits, t, decay, g, 0, 5200, 0.6, "hp", 0.35);
  // CONTROL ISN'T.: everything stops on a single low hit.
  boom(D.hits, FREEZE, 110, 34, 0.42, 1.3);
  burst(D.hits, FREEZE, 0.12, 0.9, 0, 300, 0.8, "lp");
  // The path snaps into structure: Sulcus.
  boom(D.hits, ONLINE, 120, 36.7, 1.3, 1.3);
  crash(ONLINE, 0.34, 1.7);
  for (const m of [38, 45, 50, 57, 62])
    padNote(D.hits, ONLINE, ONLINE + 0.25, midi(m), 0.4, (t) => 3200 * Math.exp(-(t - ONLINE) / 0.9) + 300, 0.008, 3.2);
  // Bar-line weight through the governed acts.
  for (let b = FIRST + 1; b <= 35; b++) {
    const t = bar(b);
    if (t >= COLLAPSE) break;
    const strong = HITS.includes(t);
    if (strong) {
      boom(D.hits, t, 105, 36.7, 0.9, t >= PEAK ? 1.1 : 0.9);
      crash(t, t >= PEAK ? 0.36 : 0.26, 1.6);
    } else if (b % 2 === 1 && b !== STOP) boom(D.hits, t, 80, 36.7, 0.6, 0.45);
    if (b >= PEAK_BAR) crash(t, 0.2, 1.1);
  }
  // The run is stopped at its limit: a hard, dry stop.
  boom(D.hits, T.limitHit, 130, 40, 0.5, 1.15);
  burst(D.hits, T.limitHit, 0.09, 0.8, 0, 420, 0.8, "lp");
  // The window lands on the ground: the ground comes on.
  boom(D.hits, T.land, 115, 36.7, 1.1, 1.0);
  crash(T.land, 0.24, 1.8);
  // End card.
  boom(D.hits, T.logo, 100, 36.7, 1.2, 1.15);
  crash(T.logo, 0.14, 2.0);
}

// ── risers, swells and the collapse ─────────────────────────────────────
{
  const rise = (x: number) => Math.pow(x, 2.4);
  // Into the freeze: two bars of everything climbing.
  sweep(D.rise, 15, FREEZE, 300, 9000, 0.5, rise);
  glideSaw(D.rise, 17.5, FREEZE, midi(50), midi(74), 0.4, rise, 1200);
  glideSaw(D.rise, 17.5, FREEZE, midi(56), midi(80), 0.26, rise, 1500);
  // Into Sulcus: a reversed breath, out of the silence.
  sweep(D.rise, ONLINE - 1.3, ONLINE, 600, 5200, 0.34, (x) => Math.pow(x, 3.2));
  glideSaw(D.rise, ONLINE - 0.9, ONLINE, midi(38), midi(50), 0.22, (x) => Math.pow(x, 3), 500);
  // Into each big downbeat.
  for (const [t, len, g] of [
    [HITS[0], 1.6, 0.26],
    [HITS[1], 2.2, 0.3],
    [HITS[2], 1.6, 0.26],
    [HITS[3], 2.2, 0.32],
    [HITS[4], 2.4, 0.46],
    [HITS[5], 1.8, 0.34],
  ])
    sweep(D.rise, t - len, t, 400, 8000, g, rise);
  glideSaw(D.rise, PEAK - 2.5, PEAK, midi(50), midi(74), 0.26, rise, 1400);
  // The collapse: everything falls into the core.
  sweep(D.rise, COLLAPSE, T.dark + 0.05, 7000, 90, 0.75, (x) => Math.pow(1 - x, 0.6) * Math.min(1, x * 12), 1.2);
  glideSaw(D.rise, COLLAPSE, T.dark, midi(74), midi(26), 0.5, (x) => 1 - x, 2200);
  tone(D.rise, COLLAPSE, 300, 0.4, 0.5, 0, [1, 0.4], 0.12);
  // Breath in before the logo.
  sweep(D.rise, T.logo - 0.7, T.logo, 500, 3000, 0.16, (x) => Math.pow(x, 3));
}

// ── sound design on picture ─────────────────────────────────────────────
{
  const blip = (t: number, f: number, g: number, pan = 0, decay = 0.03) =>
    tone(D.fx, t, f, decay, g, pan, [1, 0.25]);
  const click = (t: number, g: number, pan = 0, fc = 3000) =>
    burst(D.fx, t, 0.006, g, pan, fc, 2.5, "bp");
  const ping = (t: number, f: number, g: number, pan = 0, decay = 0.4) =>
    tone(D.ping, t, f, decay, g, pan, [1, 0.35, 0.12]);
  const whoosh = (t0: number, t1: number, f0: number, f1: number, g: number) =>
    sweep(D.fx, t0, t1, f0, f1, g, (x) => Math.sin(Math.PI * x));
  const typing = (t: number, n: number, g: number, pan = 0) => {
    for (let k = 0; k < n; k++) click(t + k * 0.045 + rnd() * 0.01, g, pan, 2800 + rnd() * 1600);
  };

  // The Agents — one event at a time.
  sample(D.rec, "agent-start", T.agentStart - 0.02, -15); // an agent starts
  ping(T.agentStart, midi(74), 0.26, 0, 0.5);
  click(T.toolCall - 0.45, 0.2, 0.2); // its path draws…
  blip(T.toolCall, 1320, 0.2, 0.25); // …and the tool call fires
  click(T.toolCall, 0.4, 0.25, 4200);
  for (let i = 0; i < 9; i++) click(T.procWake + i * 0.045 + rnd() * 0.01, 0.2, -0.5, 2200 + rnd() * 1800); // a terminal wakes
  sample(D.rec, "execution-pulse", T.procWake, -22);
  ping(T.procWake, midi(69), 0.12, -0.5);
  blip(T.browserWake, 990, 0.16, 0.5); // a browser task
  blip(T.browserWake + 0.09, 1480, 0.16, 0.5);
  ping(T.browserWake, midi(72), 0.11, 0.5);
  click(T.fileWrite, 0.36, -0.15, 1800); // a file changes
  click(T.fileWrite + 0.07, 0.3, -0.15, 2400);
  click(T.fileWrite + 0.14, 0.26, -0.15, 2000);
  sweep(D.fx, T.apiCall, T.cloudWake, 700, 4200, 0.05, (x) => Math.sin(Math.PI * x)); // an API call travels…
  ping(T.cloudWake, midi(81), 0.2, -0.1, 0.6); // …and a cloud process answers
  T.moreRoots.forEach((t, i) => {
    ping(t, midi([69, 74, 77][i]), 0.14, [-0.7, 0.3, 0.7][i]);
    click(t, 0.2, [-0.7, 0.3, 0.7][i]);
  });

  // Complexity — execution ticks, accelerating; warnings; unanswered requests.
  const SCALE = [74, 77, 79, 81, 84, 86, 89, 91];
  for (let t = 9; t < FREEZE - 0.02; ) {
    const rate = env([[9, 1.5], [13, 5], [17, 13], [FREEZE, 30]], t);
    t += (0.4 + rnd() * 1.2) / rate;
    if (t >= FREEZE - 0.02) break;
    const g = env([[9, 0.07], [14.5, 0.11], [FREEZE, 0.16]], t);
    const pan = rnd() * 1.6 - 0.8;
    if (rnd() < 0.55) click(t, g * 2.2, pan, 1800 + rnd() * 5000);
    else blip(t, midi(SCALE[Math.floor(rnd() * SCALE.length)]), g, pan, 0.02 + rnd() * 0.02);
  }
  // Warnings: a flat, minor-second two-tone, more of them toward the end.
  for (let t = 12.4; t < FREEZE - 0.1; ) {
    const g = env([[12, 0.08], [FREEZE, 0.2]], t);
    const pan = rnd() * 1.4 - 0.7;
    blip(t, 622, g, pan, 0.05);
    blip(t + 0.09, 587, g, pan, 0.07);
    t += env([[12, 2.3], [16, 1.2], [FREEZE, 0.35]], t) * (0.6 + rnd() * 0.8);
  }
  sample(D.rec, "warning-rise", 15.0, -20);
  sample(D.rec, "warning-rise", 18.1, -17);
  sample(D.rec, "approval-request", 11.8, -24); // a permission request, unanswered
  sample(D.rec, "approval-request", 16.2, -22);

  // Into Sulcus — two pulses in the silence, on the first agent.
  ping(T.pulse1, midi(74), 0.42, 0, 0.7);
  blip(T.pulse1, midi(86), 0.1, 0, 0.12);
  ping(T.pulse2, midi(74), 0.5, 0, 0.7);
  ping(T.pulse2, midi(81), 0.2, 0, 0.6);
  // Light runs out along its paths.
  for (let i = 0; i < 6; i++) click(T.pulse2 + 0.1 + i * 0.09, 0.16, (i - 2.5) / 4, 3400 + i * 200);
  sample(D.rec, "control-engage", ONLINE - 0.03, -12);
  // Every node lands on the element of the interface it is: a run of locks.
  for (let i = 0; i < 12; i++) {
    const t = ONLINE + 1.3 + Math.pow(i / 12, 0.9) * 0.4;
    click(t, 0.28, rnd() * 1.2 - 0.6, 2600 + i * 140);
    if (i % 3 === 0) blip(t, midi(74 + [0, 3, 7, 10][i % 4]), 0.08, rnd() * 1.2 - 0.6, 0.05);
  }
  // The interface resolves around it.
  sweep(D.fx, T.uiIn, T.uiFull, 900, 6000, 0.035, (x) => Math.sin(Math.PI * x) * x);
  // Pulling back to the whole app.
  whoosh(T.uiFull, T.see, 2400, 700, 0.03);

  // SEE — execution lights each row, root first.
  [62, 69, 74].forEach((m, i) => {
    const t = T.see + 0.2 + i * 0.28;
    blip(t, midi(m + 12), 0.14, -0.2 + i * 0.2, 0.06);
    click(t, 0.24, -0.2 + i * 0.2, 2600 + i * 500);
  });
  // The Researcher is selected: down the tree, and its row opens.
  click(T.select - 0.3, 0.3, -0.2, 2400);
  blip(T.select, midi(81), 0.14, -0.1, 0.07);
  click(T.select, 0.42, -0.1, 1900);
  whoosh(T.select, T.select + 0.25, 1500, 4200, 0.03);
  // New calls appear on its row as they happen.
  for (const t of [33.04, 33.1, 34.94, 36.0]) click(t, 0.16, 0.3, 4200);
  // Inspect — the camera dives onto one call…
  whoosh(T.inspect - 0.1, T.inspect + 0.7, 600, 3400, 0.05);
  ping(T.inspect + 0.4, midi(86), 0.12, 0.2, 0.4);
  // …the event log opens, the page drops to it, and that call's event opens.
  click(T.logOpen, 0.36, 0, 2000);
  whoosh(T.logOpen, T.logOpen + 0.8, 2600, 900, 0.035);
  click(T.rowOpen, 0.4, -0.1, 2200);
  typing(T.rowOpen + 0.05, 10, 0.08, -0.2);
  whoosh(T.inspectOut, T.approvalAsk, 900, 2600, 0.03);

  // Step in — the call waits for a decision; the run pauses.
  sample(D.rec, "approval-request", T.approvalAsk - 0.02, -13);
  click(T.approvalAsk + 0.15, 0.5, 0.2, 1400);
  tone(D.fx, T.approvalAsk + 0.15, 110, 0.09, 0.32, 0.2, [1, 0.5]);
  // It waits: a quiet tick on each beat while nothing moves.
  for (let t = T.approvalAsk + BEAT; t < T.approvalChoose - 0.1; t += BEAT) blip(t, midi(74), 0.07, 0.2, 0.05);
  // Approve is lit, then pressed.
  click(T.approvalChoose, 0.28, 0.3, 2400);
  blip(T.approvalChoose, midi(86), 0.07, 0.3, 0.04);
  sample(D.rec, "approval-confirm", T.approvalGrant - 0.02, -12);
  click(T.approvalGrant, 0.55, 0.3, 1800);
  // The decision lands: execution resumes at once.
  ping(T.approvalDone, midi(81), 0.2, 0.1, 0.5);
  ping(T.approvalDone + 0.1, midi(86), 0.2, 0.1, 0.6);
  whoosh(T.approvalDone, T.approvalDone + 0.6, 1400, 4800, 0.04);
  for (let i = 0; i < 5; i++) click(T.approvalDone + 0.2 + i * 0.12, 0.18, 0.4, 3200 + i * 300);

  // Boundaries — the limit, as it was set…
  sample(D.rec, "policy-lock", T.bounds - 0.02, -15);
  whoosh(T.bounds, T.bounds + 0.9, 700, 2400, 0.03);
  typing(T.bounds + 0.6, 5, 0.1, -0.3);
  // …carried into the run.
  sweep(D.fx, T.bounds + 1.3, T.bounds + 2.2, 900, 4200, 0.05, (x) => x * x);
  click(T.bounds + 2.2, 0.45, 0.3, 1500);
  tone(D.fx, T.bounds + 2.2, 110, 0.06, 0.24, 0.3, [1, 0.5]);
  // Usage climbs…
  for (let i = 0; i < 8; i++) blip(47.6 + i * 0.14, 520 + i * 70, 0.06, 0.3, 0.02);
  // …past 80 %…
  blip(T.limitWarn, 622, 0.18, 0.3, 0.06);
  blip(T.limitWarn + 0.1, 587, 0.16, 0.3, 0.08);
  // …and the next call will not fit. Sulcus stops the run.
  click(T.limitHit, 0.6, 0, 1200);
  blip(T.limitHit + 0.03, 311, 0.22, 0, 0.09);
  blip(T.limitHit + 0.14, 294, 0.2, 0, 0.12);
  sample(D.rec, "policy-lock", T.limitHit + 0.05, -14);

  // One run steps back; another comes forward.
  whoosh(T.limitHit + 2.6, T.many - 0.2, 400, 2200, 0.05);
  // Many agents: one completes, one fails, one joins, one waits.
  ping(T.manyDone, midi(81), 0.16, -0.3, 0.45);
  ping(T.manyDone + 0.08, midi(86), 0.12, -0.3, 0.5);
  blip(T.manyFail, 440, 0.18, 0.3, 0.06);
  blip(T.manyFail + 0.09, 415, 0.16, 0.3, 0.08);
  ping(T.manyStart, midi(77), 0.12, 0.1, 0.4);
  sample(D.rec, "approval-request", T.manyApproval - 0.02, -17);
  click(T.manyApproval + 0.15, 0.36, 0.3, 1400);

  // The workspace; then the Runs page, and the window is laid down.
  whoosh(T.projects, T.projects + 0.6, 2000, 700, 0.035);
  click(T.projects + 0.1, 0.3, 0, 2200);
  click(T.integrate, 0.32, 0, 2200);
  sweep(D.fx, T.integrate - 0.2, T.land, 3000, 300, 0.05, (x) => Math.sin(Math.PI * x) * (1 - x * 0.4));
  sample(D.rec, "control-engage", T.land - 0.03, -13);

  // Seven systems connect, one per beat, climbing the scale.
  const JOIN = [62, 65, 67, 69, 72, 74, 77];
  JOIN.forEach((m, i) => {
    const t = connectAt(i);
    const pan = (i - 3) / 4;
    ping(t, midi(m + 12), 0.26, pan, 0.45);
    click(t, 0.34, pan, 2400);
    tone(D.fx, t, midi(m - 12), 0.07, 0.22, pan, [1, 0.4]);
    click(t + 0.6, 0.26, 0, 3600); // its run lands in the list
  });
  // Their runs, one structure: past each, a pass.
  for (const t of [71.9, 72.9, 73.9, 74.9]) whoosh(t - 0.45, t + 0.35, 500, 2600, 0.04);
  // One place: the core takes them all.
  sweep(D.fx, T.onePlace, T.onePlace + 1.7, 900, 5200, 0.05, (x) => Math.sin(Math.PI * x));
  for (let i = 0; i < 7; i++) {
    const t = T.onePlace + 0.15 + i * 0.2;
    blip(t, midi(74 + [0, 3, 5, 7, 10, 12, 15][i]), 0.13, (i - 3) / 4, 0.05);
    click(t + 0.05, 0.2, (i - 3) / 4, 4200);
  }

  // Scale — the rings arrive in waves.
  for (let i = 0; i < 40; i++) {
    const t = PEAK + 0.3 + Math.pow(i / 40, 0.9) * 3.4;
    click(t, 0.16, rnd() * 1.8 - 0.9, 2000 + rnd() * 3000);
  }

  // End card.
  sample(D.rec, "brand-impact", T.logo - 0.03, -14);
  ping(T.logo, midi(86), 0.2, 0, 0.9);
  ping(T.wordmark, midi(81), 0.09, 0, 0.8);
}

// ── mix ─────────────────────────────────────────────────────────────────

// Sidechain: the bed breathes around each kick.
const duck = new Float32Array(N).fill(1);
for (const t of kicks) {
  const i0 = Math.round(t * SR);
  for (let i = 0; i < 0.3 * SR && i0 + i < N; i++) {
    const g = 1 - 0.5 * Math.exp(-i / (0.085 * SR));
    if (g < duck[i0 + i]) duck[i0 + i] = g;
  }
}
for (const b of [D.bass, D.pad, D.arp, D.lead])
  for (let i = 0; i < N; i++) {
    b.L[i] *= duck[i];
    b.R[i] *= duck[i];
  }

// Stem levels, in dB.
const LEVEL = {
  drone: -14,
  pad: -4.5,
  bass: -2.5,
  arp: 3,
  lead: -3,
  drums: -4.5,
  hats: 3,
  fx: 3,
  rise: -10,
  rec: -4,
  hits: -9,
  ping: -6,
};
// Sends to the short room, the long hall, and the delay.
const SEND: Record<keyof typeof LEVEL, [number, number, number]> = {
  drone: [0, 0.1, 0],
  pad: [0.2, 0.35, 0],
  bass: [0, 0, 0],
  arp: [0.25, 0.2, 0.3],
  lead: [0.2, 0.5, 0.25],
  drums: [0.22, 0.08, 0],
  hats: [0.15, 0, 0],
  fx: [0.3, 0.3, 0.12],
  rise: [0.1, 0.35, 0],
  rec: [0.1, 0.2, 0],
  hits: [0.1, 0.45, 0],
  ping: [0.2, 0.7, 0.5],
};

// Stem levels by section, for balancing by numbers.
const SECTIONS: [string, number, number][] = [
  ["Agents", 0, 10],
  ["Complex", 10, 17.5],
  ["Riser", 17.5, 20],
  ["Freeze", 20.2, 22.5],
  ["Pulses", 22.5, 25],
  ["Sulcus", 25, 40],
  ["StepIn", 40, 50],
  ["Stop", 50, 52.5],
  ["Many", 52.5, 65],
  ["Integr", 65, 77.5],
  ["Scale", 77.5, 86.25],
  ["Dark", 87.2, 88.1],
  ["End", 88.1, 90],
  ["Tail", 90, 93.5],
];
const rmsOf = (b: Bus, a: number, z: number, g = 1) => {
  const i0 = Math.round(a * SR);
  const i1 = Math.min(N, Math.round(z * SR));
  let e = 0;
  for (let i = i0; i < i1; i++) e += (b.L[i] * b.L[i] + b.R[i] * b.R[i]) / 2;
  return toDb(Math.sqrt(e / (i1 - i0)) * g);
};
if (process.env.STEMS) {
  console.log("stem".padEnd(7) + SECTIONS.map(([n]) => n.padStart(8)).join(""));
  for (const name of Object.keys(LEVEL) as (keyof typeof LEVEL)[])
    console.log(
      name.padEnd(7) +
        SECTIONS.map(([, a, z]) => {
          const v = rmsOf(D[name], a, z, db(LEVEL[name]));
          return (v < -90 ? "—" : v.toFixed(0)).padStart(8);
        }).join(""),
    );
}

const dry = bus();
const toRoom = bus();
const toHall = bus();
const toDelay = bus();
for (const name of Object.keys(LEVEL) as (keyof typeof LEVEL)[]) {
  const g = db(LEVEL[name]);
  mixInto(dry, D[name], g);
  mixInto(toRoom, D[name], g * SEND[name][0]);
  mixInto(toHall, D[name], g * SEND[name][1]);
  mixInto(toDelay, D[name], g * SEND[name][2]);
}
const delayed = pingPong(toDelay, BEAT * 0.75, 0.42);
mixInto(toHall, delayed, 0.4);
const room = reverb(toRoom, 1.3, 0.45, 0.008);
const hall = reverb(toHall, 5.2, 0.6, 0.03);

const mix = bus();
mixInto(mix, dry, 1);
mixInto(mix, delayed, 0.8);
mixInto(mix, room, 0.85);
// The hall is pulled back for the freeze so the silence is a real one, and
// again at the collapse; otherwise it rings freely.
mixInto(mix, hall, (t) =>
  env(
    [
      [0, 1],
      [T.freeze, 1],
      [T.freeze + 0.2, 0.4],
      [T.pulse1, 0.7],
      [T.online, 1],
      [COLLAPSE + 0.05, 1],
      [T.dark, 0.5],
      [T.logo, 1],
      [T.endFade - 0.2, 1],
      [T.endDark + 0.2, 0],
    ],
    t,
  ),
);

// Master: high-pass, gentle saturation, loudness, true-peak ceiling.
{
  const hl = new SVF();
  const hr = new SVF();
  hl.set(24, 0.71);
  hr.set(24, 0.71);
  for (let i = 0; i < N; i++) {
    hl.run(mix.L[i]);
    hr.run(mix.R[i]);
    mix.L[i] = hl.hp;
    mix.R[i] = hr.hp;
  }
  // Each act sits a little above the one before, so the scale reveal is
  // the loudest sustained passage of the film.
  for (let i = 0; i < N; i++) {
    const g = env(
      [
        [T.online, 1],
        [T.online + 2, 0.84],
        [bar(17) - 0.2, 0.84],
        [bar(17) + 0.1, 0.95],
        [bar(27) - 0.2, 0.95],
        [bar(27) + 0.1, 1],
        [bar(32) - 0.2, 1],
        [bar(32) + 0.1, 1.14],
        [COLLAPSE + 0.05, 1.18],
        [COLLAPSE + 0.75, 1],
      ],
      i / SR,
    );
    mix.L[i] *= g;
    mix.R[i] *= g;
  }
  // Hard fades at the very ends.
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    const g = Math.min(1, t / 0.02) * clamp01((FILM_SECONDS - 0.4 - t) / 0.4);
    mix.L[i] *= g;
    mix.R[i] *= g;
  }
}

// BS.1770 integrated loudness (K-weighted, gated).
const lufs = (L: Float32Array, R: Float32Array, i0 = 0, i1 = N) => {
  const biq = (x: Float32Array, b: number[], a: number[]) => {
    const y = new Float64Array(i1 - i0);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = i0; i < i1; i++) {
      const v = b[0] * x[i] + b[1] * x1 + b[2] * x2 - a[0] * y1 - a[1] * y2;
      x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i - i0] = v;
    }
    return y;
  };
  const kw = (x: Float32Array) => {
    const s = biq(x, [1.53512485958697, -2.69169618940638, 1.19839281085285], [-1.69065929318241, 0.73248077421585]);
    const y = new Float64Array(s.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < s.length; i++) {
      const v = s[i] - 2 * x1 + x2 + 1.99004745483398 * y1 - 0.99007225036621 * y2;
      x2 = x1; x1 = s[i]; y2 = y1; y1 = v; y[i] = v;
    }
    return y;
  };
  const kL = kw(L);
  const kR = kw(R);
  const val = (ms: number) => -0.691 + 10 * Math.log10(Math.max(ms, 1e-12));
  const blk = 0.4 * SR;
  const hop = 0.1 * SR;
  const blocks: number[] = [];
  for (let s = 0; s + blk <= kL.length; s += hop) {
    let a = 0;
    for (let i = s; i < s + blk; i++) a += kL[i] * kL[i] + kR[i] * kR[i];
    blocks.push(a / blk);
  }
  const abs = blocks.filter((z) => val(z) > -70);
  if (abs.length === 0) return -Infinity;
  const rel = val(abs.reduce((a, z) => a + z, 0) / abs.length) - 10;
  const gated = abs.filter((z) => val(z) > rel);
  return val(gated.reduce((a, z) => a + z, 0) / gated.length);
};

const TARGET_LUFS = -14;
const CEILING_DB = -1.2;

// Saturate the peaks softly, then bring the whole film to the target.
const pre = lufs(mix.L, mix.R);
let gain = db(TARGET_LUFS - pre);
const shape = (x: number) => {
  const a = Math.abs(x);
  if (a < 0.5) return x;
  // Above −6 dBFS, ease toward the ceiling instead of clipping.
  return Math.sign(x) * (0.5 + 0.42 * Math.tanh((a - 0.5) / 0.42));
};
for (let pass = 0; pass < 3; pass++) {
  const L = new Float32Array(N);
  const R = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    L[i] = shape(mix.L[i] * gain);
    R[i] = shape(mix.R[i] * gain);
  }
  gain *= db(TARGET_LUFS - lufs(L, R));
}
for (let i = 0; i < N; i++) {
  mix.L[i] = shape(mix.L[i] * gain);
  mix.R[i] = shape(mix.R[i] * gain);
}

// Look-ahead limiter for whatever is still over the ceiling.
{
  const c = db(CEILING_DB);
  const la = Math.round(0.004 * SR);
  const need = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const p = Math.max(Math.abs(mix.L[i]), Math.abs(mix.R[i])) * 1.06; // inter-sample margin
    need[i] = p > c ? c / p : 1;
  }
  let g = 1;
  const rel = 1 - Math.exp(-1 / (0.09 * SR));
  for (let i = 0; i < N; i++) {
    let m = 1;
    for (let j = i; j < Math.min(N, i + la); j++) if (need[j] < m) m = need[j];
    g = m < g ? g + (m - g) * 0.35 : g + (m - g) * rel;
    mix.L[i] *= g;
    mix.R[i] *= g;
  }
}

// ── write ───────────────────────────────────────────────────────────────

const outPath = path.join(ROOT, "public/audio/sulcus-score.wav");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
const data = Buffer.alloc(N * 6);
let peak = 0;
for (let i = 0; i < N; i++) {
  peak = Math.max(peak, Math.abs(mix.L[i]), Math.abs(mix.R[i]));
  data.writeIntLE(Math.round(Math.max(-1, Math.min(1, mix.L[i])) * 8388607), 6 * i, 3);
  data.writeIntLE(Math.round(Math.max(-1, Math.min(1, mix.R[i])) * 8388607), 6 * i + 3, 3);
}
const h = Buffer.alloc(44);
h.write("RIFF", 0);
h.writeUInt32LE(36 + data.length, 4);
h.write("WAVE", 8);
h.write("fmt ", 12);
h.writeUInt32LE(16, 16);
h.writeUInt16LE(1, 20);
h.writeUInt16LE(2, 22);
h.writeUInt32LE(SR, 24);
h.writeUInt32LE(SR * 6, 28);
h.writeUInt16LE(6, 32);
h.writeUInt16LE(24, 34);
h.write("data", 36);
h.writeUInt32LE(data.length, 40);
fs.writeFileSync(outPath, Buffer.concat([h, data]));

// Report: overall loudness, and short-term loudness through the film.
console.log(`wrote ${path.relative(ROOT, outPath)}  (${FILM_SECONDS}s, 48 kHz / 24-bit)`);
console.log(`integrated ${lufs(mix.L, mix.R).toFixed(1)} LUFS · sample peak ${toDb(peak).toFixed(2)} dBFS`);
console.log("master ".padEnd(7) + SECTIONS.map(([n]) => n.padStart(8)).join(""));
console.log("rms dB".padEnd(7) + SECTIONS.map(([, a, z]) => rmsOf(mix, a, z).toFixed(1).padStart(8)).join(""));
// Tonal balance: energy per band, per section.
if (process.env.STEMS) {
  const bands: [string, number, number][] = [
    ["<60", 0, 60],
    ["60-250", 60, 250],
    ["250-1k", 250, 1000],
    ["1k-4k", 1000, 4000],
    [">4k", 4000, 0],
  ];
  for (const [name, lo, hi] of bands) {
    const out = bus();
    for (const ch of ["L", "R"] as const) {
      const a = new SVF();
      const b = new SVF();
      const c = new SVF();
      const d = new SVF();
      if (lo) { a.set(lo, 0.71); b.set(lo, 0.71); }
      if (hi) { c.set(hi, 0.71); d.set(hi, 0.71); }
      for (let i = 0; i < N; i++) {
        let x = mix[ch][i];
        if (lo) { a.run(x); b.run(a.hp); x = b.hp; }
        if (hi) x = d.run(c.run(x));
        out[ch][i] = x;
      }
    }
    console.log(name.padEnd(7) + SECTIONS.map(([, a, z]) => rmsOf(out, a, z).toFixed(0).padStart(8)).join(""));
  }
}
// Half-second loudness contour, for reading the shape of the film.
if (process.env.STEMS) {
  let line = "";
  for (let t = 0; t < FILM_SECONDS; t += 0.5) {
    if (t % 10 === 0) line += `
${String(t).padStart(3)}s `;
    line += rmsOf(mix, t, t + 0.5).toFixed(0).padStart(4);
  }
  console.log(line);
}
