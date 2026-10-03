import { clamp01, easeInOut, easeOut, fract, hit, lerp, ramp, v3, type Vec3 } from "../engine/math";
import { onPlane, type Plane } from "../engine/project";
import type { Renderer } from "../engine/renderer";
import { drawNode, nodeScale } from "../primitives/node";
import { drawPath, drawPulse } from "../primitives/path";
import { drawSourceLabel } from "../primitives/stream";
import type { UIRect, Measured } from "../ui/SulcusUI";
import { RELEASE_PAUSE } from "../ui/runs/release";
import { CARDS, landsAt, STREAM_TRAVEL } from "../ui/runs/workspace";
import { drawField } from "../world/drawField";
import { connectTime, FIELD, fieldState, FRAMES, route, SYSTEMS } from "../world/field";
import { controlsCard, flyCard, w1, w2 } from "./planes";
import { BEAT, CONNECT_ORDER, ECOSYSTEMS, FOLLOWED, T } from "./timeline";

// Light the film adds on top of the Sulcus interface. All of it is anchored
// to real elements of the UI (measured after layout), so an execution path,
// a pulse or a stream lands exactly on the row, marker or button it means.

export type Sinks = { w1: Measured; w2: Measured };

const center = (r: UIRect): [number, number] => [r.x + r.w / 2, r.y + r.h / 2];

// A point on a window, in the world.
const at = (pl: Plane, x: number, y: number): Vec3 => onPlane(pl, x, y);

// A glowing point on a window.
const spot = (r: Renderer, pl: Plane, x: number, y: number, size: number, color: "hot" | "signal" | "ink" | "error", a: number) => {
  const p = r.project(at(pl, x, y));
  if (!p || a <= 0.01) return;
  r.glow(p.x, p.y, size * p.s, color, a);
};

// A ring going out from a point on a window.
const ring = (r: Renderer, pl: Plane, x: number, y: number, age: number, size: number, color: "hot" | "signal" | "error" = "signal") => {
  if (age < 0 || age > 0.9) return;
  const p = r.project(at(pl, x, y));
  if (!p) return;
  const k = age / 0.9;
  r.ring2(p.x, p.y, (6 + size * easeOut(k)) * p.s, color, (1 - k) * 0.9, 1.4);
  r.glow(p.x, p.y, 40 * p.s, "hot", (1 - k) * (1 - k) * 0.8);
};

// A streak of light along a path drawn in UI pixels on a window.
const streak = (r: Renderer, pl: Plane, pts: [number, number][], f: number, a: number, length = 0.25) => {
  if (a <= 0.01 || f <= 0 || f >= 1) return;
  const w = pts.map(([x, y]) => at(pl, x, y));
  drawPulse(r, w, f, "hot", a, length);
  drawPulse(r, w, f, "signal", 0.6 * a, length * 0.5);
};

// ── Into Sulcus: the followed agent becomes the Run Detail ───────────────

const followed = FIELD.nodes.filter((n) => n.sys === FOLLOWED);
const followedEdges = FIELD.edges.filter((e) => !e.cross && FIELD.nodes[e.b].sys === FOLLOWED);
const subs = followed.filter((n) => n.depth === 1 && n.kind === "agent");

// Where each node of the followed system lands in the Run Detail.
const targets = (m: Measured) => {
  const out = new Map<number, [number, number]>();
  const node = (name: string) => (m.rects[name] ? center(m.rects[name]) : null);
  const tools = (name: string) => (m.all[name] ?? []).map(center);
  const root = followed[0];
  const c = node("coordNode");
  if (c) out.set(root.id, c);
  const rowsBySub = [
    [node("researcherNode"), tools("rTools")],
    [node("verifierNode"), tools("vTools")],
  ] as const;
  subs.forEach((s, i) => {
    const [p, mk] = rowsBySub[i];
    if (p) out.set(s.id, p);
    // Its calls become its most recent tool markers.
    const leaves = s.children.map((id) => FIELD.nodes[id]);
    leaves.forEach((l, j) => {
      const pick = mk[Math.max(0, mk.length - leaves.length + j)];
      if (pick) out.set(l.id, pick);
    });
  });
  // The root's own opening moves are the Coordinator's first two calls.
  const ct = tools("cTools");
  root.children
    .map((id) => FIELD.nodes[id])
    .filter((n) => n.kind !== "agent")
    .forEach((n, j) => {
      if (ct[j]) out.set(n.id, ct[j]);
    });
  return out;
};

