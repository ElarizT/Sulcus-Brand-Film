# Sulcus brand film

A 74-second cinematic introduction to Sulcus, the runtime and control layer
for AI agents. Built with [Remotion](https://www.remotion.dev); picture, score
and sound design are all generated from code in this folder.

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

## Compositions

| Id | Size | Use |
| --- | --- | --- |
| `SulcusFilm` | 3840×2160, 24 fps | The master |
| `SulcusFilm-1080p` | 1920×1080, 24 fps | The same film, for previews |
| `Scenes/*` | 1920×1080 | Each of the six scenes on its own, silent |

## Changing things

- **Timing** lives in one place: `src/film/timeline.ts`. Picture and sound
  both read it. After moving a cue, run `npm run score` so the sound follows.
- **Camera**: the keys in `src/film/camera.ts`. It is one path for the whole
  film.
- **The world**: `src/world/field.ts` builds the seven agent systems;
  `src/world/lattice.ts` the rings of the scale reveal.
- **Look**: `src/theme/colors.ts`, and the bloom / fog / depth-of-field in
  `src/engine/renderer.ts`.
- **Music and effects**: `scripts/score.ts`. Stem levels are the `LEVEL` table
  near the end; `STEMS=1 npm run score` prints per-stem and per-band loudness
  for every section of the film.

Every frame is a pure function of its frame number, so nothing in `src` may
use `Math.random()` or carry state between frames; use `hash()` / `rng()`
from `src/engine/math.ts`.

## Licence note

Remotion requires a company licence for some organisations; see the
[terms](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md).
