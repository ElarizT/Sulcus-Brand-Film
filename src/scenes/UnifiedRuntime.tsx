import { useCallback } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Overlay } from "../components/Overlay";
import { Stage } from "../components/Stage";
import { Title } from "../components/Title";
import { lerp, ramp } from "../engine/math";
import type { Renderer } from "../engine/renderer";
import { FPS, SCENES, T } from "../film/timeline";
import { drawCore, drawPlane } from "../primitives/plane";
import { drawField } from "../world/drawField";
import { drawGovernance, scanAt } from "../world/drawGovernance";
import { beginWorld } from "./world";

// 47.5–57.5 s. The seven trees are named: seven ecosystems, local and cloud,
// each joining the same layer on the beat. At 52.5 a scan reads the state of
// every system at once, and a control signal goes out from the core to pause
// one of them and then resume it: one place to control them.
export const UnifiedRuntime: React.FC = () => {
  const t = SCENES.UnifiedRuntime.from + useCurrentFrame() / FPS;
  const draw = useCallback(
    (r: Renderer) => {
      beginWorld(r, t);
      drawPlane(r, t);
      drawCore(r, t);
      // Fine labelling thins out as the camera backs away from the trees.
      const detail = lerp(1, 0.35, ramp(t, T.unify - 1, T.unify + 2));
      drawField(r, t, { detail, scan: (sys) => scanAt(t, sys) });
      drawGovernance(r, t, { detail });
    },
    [t],
  );
  return (
    <AbsoluteFill>
      <Stage draw={draw} />
      <Overlay>
        <Title
          text="ONE PLACE TO CONTROL THEM."
          t={t}
          from={T.onePlace}
          to={T.onePlaceOut}
          y={940}
          size={40}
          scrim
        />
      </Overlay>
    </AbsoluteFill>
  );
};
