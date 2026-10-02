// Single source of truth for the film's timing. Everything is in seconds and
// sits on a 96 BPM grid: at 24 fps a beat is exactly 15 frames and a bar is
// exactly 60, so picture cuts and musical downbeats are the same frame.
//
// This file has no imports on purpose: scripts/score.ts reads it from Node to
// place every sound on the same cue the picture uses.

export const FPS = 24;
// The master is native 4K. Everything is authored in a 1920×1080 logical
// space and scaled, so the 1080p preview composition is the same picture.
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const LOGICAL_W = 1920;
export const LOGICAL_H = 1080;

export const BPM = 96;
export const BEAT = 60 / BPM; // 0.625 s
export const BAR = BEAT * 4; // 2.5 s
// Bars are 1-indexed, like a score.
export const bar = (n: number) => (n - 1) * BAR;

export const FILM_SECONDS = 94;
export const FILM_FRAMES = FILM_SECONDS * FPS;

export const frames = (seconds: number) => Math.round(seconds * FPS);

export type SceneId =
  | "IntroAgents"
  | "Complexity"
  | "IntoSulcus"
  | "RunDetail"
  | "ManyAgents"
  | "Workspace"
  | "Integrations"
  | "ScaleSequence"
  | "EndCard";

export const SCENES: Record<SceneId, { from: number; to: number }> = {
  IntroAgents: { from: 0, to: 10 }, // bars 1–4: agents wake in the dark
  Complexity: { from: 10, to: 22.5 }, // bars 5–9: the tangle, then the freeze
  IntoSulcus: { from: 22.5, to: 30 }, // bars 10–12: one path becomes the Run Detail
  RunDetail: { from: 30, to: 52.5 }, // bars 13–21: see, inspect, approve, limit
  ManyAgents: { from: 52.5, to: 62.5 }, // bars 22–25: a run with many agents
  Workspace: { from: 62.5, to: 65 }, // bar 26: projects
  Integrations: { from: 65, to: 77.5 }, // bars 27–31: seven systems, one place
  ScaleSequence: { from: 77.5, to: 87.5 }, // bars 32–35: everything, structured
  EndCard: { from: 87.5, to: 94 },
};

export const sceneFrames = (id: SceneId) => ({
  from: frames(SCENES[id].from),
  durationInFrames: frames(SCENES[id].to - SCENES[id].from),
});

// Picture cues. Every one of these is also a sound cue in scripts/score.ts.
export const T = {
  // ── The Agents (abstract) ─────────────────────────────────────────────
  agentStart: 1.25, // the first agent wakes: the research run starts here
  toolCall: 2.5, // its first tool call fires
  procWake: 3.75, // a terminal process starts elsewhere
  browserWake: 5.0, // a browser task begins
  fileWrite: 5.625, // files change
  apiCall: 6.25, // an API call leaves for the cloud…
  cloudWake: 6.875, // …and a cloud process activates
  title1In: 7.5, // AGENTS ARE EVERYWHERE.
  title1Out: 10.4,
  moreRoots: [7.5, 8.125, 8.75] as const,

  // ── Complexity ────────────────────────────────────────────────────────
  complexity: 10,
  spawnEnd: 19.3, // last agent of the uncontrolled network is born
  freeze: 20.0, // CONTROL ISN'T. — the music is cut on this frame
  title2Out: 22.25,

  // ── Into Sulcus: one execution path becomes the Run Detail ────────────
  pulse1: 22.5, // an orange point lands on the first agent of the film
  pulse2: 23.75, // its branch lights, root to call
  online: 25.0, // structure: the branch snaps into the agent tree + timeline
  uiIn: 25.5, // the real interface begins to resolve around it
  uiFull: 27.4, // fully resolved
  // The camera then pulls back to the whole app.

  // ── Run Detail: research-agent ────────────────────────────────────────
  see: 30.0, // SEE WHAT YOUR AGENTS ARE DOING.
  select: 32.5, // the Researcher row is selected and expands
  seeOut: 34.6,
  inspect: 35.0, // the camera drops onto one search_web call…
  logOpen: 35.7, // …the event log opens on Tools…
  rowOpen: 36.25, // …and that call's event opens
  inspectOut: 39.4,
  approvalAsk: 40.0, // STEP IN WHEN IT MATTERS. execute_command waits
  approvalChoose: 43.0, // Approve is lit
  approvalGrant: 43.75, // …and pressed
  approvalDone: 44.1, // the decision lands; execution resumes
  stepOut: 44.6,
  bounds: 45.0, // SET THE BOUNDARIES. the run's token limit
  boundsOut: 49.6,
  limitWarn: 48.75, // usage passes 80 %
  limitHit: 50.0, // the next AI call would not fit: Sulcus stops the run

  // ── Many agents: release-review ──────────────────────────────────────
  many: 55.0, // the second run fills the frame
  manyDone: 56.25, // one branch completes
  manyFail: 57.5, // one branch's tool call fails
  manyApproval: 58.75, // one branch waits for approval
  manyHide: 60.6, // the operator hides the panel; the run carries on
  manyOut: 62.5,

  // ── Workspace ─────────────────────────────────────────────────────────
  projects: 62.5,

  // ── Integrations ──────────────────────────────────────────────────────
  integrate: 65.0, // seven systems connect, one per beat
  flyThrough: 69.375, // their runs, one structure
  onePlace: 72.5, // ONE PLACE TO CONTROL THEM.
  onePlaceOut: 77.0,

  // ── Scale ─────────────────────────────────────────────────────────────
  scale: 77.5, // the camera leaves the interface
  land: 79.375, // the interface lies down at the core of everything
  climax: 82.5,
  collapse: 86.25,
  dark: 87.2,

  // ── End card ──────────────────────────────────────────────────────────
  logo: 88.125,
  wordmark: 88.75,
  tagline: 89.6,
  url: 90.2,
  endFade: 92.6,
  endDark: 93.4,
} as const;

// The seven systems of the opening, in arc order around the core. `kind`
// picks the glyph their first process wakes with; `framework` is how Sulcus
// Cloud labels their runs.
export const ECOSYSTEMS = [
  { name: "LANGGRAPH", where: "framework", kind: "agent", framework: "langgraph" },
  { name: "CLAUDE CODE", where: "local", kind: "proc", framework: "claude-code" },
  { name: "COPILOT STUDIO", where: "cloud", kind: "cloud", framework: "copilot-studio" },
  { name: "OPENAI AGENTS SDK", where: "framework", kind: "agent", framework: "openai-agents" },
  { name: "CODEX", where: "local", kind: "proc", framework: "codex" },
  { name: "CREWAI", where: "framework", kind: "browser", framework: "crewai" },
  { name: "GOOGLE ADK", where: "cloud", kind: "cloud", framework: "google-adk" },
] as const;

// The system the film follows into Sulcus: the first agent to wake.
export const FOLLOWED = 3;

// The order the seven systems connect during the integrations sequence.
export const CONNECT_ORDER = [1, 4, 2, 6, 0, 5, 3] as const;
export const connectAt = (i: number) => T.integrate + i * BEAT;
