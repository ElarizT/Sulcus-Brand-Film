import { useCallback } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Overlay } from "../components/Overlay";
import { Stage } from "../components/Stage";
import { Title } from "../components/Title";
import type { Renderer } from "../engine/renderer";
import { FPS, SCENES, T } from "../film/timeline";
import { drawField } from "../world/drawField";
import { beginWorld } from "./world";

// 10–25 s. The same systems, spawning faster than they can be followed:
// cross-system calls, retries, warnings, permission requests nobody answers.
// At 22.5 s everything stops on one frame.
export const Complexity: React.FC = () => {
  const t = SCENES.Complexity.from + useCurrentFrame() / FPS;
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
        {/* The first line is still leaving as this scene opens. */}
        <Title
          text="AGENTS ARE EVERYWHERE."
          t={t}
          from={T.title1In}
          to={T.title1Out}
          scrim
        />
        <Title
          text="CONTROL ISN’T."
          t={t}
          from={T.freeze}
          to={T.title2Out}
          entrance="hit"
        />
      </Overlay>
    </AbsoluteFill>
  );
};
