import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Renderer } from "../engine/renderer";
import { fontsReady } from "../theme/typography";

type Props = {
  // Draws one frame. Must be a pure function of its arguments.
  draw: (r: Renderer) => void;
  bloom?: number;
};

// The canvas every scene draws its world into. One renderer per canvas; the
// frame is redrawn synchronously in a layout effect so it is on screen before
// Remotion captures it.
export const Stage: React.FC<Props> = ({ draw, bloom = 1 }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<Renderer | null>(null);
  const { width, height } = useVideoConfig();
  const frame = useCurrentFrame();
  const [fonts, setFonts] = useState(false);

  useEffect(() => {
    const handle = delayRender("Loading fonts for canvas text");
    fontsReady.then(() => {
      setFonts(true);
      continueRender(handle);
    });
  }, []);

  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas || !fonts) return;
    if (!renderer.current) renderer.current = new Renderer(canvas, width);
    const r = renderer.current;
    r.begin();
    draw(r);
    r.end(bloom);
    // `draw` closes over the frame, so the frame is the only real dependency.
  }, [frame, fonts, width, height, bloom, draw]);

  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    />
  );
};
