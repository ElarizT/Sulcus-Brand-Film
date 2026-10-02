import { clamp01, hash, hit, lerp, ramp, fract, type Vec3 } from "../engine/math";
import type { Renderer } from "../engine/renderer";
import { BEAT, COMMANDED, connectAt, ECOSYSTEMS, T } from "../film/timeline";
import { drawApprovalGate } from "../primitives/approval";
import { drawBoundary } from "../primitives/boundary";
import { drawCallout } from "../primitives/callout";
import { drawRetry } from "../primitives/events";
import { drawLimitMeter } from "../primitives/meter";
import { nodeScale } from "../primitives/node";
import { drawPanel, type PanelRow } from "../primitives/panel";
import { drawPulse } from "../primitives/path";
import {
  drawCommand,
  drawSourceLabel,
  drawStream,
  drawTap,
} from "../primitives/stream";
import { drawTimelineRail } from "../primitives/timelineRail";
import { edgePoint } from "./drawField";
import {
  beatsSinceOnline,
  commandedPause,
  FEATURE,
  FIELD,
  fieldState,
  focusSee,
  focusStep,
  FRAMES,
  route,
  SYSTEMS,
} from "./field";
import { ARC_R, LEVEL_V, place, type TreeFrame } from "./layout";

// Everything Sulcus adds to the field once it owns it, and the three things
// it lets you do there: see what an agent is doing, step in before a
// sensitive action, and set boundaries that hold. All of it is orange;
// nothing an agent does on its own ever is.

// Where the supervision scan is on a given system, 0..1+.
export const scanAt = (t: number, sys: number) => {
  const d = (t - (T.onePlace + sys * 0.2)) / 0.3;
  return 1.3 * Math.exp(-d * d);
};

// When the boundaries arm, spreading from the trees in shot.
const armAt = (sys: number) => T.bounds + Math.abs(sys - 3.5) * 0.11;

export type GovernanceOptions = {
  // 0..1: fine detail (meters, rails) — off in the widest shots.
  detail?: number;
};

