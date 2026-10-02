// Sulcus identity, from the sulcus.dev design tokens (src/styles/global.css).
// The film sits a step darker than the site so orange reads as light.
export const colors = {
  void: "#050506",
  deep: "#0c0d0f",
  line: "#343539",
  ink: "#f2f1ed",
  muted: "#aeada7",
  faint: "#6f6e6a",
  signal: "#f39a48",
  signalStrong: "#ffad61",
  error: "#ed9990",
} as const;

// Light sources for the additive renderer, as RGB. `hot` is a deeper orange
// than the brand token: stacked additive light drifts toward yellow-white, and
// starting deeper keeps overlapping control lines orange.
export const LIGHT = {
  ink: [242, 241, 237],
  cool: [176, 190, 205],
  dim: [120, 124, 132],
  signal: [243, 154, 72],
  hot: [255, 122, 40],
  error: [237, 110, 96],
} as const;

export type LightName = keyof typeof LIGHT;
