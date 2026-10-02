import { clamp01, easeInOut, hash, ramp, rng, v3, type Vec3 } from "../engine/math";
import { BEAT, CONNECT_ORDER, connectAt, ECOSYSTEMS, FOLLOWED, T } from "../film/timeline";
import type { NodeKind } from "../primitives/node";
import { ARC_R, frameAt, LEAF_SPACING, LEVEL_V, place, treeAngle, type TreeFrame } from "./layout";

// The field: seven agent systems, ~90 agents and tool calls, built once and
// deterministically. Every node has two homes — where it sits in the
// uncontrolled network, and its place in its system's tree — and the film is
// largely the journey from one to the other.
//
// One system is followed into Sulcus: the first agent to wake (FOLLOWED) is
// the research-agent run, whose Coordinator, Researcher and Verifier become
// rows of the real Run Detail. The other six stay frozen in the dark until
// they connect to Sulcus near the end, one per beat.

export type FNode = {
  id: number;
  sys: number;
  parent: number;
  depth: number;
  kind: NodeKind;
  // Clean name shown once the system is legible.
  label: string;
  // Raw runtime event shown as the node appears.
  event: string;
  birth: number;
  chaos: Vec3;
  tree: Vec3;
  u: number;
  v: number;
  children: number[];
  // Uncontrolled-network incidents.
  warnAt: number;
  warnText: string;
  permAt: number;
  retry: boolean;
  meter: number;
  // When Sulcus takes hold of this node.
  acquire: number;
};

export type FEdge = {
  a: number;
  b: number;
  birth: number;
  grow: number;
  // Axis order of the uncontrolled route.
  order: number;
  cross: boolean;
  period: number;
  phase: number;
};

const TOOLS = [
  "fs.read",
  "fs.write",
  "shell.exec",
  "http.get",
  "web.search",
  "git.diff",
  "sql.query",
  "browser.click",
  "vector.search",
  "code.run",
  "mcp.call",
  "fs.patch",
  "http.post",
  "test.run",
];
const AGENTS = [
  "planner",
  "researcher",
  "coder",
  "reviewer",
  "executor",
  "retriever",
  "critic",
  "router",
  "writer",
  "tester",
];
// The research-agent run's own tools, as its events name them.
const FOLLOWED_TOOLS = ["search_web", "read_file", "search_web", "write_file", "read_file", "execute_command"];
const FOLLOWED_AGENTS = ["Researcher", "Verifier"];
const WARNINGS = [
  "WARN 429 rate_limit",
  "WARN timeout 30s",
  "ERR ECONNRESET",
  "WARN context 97%",
  "ERR tool schema",
  "WARN retry storm",
  "WARN no owner",
  "ERR exit 1",
];
// The first event each system emits as it wakes: what it is, without a logo.
const ROOT_EVENT = [
  "langgraph.node  supervisor", // LangGraph
  "claude  › Edit src/app.ts", // Claude Code
  "copilot.topic  triggered", // Copilot Studio
  "agent.started  Coordinator", // OpenAI Agents SDK
  "$ codex exec  pid 4127", // Codex
  "crew.kickoff  support", // CrewAI
  "adk.run_async  billing_agent", // Google ADK
];

// Where each system's first agent wakes, before there is any ground to
// stand on. The followed system is the first agent of the film.
const CHAOS_CENTERS: Vec3[] = [
  [-1900, 900, 2300],
  [-620, 380, 1500],
  [-200, 1050, 2100],
  [0, 520, 900],
  [900, 250, 2300],
  [560, 700, 1300],
  [2000, 620, 1500],
];

export const FRAMES: TreeFrame[] = ECOSYSTEMS.map((_, i) => frameAt(treeAngle(i), ARC_R));

// When each system connects to Sulcus (the integrations sequence).
export const connectTime = (sys: number) => connectAt(CONNECT_ORDER.indexOf(sys as never));

