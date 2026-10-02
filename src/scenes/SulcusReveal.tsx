import { useCallback } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Overlay } from "../components/Overlay";
import { Stage } from "../components/Stage";
import { Title } from "../components/Title";
import type { Renderer } from "../engine/renderer";
import { FPS, SCENES, T } from "../film/timeline";
import { drawCore, drawPlane } from "../primitives/plane";
import { drawField } from "../world/drawField";
import { drawGovernance } from "../world/drawGovernance";
import { beginWorld } from "./world";

// 25–47.5 s. Two orange pulses in the silence, then the control plane comes
// online under the frozen network, takes hold of every agent and brings each
// one down into the tree of its own system. Then the three things Sulcus
// lets you do, one tree and one line each:
//
//   32.5  SEE WHAT THEY'RE DOING.    one branch selected and inspected
//   37.5  STEP IN WHEN IT MATTERS.   a deploy held for approval, then approved
//   42.5  SET THE BOUNDARIES.        a budget reached, a call stopped at the wall
export const SulcusReveal: React.FC = () => {
  const t = SCENES.SulcusReveal.from + useCurrentFrame() / FPS;
  const draw = useCallback(
    (r: Renderer) => {
      beginWorld(r, t);
      drawPlane(r, t);
      drawCore(r, t);
      drawField(r, t);
      drawGovernance(r, t);
    },
    [t],
  );
  return (
    <AbsoluteFill>
      <Stage draw={draw} />
      <Overlay>
        <Title
          text="SEE WHAT THEY’RE DOING."
          t={t}
          from={T.select}
          to={T.seeOut}
          y={940}
          size={40}
          scrim
        />
        <Title
          text="STEP IN WHEN IT MATTERS."
          t={t}
          from={T.approvalAsk}
          to={T.stepOut}
          y={940}
          size={40}
          scrim
        />
        <Title
          text="SET THE BOUNDARIES."
          t={t}
          from={T.bounds}
          to={T.boundsOut}
          y={940}
          size={40}
          scrim
        />
      </Overlay>
    </AbsoluteFill>
  );
};
