import { TAU } from "../engine/math";
import type { Projected, Renderer } from "../engine/renderer";
import { nodeScale } from "./node";

// Runtime events as they look when nobody is supervising them: warnings that
// flash and stay, permission requests nobody answers, retries with no count.

const labelPx = (sz: number) => Math.min(20, Math.max(6.5, 10.5 * sz));

// A warning on a node. `age` is seconds since it fired.
export const drawWarning = (
  r: Renderer,
  pr: Projected,
  age: number,
  text: string,
  energy: number,
) => {
  // Warnings stay readable even from far back: they are the point.
  const sz = Math.max(0.62, nodeScale(pr));
  const a = energy * r.fog(pr.z) * (1 - r.blur(pr.z));
  if (a < 0.02) return;
  r.glow(pr.x, pr.y, 34 * sz, "error", 0.4 * a);
  const blink = age < 0.9 ? (Math.floor(age * 9) % 2 === 0 ? 1 : 0.25) : 0.7;
  const x = pr.x - 13 * sz;
  const y = pr.y - 13 * sz;
  const h = 6.5 * sz;
  r.line2(x, y - h, x + h, y + h * 0.7, "error", blink * a, 1.1);
  r.line2(x + h, y + h * 0.7, x - h, y + h * 0.7, "error", blink * a, 1.1);
  r.line2(x - h, y + h * 0.7, x, y - h, "error", blink * a, 1.1);
  if (age < 0.5) r.glow(pr.x, pr.y, 46 * sz, "error", (1 - age / 0.5) * 0.6 * a);
  if (sz >= 0.34)
    r.text(
      text.slice(0, Math.floor(age / 0.018)),
      pr.x + 13 * sz,
      pr.y + 12 * sz,
      labelPx(sz) * 0.92,
      "error",
      (age < 2.5 ? 0.85 : 0.5) * a,
    );
};

// A permission request with no one to grant it: it blinks, then lets itself
// through.
export const drawPermission = (
  r: Renderer,
  pr: Projected,
  age: number,
  energy: number,
) => {
  if (age < 0 || age > 2.6) return;
  const sz = nodeScale(pr);
  const a = energy * r.fog(pr.z) * (1 - r.blur(pr.z));
  if (a < 0.02 || sz < 0.34) return;
  const asking = age < 1.4;
  const blink = asking ? (Math.floor(age * 5) % 2 === 0 ? 0.95 : 0.35) : 0.45;
  const d = 12 * sz;
  if (asking) {
    // Corner brackets hold the node for a moment.
    for (const sx of [-1, 1])
      for (const sy of [-1, 1]) {
        r.line2(pr.x + sx * d, pr.y + sy * d, pr.x + sx * d * 0.5, pr.y + sy * d, "ink", blink * a, 1.1);
        r.line2(pr.x + sx * d, pr.y + sy * d, pr.x + sx * d, pr.y + sy * d * 0.5, "ink", blink * a, 1.1);
      }
  }
  r.text(
    asking ? "permission?" : "auto-allowed",
    pr.x - 15 * sz,
    pr.y + 1,
    labelPx(sz) * 0.92,
    "ink",
    blink * a * (asking ? 1 : 1 - (age - 1.4) / 1.2),
    { align: "right" },
  );
};

// A retry: an open arc circling the node.
export const drawRetry = (
  r: Renderer,
  pr: Projected,
  turn: number,
  alpha: number,
  color: "error" | "ink" | "signal" = "error",
) => {
  const sz = nodeScale(pr);
  const a = alpha * r.fog(pr.z) * (1 - r.blur(pr.z));
  if (a < 0.02 || sz < 0.4) return;
  const a0 = turn * TAU;
  const rad = 10.5 * sz;
  r.ring2(pr.x, pr.y, rad, color, 0.8 * a, 1.1, a0, a0 + TAU * 0.72);
  r.dot(
    pr.x + Math.cos(a0 + TAU * 0.72) * rad,
    pr.y + Math.sin(a0 + TAU * 0.72) * rad,
    1.5 * sz,
    color,
    a,
  );
};

// A small meter beside a node: usage with nothing to stop it.
export const drawRunawayMeter = (
  r: Renderer,
  pr: Projected,
  level: number,
  energy: number,
) => {
  const sz = nodeScale(pr);
  const a = energy * r.fog(pr.z) * (1 - r.blur(pr.z));
  if (a < 0.02 || sz < 0.45) return;
  const x = pr.x - 11 * sz;
  const h = 22 * sz;
  const y1 = pr.y + 20 * sz;
  const over = level > 1;
  r.line2(x, y1, x, y1 - h, "dim", 0.5 * a, 1);
  r.line2(
    x,
    y1,
    x,
    y1 - h * Math.min(1.35, level),
    over ? "error" : "ink",
    0.8 * a,
    2.2 * sz,
  );
};
