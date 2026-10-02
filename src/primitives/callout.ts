import type { Renderer } from "../engine/renderer";
import type { LightName } from "../theme/colors";

// A two-line annotation for a moment of control: what Sulcus did, and to
// what. It clears a dark plate behind itself so it reads over the tree.
export const drawCallout = (
  r: Renderer,
  x: number,
  y: number,
  sz: number,
  title: string,
  sub: string,
  color: LightName,
  align: "left" | "right",
  alpha: number,
  // Type size multiplier, for shots that hold further back.
  scale = 1,
) => {
  if (alpha <= 0.02) return;
  sz *= scale;
  const tp = Math.min(24, Math.max(7, 11 * sz));
  const sp = tp * 0.88;
  const head = { weight: 500, tracking: 0.1 };
  const w = Math.max(r.measure(title, tp, head), sub ? r.measure(sub, sp) : 0);
  const pad = 8 * sz;
  const x0 = align === "left" ? x : x - w;
  const half = (sub ? 18 : 10) * sz;
  r.plate(x0 - pad, y - half, w + pad * 2, half * 2, 0.88 * alpha);
  // An accent on the side the annotation points from.
  const bar = align === "left" ? x0 - pad : x0 + w + pad;
  r.line2(bar, y - half, bar, y + half, color, alpha, 1.6);
  r.text(title, x0, y - (sub ? 7.5 * sz : 0), tp, color, alpha, head);
  if (sub) r.text(sub, x0, y + 8.5 * sz, sp, "dim", alpha);
};
