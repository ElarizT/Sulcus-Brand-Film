import { useCallback } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Stage } from "../components/Stage";
import { lerp, ramp } from "../engine/math";
import type { Renderer } from "../engine/renderer";
import { FPS, SCENES, T } from "../film/timeline";
import { drawCore, drawPlane } from "../primitives/plane";
import { drawField } from "../world/drawField";
import { drawGovernance } from "../world/drawGovernance";
import { drawLattice } from "../world/lattice";
import { beginWorld } from "./world";

// 57.5–67.5 s. The camera leaves the ground. The seven systems were the first
// ring; there are hundreds more, all bounded, all wired to the same core,
// pulsing together. No text: the picture and the score carry it. Then the
// whole structure falls into the core and is gone.
export const ScaleSequence: React.FC = () => {
  const t = SCENES.ScaleSequence.from + useCurrentFrame() / FPS;
  const draw = useCallback(
    (r: Renderer) => {
      beginWorld(r, t);
      drawPlane(r, t, lerp(1, 1.5, ramp(t, T.scale, T.scale + 3)));
      drawCore(r, t);
      drawLattice(r, t);
      const detail = 0.35 * (1 - ramp(t, T.scale, T.scale + 1.5));
      drawField(r, t, { detail });
      drawGovernance(r, t, { detail });
      // The last light: everything arriving at one point.
      if (t >= T.collapse) {
        const c = ramp(t, T.collapse, T.dark);
        const o = r.project([0, 0, 0]);
        if (o) {
          const flare = Math.pow(Math.sin(Math.PI * Math.min(1, c * 1.08)), 2);
          r.gain = 1;
          r.glow(o.x, o.y, 520 * (1.1 - c), "hot", flare);
          r.glow(o.x, o.y, 120 * (1.2 - c), "signal", flare);
          r.haze(o.x, o.y, 1500 * (1.15 - c), 50, "hot", 0.8 * flare);
        }
      }
    },
    [t],
  );
  return (
    <AbsoluteFill>
      <Stage
        draw={draw}
        bloom={lerp(1, 1.25, ramp(t, T.climax - 1, T.climax))}
      />
    </AbsoluteFill>
  );
};
