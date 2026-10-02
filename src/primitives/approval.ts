import { clamp01, easeOut } from "../engine/math";
import type { Projected, Renderer } from "../engine/renderer";

// Approval states. A held call sits between two brackets that Sulcus closes
// around it; on approval the brackets part and the call goes through.

export type ApprovalState = "idle" | "held" | "approved";

export const drawApprovalGate = (
  r: Renderer,
  pr: Projected,
  // Seconds since the call was held, and since it was approved (negative
  // before each).
  held: number,
  granted: number,
  beat: number,
  alpha: number,
  size = 1,
) => {
  if (held < 0 || alpha <= 0.01) return;
  const sz = Math.min(2.6, Math.max(0.4, pr.s)) * size;
  const a = alpha * r.fog(pr.z);
  const close = easeOut(held / 0.28);
  const open = granted > 0 ? easeOut(granted / 0.45) : 0;
  const fade = 1 - clamp01((granted - 0.2) / 0.6);
  // The brackets arrive from wide and lock; on approval they part.
  const gap = (11 + 26 * (1 - close) + 30 * open) * sz;
  const h = 13 * sz;
  const arm = 6 * sz;
  const pulse = granted > 0 ? 1 : 0.7 + 0.3 * Math.cos(beat * Math.PI * 2);
  const al = a * fade * pulse * close;
  for (const s of [-1, 1]) {
    const x = pr.x + s * gap;
    r.line2(x, pr.y - h, x, pr.y + h, "signal", al, 1.6);
    r.line2(x, pr.y - h, x - s * arm, pr.y - h, "signal", al, 1.6);
    r.line2(x, pr.y + h, x - s * arm, pr.y + h, "signal", al, 1.6);
  }
  // The held call itself.
  r.glow(pr.x, pr.y, 26 * sz, "hot", 0.7 * a * fade * pulse);
  r.dot(pr.x, pr.y, 2.4 * sz, "signal", a * fade);
  // The lock, and the release.
  if (held < 0.5) r.glow(pr.x, pr.y, 80 * sz, "hot", (1 - held / 0.5) * 0.7 * a);
  if (granted > 0 && granted < 0.6)
    r.glow(pr.x, pr.y, 110 * sz, "ink", (1 - granted / 0.6) * 0.6 * a);
};