const build = () => {
  const nodes: FNode[] = [];
  const named: number[] = [];
  const add = (sys: number, parent: number, depth: number, kind: NodeKind, R: () => number) => {
    const id = nodes.length;
    // Agents take the next unused name in their system; tools may repeat.
    const pick = R();
    const isTool = kind === "tool" || kind === "file";
    if (!isTool) named[sys] = (named[sys] ?? sys * 3) + 1;
    const followed = sys === FOLLOWED;
    const name = isTool
      ? followed
        ? FOLLOWED_TOOLS[nodes.filter((n) => n.sys === sys && (n.kind === "tool" || n.kind === "file")).length % FOLLOWED_TOOLS.length]
        : TOOLS[Math.floor(pick * TOOLS.length)]
      : followed
        ? FOLLOWED_AGENTS[(named[sys] - sys * 3 - 2) % 2]
        : AGENTS[named[sys] % AGENTS.length];
    const label =
      depth === 0 ? (followed ? "Coordinator" : "orchestrator") : kind === "file" && !followed ? "fs.write" : name;
    const event =
      depth === 0
        ? ROOT_EVENT[sys]
        : kind === "file"
          ? followed
            ? "write_file  plan.md"
            : "write  src/index.ts  +42 −7"
          : kind === "tool"
            ? `tool.call  ${name}`
            : followed
              ? `handoff  → ${name}`
              : `spawn  ${name}`;
    nodes.push({
      id,
      sys,
      parent,
      depth,
      kind,
      label,
      event,
      birth: 0,
      chaos: [0, 0, 0],
      tree: [0, 0, 0],
      u: 0,
      v: LEVEL_V[depth],
      children: [],
      warnAt: Infinity,
      warnText: "",
      permAt: Infinity,
      retry: false,
      meter: 0,
      acquire: Infinity,
    });
    if (parent >= 0) nodes[parent].children.push(id);
    return id;
  };

  const roots: number[] = [];
  for (let s = 0; s < ECOSYSTEMS.length; s++) {
    const R = rng(4100 + s * 97);
    const followed = s === FOLLOWED;
    const root = add(s, -1, 0, ECOSYSTEMS[s].kind as NodeKind, R);
    roots.push(root);
    let leaves = 0;
    const subs = followed ? 2 : 3;
    for (let j = 0; j < subs; j++) {
      const sub = add(s, root, 1, "agent", R);
      const n = 2 + (R() < 0.5 ? 1 : 0);
      for (let k = 0; k < n; k++) {
        // The followed run has three agents and no deeper ones.
        if (!followed && R() < 0.3 && leaves < 7) {
          const a = add(s, sub, 2, "agent", R);
          const m = 1 + (R() < 0.6 ? 1 : 0);
          for (let q = 0; q < m; q++) add(s, a, 3, "tool", R);
          leaves += m;
        } else {
          add(s, sub, 2, R() < 0.16 && !followed ? "file" : "tool", R);
          leaves += 1;
        }
      }
    }
    // The first agent's opening moves are a tool call and a file write.
    if (followed) {
      add(s, root, 1, "tool", R);
      add(s, root, 1, "file", R);
    }
  }

  // Tidy layout: leaves evenly spaced, parents centred over their children.
  for (const root of roots) {
    let next = 0;
    const walk = (id: number): number => {
      const n = nodes[id];
      if (n.children.length === 0) {
        n.u = next++ * LEAF_SPACING;
        return n.u;
      }
      const us = n.children.map(walk);
      n.u = (us[0] + us[us.length - 1]) / 2;
      return n.u;
    };
    walk(root);
    const mid = ((next - 1) * LEAF_SPACING) / 2;
    const shift = (id: number) => {
      nodes[id].u -= mid;
      nodes[id].children.forEach(shift);
    };
    shift(root);
  }
  for (const n of nodes) n.tree = place(FRAMES[n.sys], n.u, n.v);

  // Uncontrolled positions: each spawn drifts off from its parent in an
  // arbitrary direction, so the seven systems grow into each other.
  for (const n of nodes) {
    const R = rng(900 + n.id * 31);
    if (n.parent < 0) {
      n.chaos = CHAOS_CENTERS[n.sys];
      continue;
    }
    const a = R() * Math.PI * 2;
    const el = (R() - 0.5) * 1.5;
    const len = (n.depth === 1 ? 420 : 300) + R() * (n.depth === 1 ? 630 : 460);
    const p = nodes[n.parent].chaos;
    n.chaos = [
      p[0] + Math.cos(a) * Math.cos(el) * len,
      Math.min(1900, Math.max(80, p[1] + Math.sin(el) * len * 0.95)),
      p[2] + Math.sin(a) * Math.cos(el) * len,
    ];
  }
  // The first agent's opening moves are composed for the opening close-up.
  const first = nodes[roots[FOLLOWED]];
  const firstTool = first.children.find((c) => nodes[c].kind === "tool")!;
  const firstFile = first.children.find((c) => nodes[c].kind === "file")!;
  nodes[firstTool].chaos = v3.add(first.chaos, [250, 120, 60]);
  nodes[firstFile].chaos = v3.add(first.chaos, [-210, -150, 150]);

  // Births. The opening is hand-timed; everything after spawns at an
  // accelerating rate until the freeze.
  const born = new Set<number>();
  const setBirth = (id: number, t: number) => {
    nodes[id].birth = t;
    born.add(id);
  };
  setBirth(roots[FOLLOWED], T.agentStart);
  setBirth(firstTool, T.toolCall);
  setBirth(roots[1], T.procWake);
  setBirth(roots[5], T.browserWake);
  setBirth(firstFile, T.fileWrite);
  setBirth(roots[2], T.cloudWake);
  setBirth(roots[0], T.moreRoots[0]);
  setBirth(roots[4], T.moreRoots[1]);
  setBirth(roots[6], T.moreRoots[2]);

  const R = rng(77);
  const order: number[] = [];
  const pending = new Set(nodes.filter((n) => !born.has(n.id)).map((n) => n.id));
  const queued = new Set(born);
  while (pending.size > 0) {
    const ready = [...pending].filter((id) => queued.has(nodes[id].parent));
    // Shallower nodes are likelier to come first, as in a real run.
    ready.sort((x, y) => nodes[x].depth - nodes[y].depth);
    const pick = ready[Math.floor(Math.pow(R(), 1.6) * ready.length)];
    order.push(pick);
    pending.delete(pick);
    queued.add(pick);
  }
  const t0 = 8.3;
  order.forEach((id, k) => {
    const t = t0 + (T.spawnEnd - t0) * Math.pow(k / (order.length - 1), 0.62);
    setBirth(id, Math.max(t, nodes[nodes[id].parent].birth + 0.55));
  });

  // Edges: one per parent→child, plus cross-system calls that tangle the
  // field as it grows.
  const edges: FEdge[] = [];
  for (const n of nodes) {
    if (n.parent < 0) continue;
    edges.push({
      a: n.parent,
      b: n.id,
      birth: n.birth - 0.45,
      grow: 0.45,
      order: Math.floor(hash(n.id, 5) * 6),
      cross: false,
      period: 1.5 + hash(n.id, 6) * 1.7,
      phase: hash(n.id, 7),
    });
  }
  // The API call that wakes the first cloud process.
  edges.push({
    a: roots[1],
    b: roots[2],
    birth: T.apiCall,
    grow: T.cloudWake - T.apiCall,
    order: 2,
    cross: true,
    period: 2.2,
    phase: 0.3,
  });
  const linked = new Set<string>();
  const C = rng(2024);
  let guard = 0;
  const lastCross = T.freeze - 0.5;
  while (edges.filter((e) => e.cross).length < 104 && guard++ < 6000) {
    const a = Math.floor(C() * nodes.length);
    const b = Math.floor(C() * nodes.length);
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    if (a === b || nodes[a].sys === nodes[b].sys || linked.has(key)) continue;
    const d = v3.dist(nodes[a].chaos, nodes[b].chaos);
    if (d > 1500 || d < 200) continue;
    linked.add(key);
    const after = Math.max(nodes[a].birth, nodes[b].birth);
    const birth = Math.min(lastCross, Math.max(10.4 + C() * 2, after + 0.3 + C() * 3.5));
    edges.push({
      a,
      b,
      birth,
      grow: 0.5,
      order: Math.floor(C() * 6),
      cross: true,
      period: 1.2 + C() * 1.6,
      phase: C(),
    });
  }

  // Incidents in the uncontrolled network, denser toward the freeze.
  const span = T.freeze - T.complexity;
  for (const n of nodes) {
    const h = (salt: number) => hash(n.id, salt);
    if (h(11) < 0.2) {
      n.warnAt = Math.max(n.birth + 0.8, T.freeze - 0.2 - Math.pow(h(12), 1.8) * span * 0.68);
      n.warnText = WARNINGS[Math.floor(h(13) * WARNINGS.length)];
    }
    const isAgent = n.kind !== "tool" && n.kind !== "file";
    if (isAgent && h(14) < 0.22) n.permAt = Math.max(n.birth + 0.6, T.complexity + 2 + h(15) * (span - 2.8));
    if (!isAgent && h(16) < 0.2) n.retry = true;
    if (isAgent && h(17) < 0.5) n.meter = 0.05 + h(18) * 0.11;
    // Sulcus takes hold of a system when it connects, root first.
    if (n.sys !== FOLLOWED) n.acquire = connectTime(n.sys) + 0.15 + n.depth * 0.08;
  }

  return { nodes, edges, roots };
};

