# Sulcus brand film — storyboard and production plan

A 74-second film for YouTube that introduces Sulcus as the runtime and control
layer for AI agents. No voice-over: picture, score and sound design carry it.

What the viewer should leave with:

> There are many kinds of AI agents running across different systems. Sulcus
> gives me one place to see what they're doing, control what they're allowed
> to do, step in when necessary, and supervise them at scale.

The middle of the film is built on three things Sulcus lets you do, one beat
and one line each — **see**, **step in**, **set boundaries** — followed by all
seven ecosystems supervised from one place.

## What was found in the workspace

| Source | What it gave the film |
| --- | --- |
| `sulcus-website/src/styles/global.css`, `docs/cloud-brand-handoff.md` | Colour tokens (ink `#f2f1ed`, signal `#f39a48`, error `#ed9990`, graphite surfaces), Inter + monospace metadata, "reserve orange for meaningful status" |
| `First-intro-video/public/Sulcus-logo.png` | The official mark (1254×1254 RGBA), used unmodified on the end card |
| `First-intro-video/src` | The first film's conventions: Remotion 4, 3D world projected in code, grain + vignette, wide-tracked SULCUS wordmark |
| `First-intro-video/public/audio/sfx/*.wav` | Eight approved effects (agent start, approval request/confirm, control engage, policy lock, warning rise, execution pulse, brand impact), layered under the new synthesised sound design |
| `Sulcus/README.md` | Product vocabulary: supervisor trees, registered tools, approvals, permissions, limits, timelines |

## The one visual idea

**Before Sulcus there is no ground.** Agents hang in a void, wired to each
other in every direction, in white and grey only. When Sulcus comes online it
is literally the plane they are brought down to stand on: an orange polar
grid radiating from a single core. From then on everything an agent does is
white, and everything Sulcus adds — boundaries, limits, approval gates, the
streams into the core — is orange. Orange never appears before 25.0 s.

The film is one continuous camera move through one world. Scene boundaries
are edit points, not camera cuts.

## Timing grid

24 fps, 96 BPM. One beat is exactly 15 frames and one bar exactly 60 frames
(2.5 s), so every scene change and every musical downbeat is the same frame.
All cues live in `src/film/timeline.ts`; picture and sound both read them.

## Second-by-second storyboard

### 1 · The Agents — 0.0–10.0 s (bars 1–4) · `IntroAgents`

| Time | Picture | Camera | Sound |
| --- | --- | --- | --- |
| 0.0–1.25 | Black. A few out-of-focus dust motes. | Close, drifting back | Machine hum on D fades in |
| 1.25 | One agent wakes: a core of light, a ring leaving it, `agent.start` types beside it | | Agent-start effect + soft ping |
| 2.5 | A path draws out from it to a diamond: `tool.call` | | Tick, pitched blip |
| 3.75 | Elsewhere, deeper: a terminal process, lines of output typing | Starts to reveal depth | Run of key-clicks, low ping |
| 5.0 | Upper right: a browser task, a grid of cells being walked | | Two-tone blip |
| 5.625 | Back at the first agent: `write src/index.ts +42 −7` | | Three soft clicks |
| 6.25–6.875 | A long path leaves the terminal process and reaches a cloud process high in the frame; it activates | | Whoosh rising, bell on arrival |
| 7.5–10.4 | **AGENTS ARE EVERYWHERE.** Three more systems wake at the edges of frame | Still pulling back | Pad swells in; three pings |

### 2 · Complexity — 10.0–25.0 s (bars 5–10) · `Complexity`

| Time | Picture | Camera | Sound |
| --- | --- | --- | --- |
| 10–15 | Spawns accelerate. Subagents, tool calls, cross-system calls routed at right angles through 3D space | Continuous pull-back | Eighth-note bass pulse enters, heartbeat, execution ticks |
| 15–20 | ~90 agents and tool calls, ~180 paths. Permission requests blink `permission?` then `auto-allowed`. Retries circle. Red warnings: `429 rate_limit`, `timeout`, `no owner`. Meters overrun | Handheld tremor grows | Kick, sixteenth arpeggio, hats; warning two-tones |
| 20–22.5 | The network overflows the frame; labels overlap past reading | Tremor at maximum | Diminished harmony, riser, snare roll into 32nds |
| **22.5** | **Hard stop.** Every pulse freezes mid-path, the network drops to 14 % brightness. **CONTROL ISN’T.** lands on one frame | Tremor gone; slow drift through the frozen world | Music cut dead. One low hit, then near-silence |

