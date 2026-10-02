import { hash } from "../engine/math";
import type { Renderer } from "../engine/renderer";

// Dust in the volume. It carries no meaning; it is what lets the eye feel the
// camera move through darkness, and out-of-focus motes near the lens give the
// frame its depth.

const COUNT = 560;
const MOTES = Array.from({ length: COUNT }, (_, i) => ({
  x: (hash(i, 1) - 0.5) * 9000,
  y: hash(i, 2) * 2400 - 100,
  z: (hash(i, 3) - 0.42) * 9000,
  phase: hash(i, 4) * 100,
  size: 0.6 + hash(i, 5) * 1.4,
}));

export const drawDust = (r: Renderer, t: number, alpha = 1) => {
  if (alpha <= 0.01) return;
  for (const m of MOTES) {
    const pr = r.project([
      m.x + Math.sin(t * 0.11 + m.phase) * 60,
      m.y + Math.sin(t * 0.07 + m.phase * 1.7) * 40 + t * 3,
      m.z + Math.cos(t * 0.09 + m.phase) * 60,
    ]);
    if (!pr || !r.onScreen(pr, 60)) continue;
    const bl = r.blur(pr.z);
    const twinkle = 0.65 + 0.35 * Math.sin(t * 0.9 + m.phase * 3);
    const s = Math.min(3, Math.max(0.25, pr.s));
    // Defocused motes bloom into soft discs.
    const radius = m.size * s * (2.2 + 16 * bl);
    r.glow(
      pr.x,
      pr.y,
      radius,
      "cool",
      (alpha * 0.5 * twinkle * r.fog(pr.z)) / (1 + 4 * bl),
    );
  }
};
