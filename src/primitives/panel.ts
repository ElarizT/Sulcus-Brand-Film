import { clamp01, easeOut } from "../engine/math";
import type { Renderer } from "../engine/renderer";
import type { LightName } from "../theme/colors";
import { place, type TreeFrame } from "../world/layout";

// An inspector: the few facts Sulcus holds about one piece of execution, set
// as a small table that stands in the world beside the thing it describes.
// It is sized in world units, so it has perspective and parallax like
// everything else, and it clears a dark plate behind itself.

export type PanelRow = {
  label: string;
  value: string;
  color?: LightName;
  // 0 → 1 as the value types in.
  shown: number;
};

export type PanelBox = {
  // Top-left corner in the tree's frame, and the panel's width.
  u: number;
  v: number;
  w: number;
  width: number;
};

const ROW = 62;
const HEAD = 52;
const PAD = 28;
const COL = 196;

export const panelHeight = (rows: number) => HEAD + rows * ROW + 14;

// Where a row's value column sits on screen, for anything drawn into it.
export type RowSlot = {
  x: number;
  y: number;
  s: number;
  left: number;
  right: number;
};

export const drawPanel = (
  r: Renderer,
  f: TreeFrame,
  box: PanelBox,
  header: string,
  rows: PanelRow[],
  open: number,
  alpha: number,
): RowSlot[] | null => {
  const o = easeOut(open);
  if (o <= 0 || alpha <= 0.01) return null;
  const height = panelHeight(rows.length);
  const tl = r.project(place(f, box.u, box.v, box.w));
  const br = r.project(place(f, box.u + box.width, box.v - height, box.w));
  if (!tl || !br) return null;
  const s = tl.s;
  const w = br.x - tl.x;
  const h = (br.y - tl.y) * o;
  const a = alpha * r.fog(tl.z);

  r.plate(tl.x - 8, tl.y - 8, w + 16, h + 16, 0.9 * alpha);

  // Frame: an accent down the left, hairlines top and bottom, corner ticks.
  r.line2(tl.x, tl.y, tl.x, tl.y + h, "signal", 0.95 * a, 2);
  r.line2(tl.x, tl.y, tl.x + w * o, tl.y, "signal", 0.55 * a);
  r.line2(tl.x, tl.y + h, tl.x + w * o, tl.y + h, "signal", 0.55 * a);
  const tick = 14 * s;
  r.line2(tl.x + w, tl.y, tl.x + w, tl.y + tick, "signal", 0.8 * a * o, 1.4);
  r.line2(tl.x + w, tl.y + h, tl.x + w, tl.y + h - tick, "signal", 0.8 * a * o, 1.4);

  r.text(header, tl.x + PAD * s, tl.y + HEAD * 0.52 * s, 15 * s, "signal", 0.95 * a * o, {
    tracking: 0.18,
    weight: 500,
  });

  const slots: RowSlot[] = [];
  rows.forEach((row, i) => {
    const y = tl.y + (HEAD + (i + 0.5) * ROW) * s;
    const x = tl.x + (PAD + COL) * s;
    slots.push({ x, y, s, left: tl.x + PAD * s, right: tl.x + w - PAD * s });
    // Rows exist once the panel has unfolded past them.
    if (y > tl.y + h) return;
    const top = y - (ROW / 2) * s;
    r.line2(tl.x + PAD * s, top, tl.x + w - PAD * s, top, "dim", 0.22 * a);
    r.text(row.label, tl.x + PAD * s, y, 14.5 * s, "dim", 0.95 * a, {
      tracking: 0.14,
    });
    const typed = row.value.slice(
      0,
      Math.ceil(clamp01(row.shown) * row.value.length),
    );
    r.text(typed, x, y, 26 * s, row.color ?? "ink", a, { weight: 500 });
  });
  return slots;
};