export const drawGovernance = (
  r: Renderer,
  t: number,
  o: GovernanceOptions = {},
) => {
  if (t < T.online) return;
  const st = fieldState(t);
  const beats = beatsSinceOnline(t);
  const detail = o.detail ?? 1;
  const { nodes } = FIELD;
  const see = focusSee(t);
  const step = focusStep(t);
  const paused = commandedPause(t);

  SYSTEMS.forEach((S, i) => {
    const f = S.frame;
    const m = st[S.root].m;
    const scan = t >= T.onePlace - 1 ? scanAt(t, i) : 0;
    // Systems step back while another one is being read.
    const back =
      (1 - 0.62 * see * (i === 1 ? 0 : 1)) *
      (1 - 0.62 * step * (i === 2 ? 0 : 1));
    const inner = back * (1 - 0.6 * see) * (1 - 0.6 * step);

    drawTap(r, f, LEVEL_V[0], m * m * m * back);

    // Boundary: closes around the tree once it has formed, and arms —
    // brighter, heavier — when the limits are switched on.
    const tb = T.boundaries + i * 0.12;
    const armed = ramp(t, armAt(i), armAt(i) + 0.4);
    const landed = i === COMMANDED ? hit(t, T.command + 0.5, 0.03, 0.6) + hit(t, T.resume + 0.5, 0.03, 0.6) : 0;
    drawBoundary(
      r,
      f,
      { u0: -S.hw - 58, u1: S.hw + 58, v0: 34, v1: S.top + 62, w: 48 },
      "signal",
      (0.4 +
        0.5 * hit(t, tb + 0.7, 0.03, 0.5) +
        0.28 * armed +
        0.5 * hit(t, armAt(i) + 0.35, 0.05, 0.7) +
        0.4 * scan +
        0.6 * landed) *
        back,
      ramp(t, tb, tb + 0.7),
      1 + 0.5 * armed,
    );

    // A line of light reads up through the system: once when the boundaries
    // arm, and again when all seven are supervised from the core.
    const sweeps: [number, number][] = [
      [armAt(i), 1 - Math.abs(ramp(t, armAt(i), armAt(i) + 0.55) * 2 - 1)],
      [T.onePlace + i * 0.2 - 0.25, scan],
    ];
    for (const [start, strength] of sweeps) {
      if (strength <= 0.05 || t < start) continue;
      const v = lerp(34, S.top + 62, clamp01((t - start) / 0.55));
      r.line3(
        place(f, -S.hw - 58, v, 48),
        place(f, S.hw + 58, v, 48),
        "hot",
        0.9 * Math.min(1, strength),
        1.8,
      );
    }

    if (detail > 0.02) {
      drawTimelineRail(
        r,
        f,
        S.hw + 34,
        500 + i,
        t - (T.timelines + i * 0.1),
        (t - T.timelines) / BEAT,
        0.9 * detail * back * (1 - 0.5 * step),
      );

      // Every agent's usage is on a gauge with its limit marked.
      const shown = ramp(t, T.timelines + 0.5 + i * 0.1, T.timelines + 1.1 + i * 0.1);
      for (const id of nodes[S.root].children) {
        const n = nodes[id];
        if (n.children.length === 0) continue;
        const limited = id === FEATURE.limit;
        const level = limited
          ? lerp(0.5, 1, ramp(t, T.bounds - 1.5, T.limitHit))
          : Math.min(0.8, 0.22 + hash(id, 40) * 0.36 + 0.006 * (t - T.timelines));
        drawLimitMeter(
          r,
          f,
          n.u - 27,
          n.v + 4,
          level,
          shown * detail * st[id].m * inner * (1 + 0.5 * hit(t, armAt(i) + 0.35, 0.05, 0.7)),
          limited && t >= T.limitHit,
          78,
        );
      }
    }
  });

  drawInspection(r, t);
  drawApproval(r, t, beats);
  drawLimit(r, t);
  drawBlocked(r, t);

  // Streams into the core, one ecosystem per beat; then all of them,
  // supervised from one place.
  if (t >= T.unify) {
    // The names leave as the camera lifts off for the scale reveal.
    const names = 1 - ramp(t, T.scale - 0.7, T.scale + 0.7);
    SYSTEMS.forEach((S, i) => {
      const at = connectAt(i);
      drawStream(r, S.frame, ARC_R, (t - at) / 0.6, beats, 1, hash(i, 70));
      const arrive = hit(t, at + 0.6, 0.02, 0.5);
      if (arrive > 0.02) {
        const c = r.project([0, 0, 0]);
        if (c) r.glow(c.x, c.y, 300 * c.s + 30, "hot", 0.8 * arrive);
      }
      // What Sulcus knows about each system, read out by the scan.
      const seen = ramp(t, T.onePlace + i * 0.2, T.onePlace + i * 0.2 + 0.3);
      const held =
        i === COMMANDED && paused > 0.5
          ? "paused from sulcus"
          : i === 3
            ? "1 paused · token budget"
            : i === 4
              ? "1 call blocked"
              : "";
      const status = held || `${S.agents} agents · running`;
      drawSourceLabel(
        r,
        S.frame,
        S.top,
        ECOSYSTEMS[i].name,
        ECOSYSTEMS[i].where,
        ramp(t, at - 0.05, at + 0.35) * names,
        seen > 0 ? status.slice(0, Math.floor(seen * 40)) : "",
        held ? "signal" : "dim",
      );
    });

    // Control runs the other way: a signal leaves the core, and a system
    // that was running is paused; a second one resumes it.
    const C = SYSTEMS[COMMANDED];
    drawCommand(r, C.frame, ARC_R, (t - T.command) / 0.5);
    drawCommand(r, C.frame, ARC_R, (t - T.resume) / 0.5);
    const core = r.project([0, 0, 0]);
    if (core) {
      const slug = ECOSYSTEMS[COMMANDED].name.toLowerCase().replace(/ /g, "-");
      for (const [at, verb, until] of [
        [T.command, "pause", T.resume - 0.45],
        [T.resume, "resume", T.resume + 1.3],
      ] as const) {
        const d = t - (at - 0.4);
        if (d < 0 || t > until + 0.3) continue;
        const line = `> ${verb} ${slug}`;
        r.glow(core.x, core.y, 420 * core.s + 30, "hot", 0.7 * hit(t, at, 0.03, 0.4));
        r.text(
          line.slice(0, Math.floor(d / 0.022)),
          core.x + 330 * core.s + 18,
          core.y - 6,
          Math.max(13, 46 * core.s),
          "signal",
          (1 - ramp(t, until, until + 0.3)) * names,
          { weight: 500, tracking: 0.04 },
        );
      }
    }
  }
};