const morphK = (depth: number, t: number) => easeInOut((t - T.online - 0.05 * depth) / 1.35);

const drawInto = (r: Renderer, t: number, m: Measured) => {
  if (t < T.pulse1 || t > T.uiFull + 1.2) return;
  const st = fieldState(t);
  const root = followed[0];
  const lit = ramp(t, T.pulse2, T.pulse2 + 0.6);
  const fade = 1 - ramp(t, T.uiFull - 0.6, T.uiFull + 0.6);

  // Before the snap: the frozen system, picked out. An orange point lands on
  // its root; then light runs out along every path from it.
  if (t < T.online) {
    drawField(r, t, {
      skip: (s) => s !== FOLLOWED,
      gain: () => 1 + 5.2 * lit,
      detail: 0,
    });
    const pr = r.project(st[root.id].p);
    if (pr) {
      for (const tp of [T.pulse1, T.pulse2]) {
        const age = t - tp;
        if (age < 0 || age > 1.6) continue;
        const k = age / 1.6;
        r.ring2(pr.x, pr.y, (8 + 160 * easeOut(k)) * nodeScale(pr), "hot", (1 - k) * (1 - k), 1.6);
        r.glow(pr.x, pr.y, 140 * nodeScale(pr), "hot", hit(t, tp, 0.03, 0.4));
      }
      r.ring2(pr.x, pr.y, 13 * nodeScale(pr), "signal", 0.9 * ramp(t, T.pulse1, T.pulse1 + 0.2), 1.4);
    }
    for (const e of followedEdges) {
      const a = FIELD.nodes[e.a];
      const k = clamp01((t - T.pulse2 - a.depth * 0.32) / 0.5);
      if (k <= 0) continue;
      const pts = route(st[e.a].p, st[e.b].p, e.order, 0);
      r.poly3(pts, "hot", 0.55, 2.6, 0, k);
      r.poly3(pts, "signal", 0.9, 1.2, 0, k);
    }
    return;
  }

  // The snap: every node travels to the element of the Run Detail it is,
  // and every path straightens into a tree guide or a timeline row.
  const pl = w1(t);
  const tg = targets(m);
  const pos = (id: number): Vec3 => {
    const n = FIELD.nodes[id];
    const g = tg.get(id);
    if (!g) return st[id].p;
    return v3.lerp(n.chaos, at(pl, g[0], g[1]), morphK(n.depth, t));
  };
  for (const e of followedEdges) {
    const a = FIELD.nodes[e.a];
    const b = FIELD.nodes[e.b];
    const k = Math.min(morphK(a.depth, t), morphK(b.depth, t));
    const ga = tg.get(a.id);
    const gb = tg.get(b.id);
    const from = route(a.chaos, b.chaos, e.order, 0);
    let to: Vec3[] = from;
    if (ga && gb) {
      if (b.kind === "agent") {
        // A tree guide: down from the parent, across to the child.
        const corner = at(pl, ga[0], gb[1]);
        to = [at(pl, ga[0], ga[1]), corner, corner, at(pl, gb[0], gb[1])];
      } else {
        // A call on its agent's row: the row line, up to the marker.
        const start = at(pl, 780, gb[1]);
        to = [start, start, at(pl, gb[0], gb[1]), at(pl, gb[0], gb[1])];
      }
    }
    const pts = from.map((p, i) => v3.lerp(p, to[i], k));
    drawPath(r, pts, "ink", 0.55 * fade, 1, 1.2);
    // Execution still runs along it, in the control colour.
    const q = fract((t - T.online) / 1.1 + a.depth * 0.3);
    drawPulse(r, pts, q, "hot", 0.9 * fade, 0.3);
  }
  for (const n of followed) {
    const p = r.project(pos(n.id));
    if (!p) continue;
    drawNode(r, p, {
      kind: n.kind,
      depth: n.depth,
      seed: 0.3,
      age: 9,
      clock: t,
      energy: 1.15 * fade,
      color: "ink",
      owned: n.depth === 0 ? 1 : 0,
    });
    // Landing: a ring where it meets the interface.
    const k = morphK(n.depth, t);
    if (k > 0.98) {
      const age = t - (T.online + 0.05 * n.depth + 1.35);
      if (age > 0 && age < 0.8) {
        const s = nodeScale(p);
        r.ring2(p.x, p.y, (5 + 26 * easeOut(age / 0.8)) * s, "signal", (1 - age / 0.8) * 0.9, 1.2);
      }
    }
  }
};

