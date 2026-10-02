import { useCallback } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Overlay } from "../components/Overlay";
import { Stage } from "../components/Stage";
import { Title } from "../components/Title";
import type { Renderer } from "../engine/renderer";
import { FPS, SCENES, T } from "../film/timeline";
import { drawField } from "../world/drawField";
import { beginWorld } from "./world";

// 0–10 s. Darkness, then agents waking one at a time: an agent, a tool call,
// a terminal process, a browser task, a file write, a call out to the cloud.
export const IntroAgents: React.FC = () => {
  const t = SCENES.IntroAgents.from + useCurrentFrame() / FPS;
  const draw = useCallback(
    (r: Renderer) => {
      beginWorld(r, t);
      drawField(r, t);
    },
    [t],
  );
  return (
    <AbsoluteFill>
      <Stage draw={draw} />
      <Overlay>
        <Title
          text="AGENTS ARE EVERYWHERE."
          t={t}
          from={T.title1In}
          to={T.title1Out}
          scrim
        />
      </Overlay>
    </AbsoluteFill>
  );
};