export const FIELD = build();

const subtree = (id: number): number[] => [id, ...FIELD.nodes[id].children.flatMap(subtree)];

// Extents of each system's tree.
export const SYSTEMS = FIELD.roots.map((root, i) => {
  const ns = subtree(root).map((id) => FIELD.nodes[id]);
  const leaves = ns.filter((n) => n.children.length === 0).length;
  return {
    root,
    frame: FRAMES[i],
    hw: Math.max(...ns.map((n) => Math.abs(n.u))),
    top: Math.max(...ns.map((n) => n.v)),
    agents: ns.length - leaves,
    calls: leaves,
    nodes: ns.map((n) => n.id),
  };
});

// ── time ──────────────────────────────────────────────────────────────────

// The activity clock of the uncontrolled network: it accelerates through the
// complexity act and stops dead at the freeze.
export const activity = (t: number) => {
  const c = Math.min(t, T.freeze);
  if (c <= T.complexity) return c;
  const d = c - T.complexity;
  return c + (0.7 * d * d) / (T.freeze - T.complexity);
};

const REORG_DELAY = 0.2;
const REORG = 1.6;

// 0 → 1 as a node travels from the tangle to its place in the tree.
export const tidy = (n: FNode, t: number) => easeInOut((t - n.acquire - REORG_DELAY) / REORG);

