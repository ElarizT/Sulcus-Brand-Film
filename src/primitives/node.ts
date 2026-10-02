import { easeOut, fract, hash, TAU } from "../engine/math";
import type { Projected, Renderer } from "../engine/renderer";
import type { LightName } from "../theme/colors";

// Execution nodes. Every agent, process and tool call in the film is one of
// these: a core of light, plus a small glyph that says what kind of work it
// is, drawn only when the camera is close enough to read it.

export type NodeKind = "agent" | "proc" | "browser" | "cloud" | "tool" | "file";

export type NodeLook = {
  kind: NodeKind;
  depth: number;
  seed: number;
  // Seconds since the node appeared.
  age: number;
  // Clock that drives the glyph's own activity (typing, scanning).
  clock: number;
  energy: number;
  color?: LightName;
  // 0..1: the orange ownership ring of a governed root.
  owned?: number;
};

// Marks are drawn a little larger than true perspective so they hold up on a
// phone, and never smaller than a legible minimum.
export const nodeScale = (pr: Projected) =>
  Math.min(2.6, Math.max(0.36, pr.s * 1.4));

export const coreRadius = (kind: NodeKind, depth: number) =>
  depth === 0 ? 5 : kind === "tool" || kind === "file" ? 2.8 : 3.7;

export const drawNode = (r: Renderer, pr: Projected, n: NodeLook) => {
  const sz = nodeScale(pr);
  const bl = r.blur(pr.z);
  const a = (n.energy * r.fog(pr.z)) / (1 + 2.4 * bl);
  if (a < 0.01) return;
  const col = n.color ?? "ink";
  const core = coreRadius(n.kind, n.depth) * sz * (1 + 2 * bl);

  r.glow(pr.x, pr.y, core * 7, col, 0.5 * a);
  r.dot(pr.x, pr.y, core, col, a);

  // Activation: a ring leaves the node as it wakes.
  if (n.age < 0.9) {
    const k = n.age / 0.9;
    r.ring2(pr.x, pr.y, (8 + 52 * easeOut(k)) * sz, col, (1 - k) * 0.7 * a, 1.2);
    r.glow(pr.x, pr.y, 70 * sz, col, (1 - k) * (1 - k) * 0.85 * a);
  }

  if (n.owned && n.owned > 0)
    r.ring2(pr.x, pr.y, core + 7 * sz, "signal", 0.85 * n.owned * a, 1.3);

  if (sz < 0.5 || bl > 0.55) return;
  const g = a * (1 - bl);

  switch (n.kind) {
    case "agent": {
      if (!n.owned) r.ring2(pr.x, pr.y, core + 6 * sz, col, 0.45 * g, 1);
      break;
    }
    case "cloud": {
      r.ring2(pr.x, pr.y, core + 6 * sz, col, 0.5 * g, 1);
      // A segmented outer ring, slowly turning: a remote process.
      const rot = n.clock * 0.5 + n.seed;
      for (let i = 0; i < 6; i++) {
        const a0 = rot + (i * TAU) / 6;
        r.ring2(pr.x, pr.y, core + 13 * sz, col, 0.4 * g, 1, a0, a0 + 0.62);
      }
      break;
    }
    case "proc": {
      // A terminal: lines of output typing out and scrolling.
      const rate = 2.4;
      const line = Math.floor(n.clock * rate);
      const typed = fract(n.clock * rate);
      const x0 = pr.x - 62 * sz;
      for (let i = 0; i < 4; i++) {
        const y = pr.y + (10 - i * 5.5) * sz;
        const id = line - i + Math.floor(n.seed * 97);
        let x = x0;
        for (let k = 0; k < 3; k++) {
          const len = (6 + hash(id, k) * 16) * sz;
          const show = i === 0 ? Math.min(1, Math.max(0, typed * 3 - k)) : 1;
          if (show > 0)
            r.line2(x, y, x + len * show, y, col, (0.6 - i * 0.12) * g, 1.3 * sz);
          x += len + 4 * sz;
        }
      }
      break;
    }
    case "browser": {
      // Structured data being walked cell by cell.
      const lit = Math.floor(n.clock * 6) % 12;
      const cell = 4.6 * sz;
      for (let i = 0; i < 12; i++) {
        const x = pr.x - 42 * sz + (i % 4) * (cell + 2 * sz);
        const y = pr.y - 10 * sz + Math.floor(i / 4) * (cell + 2 * sz);
        r.rect2(x, y, cell, cell, col, (i === lit ? 0.9 : 0.16) * g);
      }
      break;
    }
    case "tool": {
      const d = core + 5 * sz;
      r.line2(pr.x, pr.y - d, pr.x + d, pr.y, col, 0.6 * g, 1);
      r.line2(pr.x + d, pr.y, pr.x, pr.y + d, col, 0.6 * g, 1);
      r.line2(pr.x, pr.y + d, pr.x - d, pr.y, col, 0.6 * g, 1);
      r.line2(pr.x - d, pr.y, pr.x, pr.y - d, col, 0.6 * g, 1);
      break;
    }
    case "file": {
      // Changed lines.
      const w = [15, 9, 12];
      for (let i = 0; i < 3; i++) {
        const y = pr.y + (i - 1) * 5 * sz;
        const flip = n.age < 1.2 ? Math.min(1, Math.max(0, n.age * 4 - i)) : 1;
        r.line2(
          pr.x + 10 * sz,
          y,
          pr.x + (10 + w[i] * flip) * sz,
          y,
          col,
          0.65 * g,
          1.6 * sz,
        );
      }
      break;
    }
  }
};