// A node's position in its tree's own coordinates.
const local = (f: TreeFrame, p: Vec3) => ({
  u: (p[0] - f.base[0]) * f.t[0] + (p[2] - f.base[2]) * f.t[2],
  v: p[1],
});

// Lights a root-to-leaf branch in the control colour, drawing on from the
// root. `upto` stops the last edge short (at an approval gate).
const drawBranch = (
  r: Renderer,
  t: number,
  ids: number[],
  progress: number,
  alpha: number,
  upto = 1,
) => {
  if (alpha <= 0.02 || progress <= 0) return;
  const st = fieldState(t);
  const n = ids.length - 1;
  for (let k = 0; k < n; k++) {
    const e = FIELD.edges.find((x) => x.b === ids[k + 1] && !x.cross)!;
    const A = st[ids[k]];
    const B = st[ids[k + 1]];
    const pts = route(A.p, B.p, e.order, Math.min(A.m, B.m));
    let p = clamp01(progress * n - k);
    if (k === n - 1) p = Math.min(p, upto);
    if (p <= 0) break;
    r.poly3(pts, "hot", 0.6 * alpha, 3.6, 0, p);
    r.poly3(pts, "signal", 0.95 * alpha, 1.5, 0, p);
  }
  // Selection brackets on each node the highlight has reached.
  ids.forEach((id, k) => {
    if (progress * n < k - 0.02) return;
    if (k === n && upto < 1) return;
    const pr = r.project(st[id].p);
    if (!pr) return;
    const d = (k === n ? 19 : 15) * nodeScale(pr);
    const a = alpha * r.fog(pr.z) * (k === n ? 1 : 0.75);
    for (const sx of [-1, 1])
      for (const sy of [-1, 1]) {
        r.line2(pr.x + sx * d, pr.y + sy * d, pr.x + sx * d * 0.45, pr.y + sy * d, "signal", a, 1.5);
        r.line2(pr.x + sx * d, pr.y + sy * d, pr.x + sx * d, pr.y + sy * d * 0.45, "signal", a, 1.5);
      }
  });
};

