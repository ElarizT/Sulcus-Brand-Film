# Sulcus brand film

A 94-second cinematic introduction to Sulcus. It starts in an abstract world
of agents running everywhere, follows one of them into the real Sulcus Cloud
interface, and travels through the product: the Agent Tree and Timeline, one
tool call's event, an approval, a token limit enforced, a run with many
agents, the workspace, and the seven agent systems that report into it. It
ends on **SULCUS · Control the agents. · sulcus.dev**.

Built with [Remotion](https://www.remotion.dev). Picture, score and sound
design are all generated from code in this folder. The interface is the
product's own: its stylesheet and rendering code, copied from Sulcus Cloud
(see [Where the interface comes from](#where-the-interface-comes-from)).

The storyboard, cue sheet and architecture are in
[docs/STORYBOARD.md](docs/STORYBOARD.md).

## Commands

```console
npm i                    # install
npm run dev              # open Remotion Studio
npm run score            # regenerate public/audio/sulcus-score.wav
npm run render:preview   # 1080p review render → out/sulcus-brand-film-1080p.mp4
npm run render           # 4K master        → out/sulcus-brand-film-4k.mp4
```

If Remotion cannot download its own browser, pass one:
`--browser-executable=/path/to/chrome-headless-shell`.

For quick review frames from a bundle (one browser for all of them):

```console
npx remotion bundle --out-dir=build
node scripts/stills.mjs build out/stills 30 41.5 50.4   # seconds
```

## Compositions

| Id | Size | Use |
| --- | --- | --- |
| `SulcusFilm` | 3840×2160, 24 fps | The master |
| `SulcusFilm-1080p` | 1920×1080, 24 fps | The same film, for previews |
| `Scenes/*` | 1920×1080 | Each scene on its own, silent |

## Where the interface comes from

| File | What it is |
| --- | --- |
| `src/ui/app.css` | Byte-for-byte copy of Sulcus Cloud's `sulcus/cloud/static/app.css` |
| `src/ui/app.scoped.css` | The same rules scoped under `.sulcus-ui` (`node scripts/scope-ui-css.mjs`) |
| `src/ui/sulcusApp.js` | `app.js`'s markup builders and derivations (Run Detail control room, Agent Tree, timeline markers, approval panel, event log, runs and projects pages), copied with the minimum changes to run as a function of film time; every change is marked `film:` |
| `src/ui/film.css` | How the film renders that stylesheet frame by frame (CSS animations re-created from film time, fixed window size) |
| `src/ui/runs/*.ts` | The runs on screen, as the runtime events Sulcus's adapters emit |

When the product UI changes, copy the new `app.css`, run
`node scripts/scope-ui-css.mjs`, and port the changed functions into
`sulcusApp.js`.

## Changing things

- **Timing** lives in one place: `src/film/timeline.ts`. Picture and sound
  both read it. After moving a cue, run `npm run score` so the sound follows.
- **Camera**: the keys in `src/film/camera.ts`, one path for the whole film.
  Shots of the interface are written as framings (`ui(window, x, y, zoom,
  yaw, pitch)`) on a window.
- **What is on screen**: `src/film/director.ts` (which page, in which state,
  per moment) and `src/ui/runs/*` (the runs themselves).
- **Where the windows stand**: `src/film/planes.ts`.
- **Light on the interface**: `src/film/light.ts`.
- **The world**: `src/world/field.ts` (the seven agent systems),
  `src/world/lattice.ts` (the scale reveal).
- **Music and effects**: `scripts/score.ts`. `STEMS=1 npm run score` prints
  per-stem and per-band loudness for every section of the film.

Every frame is a pure function of its frame number, so nothing in `src` may
use `Math.random()`, `Date.now()` or carry state between frames; use
`hash()` / `rng()` from `src/engine/math.ts`.

Fonts are bundled in `public/fonts` (Inter, JetBrains Mono, and a small symbol
subset built by `scripts/symbols-font.py`), so a render needs no network.

## Licence note

Remotion requires a company licence for some organisations; see the
[terms](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md).