### 3 · Sulcus — 25.0–47.5 s (bars 11–19) · `SulcusReveal`

The control plane arrives, then three capability beats. Each is one hold of
the camera on one or two trees, with one line of text in the lower third.

| Time | Picture | Camera | Sound |
| --- | --- | --- | --- |
| 25.0 | Below the frozen network: one precise orange point, a ring leaving it along a plane that was not there before | Tilting down toward it | A single clean ping in the silence |
| 26.25 | A second pulse | | Second ping; reversed swell begins |
| **27.5** | The control plane comes online: a wavefront races outward across a polar grid; core rings draw on; a beacon rises | | Impact. Score re-enters: i–VI–III–VII, half-time |
| 27.5–29 | As the wave passes under each agent, an orange line rises from the plane and takes hold of it; it comes back to life | Pushing in | A run of lock clicks, rising |
| 28–31.4 | Every node travels to its place in its system's tree. The cross-system tangle dissolves. Seven trees stand on the plane | Descends into the arc of trees | |
| 30.9, 31.5 | Boundaries close around each tree; timelines slide into register under them | | Policy-lock, low ticks, a tick run |

**See — 32.5–36.3 s**

| Time | Picture | Sound |
| --- | --- | --- |
| **32.5** | **SEE WHAT THEY’RE DOING.** In the Claude Code tree, one branch is selected: an orange highlight runs root → agent → tool call, with selection brackets on each. Every other node, and every other tree, steps back to a quarter brightness | Three rising blips, root to call |
| 33.0–34.3 | An inspector opens beside the branch, one row at a time: **AGENT** retriever · **PARENT** orchestrator · **TOOL CALL** http.get /v2/orders · **STATUS** running · **EVENTS** a small timeline; `RUNNING` top right | Soft unfold; a tick per row |
| 34.3 | The call fails: the node flashes red, a retry arc circles it. STATUS → `503 · retry 1/3`; a red mark lands on the events line | Flat two-tone |
| 34.95 | `503 · retry 2/3` | Same |
| 35.6 | `200 OK · 3rd attempt`; the node returns to white | Rising resolve |

**Step in — 37.5–41.3 s**

| Time | Picture | Sound |
| --- | --- | --- |
| 36.3–37.4 | | Camera glides to the next tree (Copilot Studio) |
| 36.9 | A call sets off up the tree | |
| **37.5** | **STEP IN WHEN IT MATTERS.** The call is stopped mid-path. Brackets lock around it and a dashed orange line — the approval boundary — runs out across the whole system. The branch is highlighted; the rest dims | Approval request, low thud |
| 37.6–38.8 | A request card opens: **TOOL CALL** deploy --prod · **AGENT** tester · **STATUS** awaiting approval, and two controls: `APPROVE`  `BLOCK` | Ticks per row; a quiet tick each beat while it waits |
| 39.2 | APPROVE is chosen (outline lights) | Click |
| **40.0** | APPROVE is pressed, on the bar line. Card → `APPROVED`; the boundary line withdraws, the brackets part, the call completes and its node lights | Approval confirm, two pings |

**Boundaries — 42.5–46.2 s**

| Time | Picture | Sound |
| --- | --- | --- |
| 41.3–42.4 | | Camera glides on and back: four running trees in shot |
| **42.5** | **SET THE BOUNDARIES.** The boundaries arm: a line of light reads up each box, the boxes get brighter and heavier, every agent's limit mark flashes | Policy-lock on the downbeat; low ticks tree by tree |
| 42.5–43.5 | Above the OpenAI Agents SDK tree: `TOKENS 84%` … counting up as an agent's gauge fills | Rising ticks |
| 43.5 | The gauge reaches its mark. `TOKEN BUDGET · PAUSED`; the agent's subtree dims inside a boundary of its own. The rest of the tree keeps running | Clamp |
| 44.1–44.8 | In the Codex tree, a call leaves an agent and heads for something outside the box (`~/.ssh`) | Short rising whoosh |
| 44.8 | It reaches the wall and stops. That stretch of boundary lights up, hatched. `BLOCKED · write outside workspace`. The attempt is withdrawn | Dull stop, descending two-tone |
| 46.0–47.8 | | Fast pull-back across the core, on the riser |

