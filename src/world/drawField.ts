import { clamp01, fract, hash, lerp, ramp, smooth } from "../engine/math";
import type { Renderer } from "../engine/renderer";
import { COMMANDED, T } from "../film/timeline";
import {
  drawPermission,
  drawRetry,
  drawRunawayMeter,
  drawWarning,
} from "../primitives/events";
import { coreRadius, drawNode, nodeScale } from "../primitives/node";
import { along, drawPath, drawPulse } from "../primitives/path";
import type { LightName } from "../theme/colors";
import {
  activity,
  beatsSinceOnline,
  commandedPause,
  FEATURE,
  FIELD,
  fieldState,
  route,
} from "./field";

// Draws the seven agent systems at time t, in whatever state they are in:
// waking one by one, tangled and accelerating, frozen, or standing in trees.

const labelPx = (sz: number) => Math.min(20, Math.max(6.5, 10.5 * sz));

export type FieldOptions = {
  // 0..1: how much of the governed trees' fine labelling to show.
  detail?: number;
  // Extra brightness on a system as the visibility scan crosses it.
  scan?: (sys: number) => number;
};

export const drawField = (r: Renderer, t: number, o: FieldOptions = {}) => {
  const { nodes, edges } = FIELD;
  const st = fieldState(t);
  const act = activity(t);
  const beats = beatsSinceOnline(t);
  const detail = o.detail ?? 1;
  // Pulses thicken as the network accelerates.
  const busy = ramp(t, T.complexity, T.freeze);

  // ── paths and pulses ────────────────────────────────────────────────
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i];
    if (t < e.birth) continue;
    const A = st[e.a];
    const B = st[e.b];
    const na = nodes[e.a];
    const nb = nodes[e.b];
    const grow = ramp(t, e.birth, e.birth + e.grow);
    const energy = Math.min(A.energy, B.energy);
    const boost = 1 + (o.scan ? o.scan(nb.sys) : 0);

    if (e.cross) {
      // Calls between systems dissolve as either end is taken into its tree.
      const fade = 1 - smooth(Math.max(A.held, B.held) / 0.9);
      if (fade <= 0) continue;
      const pts = route(A.p, B.p, e.order, 0);
      drawPath(r, pts, "cool", 0.3 * energy * fade, grow);
      if (grow >= 1)
        drawPulse(r, pts, fract(act / e.period + e.phase), "ink", 0.85 * energy * fade);
      continue;
    }

    const m = Math.min(A.m, B.m);
    const pts = route(A.p, B.p, e.order, m);
    drawPath(r, pts, "ink", lerp(0.36, 0.5, m) * energy * boost, grow);
    if (grow < 1) continue;

    // Uncontrolled traffic, on its own accelerating clock.
    if (m < 1) {
      const w = (1 - m) * energy;
      drawPulse(r, pts, fract(act / e.period + e.phase), "ink", 0.9 * w);
      if (busy > 0.35 && hash(i, 3) < busy)
        drawPulse(r, pts, fract(act / (e.period * 0.7) + e.phase + 0.5), "ink", 0.7 * w);
    }

    // Governed traffic: one wave up each tree every two beats.
    if (m > 0) {
      if (nb.id === FEATURE.approval) continue; // drawn by the approval gate
      if (t >= T.limitHit && FEATURE.limitTree.has(nb.id)) continue;
      if (nb.sys === COMMANDED && commandedPause(t) > 0.5) continue;
      const phase = beats / 2 - na.depth * 0.25 - (na.sys % 2) * 0.5;
      const q = fract(phase) * 2;
      if (q < 1) drawPulse(r, pts, q, "ink", 0.95 * m * energy, 0.22);
    }
  }

  // ── nodes ───────────────────────────────────────────────────────────
  for (const n of nodes) {
    if (t < n.birth) continue;
    const S = st[n.id];
    const pr = r.project(S.p);
    if (!pr || !r.onScreen(pr, 160)) continue;
    const sz = nodeScale(pr);
    const age = t - n.birth;
    const wild = 1 - S.m;
    const warned = t >= n.warnAt && S.m < 0.5;
    const boost = 1 + (o.scan ? o.scan(n.sys) : 0);

    let color: LightName = warned ? "error" : "ink";
    let energy = S.energy * boost;
    if (n.id === FEATURE.inspected && t >= T.retryFail && t < T.retryOk) color = "error";
    if (n.id === FEATURE.approval && S.m > 0.5 && t < T.approvalGrant + 0.35)
      energy *= 0.3;

    drawNode(r, pr, {
      kind: n.kind,
      depth: n.depth,
      seed: hash(n.id, 2),
      age,
      clock: S.m > 0.5 ? t : act,
      energy,
      color,
      owned: n.depth === 0 ? S.m : 0,
    });

    // The moment the control plane takes hold: a line rises from the plane
    // to the node and it comes back to life.
    if (S.held >= 0 && S.held < 1.3) {
      const k = S.held / 1.3;
      r.line3([S.p[0], 0, S.p[2]], S.p, "hot", (1 - k) * (1 - k) * 0.9, 1.3);
      r.glow(pr.x, pr.y, (40 + 60 * k) * sz, "hot", (1 - k) * 0.9 * r.fog(pr.z));
      r.ring2(pr.x, pr.y, (6 + 30 * k) * sz, "signal", (1 - k) * 0.9 * r.fog(pr.z), 1.2);
    }

    const vis = S.energy * r.fog(pr.z) * (1 - r.blur(pr.z) * 1.3);

    // Incidents belong to the uncontrolled network and leave with it.
    if (wild > 0.05) {
      if (t >= n.warnAt) drawWarning(r, pr, t - n.warnAt, n.warnText, S.energy * wild);
      if (t >= n.permAt) drawPermission(r, pr, t - n.permAt, S.energy * wild);
      if (n.retry && age > 0.6)
        drawRetry(r, pr, act * 0.9 + n.id, 0.7 * S.energy * wild);
      if (n.meter > 0 && t > T.complexity)
        drawRunawayMeter(r, pr, (act - n.birth) * n.meter, S.energy * wild);
      // The raw event, typed out as it happens.
      if (sz >= 0.34 && vis > 0.03) {
        const fresh = age < 2.2 ? 0.8 : lerp(0.8, 0.3, clamp01((age - 2.2) / 1.5));
        r.text(
          n.event.slice(0, Math.floor(age / 0.022)),
          pr.x + 13 * sz,
          pr.y - 13 * sz,
          labelPx(sz),
          "ink",
          fresh * vis * wild * wild,
        );
      }
    }

    // Governed: a name, where the camera is close enough to want one.
    if (S.m > 0.6 && detail > 0 && vis > 0.03) {
      const leaf = n.children.length === 0;
      const a = S.m * S.m * vis * detail * (leaf ? 0.6 : 0.8);
      // The approval call is named by its gate until it has gone through.
      // Calls that are being annotated are named by their annotation.
      const gated =
        (n.id === FEATURE.approval && t < T.approvalGrant + 1.9) ||
        (n.id === FEATURE.inspected && t > T.select - 0.3 && t < T.seeOut + 0.4);
      // Agents on the leaf row have calls either side; only the first two
      // levels are named.
      if (!leaf && n.depth <= 1 && sz >= 0.55)
        r.text(n.label, pr.x + (coreRadius(n.kind, n.depth) + 12) * sz, pr.y, labelPx(sz), "ink", a);
      else if (leaf && !gated && sz >= 0.9)
        r.text(
          n.label,
          pr.x,
          pr.y - (15 + (Math.round(n.u / 62) % 2 === 0 ? 0 : 11)) * sz,
          labelPx(sz) * 0.9,
          "ink",
          a,
          { align: "center" },
        );
    }
  }
};

// The live position of a point partway along a tree edge, for overlays that
// ride on it (the approval gate).
export const edgePoint = (t: number, child: number, f: number) => {
  const st = fieldState(t);
  const n = FIELD.nodes[child];
  const e = FIELD.edges.find((x) => x.b === child && !x.cross)!;
  const m = Math.min(st[n.parent].m, st[child].m);
  const pts = route(st[n.parent].p, st[child].p, e.order, m);
  return { pts, p: along(pts, f) };
};
