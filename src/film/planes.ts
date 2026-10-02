import { easeInOut, lerp, ramp, v3, type Vec3 } from "../engine/math";
import { makePlane, type Plane } from "../engine/project";
import { T } from "./timeline";

// Where the Sulcus windows stand in the world. Each is a 1920×1080 browser
// window: one world unit per UI pixel unless scaled.
//
//   W1  research-agent's Run Detail. It stands where the followed agent's
//       tree was, so the execution path the camera follows lands on it.
//   W2  the app window for the rest of the film: release-review, Projects,
//       Runs. It slides in as W1 slides away, and at the integrations it lies
//       down on the ground at the core of everything.

export const UI_W = 1920;
export const UI_H = 1080;

// W1 is placed so that the followed agent's root, [0, 520, 900] in the
// world, sits on the Coordinator's node in the Agent Tree (UI 398, 239).
export const W1_CENTER: Vec3 = [562, 219, 900];

type Pose = { center: Vec3; yaw: number; pitch: number; scale: number };

const pose = (center: Vec3, yaw = 0, pitch = 0, scale = 1): Pose => ({ center, yaw, pitch, scale });
const mix = (a: Pose, b: Pose, k: number): Pose => ({
  center: v3.lerp(a.center, b.center, k),
  yaw: lerp(a.yaw, b.yaw, k),
  pitch: lerp(a.pitch, b.pitch, k),
  scale: lerp(a.scale, b.scale, k),
});
const toPlane = (p: Pose, w = UI_W, h = UI_H) => makePlane(p.center, w, h, p.scale, p.yaw, p.pitch);

// The window swap after the research run is stopped.
const SWAP_A = T.limitHit + 2.6; // 52.6
const SWAP_B = T.many - 0.1; // 54.9

const W1_HOME = pose(W1_CENTER);
const W1_AWAY = pose([-1700, 380, 2700], -34, 0, 1);
const W2_WAIT = pose([2900, 260, 2500], 34, 0, 1);
const W2_HOME = pose(W1_CENTER);
// Lying on the ground at the core, half size.
const W2_FLAT = pose([0, 3, 0], 0, 90, 0.5);

export const TIP_FROM = T.integrate - 0.2;
export const LAND = T.land;

export const w1 = (t: number): Plane => toPlane(mix(W1_HOME, W1_AWAY, easeInOut(ramp(t, SWAP_A, SWAP_B))));
export const w1Opacity = (t: number) => 1 - ramp(t, SWAP_B - 0.9, SWAP_B + 0.2);

export const w2 = (t: number): Plane => {
  if (t < TIP_FROM) return toPlane(mix(W2_WAIT, W2_HOME, easeInOut(ramp(t, SWAP_A + 0.2, SWAP_B))));
  // It tips back and comes down to the ground. The tip leads the descent a
  // little, so it reads as a window being laid down, not falling.
  const k = ramp(t, TIP_FROM, LAND);
  const p = mix(W2_HOME, W2_FLAT, easeInOut(k));
  p.pitch = 90 * easeInOut(Math.min(1, k * 1.08));
  return toPlane(p);
};
// It is the last thing to go: as everything falls into the core it burns
// out in the flare.
export const w2Opacity = (t: number) => ramp(t, SWAP_A + 0.2, SWAP_A + 1.0) * (1 - ramp(t, T.collapse, T.collapse + 0.4));

// The New run form's Controls panel, which floats in front of W1 while the
// limit is set, then sinks into the run's TOKENS readout.
export const CARD_W = 880;
export const CARD_H = 196;
const CARD_IN: Vec3 = [700, 250, 600];
const CARD_HOLD: Vec3 = [840, 420, 640];
const CARD_SINK: Vec3 = [1080, 624, 890];
export const controlsCard = (t: number): { plane: Plane; opacity: number } => {
  const a = easeInOut(ramp(t, T.bounds, T.bounds + 0.9));
  const b = easeInOut(ramp(t, T.bounds + 2.0, T.bounds + 2.8));
  const c = v3.lerp(v3.lerp(CARD_IN, CARD_HOLD, a), CARD_SINK, b);
  return {
    plane: makePlane(c, CARD_W, CARD_H, lerp(0.82, 0.22, b), lerp(-14, -4, a), lerp(12, 0, a)),
    opacity: a * (1 - ramp(t, T.bounds + 2.4, T.bounds + 2.8)),
  };
};

// The fly-through: four Run Details stand in a row beyond the flat window.
export const CARD_SCALE = 0.42;
export const flyCard = (i: number, t: number): { plane: Plane; opacity: number } => {
  const up = T.flyThrough - 0.3 + i * 0.3;
  const rise = easeInOut(ramp(t, up, up + 0.8));
  const x = (i - 1.5) * 900;
  const center: Vec3 = [x, lerp(-180, 300, rise), 760];
  return {
    plane: makePlane(center, UI_W, UI_H, CARD_SCALE, 0, lerp(40, 0, rise)),
    opacity: rise * (1 - ramp(t, T.onePlace - 0.2, T.onePlace + 0.7)),
  };
};
