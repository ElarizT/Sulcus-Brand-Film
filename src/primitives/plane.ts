import { easeOut, fract, hit, rad, ramp, TAU, type Vec3 } from "../engine/math";
import type { Renderer } from "../engine/renderer";
import { BEAT, T } from "../film/timeline";
import { CORE_R } from "../world/layout";

// The Sulcus control plane: the ground every agent system stands on. It is
// not there in the opening — the agents hang in a void. It comes on when the
// Sulcus window is laid down at the core: a polar grid radiating from the
// window, wired to everything that connects to it.

const FIRST_EXTENT = 3700;
const FULL_EXTENT = 12600;
const WAVE_SPEED = 2400; // world units per second

// How far the ground reaches at time t.
export const planeRadius = (t: number) => {
  if (t < T.land) return 0;
  const wave = CORE_R + (t - T.land) * WAVE_SPEED;
  const cap = FIRST_EXTENT + (FULL_EXTENT - FIRST_EXTENT) * easeOut((t - T.scale) / 5.2);
  return Math.min(wave, cap);
};

const ORIGIN: Vec3 = [0, 0, 0];
const polar = (a: number, radius: number): Vec3 => [radius * Math.sin(a), 0, radius * Math.cos(a)];

export const drawPlane = (r: Renderer, t: number, level = 1) => {
  const R = planeRadius(t);
  if (R <= 0) return;
  const beats = (t - T.land) / BEAT;
  const speed = (R - planeRadius(t - 0.05)) / 0.05;

  // A slow brightness wave leaves the core every bar.
  const wave = (radius: number) => {
    const x = fract(beats / 4 - radius / 9000);
    return 1 + 1.3 * Math.exp(-x * 7);
  };

  for (let radius = 1000; radius <= R; radius += 500) {
    const fresh = ramp(R - radius, 0, 500);
    r.circle3(ORIGIN, radius, "signal", 0.105 * fresh * wave(radius) * level, 1, 0, TAU, Math.max(72, Math.round(radius / 28)));
  }
  for (let deg = 0; deg < 360; deg += 10) {
    const a = rad(deg);
    for (let r0 = CORE_R; r0 < R; r0 += 500) {
      const r1 = Math.min(R, r0 + 500);
      r.line3(polar(a, r0), polar(a, r1), "signal", 0.07 * wave(r0) * level);
    }
  }

  // The leading edge, while the ground is still extending.
  if (speed > 40) {
    const a = Math.min(1, speed / 1800) * (t < T.scale ? 1 - R / 4600 : 0.55);
    r.circle3(ORIGIN, R, "hot", 0.95 * a * level, 2.2, 0, TAU, 160);
    r.circle3(ORIGIN, R - 60, "signal", 0.3 * a * level, 1, 0, TAU, 160);
  }
};

// The core: rings round the window at the centre of everything.
export const drawCore = (r: Renderer, t: number) => {
  if (t < T.land) return;
  const pr = r.project(ORIGIN);
  const on = t - T.land;
  const ignite = hit(t, T.onePlace, 0.05, 1.4);
  const breathe = 0.82 + 0.18 * Math.cos((on / BEAT) * Math.PI);
  if (pr) {
    const flash = hit(t, T.land, 0.04, 0.9);
    // Light spilling along the ground from under the window.
    r.haze(pr.x, pr.y, 1500 * pr.s, 330 * pr.s, "hot", 0.1 * breathe + 0.35 * flash + 0.25 * ignite);
    r.glow(pr.x, pr.y, (900 + 900 * flash) * pr.s, "hot", 0.12 + 0.4 * flash + 0.25 * ignite);
  }
  const draw = easeOut(on / 0.8);
  [CORE_R - 90, CORE_R].forEach((radius, i) => {
    const turn = (t * (i === 0 ? -0.12 : 0.08) + i) % TAU;
    r.circle3(
      ORIGIN,
      radius,
      i === 1 ? "signal" : "hot",
      (i === 1 ? 0.95 : 0.42) * (0.75 + 0.25 * breathe + 0.6 * ignite),
      i === 1 ? 1.8 : 1.2,
      turn,
      turn + TAU * draw,
      160,
    );
  });
  // Graduations on the outer ring.
  for (let i = 0; i < 48; i++) {
    const a = (i * TAU) / 48 + t * 0.08;
    r.line3(polar(a, CORE_R + 14), polar(a, CORE_R + (i % 3 === 0 ? 70 : 40)), "signal", 0.55 * draw * ramp(on, 0, 0.5));
  }
};
