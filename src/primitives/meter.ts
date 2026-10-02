import { clamp01 } from "../engine/math";
import type { Renderer } from "../engine/renderer";
import { place, type TreeFrame } from "../world/layout";

// Resource indicators: a vertical gauge beside an agent with its limit drawn
// on it. Below the limit the fill is plain light; at the limit Sulcus holds
// it and the fill turns to the control colour.

export const drawLimitMeter = (
  r: Renderer,
  f: TreeFrame,
  u: number,
  v: number,
  // 0..1 of the limit.
  level: number,
  alpha: number,
  held: boolean,
  height = 96,
) => {
  if (alpha <= 0.01) return;
  const v0 = v - height / 2;
  const v1 = v + height / 2;
  const limit = v0 + height * 0.84;
  // Track.
  r.line3(place(f, u - 5, v0), place(f, u - 5, v1), "dim", 0.5 * alpha);
  r.line3(place(f, u + 5, v0), place(f, u + 5, v1), "dim", 0.5 * alpha);
  r.line3(place(f, u - 5, v0), place(f, u + 5, v0), "dim", 0.5 * alpha);
  // Fill, capped at the limit.
  const top = v0 + (limit - v0) * clamp01(level);
  r.line3(
    place(f, u, v0 + 2),
    place(f, u, top),
    held ? "hot" : "ink",
    (held ? 0.95 : 0.7) * alpha,
    5,
    true,
  );
  // The limit itself is always Sulcus's mark.
  r.line3(
    place(f, u - 13, limit),
    place(f, u + 13, limit),
    "signal",
    (held ? 1 : 0.75) * alpha,
    held ? 2 : 1.3,
  );
};
