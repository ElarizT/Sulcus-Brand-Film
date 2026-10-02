import type { Focus, Reveal, Vignette } from "../components/UIPlane";
import { clamp01, easeIn, easeInOut, ramp, v3 } from "../engine/math";
import { type Plane, type Projector, place } from "../engine/project";
import type { Camera } from "../engine/renderer";
import { sequenceOf } from "../ui/model";
import { controlsCard as controlsHtml, projectsPage, pulseVars, runDetailPage, runsPage } from "../ui/pages";
import { RELEASE, RELEASE_PAUSE } from "../ui/runs/release";
import {
  APPROVAL_ID,
  INSPECTED_CALL,
  RESEARCH,
  RESEARCH_ROWS,
} from "../ui/runs/research";
import { CARDS, landingRunId, landsAt, projectsAt, runsAt } from "../ui/runs/workspace";
import type { AfterLayout } from "../ui/SulcusUI";
import { CARD_H, CARD_W, controlsCard, flyCard, w1, w1Opacity, w2, w2Opacity } from "./planes";
import { CONNECT_ORDER, T } from "./timeline";

// What every Sulcus window shows at a moment of film time: which page, in
// which state, how it is lit and focused. The camera decides where it is
// seen from; this decides what is on it.

export type WindowSpec = {
  key: string;
  plane: Plane;
  html: string;
  vars?: Record<string, string | number>;
  after?: AfterLayout;
  sink?: "w1" | "w2";
  opacity: number;
  reveal?: Reveal;
  focus?: Focus;
  vignette?: Vignette;
  blur?: number;
  brightness?: number;
};

// Where the camera is looking on a window, and how close: depth of field and
// light follow the shot.
export const lens = (pl: Plane, cam: Camera, project: Projector) => {
  const n = v3.cross(pl.ax, pl.ay);
  const dir = v3.sub(cam.target, cam.eye);
  const denom = v3.dot(dir, n);
  if (Math.abs(denom) < 1e-6) return null;
  const s = v3.dot(v3.sub(pl.origin, cam.eye), n) / denom;
  const hitPt = v3.add(cam.eye, v3.scale(dir, s));
  const d = v3.sub(hitPt, pl.origin);
  const x = v3.dot(d, pl.ax) / v3.dot(pl.ax, pl.ax);
  const y = v3.dot(d, pl.ay) / v3.dot(pl.ay, pl.ay);
  const pr = project(hitPt);
  const zoom = pr ? pr.s * v3.len(pl.ax) : 1;
  return { x, y, zoom };
};

const shot = (pl: Plane, cam: Camera, project: Projector, strength = 1) => {
  const l = lens(pl, cam, project);
  if (!l) return {};
  const blur = clamp01((l.zoom - 1.05) / 1.6) * 2.4 * strength;
  return {
    focus: blur > 0.05 ? { x: l.x, y: l.y, r: 260 + 900 / Math.pow(l.zoom, 0.8), blur } : undefined,
    vignette: { x: l.x, y: l.y, r: 700 + 1300 / l.zoom, strength: 0.32 + 0.12 * clamp01(l.zoom - 1) },
  };
};

// ── research-agent (W1) ──────────────────────────────────────────────────

// The completed event of the call the camera inspects.
export const INSPECTED_DONE = sequenceOf(
  RESEARCH,
  (e) => e.event.event_type === "tool.execution_completed" && e.event.metadata.tool_call_id === INSPECTED_CALL,
);
export const INSPECTED_FIRST = sequenceOf(RESEARCH, (e) => e.event.metadata.tool_call_id === INSPECTED_CALL);

const LOG_CLOSE = T.approvalAsk;

// The page scrolls down to the event log, and back.
export const pageScroll = (t: number) =>
  470 * easeInOut(ramp(t, T.logOpen, T.logOpen + 0.8)) * (1 - easeInOut(ramp(t, T.inspectOut, LOG_CLOSE)));

const row = (key: string) => `[data-row="${key}"]`;

export const W1_MEASURE: AfterLayout = {
  measure: {
    coordNode: `${row(RESEARCH_ROWS.coordinator)} .cr-node`,
    researcherNode: `${row(RESEARCH_ROWS.researcher)} .cr-node`,
    verifierNode: `${row(RESEARCH_ROWS.verifier)} .cr-node`,
    inspected: `[data-mk="${RESEARCH_ROWS.researcher}:tool:${INSPECTED_FIRST}"]`,
    eventRow: `[data-sequence="${INSPECTED_DONE}"]`,
    tokens: ".cr-tokens",
    pending: ".mk-approval.is-pending",
    approve: "#approval-approve",
    error: ".mk-error",
    summary: ".run-summary",
    cursor: "#cr-cursor",
    researcherRow: row(RESEARCH_ROWS.researcher),
    verifierRow: row(RESEARCH_ROWS.verifier),
  },
  measureAll: {
    cTools: `${row(RESEARCH_ROWS.coordinator)} .mk-tool`,
    rTools: `${row(RESEARCH_ROWS.researcher)} .mk-tool`,
    vTools: `${row(RESEARCH_ROWS.verifier)} .mk-tool`,
    lines: ".cr-line",
    rows: ".cr-row",
  },
};