// ── SEE WHAT THEY'RE DOING ────────────────────────────────────────────────
// One branch is picked out of a running system and everything known about it
// stands beside it: which agent, under which parent, calling what, and how
// that call is going — including the two times it failed.
const drawInspection = (r: Renderer, t: number) => {
  const see = focusSee(t);
  if (see <= 0) return;
  const st = fieldState(t);
  const ids = FEATURE.inspectedBranch;
  const leaf = FIELD.nodes[FEATURE.inspected];
  const agent = FIELD.nodes[leaf.parent];
  const S = SYSTEMS[leaf.sys];
  const f = S.frame;

  drawBranch(r, t, ids, ramp(t, T.select, T.select + 0.5), see);

  const failing = t >= T.retryFail && t < T.retryOk;
  const pr = r.project(st[leaf.id].p);
  if (pr) {
    const sz = nodeScale(pr);
    if (failing) drawRetry(r, pr, (t - T.retryFail) * 1.4, see, "error");
    const bad = hit(t, T.retryFail, 0.02, 0.45) + hit(t, T.retryAgain, 0.02, 0.45);
    r.glow(pr.x, pr.y, 70 * sz, "error", 0.8 * bad * see);
    r.glow(pr.x, pr.y, 90 * sz, "ink", 0.8 * hit(t, T.retryOk, 0.02, 0.5) * see);
  }

  const status: PanelRow =
    t < T.retryFail
      ? { label: "STATUS", value: `running · ${(t - T.select + 0.6).toFixed(1)} s`, shown: 1 }
      : t < T.retryAgain
        ? { label: "STATUS", value: "503 · retry 1/3", color: "error", shown: 1 }
        : t < T.retryOk
          ? { label: "STATUS", value: "503 · retry 2/3", color: "error", shown: 1 }
          : { label: "STATUS", value: "200 OK · 3rd attempt", shown: 1 };
  const typed = (i: number) =>
    ramp(t, T.inspect + 0.2 + i * 0.28, T.inspect + 0.5 + i * 0.28);
  status.shown = t < T.retryFail ? typed(3) : 1;
  const rows: PanelRow[] = [
    { label: "AGENT", value: agent.label, shown: typed(0) },
    { label: "PARENT", value: FIELD.nodes[agent.parent].label, shown: typed(1) },
    { label: "TOOL CALL", value: `${leaf.label}  /v2/orders`, shown: typed(2) },
    status,
    { label: "EVENTS", value: "", shown: typed(4) },
  ];
  const WIDTH = 700;
  const box = { u: -S.hw - 58 - 56 - WIDTH, v: 800, w: 70, width: WIDTH };
  const slots = drawPanel(
    r,
    f,
    box,
    `${ECOSYSTEMS[leaf.sys].name} · RUN 7F3A`,
    rows,
    ramp(t, T.inspect, T.inspect + 0.4),
    see,
  );
  if (!slots) return;

  // A leader from the inspected call to its panel.
  const from = local(f, st[leaf.id].p);
  r.line3(
    place(f, box.u + WIDTH, from.v, 70),
    place(f, from.u - 26, from.v, 0),
    "signal",
    0.7 * see * ramp(t, T.inspect, T.inspect + 0.3),
  );

  // Live state, top right of the panel.
  const a0 = slots[0];
  if (rows[0].shown > 0.5) {
    const beat = 0.6 + 0.4 * Math.cos(((t - T.online) / BEAT) * Math.PI * 2);
    r.dot(a0.right - 6 * a0.s, a0.y, 5 * a0.s, failing ? "error" : "ink", see * beat);
    r.text(failing ? "RETRYING" : "RUNNING", a0.right - 22 * a0.s, a0.y, 14.5 * a0.s, failing ? "error" : "ink", 0.9 * see, {
      align: "right",
      tracking: 0.14,
    });
  }

  // The call's events on a line: model turn, tool call, two failures, success.
  const ev = slots[4];
  if (rows[4].shown > 0) {
    const w = ev.right - ev.x;
    r.line2(ev.x, ev.y, ev.right, ev.y, "dim", 0.4 * see);
    const marks: [number, number, number, "ink" | "error"][] = [
      [T.select, 0.02, 0.14, "ink"],
      [T.inspect + 0.4, 0.2, 0.2, "ink"],
      [T.retryFail, 0.46, 0.1, "error"],
      [T.retryAgain, 0.6, 0.1, "error"],
      [T.retryOk, 0.74, 0.2, "ink"],
    ];
    for (const [at, x, len, color] of marks) {
      const grow = ramp(t, at, at + 0.25) * rows[4].shown;
      if (grow <= 0) continue;
      r.line2(ev.x + w * x, ev.y, ev.x + w * (x + len * grow), ev.y, color, 0.95 * see, 6 * ev.s);
    }
    const head = ev.x + w * lerp(0.02, 0.96, ramp(t, T.select, T.seeOut));
    r.line2(head, ev.y - 13 * ev.s, head, ev.y + 13 * ev.s, "signal", 0.9 * see, 1.4);
  }
};

