import { useLayoutEffect, useRef } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { Renderer } from "../engine/renderer";
import { useFonts } from "../theme/typography";

type Props = {
  // Draws one frame. Must be a pure function of its arguments.
  draw: (r: Renderer) => void;
  bloom?: number;
  // A light layer over other picture (the Sulcus UI): no black ground, and it
  // adds its light onto whatever is under it.
  transparent?: boolean;
};

// The canvas every scene draws its world into. One renderer per canvas; the
// frame is redrawn synchronously in a layout effect so it is on screen before
// Remotion captures it.
export const Stage: React.FC<Props> = ({ draw, bloom = 1, transparent = false }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<Renderer | null>(null);
  const { width, height } = useVideoConfig();
  const frame = useCurrentFrame();
  const fonts = useFonts();

  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas || !fonts) return;
    if (!renderer.current) renderer.current = new Renderer(canvas, width);
    const r = renderer.current;
    r.begin(transparent);
    draw(r);
    r.end(bloom);
    // `draw` closes over the frame, so the frame is the only real dependency.
  }, [frame, fonts, width, height, bloom, draw, transparent]);

  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        mixBlendMode: transparent ? "plus-lighter" : undefined,
      }}
    />
  );
};
