import { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { hash } from "../engine/math";
import { LOGICAL_W } from "../film/timeline";

// Lens falloff and film grain over the whole picture. The grain is not
// decoration: the film is mostly near-black gradients, which band badly once
// a video codec quantises them, and a little noise dithers the banding away.

const TILE = 256;
let tile: HTMLCanvasElement | null = null;
const grainTile = () => {
  if (tile) return tile;
  tile = document.createElement("canvas");
  tile.width = tile.height = TILE;
  const g = tile.getContext("2d")!;
  const img = g.createImageData(TILE, TILE);
  for (let i = 0; i < TILE * TILE; i++) {
    // Sum of two uniforms: a soft triangular distribution.
    const n = (hash(i, 9) + hash(i, 10)) / 2;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = 255;
    img.data[i * 4 + 3] = Math.round(n * 255);
  }
  g.putImageData(img, 0, 0);
  return tile;
};

export const Atmosphere: React.FC<{ grain?: number }> = ({ grain = 0.034 }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  useLayoutEffect(() => {
    const c = ref.current?.getContext("2d");
    if (!c) return;
    const s = width / LOGICAL_W;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, width, height);
    // Grain cells are one logical pixel, so 1080p and 4K look alike.
    c.setTransform(s, 0, 0, s, 0, 0);
    c.imageSmoothingEnabled = false;
    const ox = Math.floor(hash(frame, 21) * TILE);
    const oy = Math.floor(hash(frame, 22) * TILE);
    const t = grainTile();
    for (let y = -oy; y < height / s; y += TILE)
      for (let x = -ox; x < width / s; x += TILE) c.drawImage(t, x, y);
  }, [frame, width, height]);

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 78% 74% at 50% 50%, transparent 52%, rgba(0,0,0,0.62) 100%)",
        }}
      />
      <canvas
        ref={ref}
        width={width}
        height={height}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: grain }}
      />
    </AbsoluteFill>
  );
};