export const researchPage = (t: number) => {
  const decided = t >= T.approvalDone;
  return runDetailPage({
    script: RESEARCH,
    t,
    expandedRow: t >= T.select ? RESEARCH_ROWS.researcher : null,
    logOpen: t >= T.logOpen && t < LOG_CLOSE,
    filter: "Tools",
    expanded: t >= T.rowOpen ? [INSPECTED_DONE] : [],
    deciding: t >= T.approvalGrant && !decided ? APPROVAL_ID : null,
    approveHover: t >= T.approvalChoose && !decided,
    enter: { expand: ramp(t, T.select, T.select + 0.18), panel: ramp(t, T.approvalAsk + 0.15, T.approvalAsk + 0.35) },
    focusOut: decided && t < T.approvalDone + 0.25 ? 1 : 0,
    toast: decided && t < T.approvalDone + 4.2 ? "Execute command approved" : undefined,
  });
};

const researchFocus = (t: number) =>
  t < T.approvalDone ? ramp(t, T.approvalAsk + 0.15, T.approvalAsk + 0.4) : 1 - ramp(t, T.approvalDone, T.approvalDone + 0.25);

// ── release-review (W2) ──────────────────────────────────────────────────

export const W2_MEASURE: AfterLayout = {
  measure: {
    pending: ".mk-approval.is-pending",
    failed: ".mk-tool.is-failed",
    changelog: '[data-row$=":agent:agent_changelog"] .cr-node',
    flakes: '[data-row$=":agent:agent_flake_triage"] .cr-node',
    docs: '[data-row$=":agent:agent_docs"] .cr-node',
    table: ".runs-table",
  },
  measureAll: { runRows: ".runs-table tbody tr" },
};

const releasePage = (t: number) =>
  runDetailPage({
    script: RELEASE,
    t,
    enter: { panel: ramp(t, RELEASE_PAUSE + 0.15, RELEASE_PAUSE + 0.35) },
  });

// ── all windows at time t ────────────────────────────────────────────────

export const windowsAt = (t: number, cam: Camera, project: Projector): WindowSpec[] => {
  const out: WindowSpec[] = [];
  const vars = pulseVars(t);

  // W1: research-agent, from the moment it resolves around the path that
  // became it, until it slides away.
  // It is laid out (hidden) from the moment the path starts to straighten, so
  // every node already knows where in the interface it is going.
  if (t >= T.online - 0.1 && w1Opacity(t) > 0) {
    const pl = w1(t);
    const page = researchPage(t);
    const reveal =
      t < T.uiFull + 0.4
        ? { x: 560, y: 270, r: Math.max(0.5, 2700 * easeIn(ramp(t, T.uiIn, T.uiFull + 0.4))), soft: 420 }
        : undefined;
    out.push({
      key: "w1",
      plane: pl,
      html: page.page,
      vars: { ...vars, focus: researchFocus(t) },
      after: { ...W1_MEASURE, pageScroll: pageScroll(t), listTo: { sequence: INSPECTED_DONE, offset: 34 } },
      sink: "w1",
      opacity: w1Opacity(t),
      reveal,
      ...shot(pl, cam, project, t > T.limitHit + 2.5 ? 0 : 1),
      brightness: 1 - 0.35 * ramp(t, T.limitHit + 2.6, T.many),
    });
  }

  // The token limit, as it was set when the run was started.
  if (t >= T.bounds - 0.1 && t < T.bounds + 3) {
    const c = controlsCard(t);
    if (c.opacity > 0.002)
      out.push({ key: "controls", plane: c.plane, html: controlsHtml("60000"), opacity: c.opacity, vars });
  }

  // W2: release-review, then Projects, then Runs.
  if (t >= T.limitHit + 2.7) {
    const pl = w2(t);
    const base = { plane: pl, sink: "w2" as const, ...shot(pl, cam, project, t < T.projects ? 1 : 0.5) };
    const toProjects = ramp(t, T.projects + 0.05, T.projects + 0.35);
    const toRuns = ramp(t, T.integrate - 0.15, T.integrate + 0.15);
    if (toProjects < 1)
      out.push({
        ...base,
        key: "w2-run",
        html: releasePage(t).page,
        vars: { ...vars, focus: ramp(t, RELEASE_PAUSE + 0.15, RELEASE_PAUSE + 0.4) },
        after: W2_MEASURE,
        opacity: w2Opacity(t) * (1 - toProjects),
      });
    if (toProjects > 0 && toRuns < 1)
      out.push({
        ...base,
        key: "w2-projects",
        html: projectsPage(t, projectsAt(t)),
        vars,
        opacity: toProjects * (1 - toRuns),
        sink: toProjects >= 1 ? "w2" : undefined,
      });
    if (toRuns > 0) {
      const fresh: Record<string, number> = {};
      for (const sys of CONNECT_ORDER) fresh[landingRunId(sys)] = ramp(t, landsAt(sys), landsAt(sys) + 0.35);
      out.push({
        ...base,
        key: "w2-runs",
        html: runsPage(t, runsAt(t), fresh),
        vars,
        after: W2_MEASURE,
        opacity: toRuns,
        brightness: 1 + 1.5 * ramp(t, T.collapse - 0.3, T.collapse + 0.3),
        sink: toRuns >= 1 ? "w2" : undefined,
        // Seen from far off, the window is a lit slab at the core.
        focus: undefined,
      });
    }
  }

  // Four runs from four frameworks, standing beyond the window.
  if (t >= T.flyThrough - 0.4 && t < T.onePlace + 0.8)
    CARDS.forEach((script, i) => {
      const c = flyCard(i, t);
      if (c.opacity <= 0.002) return;
      out.push({ key: `card${i}`, plane: c.plane, html: runDetailPage({ script, t }).page, vars, opacity: c.opacity });
    });

  // Far planes first.
  return out
    .map((w) => ({ w, d: place(w.plane, project).depth }))
    .sort((a, b) => b.d - a.d)
    .map(({ w }) => w);
};

export { CARD_H, CARD_W };
