import { clamp01, v3, type Vec3 } from "../engine/math";
import type { Renderer } from "../engine/renderer";
import type { LightName } from "../theme/colors";

// Agent paths and the pulses that travel them.

// A point at arc-length fraction `f` of a polyline.
export const along = (pts: Vec3[], f: number): Vec3 => {
  let total = 0;
  const lens: number[] = [];
  for (let i = 1; i < pts.length; i++) {
    const l = v3.dist(pts[i - 1], pts[i]);
    lens.push(l);
    total += l;
  }
  let d = clamp01(f) * total;
  for (let i = 0; i < lens.length; i++) {
    if (d <= lens[i] || i === lens.length - 1)
      return v3.lerp(pts[i], pts[i + 1], lens[i] > 0 ? d / lens[i] : 0);
    d -= lens[i];
  }
  return pts[pts.length - 1];
};

// An execution path, drawn on from its start as `progress` goes 0 → 1.
export const drawPath = (
  r: Renderer,
  pts: Vec3[],
  color: LightName,
  alpha: number,
  progress = 1,
  width = 1,
) => {
  if (alpha <= 0.008 || progress <= 0) return;
  r.poly3(pts, color, alpha, width, 0, progress);
  // While it grows, the tip is live.
  if (progress < 1) {
    const tip = r.project(along(pts, progress));
    if (tip) {
      const s = Math.min(2.2, Math.max(0.3, tip.s));
      r.glow(tip.x, tip.y, 16 * s, color, alpha * 1.6 * r.fog(tip.z));
      r.dot(tip.x, tip.y, 1.6 * s, color, alpha * 2 * r.fog(tip.z));
    }
  }
};

// A pulse: a short streak with a bright head, at fraction `f` of the path.
export const drawPulse = (
  r: Renderer,
  pts: Vec3[],
  f: number,
  color: LightName,
  alpha: number,
  length = 0.14,
) => {
  if (alpha <= 0.01 || f <= 0 || f >= 1) return;
  const tail = Math.max(0, f - length);
  r.poly3(pts, color, alpha * 0.55, 1.5, tail, f);
  r.poly3(pts, color, alpha * 0.5, 1.5, Math.max(0, f - length * 0.4), f);
  const head = r.project(along(pts, f));
  if (!head) return;
  const s = Math.min(2.2, Math.max(0.3, head.s));
  const a = alpha * r.fog(head.z) * (1 - 0.6 * r.blur(head.z));
  r.glow(head.x, head.y, 15 * s, color, a);
  r.dot(head.x, head.y, 1.7 * s, color, a);
};