// ── STEP IN WHEN IT MATTERS ───────────────────────────────────────────────
// A deploy to production is stopped at a gate. Nothing crosses the line until
// someone chooses Approve; then the call goes through.
const drawApproval = (r: Renderer, t: number, beats: number) => {
  const st = fieldState(t);
  const S = st[FEATURE.approval];
  if (S.m < 0.9) return;
  const GATE = 0.62;
  const ask = T.approvalAsk;
  const grant = T.approvalGrant;
  const depart = ask - 0.6;
  const { pts, p } = edgePoint(t, FEATURE.approval, GATE);
  const leaf = FIELD.nodes[FEATURE.approval];
  const agent = FIELD.nodes[leaf.parent];
  const sys = SYSTEMS[leaf.sys];
  const f = sys.frame;
  const granted = t >= grant;

  // The call itself: it sets off, is held, and after approval completes.
  if (t >= depart && t < ask)
    drawPulse(r, pts, GATE * ramp(t, depart, ask), "ink", S.energy, 0.2);
  if (granted && t < grant + 0.35)
    drawPulse(r, pts, lerp(GATE, 1, ramp(t, grant, grant + 0.35)), "ink", S.energy, 0.2);
  if (t >= grant + 0.35) {
    const q = fract(beats / 2 - agent.depth * 0.25 - (agent.sys % 2) * 0.5) * 2;
    if (q < 1) drawPulse(r, pts, q, "ink", 0.95 * S.energy, 0.22);
    const node = r.project(S.p);
    if (node)
      r.glow(node.x, node.y, 110 * nodeScale(node), "ink", 0.9 * hit(t, grant + 0.35, 0.02, 0.6));
  }
  if (t < ask - 0.3) return;

  const step = focusStep(t);
  drawBranch(
    r,
    t,
    FEATURE.approvalBranch,
    ramp(t, ask - 0.1, ask + 0.35),
    step,
    granted ? lerp(GATE, 1, ramp(t, grant, grant + 0.35)) : GATE,
  );

  const pr = r.project(p);
  if (!pr || t < ask) return;
  const g = local(f, p);

  // The approval boundary: a line across the whole system that the call
  // cannot pass.
  const line = ramp(t, ask, ask + 0.3) * (1 - ramp(t, grant, grant + 0.3));
  if (line > 0) {
    const pulse = 0.65 + 0.35 * Math.cos(beats * Math.PI * 2);
    for (const dir of [-1, 1]) {
      const edge = dir < 0 ? -sys.hw - 58 : sys.hw + 58;
      const reach = g.u + (edge - g.u) * line;
      for (let u = g.u + dir * 34; dir * u < dir * reach; u += dir * 44)
        r.line3(
          place(f, u, g.v, 48),
          place(f, dir < 0 ? Math.max(reach, u - 26) : Math.min(reach, u + 26), g.v, 48),
          "signal",
          pulse,
          2.2,
        );
    }
  }
  drawApprovalGate(r, pr, t - ask, t - grant, beats, 1, 1.7);

  // The request, and the two things that can be done with it.
  const fade = 1 - ramp(t, grant + 1.0, grant + 1.5);
  const rows: PanelRow[] = [
    { label: "TOOL CALL", value: "deploy --prod", shown: ramp(t, ask + 0.25, ask + 0.55) },
    { label: "AGENT", value: agent.label, shown: ramp(t, ask + 0.5, ask + 0.75) },
    granted
      ? { label: "STATUS", value: "approved", shown: 1 }
      : { label: "STATUS", value: "awaiting approval", color: "signal", shown: ramp(t, ask + 0.75, ask + 1.05) },
    { label: "", value: "", shown: 1 },
  ];
  const slots = drawPanel(
    r,
    f,
    { u: g.u + 96, v: g.v + 205, w: 70, width: 620 },
    granted ? "APPROVED" : "APPROVAL REQUIRED",
    rows,
    ramp(t, ask + 0.08, ask + 0.45),
    fade,
  );
  if (!slots) return;

  const row = slots[3];
  const s = row.s;
  const left = row.left;
  const shown = ramp(t, ask + 1.0, ask + 1.3) * (1 - ramp(t, grant + 0.25, grant + 0.6)) * fade;
  if (shown <= 0) return;
  // Approve is chosen a moment before the bar line, and pressed on it.
  const chosen = ramp(t, grant - 0.8, grant - 0.55);
  const press = hit(t, grant, 0.02, 0.3);
  const button = (x: number, w: number, label: string, on: number) => {
    const h = 38 * s;
    const y = row.y - h / 2;
    const a = shown * (0.42 + 0.58 * on);
    const color = on > 0.5 ? "signal" : "dim";
    r.line2(x, y, x + w, y, color, a, 1 + on * 0.6);
    r.line2(x, y + h, x + w, y + h, color, a, 1 + on * 0.6);
    r.line2(x, y, x, y + h, color, a, 1 + on * 0.6);
    r.line2(x + w, y, x + w, y + h, color, a, 1 + on * 0.6);
    if (on > 0) r.rect2(x, y, w, h, "signal", shown * (0.14 * on + 0.8 * press * on));
    r.text(label, x + w / 2, row.y, 15 * s, on > 0.5 ? "ink" : "dim", shown * (0.7 + 0.3 * on), {
      align: "center",
      tracking: 0.16,
      weight: 500,
    });
  };
  button(left, 200 * s, "APPROVE", chosen);
  button(left + 222 * s, 150 * s, "BLOCK", 0);
};

