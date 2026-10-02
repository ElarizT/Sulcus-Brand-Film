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

export const FILM_SECONDS = 74;
export const FILM_FRAMES = FILM_SECONDS * FPS;

export const frames = (seconds: number) => Math.round(seconds * FPS);

export type SceneId =
  | "IntroAgents"
  | "Complexity"
  | "SulcusReveal"
  | "UnifiedRuntime"
  | "ScaleSequence"
  | "EndCard";

export const SCENES: Record<SceneId, { from: number; to: number }> = {
  IntroAgents: { from: 0, to: 10 }, // bars 1–4
  Complexity: { from: 10, to: 25 }, // bars 5–10
  SulcusReveal: { from: 25, to: 47.5 }, // bars 11–19
  UnifiedRuntime: { from: 47.5, to: 57.5 }, // bars 20–23
  ScaleSequence: { from: 57.5, to: 67.5 }, // bars 24–27
  EndCard: { from: 67.5, to: 74 },
};

export const sceneFrames = (id: SceneId) => ({
  from: frames(SCENES[id].from),
  durationInFrames: frames(SCENES[id].to - SCENES[id].from),
});

// Picture cues. Every one of these is also a sound cue in scripts/score.ts.
export const T = {
  // ── The Agents ────────────────────────────────────────────────────────
  agentStart: 1.25, // the first agent wakes
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
  spawnEnd: 21.8, // last agent of the uncontrolled network is born
  freeze: 22.5, // CONTROL ISN'T. — the music is cut on this frame
  title2Out: 24.75,

  // ── Sulcus ────────────────────────────────────────────────────────────
  pulse1: 25.0, // one precise orange pulse in the silence
  pulse2: 26.25,
  online: 27.5, // the control plane comes online
  waveSpeed: 2400, // world units per second
  reorgDelay: 0.25, // after the wave reaches an agent
  reorgDuration: 2.2,
  boundaries: 30.9, // boundaries close around each tree, staggered
  timelines: 31.5, // timelines align under the trees

  // See: one branch is selected and inspected.
  select: 32.5, // SEE WHAT THEY'RE DOING.
  inspect: 33.0, // the inspector opens, one row at a time
  retryFail: 34.3, // the call fails…
  retryAgain: 34.95, // …is retried…
  retryOk: 35.6, // …and goes through
  seeOut: 36.3,

  // Step in: a sensitive call is held until someone approves it.
  approvalAsk: 37.5, // STEP IN WHEN IT MATTERS.
  approvalGrant: 40.0,
  stepOut: 41.3,

  // Boundaries: limits are enforced on running agents.
  bounds: 42.5, // SET THE BOUNDARIES.
  limitHit: 43.5, // an agent reaches its token budget and is paused
  blocked: 44.8, // a call tries to leave its boundary and is stopped
  boundsOut: 46.2,

  // ── One place ─────────────────────────────────────────────────────────
  unify: 47.5, // one ecosystem joins the layer per beat
  connectFirst: 47.5,
  onePlace: 52.5, // all seven supervised: ONE PLACE TO CONTROL THEM.
  command: 54.375, // a control signal leaves the core and pauses a system…
  resume: 56.25, // …and another resumes it
  onePlaceOut: 56.7,

  // ── Scale ─────────────────────────────────────────────────────────────
  scale: 57.5,
  climax: 62.5,
  collapse: 66.25,
  dark: 67.2,

  // ── End card ──────────────────────────────────────────────────────────
  logo: 68.125,
  wordmark: 68.75,
  tagline: 69.6,
  url: 70.2,
  endFade: 72.6,
  endDark: 73.4,
} as const;

// Arc order, left to right as seen from the core. `kind` picks the root glyph
// and `where` the caption under the name.
export const ECOSYSTEMS = [
  { name: "LANGGRAPH", where: "framework", kind: "agent" },
  { name: "CLAUDE CODE", where: "local", kind: "proc" },
  { name: "COPILOT STUDIO", where: "cloud", kind: "cloud" },
  { name: "OPENAI AGENTS SDK", where: "framework", kind: "agent" },
  { name: "CODEX", where: "local", kind: "proc" },
  { name: "CREWAI", where: "framework", kind: "browser" },
  { name: "GOOGLE ADK", where: "cloud", kind: "cloud" },
] as const;

export const connectAt = (i: number) => T.connectFirst + i * BEAT;

// The ecosystem that is paused and resumed from the core.
export const COMMANDED = 6;
