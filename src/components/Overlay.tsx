import { AbsoluteFill, useVideoConfig } from "remotion";
import { LOGICAL_H, LOGICAL_W } from "../film/timeline";

// DOM layers are laid out in the same 1920×1080 logical space as the canvas
// and scaled to the output, so type sits identically at 1080p and 4K.
export const Overlay: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { width } = useVideoConfig();
  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: LOGICAL_W,
          height: LOGICAL_H,
          transformOrigin: "0 0",
          scale: width / LOGICAL_W,
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  );
};
