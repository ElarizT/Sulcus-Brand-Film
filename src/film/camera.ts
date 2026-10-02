import { rad, ramp, v3, type Vec3 } from "../engine/math";
import type { Camera } from "../engine/renderer";
import { FEATURE, FIELD } from "../world/field";
import { ARC_R, frameAt } from "../world/layout";
import { T } from "./timeline";

// One camera for the whole film. The picture is a single continuous move
// through one world: it starts on a single agent, backs away as the network
// outgrows the frame, drops in to read the governed trees one at a time, then
// rises until the whole system is in view. Scene boundaries are cuts in the
// edit, not in the camera.

type Key = {
  t: number;
  eye: Vec3;
  target: Vec3;
  focal: number;
  // How the camera passes through this key. By default it carries the
  // average speed of the keys either side. "next" / "prev" take the speed of
  // the adjoining segment instead: the start and end of a slow hold, so the
  // hold is one steady push and not a wobble.
  via?: "next" | "prev";
};

// A position inside the arc, looking squarely at the tree at `deg`, shifted
// `aside` along the ring so the tree can sit off-centre in frame.
const atTree = (
  deg: number,
  dist: number,
  eyeH: number,
  lookH: number,
  aside = 0,
) => {
  const f = frameAt(rad(deg), ARC_R);
  const at = v3.add(f.base, v3.scale(f.t, aside));
  return {
    eye: v3.add(v3.add(at, v3.scale(f.n, dist)), [0, eyeH, 0]),
    target: v3.add(at, [0, lookH, 0]),
  };
};

// The approval beat is framed on its gate, with room to the right for the
// request.
const GATE_ASIDE = FIELD.nodes[FEATURE.approval].u + 215;

const KEYS: Key[] = [
  // The Agents: close on the first agent, drifting back.
  { t: 0, eye: [150, 565, 430], target: [10, 525, 900], focal: 1250 },
  { t: 3.75, eye: [90, 590, 110], target: [-20, 535, 980], focal: 1230 },
  { t: 7, eye: [-70, 640, -400], target: [-10, 600, 1250], focal: 1190 },
  { t: 10, eye: [-240, 700, -950], target: [40, 600, 1500], focal: 1150 },
  // Complexity: the pull-back keeps going; the network outgrows the frame.
  { t: 16, eye: [-420, 860, -1150], target: [60, 680, 1750], focal: 1080 },
  { t: 22.5, eye: [-640, 980, -1380], target: [80, 680, 1900], focal: 980 },
  // Frozen. The camera keeps drifting through a world that has stopped.
  { t: 27.5, eye: [-600, 990, -1380], target: [40, 250, 1300], focal: 1000 },
  // The control plane takes the field; push in as it reorganises.
  { t: 30.2, eye: [-560, 860, -1000], target: [-220, 420, 1500], focal: 1080 },
  // Three holds, each a slow push, with a glide along the arc between them.
  // See: one tree, with room on its left for the inspector.
  { t: 32.3, ...atTree(-40, 1430, 440, 378, -378), focal: 1150, via: "next" },
  { t: 36.2, ...atTree(-40, 1340, 440, 378, -378), focal: 1150, via: "prev" },
  // Step in: the next tree, on its approval gate.
  { t: 37.4, ...atTree(-20, 1450, 450, 400, GATE_ASIDE), focal: 1150, via: "next" },
  { t: 41.2, ...atTree(-20, 1330, 450, 400, GATE_ASIDE), focal: 1150, via: "prev" },
  // Boundaries: back a little, two trees in shot.
  { t: 42.4, ...atTree(10, 1760, 470, 390), focal: 1100, via: "next" },
  { t: 46.0, ...atTree(10, 1670, 470, 390), focal: 1100, via: "prev" },
  // One place: back behind the core, all seven systems in frame.
  { t: 47.8, eye: [0, 1090, -1580], target: [0, 195, 1040], focal: 1050, via: "next" },
  { t: 52.5, eye: [280, 1260, -1850], target: [0, 190, 1000], focal: 1050 },
  { t: 57.5, eye: [560, 1500, -2300], target: [0, 150, 900], focal: 1040 },
  // Scale: up and away.
  { t: 60, eye: [1050, 2700, -4300], target: [0, 0, 600], focal: 1000 },
  { t: 63, eye: [1650, 4300, -7000], target: [0, 0, 300], focal: 980 },
  { t: 66.25, eye: [2100, 5600, -9200], target: [0, 0, 0], focal: 960 },
  { t: 68, eye: [2200, 5900, -9700], target: [0, 0, 0], focal: 960 },
];

const hermite = (
  p0: number,
  p1: number,
  m0: number,
  m1: number,
  dt: number,
  s: number,
) => {
  const s2 = s * s;
  const s3 = s2 * s;
  return (
    (2 * s3 - 3 * s2 + 1) * p0 +
    (s3 - 2 * s2 + s) * dt * m0 +
    (-2 * s3 + 3 * s2) * p1 +
    (s3 - s2) * dt * m1
  );
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
    k.via === "next"
      ? slope(k, after)
      : k.via === "prev"
        ? slope(before, k)
        : slope(before, after);
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
  const amp = t < T.freeze ? 3.4 * Math.pow(ramp(t, 13, T.freeze), 2) : 0;
  return {
    x: amp * (0.6 * Math.sin(t * 31.4) + 0.4 * Math.sin(t * 66.5 + 1.3)),
    y: amp * (0.6 * Math.sin(t * 25.7 + 0.7) + 0.4 * Math.sin(t * 74.6 + 2.1)),
  };
};