export type NodeState = {
  p: Vec3;
  // 0 → 1 over the node's first moments.
  born: number;
  m: number;
  // Seconds since Sulcus took hold of it; negative before.
  held: number;
  // Brightness: full while running, low while frozen and unowned.
  energy: number;
};

let cacheT = NaN;
let cache: NodeState[] = [];

export const fieldState = (t: number): NodeState[] => {
  if (t === cacheT) return cache;
  const frozen = ramp(t, T.freeze, T.freeze + 0.1);
  const followedAt = connectTime(FOLLOWED);
  cache = FIELD.nodes.map((n) => {
    // The followed system left the tangle for the Run Detail; it is seen
    // again only as its tree, when its stream connects.
    if (n.sys === FOLLOWED && t > T.online + 3) {
      const grow = clamp01((t - followedAt - n.depth * 0.08) / 0.5);
      return { p: n.tree, born: grow, m: 1, held: t - followedAt, energy: grow };
    }
    const m = tidy(n, t);
    const held = t - n.acquire;
    // Unanchored nodes hang and sway; owned ones stand still.
    const sway = (1 - m) * (1 - frozen);
    const a = activity(t);
    const drift: Vec3 = [
      Math.sin(a * 0.5 + n.id * 1.7) * 9 * sway,
      Math.sin(a * 0.41 + n.id * 2.3) * 7 * sway,
      Math.cos(a * 0.37 + n.id * 0.9) * 9 * sway,
    ];
    const p = v3.add(v3.lerp(n.chaos, n.tree, m), drift);
    const wake = clamp01(held / 0.5);
    const energy = 1 - 0.86 * frozen * (1 - wake);
    return { p, born: clamp01((t - n.birth) / 0.35), m, held, energy };
  });
  cacheT = t;
  return cache;
};

// The four points of an edge's route between two live positions. An
// uncontrolled route steps along the axes in an arbitrary order; a governed
// one rises, crosses and rises, like an org chart. `m` blends between them.
export const route = (a: Vec3, b: Vec3, order: number, m: number): Vec3[] => {
  const axes = [
    [0, 1, 2],
    [0, 2, 1],
    [1, 0, 2],
    [1, 2, 0],
    [2, 0, 1],
    [2, 1, 0],
  ][order];
  const c1: Vec3 = [a[0], a[1], a[2]];
  c1[axes[0]] = b[axes[0]];
  const c2: Vec3 = [c1[0], c1[1], c1[2]];
  c2[axes[1]] = b[axes[1]];
  if (m <= 0) return [a, c1, c2, b];
  const ym = (a[1] + b[1]) / 2;
  const t1: Vec3 = [a[0], ym, a[2]];
  const t2: Vec3 = [b[0], ym, b[2]];
  return [a, v3.lerp(c1, t1, m), v3.lerp(c2, t2, m), b];
};

// Beats since a system connected; governed motion runs on this.
export const beatsSince = (t: number, at: number) => (t - at) / BEAT;