### 4 · One place — 47.5–57.5 s (bars 20–23) · `UnifiedRuntime`

| Time | Picture | Camera | Sound |
| --- | --- | --- | --- |
| 47.5–51.25 | One ecosystem joins per beat, left to right: its name appears above its tree and an orange stream runs along the plane into the core. **LangGraph · Claude Code · Copilot Studio · OpenAI Agents SDK · Codex · CrewAI · Google ADK**, each tagged `local`, `cloud` or `framework` | Settling behind the core | Hit at 47.5, lead line enters; seven pings climbing the D-minor scale |
| **52.5** | **ONE PLACE TO CONTROL THEM.** The core ignites. A line of light reads up through each system in turn and its state types in above its name: `5 agents · running`, `1 paused · token budget`, `1 call blocked` — what happened in the close-ups is still true, and visible from here | Slow orbit | Hit; scan sweep, seven blips |
| 54.375 | Beside the core: `> pause google-adk`. A control signal — bigger and brighter than the events flowing in — travels *outward* along that system's stream. On arrival the Google ADK tree dims, its pulses stop, its status reads `paused from sulcus` | | Typed ticks, a travelling sweep, a lock |
| 56.25 | `> resume google-adk`: a second signal goes out, and the system comes back | Begins to lift | Same, resolving upward; riser and roll |

Events flow in to the core; control flows out from it. That is the one new
piece of visual grammar in this section.

### 5 · Scale — 57.5–67.5 s (bars 24–27) · `ScaleSequence`

No text. The picture and the peak of the score carry it.

| Time | Picture | Camera | Sound |
| --- | --- | --- | --- |
| **57.5** | The camera leaves the ground | Up and back, fast | Biggest hit; full arrangement |
| 57.5–62 | The seven systems were the first ring. Ring after ring of agent trees rises from the plane behind them — 423 trees, every one bounded, every one wired to the core by eighteen trunk lines | | Rings arriving as scattered ticks |
| 62.5–66.25 | The whole structure pulses outward from the core every two beats. Powerful, and completely ordered | Still climbing | Peak: lead up an octave |
| 66.25–67.2 | Everything falls into the core: the world scales to a point and flares | | Music cut; falling sweep |
| 67.2–68.1 | Black | | Near silence |

### 6 · End card — 67.5–74.0 s · `EndCard`

| Time | Picture | Sound |
| --- | --- | --- |
| 68.125 | The Sulcus mark resolves where the world collapsed, in a brief orange glow | One impact; an open fifth on D rings |
| 68.75 | **SULCUS**, tracking closing as it settles | |
| 69.6 | **Control the agents.** — set in full white, the last statement of the film | |
| 70.2 | sulcus.dev | |
| 70.2–72.6 | Hold | Tail decays |
| 72.6–74.0 | Fade to black, then silence | Silence |

## Text

Six lines in the body of the film, one typographic voice (Inter 500,
wide-tracked capitals). The first two are centred and read as one sentence:
the problem. The next three say what you can do about it, each under the
picture that shows it. The sixth says where.

| Line | In | Out | Entrance |
| --- | --- | --- | --- |
| AGENTS ARE EVERYWHERE. | 7.5 | 10.4 | Eases in |
| CONTROL ISN’T. | 22.5 | 24.75 | Single-frame hit |
| SEE WHAT THEY’RE DOING. | 32.5 | 36.3 | Eases in |
| STEP IN WHEN IT MATTERS. | 37.5 | 41.3 | Eases in |
| SET THE BOUNDARIES. | 42.5 | 46.2 | Eases in |
| ONE PLACE TO CONTROL THEM. | 52.5 | 56.7 | Eases in |

Every line enters on a bar line of the score. The scale sequence has no text.
The end card answers the second line: **Control the agents.**

In-world text is part of the picture, drawn in JetBrains Mono on the canvas:
raw events in the opening (`agent.start`), the inspector and the approval
card, short annotations (`TOKEN BUDGET · PAUSED`, `BLOCKED`), the ecosystem
names and their status lines, and the two commands beside the core.

## Transitions

