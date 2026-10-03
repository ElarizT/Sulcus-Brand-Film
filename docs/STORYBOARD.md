# Sulcus brand film — storyboard and production notes

A 94-second film for YouTube. No voice-over: picture, score and sound design
carry it.

What the viewer should leave with:

> Sulcus shows me what my AI agents are doing, gives me one timeline and agent
> structure to understand their execution, lets me inspect tool actions,
> approve sensitive operations, enforce limits, and supervise agents built
> with different frameworks and platforms — and I have seen enough of the
> real interface to recognise it when I open app.sulcus.dev.

## What changed from the previous cut

The previous cut (74 s) told the same story entirely in abstract light: agent
trees on a polar grid, with drawn panels standing in for the product. This cut
keeps its world, its camera language, its score and its effects, and puts the
**real Sulcus Cloud interface** at the centre:

- Of the 87.5 s before the end card, about 41 s are the real interface on
  its own and another 11 s (the integrations) are the interface and the
  abstract world together: a little under 60 % interface. The rest is the
  abstract world it grows out of and returns to.
- The abstract governance mock-ups (inspector panel, approval gate, limit
  meters, blocked call, pause/resume from the core) are gone. Each of those
  moments is now the product's own UI doing what it does.
- The opening is kept (one bar shorter), the score keeps its instruments,
  harmony, tempo, freeze and re-entry, re-arranged onto the new cue sheet.
- The end card is unchanged: **SULCUS / Control the agents. / sulcus.dev**.

## The one visual idea

**The abstract world and the interface are the same place.** The Sulcus
windows are planes standing in the film's 3D world, seen through the same
camera as the light: the execution path the camera follows straightens into a
row of the Run Detail; the window that holds every run is finally laid down on
the ground and becomes the core every agent system is wired into. Orange is
still only ever Sulcus.

## Where the interface comes from

Everything in the windows is rendered by Sulcus Cloud's own code, from
`ElarizT/Sulcus` `sulcus/cloud/static` at `48b8c46` (main, 2026-10-02):

| Film | Product source |
| --- | --- |
| `src/ui/app.css` | `app.css`, byte for byte (scoped to `.sulcus-ui` by `scripts/scope-ui-css.mjs`) |
| `src/ui/sulcusApp.js` | `app.js`: `renderRunDetail`, `rowHtml`, `rowMarkers`, `controlRows`, `agentNodes`, `metricsForRun`, `usageHtml`, `runSummaryHtml`, `approvalPanelHtml`, `liveEventsHtml`, the event log (`renderTabs`/`renderTimeline`/`renderEventList`), `renderRuns`, `renderProjects`, the New run form's Controls section, and the `dashboard.html` shell |
| `src/ui/runs/*.ts` | Runtime events in the shapes the adapters emit (`sulcus/integrations/openai_agents`, `claude_code`, `codex`, `langgraph`, `crewai`; `sulcus/tokens.py`; `sulcus/cloud/service.py`) |

Changes to `app.js` are marked `film:` and only make it a function of film
time: state is passed in, `Date.now()` is the film clock, DOM writes return
markup, one-shot CSS entrance animations are driven per frame, dates are
formatted in a fixed locale. The tree, statuses, markers, labels, metrics,
token-limit messages, approval panel and focus dimming are the product's own
logic and copy.

Behaviour shown is behaviour the product has:

- the Agent Tree is built from runtime parent spans (agents used as tools in
  the OpenAI Agents SDK; `parent_run_id` in LangGraph);
