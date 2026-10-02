// Types for the ported Sulcus Cloud rendering code (sulcusApp.js).

export type AppState = {
  now: number;
  run?: unknown;
  events?: unknown[];
  approvals?: unknown[];
  runs?: unknown[];
  projects?: unknown[];
  approvalFocus?: string | null;
  approvalHidden?: boolean;
  deciding?: string | null;
  expandedRow?: string | null;
  logOpen?: boolean;
  tab?: "activity" | "technical";
  filter?: string;
  expanded?: Set<number>;
  fx: {
    favicon: string;
    approveHover?: boolean;
    focusOut?: number;
    enter?: Record<string, number | undefined>;
    scale?: (scale: TimeScale, clock: RunClock) => TimeScale;
  };
};

export type TimeScale = { start: number; span: number; step: number };
export type RunClock = { start: number; end: number; live: boolean };
export type Marker = { kind: string; time: number; sequence: number | string; name: string; tone: string };
export type Row = { key: string; name: string; depth: number; items: unknown[] };

export type RunDetail = {
  html: string;
  breadcrumb: string[];
  actions: { label: string; className?: string; disabled?: boolean }[];
  entries: { row: Row; markers: Marker[]; status: string }[];
  metrics: { tokenTotal: number | null; tokenLimit: number | null; warning: boolean; tokenViolation: boolean };
  clock: RunClock;
  scale: TimeScale;
  pending: unknown[];
  showPanel: boolean;
};

export function runDetail(s: AppState): RunDetail;
export function runsPage(s: AppState): string;
export function projectsPage(s: AppState): string;
export function shell(
  s: AppState,
  nav: string,
  breadcrumb: string[],
  actions: { label: string; className?: string; disabled?: boolean }[],
  page: string,
  account: { name: string; email: string },
): string;
export function toast(message: string, isError?: boolean): string;
export function newRunControls(tokenLimit: string | number): string;
export function rowsFor(s: AppState): Row[];
export function runScale(s: AppState): TimeScale;
export function actionName(toolName: string): string;
export function clockLabel(ms: number, precise?: boolean): string;
export function formatDuration(ms: number | null): string;
export function shortId(id: string): string;
