import { clamp01, easeOut, fract, hash } from "../engine/math";
import type { Renderer } from "../engine/renderer";
import { place, RAIL, type TreeFrame } from "../world/layout";

// A tree's timeline: one lane per agent, spans for the work it did, on a
// shared ruler. The lanes arrive out of register and slide into alignment;
// an orange playhead then reads across them.

type Span = { a: number; b: number; fault: boolean };

const lanes = (seed: number): Span[][] => {
  const out: Span[][] = [];
  for (let l = 0; l < RAIL.lanes; l++) {
    const spans: Span[] = [];
    let x = 0.02 + hash(seed, l * 13) * 0.1;
    let k = 0;
    while (x < 0.96) {
      const len = 0.05 + hash(seed, l * 31 + k * 7) * 0.16;
      spans.push({
        a: x,
        b: Math.min(0.99, x + len),
        fault: hash(seed, l * 17 + k * 3) < 0.09,
      });
      x += len + 0.02 + hash(seed, l * 41 + k * 5) * 0.09;
      k++;
    }
    out.push(spans);
  }
  return out;
};

const cache = new Map<number, Span[][]>();

export const drawTimelineRail = (
  r: Renderer,
  f: TreeFrame,
  halfWidth: number,
  seed: number,
  // Seconds since this rail appeared.
  age: number,
  // Beats, for the playhead.
  beats: number,
  alpha: number,
) => {
  if (age <= 0 || alpha <= 0.01) return;
  let data = cache.get(seed);
  if (!data) cache.set(seed, (data = lanes(seed)));
  const appear = clamp01(age / 0.5);
  const hw = halfWidth;
  const at = (x: number) => -hw + x * hw * 2;

  // Ruler.
  const ry = RAIL.ruler;
  r.line3(place(f, -hw, ry), place(f, hw, ry), "dim", 0.5 * alpha * appear);
  for (let i = 0; i <= 16; i++) {
    const major = i % 4 === 0;
    r.line3(
      place(f, at(i / 16), ry),
      place(f, at(i / 16), ry + (major ? 12 : 6)),
      "dim",
      (major ? 0.7 : 0.4) * alpha * appear,
    );
  }

  // The first pass of the playhead writes the spans; later passes read them.
  const sweep = Math.max(0, beats) / 8;
  const head = fract(sweep);
  const written = sweep >= 1 ? 1 : head;

  for (let l = 0; l < data.length; l++) {
    const v = RAIL.top - l * RAIL.lane;
    // Out of register on arrival, then aligned.
    const settle = easeOut((age - 0.1 - l * 0.09) / 0.9);
    const slip = (1 - settle) * (hash(seed, l + 90) - 0.5) * hw * 0.55;
    r.line3(place(f, -hw, v), place(f, hw, v), "dim", 0.22 * alpha * appear);
    for (const s of data[l]) {
      if (s.a > written) continue;
      const b = Math.min(s.b, written);
      const near = Math.abs((s.a + b) / 2 - head) < 0.06 ? 1 : 0;
      r.line3(
        place(f, at(s.a) + slip, v),
        place(f, at(b) + slip, v),
        s.fault ? "error" : "ink",
        (0.42 + 0.45 * near) * alpha * appear * settle,
        3.2,
        true,
      );
    }
  }

  // Playhead.
  const x = at(head);
  r.line3(
    place(f, x, ry - 8),
    place(f, x, RAIL.top + 18),
    "signal",
    0.85 * alpha * appear,
    1.3,
  );
};
