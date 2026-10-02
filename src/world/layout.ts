import { rad, type Vec3 } from "../engine/math";

// The governed world is radial. The Sulcus core sits at the origin of the
// ground plane (y = 0); agent trees stand on rings around it, each in its own
// vertical plane facing the core. The seven named ecosystems occupy an arc of
// the first ring, centred on +z.

export const ARC_R = 2000;
export const ARC_STEP = rad(20);
export const treeAngle = (i: number) => (i - 3) * ARC_STEP;

// The core is the Sulcus window lying at the centre (960 × 540 world units).
export const CORE_R = 640;

// A tree's local frame: `t` runs along the ring (screen-right seen from the
// core), `n` points at the core.
export type TreeFrame = { base: Vec3; t: Vec3; n: Vec3 };

export const frameAt = (angle: number, radius: number): TreeFrame => {
  const s = Math.sin(angle);
  const c = Math.cos(angle);
  return { base: [radius * s, 0, radius * c], t: [c, 0, -s], n: [-s, 0, -c] };
};

// Tree-local (u along the ring, v up, w toward the core) → world.
export const place = (f: TreeFrame, u: number, v: number, w = 0): Vec3 => [
  f.base[0] + f.t[0] * u + f.n[0] * w,
  v,
  f.base[2] + f.t[2] * u + f.n[2] * w,
];

// Heights of the tree levels, root first. The band under the root holds the
// tree's timeline.
export const LEVEL_V = [300, 500, 690, 850];
export const LEAF_SPACING = 62;
export const RAIL = { top: 232, lane: 38, lanes: 4, ruler: 62 };

// Rings of the scaled-out system.
export const RING_GAP = 1150;
export const RING_COUNT = 8;
export const ringRadius = (k: number) => ARC_R + k * RING_GAP;
