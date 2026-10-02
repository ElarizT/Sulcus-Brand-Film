import { easeOut, fract, hash, ramp, rng, TAU, type Vec3 } from "../engine/math";
import type { Renderer } from "../engine/renderer";
import { BEAT, T } from "../film/timeline";
import { planeRadius } from "../primitives/plane";
import {
  CORE_R,
  frameAt,
  LEAF_SPACING,
  LEVEL_V,
  place,
  RING_COUNT,
  ringRadius,
  type TreeFrame,
} from "./layout";

// Scale. The seven systems turn out to stand on the first ring of something
// much larger: hundreds of agent trees on concentric rings, every one bounded
// and every one wired into the same core.

type TNode = { u: number; v: number; parent: number; depth: number };
type Template = { nodes: TNode[]; hw: number; top: number };

const template = (seed: number): Template => {
  const R = rng(seed);
  const nodes: TNode[] = [{ u: 0, v: LEVEL_V[0], parent: -1, depth: 0 }];
  const kids: number[][] = [[]];
  const add = (parent: number, depth: number) => {
    nodes.push({ u: 0, v: LEVEL_V[depth], parent, depth });
    kids.push([]);
    kids[parent].push(nodes.length - 1);
    return nodes.length - 1;
  };
  const subs = 2 + (R() < 0.55 ? 1 : 0);
  for (let j = 0; j < subs; j++) {
    const s = add(0, 1);
    const n = 2 + (R() < 0.4 ? 1 : 0);
    for (let k = 0; k < n; k++) {
      const c = add(s, 2);
      if (R() < 0.22) add(c, 3);
    }
  }
  let next = 0;
  const walk = (id: number): number => {
    if (kids[id].length === 0) return (nodes[id].u = next++ * LEAF_SPACING);
    const us = kids[id].map(walk);
    return (nodes[id].u = (us[0] + us[us.length - 1]) / 2);
  };
  walk(0);
  const mid = ((next - 1) * LEAF_SPACING) / 2;
  nodes.forEach((n) => (n.u -= mid));
  return {
    nodes,
    hw: mid,
    top: Math.max(...nodes.map((n) => n.v)),
  };
};

const TEMPLATES = Array.from({ length: 12 }, (_, i) => template(300 + i * 13));

type LTree = {
  frame: TreeFrame;
  radius: number;
  tpl: Template;
  reveal: number;
  id: number;
};

const TREES: LTree[] = (() => {
  const out: LTree[] = [];
  let id = 0;
  for (let k = 0; k < RING_COUNT; k++) {
    const radius = ringRadius(k);
    const count = k === 0 ? 18 : Math.round((TAU * radius) / 720);
    for (let j = 0; j < count; j++) {
      // The named ecosystems already stand on seven places of the first ring.
      if (k === 0 && (j <= 3 || j >= 15)) continue;
      const angle = (j + (k % 2 ? 0.5 : 0)) * (TAU / count);
      out.push({
        frame: frameAt(angle, radius),
        radius,
        tpl: TEMPLATES[Math.floor(hash(id, 1) * TEMPLATES.length)],
        reveal:
          T.scale + 0.25 + (radius - ringRadius(0)) / 2700 + hash(id, 2) * 0.3,
        id,
      });
      id++;
    }
  }
  return out;
})();

export const LATTICE_COUNT = TREES.length;

const polar = (a: number, radius: number): Vec3 => [
  radius * Math.sin(a),
  0,
  radius * Math.cos(a),
];

