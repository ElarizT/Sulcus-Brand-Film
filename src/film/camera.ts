import { ramp, v3, type Vec3 } from "../engine/math";
import { onPlane, planeNormal, type Plane } from "../engine/project";
import type { Camera } from "../engine/renderer";
import { w1, w2 } from "./planes";
import { T } from "./timeline";

// One camera for the whole film. The picture is a single continuous move
// through one world: it starts on a single agent, backs away as the network
// outgrows the frame, finds that first agent again in the frozen tangle and
// follows its execution path until it is the Sulcus Run Detail, travels
// through the real interface like a film camera rather than a pointer, then
// rises off the ground until the whole system is in view. Scene boundaries
// are cuts in the edit, not in the camera.

type Key = {
  t: number;
  eye: Vec3;
  target: Vec3;
  focal: number;
  // How the camera passes through this key. By default it carries the
  // average speed of the keys either side. "next" / "prev" take the speed of
  // the adjoining segment instead: the start and end of a slow hold, so the
  // hold is one steady push and not a wobble. "stop" arrives at rest.
  via?: "next" | "prev" | "stop";
};

const FOCAL = 1100;

// Rodrigues rotation of v about unit axis k.
const rotate = (v: Vec3, k: Vec3, deg: number): Vec3 => {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return v3.add(v3.add(v3.scale(v, c), v3.scale(v3.cross(k, v), s)), v3.scale(k, v3.dot(k, v) * (1 - c)));
};

// A framing on a Sulcus window: look at UI point (x, y) so that one UI pixel
// is `zoom` screen pixels, from straight in front of the window, swung `yaw`
// degrees round it and raised `pitch` degrees above it.
const ui = (pl: Plane, x: number, y: number, zoom: number, yaw = 0, pitch = 0, focal = FOCAL) => {
  const target = onPlane(pl, x, y);
  let dir = planeNormal(pl);
  dir = rotate(dir, [0, 1, 0], yaw);
  const side = v3.norm(v3.cross(dir, [0, 1, 0]));
  dir = rotate(dir, side, pitch);
  const d = (focal * v3.len(pl.ax)) / zoom;
  return { eye: v3.add(target, v3.scale(dir, d)), target, focal };
};

const W1 = w1(30);
const W2 = w2(58);

const KEYS: Key[] = [
  // The Agents: close on the first agent, drifting back.
  { t: 0, eye: [150, 565, 430], target: [10, 525, 900], focal: 1250 },
  { t: 3.75, eye: [90, 590, 110], target: [-20, 535, 980], focal: 1230 },
  { t: 7, eye: [-70, 640, -400], target: [-10, 600, 1250], focal: 1190 },
  { t: 10, eye: [-240, 700, -950], target: [40, 600, 1500], focal: 1150 },
  // Complexity: the pull-back keeps going; the network outgrows the frame.
  { t: 15.2, eye: [-420, 860, -1150], target: [60, 680, 1750], focal: 1080 },
  { t: T.freeze, eye: [-640, 980, -1380], target: [80, 680, 1900], focal: 980 },
  // Frozen. The camera drifts through a world that has stopped, and turns to
  // find the first agent again.
  { t: T.pulse1, eye: [-560, 900, -1250], target: [30, 560, 1000], focal: 1000 },
  // Following its execution path in, until it is square on.
  { t: T.online, eye: [-170, 660, -330], target: [150, 490, 900], focal: 1080 },
  { t: T.uiFull, ...ui(W1, 860, 320, 1.45) },
  // The whole app: this is a real product.
  { t: T.see, ...ui(W1, 960, 560, 0.84), via: "stop" },
  // SEE WHAT YOUR AGENTS ARE DOING.
  { t: 32.4, ...ui(W1, 1010, 330, 1.22, 4) },
  { t: 33.4, ...ui(W1, 900, 300, 1.7, 6) },
  { t: 34.9, ...ui(W1, 1150, 290, 1.9, 4) },
  // One call, close; then down to its event.
  { t: 35.7, ...ui(W1, 1273, 282, 3.0, 2) },
  { t: 36.8, ...ui(W1, 830, 600, 1.55, -3), via: "next" },
  { t: 39.2, ...ui(W1, 850, 610, 1.68, -5), via: "prev" },
  // STEP IN WHEN IT MATTERS.
  { t: 40.3, ...ui(W1, 1050, 470, 1.25, 4) },
  { t: 41.6, ...ui(W1, 1080, 530, 1.5, 8, 2), via: "next" },
  { t: 43.4, ...ui(W1, 1390, 590, 2.05, 9, 3), via: "prev" },
  { t: 44.8, ...ui(W1, 1150, 560, 1.0, 3) },
  // SET THE BOUNDARIES.
  { t: 46.8, ...ui(W1, 1180, 420, 1.12, -6) },
  { t: 49.2, ...ui(W1, 1300, 240, 1.85, -6), via: "next" },
  { t: 50.4, ...ui(W1, 1060, 290, 1.32, -2) },
  { t: 52.3, ...ui(W1, 1050, 300, 1.25, 0), via: "prev" },
  // Back: one run is stopped, another comes forward.
  { t: 53.7, ...ui(W1, 1180, 520, 0.56, 6) },
  { t: T.many, ...ui(W2, 1000, 400, 1.08) },
  { t: 57.0, ...ui(W2, 900, 380, 1.35, 5) },
  { t: 59.3, ...ui(W2, 1080, 400, 1.32, -4) },
  { t: 61.4, ...ui(W2, 1200, 520, 1.45, -6) },
  // The workspace.
  { t: 63.4, ...ui(W2, 960, 560, 0.88) },
  // The window is laid down at the core; the ground comes on from it.
  { t: T.land, eye: [0, 760, -860], target: [0, 40, 260], focal: 980 },
  { t: 68.4, eye: [-60, 560, -560], target: [0, 60, 500], focal: 1000 },
  { t: 70.6, eye: [60, 520, -470], target: [0, 90, 560], focal: 1000 },
  // Four runs from four frameworks: one Run Detail.
  { t: 71.9, eye: [-1350, 330, 40], target: [-1350, 300, 760], focal: 1050 },
  { t: 72.9, eye: [-450, 330, 40], target: [-450, 300, 760], focal: 1050 },
  { t: 73.9, eye: [450, 330, 40], target: [450, 300, 760], focal: 1050 },
  { t: 74.9, eye: [1350, 330, 40], target: [1350, 300, 760], focal: 1050 },
  // ONE PLACE TO CONTROL THEM.
  { t: 75.9, eye: [380, 1250, -1750], target: [0, 170, 850], focal: 1040 },
  { t: T.scale, eye: [560, 1500, -2300], target: [0, 150, 900], focal: 1040 },
  // Scale: up and away.
  { t: 80, eye: [1050, 2700, -4300], target: [0, 0, 600], focal: 1000 },
  { t: 83, eye: [1650, 4300, -7000], target: [0, 0, 300], focal: 980 },
  { t: T.collapse, eye: [2100, 5600, -9200], target: [0, 0, 0], focal: 960 },
  { t: 88, eye: [2200, 5900, -9700], target: [0, 0, 0], focal: 960 },
];

