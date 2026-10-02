import { staticFile } from "remotion";
import { easeInOut } from "../engine/math";
import { runAt, wall, type RunScript } from "./model";
import * as app from "./sulcusApp";
import type { AppState, RunDetail, TimeScale } from "./sulcusApp";

// Assembles Sulcus Cloud pages at a moment of film time: the app state the
// real app would hold, rendered by the real app's code, inside the real
// dashboard shell.

export const ACCOUNT = { name: "Acme Labs", email: "ops@acme-labs.dev" };

const favicon = () => staticFile("favicon.png");

// The product's two looping status animations, at film time t.
export const pulseVars = (t: number) => ({
  // @keyframes pulse { 50% { opacity: .42 } } — 1.8 s, ease-in-out.
  pulse: (1 - 0.58 * (0.5 - 0.5 * Math.cos((2 * Math.PI * t) / 1.8))).toFixed(3),
  // @keyframes cr-pulse — 2.4 s.
  crpulse: (0.5 - 0.5 * Math.cos((2 * Math.PI * t) / 2.4)).toFixed(3),
});

export type RunView = {
  script: RunScript;
  t: number;
  expandedRow?: string | null;
  logOpen?: boolean;
  tab?: "activity" | "technical";
  filter?: string;
  expanded?: number[];
  approvalHidden?: boolean;
  deciding?: string | null;
  approveHover?: boolean;
  enter?: Record<string, number | undefined>;
  focus?: number; // 0..1 of the approval focus (the product's .25 s ease)
  toast?: string;
};

const stateFor = (v: RunView): AppState => {
  const { run, events, approvals } = runAt(v.script, v.t);
  return {
    now: wall(v.t),
    run,
    events,
    approvals,
    approvalFocus: null,
    approvalHidden: Boolean(v.approvalHidden),
    deciding: v.deciding ?? null,
    expandedRow: v.expandedRow ?? null,
    logOpen: Boolean(v.logOpen),
    tab: v.tab ?? "activity",
    filter: v.filter ?? "All",
    expanded: new Set(v.expanded ?? []),
    fx: { favicon: favicon(), approveHover: v.approveHover, enter: v.enter },
  };
};

// The app re-picks its time scale on every render, so the timeline jumps when
// a live run crosses a scale boundary or ends. The film eases those changes
// over 0.8 s.
const SMOOTH = 0.8;
const smoothScale = (script: RunScript, t: number): TimeScale => {
  const at = (x: number) => app.runScale(stateFor({ script, t: x }));
  const now = at(t);
  for (let d = 0.05; d <= SMOOTH; d += 0.05) {
    const prev = at(t - d);
    if (Math.abs(prev.span - now.span) > 1) {
      // The change happened between t-d and t-d+0.05.
      const k = easeInOut(d / SMOOTH);
      return { ...now, span: prev.span + (now.span - prev.span) * k };
    }
  }
  return now;
};

export type RunPage = RunDetail & { page: string; state: AppState };

export const runDetailPage = (v: RunView): RunPage => {
  const state = stateFor(v);
  const scale = smoothScale(v.script, v.t);
  state.fx.scale = () => scale;
  const detail = app.runDetail(state);
  const page = app.shell(state, "runs", detail.breadcrumb, detail.actions, detail.html, ACCOUNT) +
    (v.toast ? app.toast(v.toast) : "");
  return { ...detail, page, state };
};

// ── Runs and Projects ────────────────────────────────────────────────────

export type ListRun = Record<string, unknown> & { id: string };
export type Project = {
  id: string;
  name: string;
  framework: string;
  repository_url: string;
  run_count: number;
  latest_run: { status: string; started_at: string } | null;
};

const baseState = (t: number): AppState => ({ now: wall(t), fx: { favicon: favicon() } });

export const runsPage = (t: number, runs: ListRun[], hover?: string) => {
  const state = { ...baseState(t), runs, projects: [{}] };
  let html = app.runsPage(state);
  if (hover) html = html.replace(`<tr data-run-id="${hover}"`, `<tr class="film-hover" data-run-id="${hover}"`);
  return app.shell(state, "runs", ["Sulcus", "Runs"], [{ label: "New run", className: "button-primary" }], html, ACCOUNT);
};

export const projectsPage = (t: number, projects: Project[], hover?: string) => {
  const state = { ...baseState(t), projects };
  let html = app.projectsPage(state);
  if (hover)
    html = html.replace(`<article class="project-row" data-project-id="${hover}"`, `<article class="project-row film-hover" data-project-id="${hover}"`);
  return app.shell(state, "projects", ["Sulcus", "Projects"], [{ label: "New project", className: "button-primary" }], html, ACCOUNT);
};

// The New run form's Controls section, on the panel it sits in.
export const controlsCard = (tokenLimit: string) =>
  `<div class="new-run-shell"><div class="panel form-panel">${app.newRunControls(tokenLimit)}</div></div>`;

export { app };