| Between | Design |
| --- | --- |
| Agents → Complexity | None: same shot, same camera move |
| Complexity → freeze | Time stops on one frame; brightness and sound cut with it |
| Freeze → Sulcus | Two orange pulses in silence, then the plane's wavefront wipes the frame from the core outward |
| See → Step in → Boundaries | Three holds, each a slow push; the camera glides along the arc of trees between them |
| Boundaries → One place | Fast pull-back from the trees across the core, on the riser into bar 20 |
| One place → Scale | Camera lifts off on the downbeat |
| Scale → End card | The world collapses into the core; the mark resolves from that point |

## Music

Original, synthesised by `scripts/score.ts`. D minor, 96 BPM.

| Bars | Time | Content |
| --- | --- | --- |
| 1–4 | 0–10 | Hum on D, air, a pad that barely opens |
| 5–9 | 10–22.5 | Bass pulse → kick and hats → arpeggio; harmony sours (♭2, then tritone); riser and roll |
| 10 | 22.5–25 | Cut. One low hit; hall return pulled down so the silence is real |
| 11 | 25–27.5 | Two pings, reversed swell |
| 12–17 | 27.5–42.5 | Impact, then a controlled half-time groove on Dm–B♭–F–C (reveal, See, Step in) |
| 18–23 | 42.5–57.5 | Same progression, brighter; lead line from bar 20; riser into 57.5 (Boundaries, One place) |
| 24–27 | 57.5–66.25 | Peak: octave lead, doubled arpeggio, hits on every bar |
| — | 66.25–68.1 | Collapse and dark |
| — | 68.1–74 | One impact, an open fifth, silence |

Mastered to −14 LUFS integrated with a −1.2 dBFS ceiling. Section loudness
(RMS): opening −25 dB, riser −14, freeze −24, bars 12–17 −16.5, bars 18–23
−14.5, Scale −11.5, dark −36.

The music is fixed to its bar lines (`HITS` and `PEAK` in the script) and did
not change when the middle of the film was restructured; only the effects
that are locked to picture moved, and the new beats were placed so that each
line of text and the approval itself land on a bar line.

## Architecture

```
src/
  film/timeline.ts        cue sheet: fps, tempo grid, scenes, every cue time
  film/camera.ts          the single keyframed camera path
  engine/renderer.ts      additive light renderer on Canvas 2D: projection,
                          fog, depth of field, batching, bloom
  engine/math.ts          vectors, easing, deterministic hash / rng
  primitives/             node · path (+ pulses) · events (warning, permission,
                          retry, runaway meter) · approval · boundary ·
                          timelineRail · meter · callout · panel (inspector
                          and approval card) · plane (+ core) · stream
                          (integration streams, control signals, source
                          labels) · particles
  world/field.ts          the seven systems: nodes, edges, births, both layouts
  world/drawField.ts      draws the field in whatever state it is in
  world/drawGovernance.ts everything Sulcus adds: the inspection, the approval,
                          the limits, and supervision from the core
  world/lattice.ts        the 423 trees of the scale reveal
  world/layout.ts         radial geometry shared by all of the above
  scenes/                 IntroAgents · Complexity · SulcusReveal ·
                          UnifiedRuntime · ScaleSequence · EndCard
  components/             Stage (canvas) · Title · Overlay · Atmosphere · SulcusLogo
  SulcusFilm.tsx          the six scenes in series, grain, audio
scripts/score.ts          synthesises score + sound design from timeline.ts
```

Why Canvas 2D and not Three.js / React Three Fiber: the film is entirely
thin emissive lines and points, which additive 2D compositing renders exactly
and cheaply, and a hand-written pinhole projection gives full camera control.
WebGL in headless Chrome on this machine's integrated GPU would have added
risk to a 4K render for no visual gain.

Every frame is a pure function of its frame number (no simulation state), so
frames render in parallel and in any order.

## Assets

| Asset | Status |
| --- | --- |
| Sulcus mark | `public/Sulcus-logo.png`, official, unmodified |
| Fonts | Inter, JetBrains Mono via `@remotion/google-fonts` |
| Score | Generated: `public/audio/sulcus-score.wav` |
| Recorded effects | `public/audio/sfx/*.wav`, from the first film |
| Ecosystem logos | Deliberately not used: names are set in type, so no third-party marks |

## Commands

```
npm run dev              # Remotion Studio
npm run score            # regenerate the score from the cue sheet
npm run render:preview   # 1080p review render
npm run render           # 4K master
```