// ── SET THE BOUNDARIES ────────────────────────────────────────────────────
// An agent reaches its token budget and is paused there, with its subtree.
const drawLimit = (r: Renderer, t: number) => {
  if (t < T.bounds - 0.3) return;
  const n = FIELD.nodes[FEATURE.limit];
  const S = fieldState(t)[FEATURE.limit];
  if (S.m < 0.9) return;
  const f = FRAMES[n.sys];
  const held = t >= T.limitHit;
  const ids = [...FEATURE.limitTree].map((id) => FIELD.nodes[id]);
  const u0 = Math.min(...ids.map((x) => x.u)) - 44;
  // The paused subtree gets its own boundary.
  if (held)
    drawBoundary(
      r,
      f,
      {
        u0,
        u1: Math.max(...ids.map((x) => x.u)) + 30,
        v0: n.v - 58,
        v1: Math.max(...ids.map((x) => x.v)) + 40,
        w: 0,
      },
      "signal",
      0.8,
      ramp(t, T.limitHit, T.limitHit + 0.45),
      1.3,
    );
  const node = r.project(S.p);
  if (node && held)
    r.glow(node.x, node.y, 110 * nodeScale(node), "hot", hit(t, T.limitHit, 0.02, 0.6));
  // The annotation sits above the system, clear of its neighbours.
  const sys = SYSTEMS[n.sys];
  const pr = r.project(place(f, -sys.hw - 50, sys.top + 62 + 64, 48));
  if (!pr) return;
  const sz = nodeScale(pr);
  const level = lerp(0.5, 1, ramp(t, T.bounds - 1.5, T.limitHit));
  drawCallout(
    r,
    pr.x,
    pr.y,
    sz,
    held ? "TOKEN BUDGET · PAUSED" : `TOKENS ${Math.round(level * 100)}%`,
    held ? "200k / 200k" : `${Math.round(level * 200)}k / 200k`,
    held ? "signal" : "ink",
    "left",
    r.fog(pr.z) * ramp(t, T.bounds, T.bounds + 0.3) * near(sz),
    1.45,
  );
};

