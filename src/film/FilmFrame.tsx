import { useCallback, useRef } from "react";
import { AbsoluteFill } from "remotion";
import { Overlay } from "../components/Overlay";
import { Stage } from "../components/Stage";
import { Title } from "../components/Title";
import { UIPlane } from "../components/UIPlane";
import { lerp, ramp } from "../engine/math";
import { onPlane, projector, type Plane, type Projector } from "../engine/project";
import type { Renderer } from "../engine/renderer";
import { emptyMeasured, type Measured } from "../ui/SulcusUI";
import { cameraAt, shakeAt } from "./camera";
import { windowsAt } from "./director";
import { drawLight } from "./light";
import { LOGICAL_H, LOGICAL_W, T } from "./timeline";
import { beginWorld, drawWorld, worldScaleAt } from "./world";

// One moment of the film, whole: the world, the Sulcus windows standing in
// it, the light on top of them, and the titles. Every layer is a function of
// film time alone, so any frame renders on its own.
//
//   world canvas   agents, ground, trees, lattice (behind everything)
//   UI planes      the real Sulcus Cloud interface, placed by the camera
//   light canvas   added on top: paths, pulses and streams, registered to
//                  elements of the interface measured in this same frame
//   titles

// Does a window fill the whole frame? Then nothing behind it is drawn.
const covers = (pl: Plane, project: Projector) => {
  const q = [onPlane(pl, 0, 0), onPlane(pl, pl.w, 0), onPlane(pl, pl.w, pl.h), onPlane(pl, 0, pl.h)].map(project);
  if (q.some((p) => !p)) return false;
  const pts = q as { x: number; y: number }[];
  const inside = (x: number, y: number) =>
    pts.every((a, i) => {
      const b = pts[(i + 1) % 4];
      return (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x) >= 0;
    });
  return [
    [0, 0],
    [LOGICAL_W, 0],
    [LOGICAL_W, LOGICAL_H],
    [0, LOGICAL_H],
  ].every(([x, y]) => inside(x, y));
};

const TITLES: { text: string; from: number; to: number; hit?: boolean; low?: boolean }[] = [
  { text: "AGENTS ARE EVERYWHERE.", from: T.title1In, to: T.title1Out },
  { text: "CONTROL ISN’T.", from: T.freeze, to: T.title2Out, hit: true },
  { text: "SEE WHAT YOUR AGENTS ARE DOING.", from: T.see, to: T.seeOut, low: true },
  { text: "STEP IN WHEN IT MATTERS.", from: T.approvalAsk, to: T.stepOut, low: true },
  { text: "SET THE BOUNDARIES.", from: T.bounds, to: T.boundsOut, low: true },
  { text: "ONE PLACE TO CONTROL THEM.", from: T.onePlace, to: T.onePlaceOut, low: true },
];

export const FilmFrame: React.FC<{ t: number }> = ({ t }) => {
  const cam = cameraAt(t);
  const project = projector(cam, shakeAt(t), worldScaleAt(t));
  const sinks = useRef({ w1: emptyMeasured(), w2: emptyMeasured() });
  const w1Sink = useRef<Measured>(emptyMeasured());
  const w2Sink = useRef<Measured>(emptyMeasured());

  const windows = windowsAt(t, cam, project);
  const covered = windows.some(
    (w) => w.opacity >= 0.999 && !w.reveal && (w.brightness ?? 1) >= 0.999 && covers(w.plane, project),
  );

  const drawBack = useCallback((r: Renderer) => drawWorld(r, t, covered), [t, covered]);
  const drawFront = useCallback(
    (r: Renderer) => {
      beginWorld(r, t);
      sinks.current.w1 = w1Sink.current;
      sinks.current.w2 = w2Sink.current;
      drawLight(r, t, sinks.current);
    },
    [t],
  );

  return (
    <AbsoluteFill>
      <Stage draw={drawBack} bloom={lerp(1, 1.25, ramp(t, T.climax - 1, T.climax))} />
      <Overlay>
        {windows.map((w) => (
          <UIPlane
            key={w.key}
            plane={w.plane}
            project={project}
            html={w.html}
            vars={w.vars}
            after={w.after}
            sink={w.sink === "w1" ? w1Sink : w.sink === "w2" ? w2Sink : undefined}
            opacity={w.opacity}
            reveal={w.reveal}
            focus={w.focus}
            vignette={w.vignette}
            blur={w.blur}
            brightness={w.brightness}
          />
        ))}
      </Overlay>
      <Stage draw={drawFront} transparent />
      <Overlay>
        {TITLES.map((x) => (
          <Title
            key={x.text}
            text={x.text}
            t={t}
            from={x.from}
            to={x.to}
            entrance={x.hit ? "hit" : "rise"}
            scrim={!x.hit}
            {...(x.low ? { y: 940, size: 40 } : {})}
          />
        ))}
      </Overlay>
    </AbsoluteFill>
  );
};