// ── Run Detail: light that runs through the real interface ───────────────

const drawResearch = (r: Renderer, t: number, m: Measured) => {
  if (t < T.see - 0.5 || t > T.limitHit + 2.6) return;
  const pl = w1(t);
  const R = m.rects;

  // SEE: execution lights each agent's row, root first.
  (m.all.lines ?? []).forEach((ln, i) => {
    const f = ramp(t, T.see + 0.2 + i * 0.28, T.see + 1.5 + i * 0.28);
    const y = ln.y + ln.h / 2;
    streak(r, pl, [[ln.x, y], [ln.x + ln.w, y]], f, 0.9);
  });

  // Selecting the Researcher: down the tree guide from the Coordinator.
  if (R.coordNode && R.researcherNode) {
    const [cx, cy] = center(R.coordNode);
    const [rx, ry] = center(R.researcherNode);
    streak(r, pl, [[cx, cy], [cx, ry], [rx, ry]], ramp(t, T.select - 0.35, T.select + 0.05), 0.9, 0.5);
    ring(r, pl, rx, ry, t - T.select, 40);
  }

  // Inspecting one call: it is marked, then followed down to its event.
  if (R.inspected) {
    const [mx, my] = center(R.inspected);
    ring(r, pl, mx, my, t - (T.inspect + 0.4), 36);
    spot(r, pl, mx, my, 30, "hot", 0.7 * ramp(t, T.inspect + 0.3, T.inspect + 0.6) * (1 - ramp(t, T.rowOpen + 0.6, T.rowOpen + 1.2)));
    if (R.eventRow) {
      const [ex, ey] = [R.eventRow.x + 60, R.eventRow.y + 14];
      const f = ramp(t, T.logOpen + 0.35, T.rowOpen + 0.05);
      streak(r, pl, [[mx, my], [mx, ey], [ex, ey]], f, 0.95, 0.4);
      const flash = hit(t, T.rowOpen, 0.03, 0.5);
      if (flash > 0.02) {
        const a = at(pl, R.eventRow.x, ey);
        const b = at(pl, R.eventRow.x + R.eventRow.w, ey);
        r.line3(a, b, "hot", 0.6 * flash, 2.4);
      }
    }
  }

  // The approval: the call is held where it stands.
  if (R.pending) {
    const [px, py] = center(R.pending);
    ring(r, pl, px, py, t - (T.approvalAsk + 0.15), 46, "hot");
    spot(r, pl, px, py, 26, "hot", 0.35 + 0.25 * Math.cos(((t - T.approvalAsk) / BEAT) * Math.PI * 2));
  }
  if (R.approve) {
    const [ax, ay] = center(R.approve);
    spot(r, pl, ax, ay, 90, "hot", 0.9 * hit(t, T.approvalGrant, 0.03, 0.45));
  }
  // …and the moment it is approved, execution resumes along its row.
  if (R.verifierRow && R.cursor && t >= T.approvalDone) {
    const y = R.verifierRow.y + R.verifierRow.h / 2;
    const x1 = R.cursor.x;
    streak(r, pl, [[x1 - 260, y], [x1, y]], ramp(t, T.approvalDone, T.approvalDone + 0.6), 0.9, 0.4);
  }

  // The limit, carried from the form into the run.
  if (R.tokens) {
    const [tx, ty] = center(R.tokens);
    const card = controlsCard(t);
    const f = ramp(t, T.bounds + 1.3, T.bounds + 2.2);
    if (f > 0 && f < 1) {
      const from = onPlane(card.plane, 170, 100);
      const to = at(pl, tx + 70, ty + 4);
      const mid = v3.add(v3.lerp(from, to, 0.5), [0, 60, -120]);
      drawPulse(r, [from, mid, to], f, "hot", 1, 0.35);
    }
    spot(r, pl, tx, ty, 120, "hot", 0.8 * hit(t, T.bounds + 2.2, 0.04, 0.6));
    // Warning at 80 %; the stop at the limit.
    spot(r, pl, tx, ty, 140, "hot", 0.6 * hit(t, T.limitWarn, 0.04, 0.7));
    spot(r, pl, tx, ty, 160, "error", 0.7 * hit(t, T.limitHit, 0.03, 0.8));
  }
  if (R.error) {
    const [ex, ey] = center(R.error);
    ring(r, pl, ex, ey, t - T.limitHit, 60, "error");
  }
  if (R.summary) {
    const flash = hit(t, T.limitHit, 0.03, 0.9);
    if (flash > 0.02) r.line3(at(pl, R.summary.x, R.summary.y), at(pl, R.summary.x, R.summary.y + R.summary.h), "error", flash, 3);
  }
};

