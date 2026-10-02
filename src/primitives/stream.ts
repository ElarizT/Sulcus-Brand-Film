import { clamp01, easeInOut, fract, v3, type Vec3 } from "../engine/math";
import type { Renderer } from "../engine/renderer";
import { CORE_R, place, type TreeFrame } from "../world/layout";

// Integration streams: how an agent system reaches the control layer. A tap
// drops from the system's root into the plane, and a trace runs along the
// plane to the core, carrying its events inward.

// Root → ground.
export const drawTap = (
  r: Renderer,
  f: TreeFrame,
  rootV: number,
  alpha: number,
) => {
  if (alpha <= 0.01) return;
  r.line3(place(f, 0, rootV), place(f, 0, 0), "signal", 0.5 * alpha, 1.2);
  r.line3(place(f, -26, 0), place(f, 26, 0), "signal", 0.8 * alpha, 1.6);
};

// Ground trace from a system's base to the core, drawn on as `progress`
// goes 0 → 1, with events flowing inward on the beat.
export const drawStream = (
  r: Renderer,
  f: TreeFrame,
  radius: number,
  progress: number,
  beats: number,
  alpha: number,
  phase = 0,
) => {
  const p = easeInOut(progress);
  if (p <= 0 || alpha <= 0.01) return;
  const span = radius - CORE_R;
  const at = (k: number, side = 0): Vec3 =>
    v3.add(place(f, side, 0, 0), v3.scale(f.n, span * k));
  const steps = Math.max(2, Math.ceil(span / 420));
  for (let i = 0; i < steps; i++) {
    const k0 = i / steps;
    const k1 = Math.min(p, (i + 1) / steps);
    if (k1 <= k0) break;
    r.line3(at(k0), at(k1), "signal", 0.62 * alpha, 1.5);
    // Side rails narrow toward the core: a bus, not a wire.
    for (const s of [-1, 1])
      r.line3(
        at(k0, s * 22 * (1 - k0)),
        at(k1, s * 22 * (1 - k1)),
        "signal",
        0.2 * alpha,
      );
  }
  if (p < 1) {
    const tip = r.project(at(p));
    if (tip) {
      r.glow(tip.x, tip.y, 60 * tip.s + 10, "hot", alpha);
      r.dot(tip.x, tip.y, Math.max(1.2, 3 * tip.s), "signal", alpha);
    }
    return;
  }
  for (let i = 0; i < 3; i++) {
    const k = fract(beats / 4 + phase + i / 3);
    const head = r.project(at(k));
    if (!head) continue;
    const a = alpha * r.fog(head.z) * Math.sin(Math.PI * clamp01(k));
    r.line3(at(Math.max(0, k - 0.05)), at(k), "hot", 0.9 * a, 2);
    r.glow(head.x, head.y, 34 * head.s + 6, "hot", 0.9 * a);
    r.dot(head.x, head.y, Math.max(1, 2.6 * head.s), "signal", a);
  }
};

// A control signal: it travels the other way, from the core out to a system.
// `k` is 0 at the core and 1 at the system.
export const drawCommand = (
  r: Renderer,
  f: TreeFrame,
  radius: number,
  k: number,
) => {
  if (k <= 0 || k >= 1) return;
  const span = radius - CORE_R;
  const at = (x: number): Vec3 => v3.add(place(f, 0, 0, 0), v3.scale(f.n, span * (1 - x)));
  r.line3(at(Math.max(0, k - 0.16)), at(k), "hot", 1, 3.2);
  r.line3(at(Math.max(0, k - 0.3)), at(k), "signal", 0.5, 2);
  const head = r.project(at(k));
  if (!head) return;
  r.glow(head.x, head.y, 90 * head.s + 14, "hot", 1);
  r.dot(head.x, head.y, Math.max(1.6, 5 * head.s), "ink", 1);
  r.ring2(head.x, head.y, 22 * head.s + 5, "signal", 0.8, 1.2);
};

// The name over a source system.
export const drawSourceLabel = (
  r: Renderer,
  f: TreeFrame,
  topV: number,
  name: string,
  where: string,
  alpha: number,
  detail = "",
  detailColor: "dim" | "signal" = "dim",
) => {
  if (alpha <= 0.01) return;
  const pr = r.project(place(f, 0, topV + 120));
  if (!pr) return;
  const px = Math.min(19, Math.max(11.5, 34 * pr.s));
  // A short leader from the boundary up to the name.
  r.line3(place(f, 0, topV + 62), place(f, 0, topV + 104), "signal", 0.6 * alpha);
  r.text(name, pr.x, pr.y - px * 0.9, px, "ink", 0.95 * alpha, {
    align: "center",
    font: "sans",
    weight: 600,
    tracking: 0.16,
  });
  r.text(where, pr.x, pr.y - px * 2.15, px * 0.68, "signal", 0.8 * alpha, {
    align: "center",
    tracking: 0.14,
  });
  if (detail)
    r.text(detail, pr.x, pr.y - px * 3.3, px * 0.8, detailColor, 0.95 * alpha, {
      align: "center",
      tracking: 0.04,
    });
};
