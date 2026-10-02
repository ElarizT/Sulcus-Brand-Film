import { easeOut, fract, hit, rad, ramp, TAU, type Vec3 } from "../engine/math";
import type { Renderer } from "../engine/renderer";
import { BEAT, T } from "../film/timeline";
import { CORE_R } from "../world/layout";

// The Sulcus control plane. Before it, agents hang in a void with nothing
// under them; when it comes online it is literally the ground they are
// brought down to stand on: a polar grid radiating from one core.

const FIRST_EXTENT = 3700;
const FULL_EXTENT = 12600;

// How far the plane reaches at time t.
export const planeRadius = (t: number) => {
  const wave = Math.max(0, t - T.online) * T.waveSpeed;
  const cap =
    FIRST_EXTENT + (FULL_EXTENT - FIRST_EXTENT) * easeOut((t - T.scale) / 5.2);
  return Math.min(wave, cap);
};

const ORIGIN: Vec3 = [0, 0, 0];
const polar = (a: number, radius: number): Vec3 => [
  radius * Math.sin(a),
  0,
  radius * Math.cos(a),
];

export const drawPlane = (r: Renderer, t: number, level = 1) => {
  const R = planeRadius(t);
  if (R <= 0) return;
  const beats = (t - T.online) / BEAT;
  const speed = (R - planeRadius(t - 0.05)) / 0.05;

  // A slow brightness wave leaves the core every bar.
  const wave = (radius: number) => {
    const x = fract(beats / 4 - radius / 9000);
    return 1 + 1.3 * Math.exp(-x * 7);
  };

  for (let radius = 500; radius <= R; radius += 500) {
    const fresh = ramp(R - radius, 0, 500);
    r.circle3(
      ORIGIN,
      radius,
      "signal",
      0.105 * fresh * wave(radius) * level,
      1,
      0,
      TAU,
      Math.max(72, Math.round(radius / 28)),
    );
  }
  for (let deg = 0; deg < 360; deg += 10) {
    const a = rad(deg);
    for (let r0 = CORE_R; r0 < R; r0 += 500) {
      const r1 = Math.min(R, r0 + 500);
      r.line3(
        polar(a, r0),
        polar(a, r1),
        "signal",
        0.07 * wave(r0) * level,
      );
    }
  }

  // The leading edge, while the plane is still extending.
  if (speed > 40) {
    const a = Math.min(1, speed / 1800) * (t < T.scale ? 1 - R / 4600 : 0.55);
    r.circle3(ORIGIN, R, "hot", 0.95 * a * level, 2.2, 0, TAU, 160);
    r.circle3(ORIGIN, R - 60, "signal", 0.3 * a * level, 1, 0, TAU, 160);
  }
};

// The core: the single point every agent system answers to.
export const drawCore = (r: Renderer, t: number) => {
  if (t < T.pulse1) return;
  const pr = r.project(ORIGIN);
  const s = pr ? pr.s : 0;

  // Two precise pulses in the silence before it comes online.
  for (const tp of [T.pulse1, T.pulse2]) {
    const age = t - tp;
    if (age < 0 || age > 1.7) continue;
    const k = age / 1.7;
    r.circle3(ORIGIN, 30 + 620 * easeOut(k), "hot", (1 - k) * (1 - k), 1.6);
    if (pr) r.glow(pr.x, pr.y, 150 * s + 40, "hot", hit(t, tp, 0.03, 0.35));
  }

  const online = t - T.online;
  const ignite = hit(t, T.onePlace, 0.05, 1.4);
  const breathe = 0.82 + 0.18 * Math.cos(((t - T.online) / BEAT) * Math.PI);

  if (pr) {
    const base = online < 0 ? 0.75 : 1;
    r.dot(pr.x, pr.y, Math.max(1.6, 4.2 * s), "signal", base);
    r.glow(pr.x, pr.y, 46 * s + 16, "hot", 0.8 * base * breathe);
    if (online >= 0) {
      const flash = hit(t, T.online, 0.04, 0.9);
      r.glow(pr.x, pr.y, (600 + 900 * flash) * s, "hot", 0.2 + 0.55 * flash + 0.3 * ignite);
      // Light spilling along the plane.
      r.haze(pr.x, pr.y, 1500 * s, 330 * s, "hot", 0.13 * breathe + 0.35 * flash + 0.25 * ignite);
    }
  }
  if (online < 0) return;

  const draw = easeOut(online / 0.8);
  [90, 170, CORE_R].forEach((radius, i) => {
    const turn = (t * (i === 1 ? -0.12 : 0.08) + i) % TAU;
    r.circle3(
      ORIGIN,
      radius,
      i === 2 ? "signal" : "hot",
      (i === 2 ? 0.95 : 0.42) * (0.75 + 0.25 * breathe + 0.6 * ignite),
      i === 2 ? 1.8 : 1.2,
      turn,
      turn + TAU * draw,
      120,
    );
  });
  // Graduations on the outer ring.
  for (let i = 0; i < 36; i++) {
    const a = (i * TAU) / 36 + t * 0.08;
    r.line3(
      polar(a, CORE_R + 14),
      polar(a, CORE_R + (i % 3 === 0 ? 54 : 34)),
      "signal",
      0.55 * draw,
    );
  }
  // A beacon: the control signal, standing on the plane.
  const beam = 0.16 + 0.75 * hit(t, T.online, 0.05, 1.2) + 0.7 * ignite;
  for (let y = 0; y < 1500; y += 150)
    r.line3([0, y, 0], [0, y + 150, 0], "hot", beam * (1 - y / 1500), 1.6);
};