- an approval request pauses an OpenAI Agents SDK run until it is decided;
  the panel appears 150 ms after the request (the app's approvals refresh),
  shows "Submitting…" while the decision is sent, and the app's toast
  confirms it;
- the token limit is the per-run `max_total_tokens` set in New run → Controls;
  at 80 % the app warns ("Approaching limit"); when the next AI call cannot
  fit, the budget blocks it (`runtime.tokens.limit_exceeded`,
  `reason: pre_call_block`) and Cloud fails the run with "Token budget
  exceeded", which the app presents as "Run stopped — AI usage limit
  exceeded";
- an inspected tool event shows what Sulcus records: tool, agent, call id,
  duration, success. Sulcus deliberately does not record tool inputs or
  outputs, so the film does not show any;
- Claude Code and Codex appear as local sessions (`claude-code`, `codex`),
  as the Sulcus CLI reports them.

**Two systems in the film are not current Sulcus integrations.** Microsoft
Copilot Studio and Google ADK appear, as the brief asks, as execution sources
in the opening and as streams and runs in the integrations sequence (labelled
`copilot-studio` and `google-adk`). The product's adapters and its website's
claim matrix list LangGraph, CrewAI, OpenAI Agents SDK, Claude Code and Codex
only. If the film is published before those two ship, change `ECOSYSTEMS` in
`src/film/timeline.ts` and `LANDINGS` in `src/ui/runs/workspace.ts`.

Integration names are set in type; no third-party logos are used.

## Timing grid

24 fps, 96 BPM: a beat is exactly 15 frames, a bar exactly 60 (2.5 s). All
cues live in `src/film/timeline.ts`; picture and sound both read them.

## Shot by shot

### 1 · The Agents — 0–10 s (bars 1–4) · abstract

Darkness; one agent wakes (`agent.started  Coordinator`). It reads a file and
writes a plan. Elsewhere other systems wake, each announced only by its first
raw event, never a logo: `claude  › Edit src/app.ts`, `$ codex exec  pid 4127`,
`crew.kickoff  support`, `copilot.topic  triggered`, `langgraph.node
supervisor`, `adk.run_async  billing_agent`. **AGENTS ARE EVERYWHERE.** at 7.5.

### 2 · Complexity — 10–22.5 s (bars 5–9) · abstract

Spawns accelerate, cross-system calls tangle, warnings and unanswered
permission requests pile up, the camera shakes. **20.0: CONTROL ISN'T.** —
everything freezes on one frame and the music cuts.

### 3 · Into Sulcus — 22.5–30 s (bars 10–12) · abstract → interface

| Time | Picture |
| --- | --- |
| 22.5 | In the frozen tangle, an orange point lands on the first agent of the film |
| 23.75 | Light runs out from it along every path of its system; the camera turns to follow it in |
| **25.0** | The music re-enters. Every node of that system travels to the element of the Run Detail it is: the root to the Coordinator's node, its two sub-agents to Researcher and Verifier, its calls to their tool markers. Paths straighten into tree guides and timeline rows |
| 25.5–27.4 | The real Run Detail resolves around them from the Agent Tree outward (`research-agent`, `Daily research brief`, `openai-agents`, `LIVE`) |
| 27.4–30 | The camera pulls back to the whole Sulcus Cloud window: sidebar, breadcrumb, Stop run |

### 4 · Run Detail — 30–52.5 s (bars 13–21) · interface

| Time | Picture |
| --- | --- |
| **30.0** | **SEE WHAT YOUR AGENTS ARE DOING.** Light runs along each agent's timeline row, root first; calls appear as they happen |
| 32.5 | The Researcher row is selected: it expands with the run's Token limit (60,000), runtime and tool chips (`Search web · 5 calls`, `Read file · 4 calls`) |
| 35.0 | The camera dives onto one `search_web` marker |
| 35.7 | The Event log opens on Tools; the page drops to it |
| 36.25 | That call's event opens: `tool.execution_completed`, `agent_name: Researcher`, `tool_name: search_web`, `tool_call_id`, `duration_ms`, `success: true` |
| **40.0** | **STEP IN WHEN IT MATTERS.** The Verifier asks to run `execute_command`; the run pauses. The row turns orange (`waiting`), the marker reads `Execute command · waiting`, and the real approval panel opens with the rest of the run dimmed behind it: Agent `Verifier`, Action `Execute command`, Waiting `00:01…` |
| 43.0–43.75 | Approve lights, and is pressed: `Submitting…` |
| 44.1 | Approved. The panel closes, focus returns, the toast reads `Execute command approved`, and execution resumes along the Verifier's row |
| **45.0** | **SET THE BOUNDARIES.** The New run form's Controls section floats in front of the run: Token limit `60000` — then sinks into the run's TOKENS readout |
| 47.5–48.75 | Usage climbs; at 80 % TOKENS turns orange and the row reads `Approaching limit` |
| **50.0** | The next AI call will not fit. The music drops out. The pill turns `FAILED`, TOKENS turns red, an issue marker lands on the timeline, and the banner reads **Run stopped — AI usage limit exceeded. The next AI call could not fit within the allowed 60,000 tokens. Sulcus detected the policy violation and stopped the run.** |

### 5 · Many agents — 52.5–62.5 s (bars 22–25) · interface

The stopped run steps back into the dark; a second window comes forward:
`v2.14 release review`, seven agents in three levels (Release Manager →
Changelog Writer, QA Lead → Test Runner, Flake Triage, Security Reviewer, Docs
Updater), interleaved calls across every row. 56.25 Changelog Writer
completes; 57.5 Flake Triage's `fetch_ci_logs` fails and its row turns red;
58.0 Docs Updater joins the tree; 60.0 Security Reviewer's `merge_pull_request`
waits for approval and the run pauses.

### 6 · The workspace — 62.5–64.4 s (bar 26) · interface

The camera pulls back as the window navigates to Projects: release-review
`approval required`, research-agent `failed`, support-triage `running`,
docs-qa and data-pipeline-agent `completed`.

### 7 · Integrations — 64.4–77.5 s (bars 26–31) · interface + abstract

| Time | Picture |
| --- | --- |
| 64.4 | The window goes to Runs and is laid down, face up, at the centre of the world |
| **66.25** | It lands: the ground comes on from it, the control plane of the previous cut, now radiating from the real interface |
| 66.9–70.6 | One per beat, the seven systems of the opening wake, form their trees, and send a stream of light along the ground into the window; each lands as a new run at the top of the Runs list (`claude-code local session`, `codex local session`, `IT helpdesk agent`, `Billing assistant`, `Docs QA nightly`, `Support triage`, `Daily research brief`) |
| 71.25–75 | Their runs, rising beyond the window: a Claude Code session, a LangGraph graph, a CrewAI crew, a Codex session — four frameworks, one Run Detail |
| **75.0** | **ONE PLACE TO CONTROL THEM.** The seven named systems around the window at the core, every one bounded and wired into it |

### 8 · Scale — 77.5–87.5 s (bars 32–35) · abstract

The camera leaves the ground. Ring after ring of agent trees rises around the
window — hundreds, every one bounded and connected to the core. The peak of
the score. At 86.25 everything falls into the core and the window burns out in
the flare.

### 9 · End card — 87.5–94 s

**SULCUS** · **Control the agents.** · `sulcus.dev`, as before.

## Text

| Line | In | Out |
| --- | --- | --- |
| AGENTS ARE EVERYWHERE. | 7.5 | 10.4 |
| CONTROL ISN’T. | 20.0 | 22.25 |
| SEE WHAT YOUR AGENTS ARE DOING. | 30.0 | 34.6 |
| STEP IN WHEN IT MATTERS. | 40.0 | 44.6 |
| SET THE BOUNDARIES. | 45.0 | 49.6 |
| ONE PLACE TO CONTROL THEM. | 75.0 | 79.0 |

## Music

Original, synthesised by `scripts/score.ts`: D minor, 96 BPM, the previous
cut's instruments, mix and mastering, re-arranged.

| Bars | Time | Content |
| --- | --- | --- |
| 1–4 | 0–10 | Hum on D, air, a pad that barely opens |
| 5–8 | 10–20 | Bass pulse → kick and hats → arpeggio; harmony sours; riser and roll |
| 9 | 20–22.5 | Cut. One low hit, then near-silence |
| 10 | 22.5–25 | Two pings on the first agent; a reversed swell |
| 11–16 | 25–40 | Impact as the path becomes the interface; half-time groove on Dm–B♭–F–C |
| 17–20 | 40–50 | Brighter (approval, boundaries) |
| 21 | 50–52.5 | The run is stopped: one hard hit, the band drops out, the pad holds |
| 22–26 | 52.5–65 | Groove returns (many agents, the workspace) |
| 27–31 | 65–77.5 | Lead line enters; seven ascending pings as the systems connect |
| 32–35 | 77.5–86.25 | Peak: octave lead, doubled arpeggio, hits on every bar; collapse |
| — | 88.1–94 | One impact, an open fifth, silence |

Mastered to −14 LUFS integrated with a −1.2 dBFS ceiling. Every on-picture
sound (row selected, event opened, approval requested / pressed / resolved,
limit warning, the stop, each system connecting) is placed from the same cue
sheet as the picture.

## Architecture

```
src/
  film/timeline.ts       cue sheet: fps, tempo grid, scenes, every cue
  film/camera.ts         the single camera path (world keys + UI framings)
  film/planes.ts         where each Sulcus window stands in the world, over time
  film/director.ts       what each window shows at each moment
  film/light.ts          light drawn on top of the interface, anchored to
                         measured UI elements
  film/world.ts          the world behind the windows
  film/FilmFrame.tsx     one frame, all layers
  engine/project.ts      the camera as a function; plane → CSS matrix3d
  engine/renderer.ts     additive light renderer on Canvas 2D
  components/UIPlane.tsx a Sulcus window in the world: transform, depth of
                         field, light falloff, reveal
  ui/                    the product's stylesheet and rendering code, page
                         assembly, and the runs on screen
  world/, primitives/    the abstract world (agents, trees, ground, lattice)
  scenes/                each scene is a stretch of FilmFrame; EndCard
scripts/score.ts         synthesises score + sound design from timeline.ts
scripts/scope-ui-css.mjs scopes the product stylesheet
scripts/stills.mjs       review stills from a bundle
```

The interface is laid out at twice its pixel density and projected down, so
it stays sharp when the camera comes close. Light on the interface is placed
from element positions measured after layout in the same frame, so it lands
exactly on the row, marker or button it refers to.

## Assets

| Asset | Status |
| --- | --- |
| Sulcus mark | `public/Sulcus-logo.png`, official, unmodified; the UI uses the product's `favicon.png` |
| Fonts | Inter and JetBrains Mono (bundled), symbol subset of DejaVu Sans Mono (`scripts/symbols-font.py`) |
| Score | Generated: `public/audio/sulcus-score.wav` |
| Recorded effects | `public/audio/sfx/*.wav`, from the first film |
| Ecosystem logos | Not used: names are set in type |
