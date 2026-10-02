import { clamp01, v3, type Vec3 } from "../engine/math";
import type { Renderer } from "../engine/renderer";
import type { LightName } from "../theme/colors";
import { place, type TreeFrame } from "../world/layout";

// Boundaries: a thin box that closes around a tree or a task. It draws on
// from its corners, so the first thing the eye gets is the extent.

export type Box = {
  u0: number;
  u1: number;
  v0: number;
  v1: number;
  // Half-depth, toward and away from the core. 0 draws a flat frame.
  w: number;
};

const edge = (
  r: Renderer,
  a: Vec3,
  b: Vec3,
  color: LightName,
  alpha: number,
  p: number,
  width: number,
) => {
  if (p >= 1) {
    r.line3(a, b, color, alpha, width);
  } else {
    r.line3(a, v3.lerp(a, b, p / 2), color, alpha, width);
    r.line3(b, v3.lerp(b, a, p / 2), color, alpha, width);
  }
};

export const drawBoundary = (
  r: Renderer,
  f: TreeFrame,
  box: Box,
  color: LightName,
  alpha: number,
  progress: number,
  width = 1,
) => {
  const p = clamp01(progress);
  if (alpha <= 0.01 || p <= 0) return;
  const { u0, u1, v0, v1, w } = box;
  const face = (d: number, a: number) => {
    const c = [
      place(f, u0, v0, d),
      place(f, u1, v0, d),
      place(f, u1, v1, d),
      place(f, u0, v1, d),
    ];
    for (let i = 0; i < 4; i++) edge(r, c[i], c[(i + 1) % 4], color, a, p, width);
    return c;
  };
  if (w <= 0) {
    face(0, alpha);
  } else {
    const front = face(w, alpha);
    const back = face(-w, alpha * 0.45);
    for (let i = 0; i < 4; i++)
      edge(r, front[i], back[i], color, alpha * 0.45, p, width);
  }
  // Corner ticks on the near face stay crisp when the box is faint.
  const tick = Math.min(34, (u1 - u0) * 0.12);
  const near = w > 0 ? w : 0;
  for (const [u, su] of [
    [u0, 1],
    [u1, -1],
  ] as const)
    for (const [v, sv] of [
      [v0, 1],
      [v1, -1],
    ] as const) {
      const c = place(f, u, v, near);
      r.line3(c, place(f, u + su * tick, v, near), color, alpha * 1.7 * p, width * 1.4);
      r.line3(c, place(f, u, v + sv * tick, near), color, alpha * 1.7 * p, width * 1.4);
    }
};