const drawRelease = (r: Renderer, t: number, m: Measured) => {
  if (t < T.many - 0.5 || t > T.manyOut + 0.5) return;
  const pl = w2(t);
  const R = m.rects;
  if (R.changelog) ring(r, pl, ...center(R.changelog), t - T.manyDone, 40, "signal");
  if (R.failed) ring(r, pl, ...center(R.failed), t - T.manyFail, 40, "error");
  if (R.docs) ring(r, pl, ...center(R.docs), t - T.manyStart, 40, "signal");
  if (R.pending) ring(r, pl, ...center(R.pending), t - (RELEASE_PAUSE + 0.15), 50, "hot");
};

// ── Integrations: seven systems, one place ───────────────────────────────

const drawStreams = (r: Renderer, t: number, m: Measured) => {
  if (t < connectTime(CONNECT_ORDER[0]) - 0.1) return;
  const pl = w2(t);
  const rows = m.all.runRows ?? [];
  const fade = 1 - ramp(t, T.scale + 1.5, T.scale + 3.5);
  CONNECT_ORDER.forEach((sys, i) => {
    const at0 = connectTime(sys);
    if (t < at0) return;
    // Its run is the row that landed i-th; newer rows push it down.
    const landed = CONNECT_ORDER.filter((s) => t >= landsAt(s)).length;
    const index = t >= landsAt(sys) ? landed - 1 - i : 0;
    const row = rows[Math.max(0, index)];
    const ry = row ? row.y + row.h / 2 : 300;
    const S = SYSTEMS[sys];
    const base = FRAMES[sys].base;
    const edge = at(pl, 150, 0);
    const entry: Vec3 = [lerp(base[0], edge[0], 0.15), 2, edge[2] + 40];
    const pts: Vec3[] = [
      [base[0], 2, base[2]],
      [base[0] * 0.35 + entry[0] * 0.65, 2, entry[2] + 220],
      entry,
      at(pl, 150, 4),
      at(pl, 150, ry),
      at(pl, 340, ry),
    ];
    const k = clamp01((t - at0) / STREAM_TRAVEL);
    drawPath(r, pts, "signal", 0.55 * fade, easeInOut(k), 1.3);
    if (k >= 1) {
      // Events flow in along it, on the beat.
      for (let j = 0; j < 2; j++) drawPulse(r, pts, fract((t - at0) / (BEAT * 4) + j / 2), "hot", 0.8 * fade, 0.12);
      if (row) {
        const flash = hit(t, landsAt(sys), 0.03, 0.7);
        if (flash > 0.02) r.line3(at(pl, row.x, ry), at(pl, row.x + row.w, ry), "hot", 0.7 * flash, 2.2);
      }
    }
    // The system's name over its tree.
    const name = ramp(t, at0 - 0.05, at0 + 0.35) * fade;
    drawSourceLabel(r, FRAMES[sys], S.top, ECOSYSTEMS[sys].name, ECOSYSTEMS[sys].where, name);
  });
};

// The four runs of the fly-through stand between the camera and the systems:
// the streams and names behind them are hidden by them, not drawn over them.
const hideBehindCards = (r: Renderer, t: number) => {
  if (t < T.flyThrough - 0.4 || t >= T.onePlace + 0.8) return;
  CARDS.forEach((_, i) => {
    const { plane: pl, opacity } = flyCard(i, t);
    const q = [at(pl, 0, 0), at(pl, pl.w, 0), at(pl, pl.w, pl.h), at(pl, 0, pl.h)].map((p) => r.project(p));
    if (q.every((p) => p)) r.cut(q as { x: number; y: number }[], opacity);
  });
};

export const drawLight = (r: Renderer, t: number, sinks: Sinks) => {
  drawInto(r, t, sinks.w1);
  drawResearch(r, t, sinks.w1);
  drawRelease(r, t, sinks.w2);
  drawStreams(r, t, sinks.w2);
  hideBehindCards(r, t);
};