const hermite = (p0: number, p1: number, m0: number, m1: number, dt: number, s: number) => {
  const s2 = s * s;
  const s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * p0 + (s3 - 2 * s2 + s) * dt * m0 + (-2 * s3 + 3 * s2) * p1 + (s3 - s2) * dt * m1;
};

// Catmull–Rom through the keys, with tangents taken over real time so the
// camera carries its speed through each key instead of stopping on it.
const spline = (get: (k: Key) => number, i: number, s: number) => {
  const k0 = KEYS[Math.max(0, i - 1)];
  const k1 = KEYS[i];
  const k2 = KEYS[i + 1];
  const k3 = KEYS[Math.min(KEYS.length - 1, i + 2)];
  const slope = (a: Key, b: Key) => (get(b) - get(a)) / (b.t - a.t || 1);
  const through = (k: Key, before: Key, after: Key) =>
    k.via === "stop" ? 0 : k.via === "next" ? slope(k, after) : k.via === "prev" ? slope(before, k) : slope(before, after);
  const m1 = through(k1, k0, k2);
  const m2 = through(k2, k1, k3);
  return hermite(get(k1), get(k2), m1, m2, k2.t - k1.t, s);
};

export const cameraAt = (t: number): Camera => {
  const c = Math.min(KEYS[KEYS.length - 1].t, Math.max(0, t));
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1].t <= c) i++;
  const s = (c - KEYS[i].t) / (KEYS[i + 1].t - KEYS[i].t);
  const axis = (pick: (k: Key) => Vec3): Vec3 => [
    spline((k) => pick(k)[0], i, s),
    spline((k) => pick(k)[1], i, s),
    spline((k) => pick(k)[2], i, s),
  ];
  return {
    eye: axis((k) => k.eye),
    target: axis((k) => k.target),
    focal: spline((k) => k.focal, i, s),
  };
};

// Handheld tremor, in logical px: none while the system is calm, growing as
// the network runs away, and gone the instant it freezes.
export const shakeAt = (t: number) => {
  const amp = t < T.freeze ? 3.4 * Math.pow(ramp(t, 12, T.freeze), 2) : 0;
  return {
    x: amp * (0.6 * Math.sin(t * 31.4) + 0.4 * Math.sin(t * 66.5 + 1.3)),
    y: amp * (0.6 * Math.sin(t * 25.7 + 0.7) + 0.4 * Math.sin(t * 74.6 + 2.1)),
  };
};