export const drawLattice = (r: Renderer, t: number) => {
  if (t < T.scale) return;
  const beats = (t - T.online) / BEAT;
  const R = planeRadius(t);
  const climax = ramp(t, T.climax - 0.3, T.climax + 0.4);

  // A brightness front leaves the core every two beats and crosses the rings.
  const wave = (radius: number) =>
    1 + (0.7 + 0.9 * climax) * Math.exp(-fract(beats / 2 - radius / 5200) * 4.5);

  // Trunk lines: eighteen spokes from the core to the edge.
  for (let j = 0; j < 18; j++) {
    const a = (j * TAU) / 18;
    for (let r0 = CORE_R; r0 < R; r0 += 600) {
      const r1 = Math.min(R, r0 + 600);
      r.line3(polar(a, r0), polar(a, r1), "signal", 0.3 * wave(r0), 1.3);
    }
    // Events flowing inward.
    for (let i = 0; i < 5; i++) {
      const k = fract(beats / 8 + hash(j, i) + i / 5);
      const radius = R - (R - CORE_R) * k;
      if (radius > R) continue;
      const pr = r.project(polar(a, radius));
      if (!pr) continue;
      const al = Math.sin(Math.PI * k) * r.fog(pr.z);
      r.glow(pr.x, pr.y, 46 * pr.s + 5, "hot", 0.9 * al);
      r.dot(pr.x, pr.y, Math.max(0.9, 3 * pr.s), "signal", al);
    }
  }
  // A collector ring just inside each ring of trees.
  for (let k = 0; k < RING_COUNT; k++) {
    const radius = ringRadius(k) - 250;
    if (radius > R) break;
    r.circle3(
      [0, 0, 0],
      radius,
      "signal",
      0.22 * wave(radius) * ramp(R - radius, 0, 400),
      1.2,
      0,
      TAU,
      Math.round(radius / 24),
    );
  }

  for (const tree of TREES) {
    const age = t - tree.reveal;
    if (age <= 0) continue;
    const base = r.project(tree.frame.base);
    if (!base || !r.onScreen(base, 260)) continue;
    const g = easeOut(age / 0.9);
    const w = wave(tree.radius);
    const f = tree.frame;
    const { nodes, hw, top } = tree.tpl;
    const far = base.s < 0.075;

    // Stub into the collector ring.
    r.line3(place(f, 0, 0, 0), place(f, 0, 0, 250), "signal", 0.34 * g * w);
    r.line3(place(f, 0, 0), place(f, 0, nodes[0].v * g), "signal", 0.34 * g);
    if (age < 0.8) r.glow(base.x, base.y, 90 * base.s + 8, "hot", (1 - age / 0.8) * 0.9);

    // Boundary.
    const u0 = -hw - 46;
    const u1 = hw + 46;
    const v1 = (top + 54) * g;
    const c = [place(f, u0, 40 * g), place(f, u1, 40 * g), place(f, u1, v1), place(f, u0, v1)];
    for (let i = 0; i < 4; i++)
      r.line3(c[i], c[(i + 1) % 4], "signal", 0.3 * g * (0.7 + 0.3 * w));

    // Tree.
    const phase = beats / 2 - tree.radius / 5200;
    for (let i = 1; i < nodes.length; i++) {
      const n = nodes[i];
      if (far && n.depth > 2) continue;
      const p = nodes[n.parent];
      const a = place(f, p.u, p.v * g);
      const b = place(f, n.u, n.v * g);
      const vm = ((p.v + n.v) / 2) * g;
      const e1 = place(f, p.u, vm);
      const e2 = place(f, n.u, vm);
      const alpha = 0.42 * g * (0.75 + 0.25 * w);
      r.line3(a, e1, "ink", alpha);
      r.line3(e1, e2, "ink", alpha);
      r.line3(e2, b, "ink", alpha);
      const pr = r.project(b);
      if (!pr) continue;
      const lit = Math.exp(-fract(phase - n.depth * 0.22) * 5);
      const fog = r.fog(pr.z);
      r.dot(pr.x, pr.y, Math.max(0.8, 3.1 * pr.s), "ink", (0.6 + 0.4 * lit) * g * fog);
      if (lit > 0.12) r.glow(pr.x, pr.y, 26 * pr.s + 3, "ink", 0.8 * lit * g * fog);
    }
    const root = r.project(place(f, 0, nodes[0].v * g));
    if (root) {
      r.dot(root.x, root.y, Math.max(1, 4.2 * root.s), "ink", g * r.fog(root.z));
      r.ring2(root.x, root.y, Math.max(1.8, 9 * root.s), "signal", 0.9 * g * r.fog(root.z), 1);
    }
  }
};
