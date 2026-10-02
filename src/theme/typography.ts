import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";

const inter = loadInter("normal", {
  weights: ["400", "500", "600"],
  subsets: ["latin"],
});
const jetbrains = loadMono("normal", {
  weights: ["400", "500"],
  subsets: ["latin"],
});

export const sans = inter.fontFamily;
export const mono = jetbrains.fontFamily;

// Canvas text does not wait for web fonts the way DOM text does: a canvas
// drawn before the font arrives keeps its fallback glyphs. The stage waits on
// this before it draws a frame.
export const fontsReady: Promise<unknown> = Promise.all([
  inter.waitUntilDone(),
  jetbrains.waitUntilDone(),
]).then(() =>
  Promise.all(
    [
      `400 12px "${mono}"`,
      `500 12px "${mono}"`,
      `400 12px "${sans}"`,
      `500 12px "${sans}"`,
      `600 12px "${sans}"`,
    ].map((f) => document.fonts.load(f)),
  ),
);