// A call tries to reach something outside its system's boundary. It gets as
// far as the wall.
const drawBlocked = (r: Renderer, t: number) => {
  const start = T.blocked - 0.75;
  if (t < start) return;
  const n = FIELD.nodes[FEATURE.blocker];
  const st = fieldState(t)[n.id];
  if (st.m < 0.9) return;
  const S = SYSTEMS[n.sys];
  const f = S.frame;
  const wall = S.hw + 58;
  const lane = n.v - 46;
  const A = place(f, n.u, n.v);
  const B = place(f, n.u, lane);
  const W = place(f, wall, lane);
  const X = place(f, wall + 84, lane);

  // The attempt: out from the agent, straight at the wall; then withdrawn.
  const reach = ramp(t, start, T.blocked);
  const back = ramp(t, T.blocked + 1.0, T.blocked + 1.6);
  const tip = reach * (1 - back);
  r.poly3([A, B, W], "ink", 0.85 * st.energy, 1.4, 0, tip);
  if (reach < 1) {
    const total = Math.abs(lane - n.v) + (wall - n.u);
    const d = tip * total;
    const head = r.project(
      d < Math.abs(lane - n.v)
        ? place(f, n.u, n.v - d)
        : place(f, n.u + d - Math.abs(lane - n.v), lane),
    );
    if (head) {
      r.glow(head.x, head.y, 30 * head.s + 6, "ink", 0.9);
      r.dot(head.x, head.y, Math.max(1.4, 4 * head.s), "ink", 1);
    }
  }

  // Where it was going: outside.
  const ghost =
    ramp(t, start, start + 0.3) * (1 - ramp(t, T.blocked + 0.4, T.blocked + 1.0));
  if (ghost > 0) {
    for (let u = wall + 12; u < wall + 70; u += 26)
      r.line3(place(f, u, lane), place(f, u + 16, lane), "dim", 0.7 * ghost);
    const x = r.project(X);
    if (x) {
      const d = 9 * nodeScale(x);
      r.line2(x.x, x.y - d, x.x + d, x.y, "dim", 0.9 * ghost);
      r.line2(x.x + d, x.y, x.x, x.y + d, "dim", 0.9 * ghost);
      r.line2(x.x, x.y + d, x.x - d, x.y, "dim", 0.9 * ghost);
      r.line2(x.x - d, x.y, x.x, x.y - d, "dim", 0.9 * ghost);
      r.text("~/.ssh", x.x, x.y + d + 13 * nodeScale(x), 11.5 * nodeScale(x), "dim", 0.95 * ghost, {
        align: "center",
      });
    }
  }

  const d = t - T.blocked;
  if (d < 0) return;
  // The wall answers: the stretch of boundary it hit lights and holds.
  const flash = hit(t, T.blocked, 0.02, 0.55);
  const hold = 1 - ramp(t, T.boundsOut + 0.4, T.boundsOut + 1.2);
  const span = 120;
  const face = [
    place(f, wall, lane - span, 48),
    place(f, wall, lane + span, 48),
    place(f, wall, lane + span, -48),
    place(f, wall, lane - span, -48),
  ];
  for (let i = 0; i < 4; i++)
    r.line3(face[i], face[(i + 1) % 4], "hot", (0.55 + 0.45 * flash) * hold, 2.2);
  for (let k = -3; k <= 3; k++)
    r.line3(
      place(f, wall, lane + k * 34 - 16, 48),
      place(f, wall, lane + k * 34 + 16, -48),
      "signal",
      (0.3 + 0.5 * flash) * hold,
    );
  // The stop itself.
  r.line3(place(f, wall, lane - 30, 0), place(f, wall, lane + 30, 0), "ink", (1 - back) * hold, 3);
  const w = r.project(W);
  if (w) r.glow(w.x, w.y, 240 * w.s + 20, "hot", flash);

  const pr = r.project(place(f, wall + 34, lane + 86, 48));
  if (!pr) return;
  const sz = nodeScale(pr);
  drawCallout(
    r,
    pr.x,
    pr.y,
    sz,
    "BLOCKED",
    "write outside workspace",
    "signal",
    "left",
    r.fog(pr.z) * ramp(d, 0.1, 0.35) * near(sz),
    1.45,
  );
};

// Annotations are for the close passes; from further back they are noise.
const near = (sz: number) => ramp(sz, 0.62, 0.84);
