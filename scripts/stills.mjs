// Renders review stills of the film from an existing bundle, reusing one
// browser for all of them.
//
//   npx remotion bundle --out-dir=build
//   node scripts/stills.mjs build out/stills 30 36.5 41.2 ...   (seconds)
//
// Set BROWSER to a Chrome / headless-shell executable if Remotion cannot
// download its own.

import path from "node:path";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";

const [bundle, outDir, ...times] = process.argv.slice(2);
const comp = process.env.COMP ?? "SulcusFilm-1080p";
const browser = await openBrowser("chrome", {
  browserExecutable: process.env.BROWSER ?? null,
});
const composition = await selectComposition({ serveUrl: bundle, id: comp, puppeteerInstance: browser });
for (const s of times) {
  const frame = Math.round(Number(s) * composition.fps);
  const output = path.join(outDir, `f${String(frame).padStart(4, "0")}.jpg`);
  const t0 = Date.now();
  await renderStill({ composition, serveUrl: bundle, frame, output, imageFormat: "jpeg", jpegQuality: 88, puppeteerInstance: browser });
  console.log(`${s}s  frame ${frame}  ${Date.now() - t0} ms  ${output}`);
}
await browser.close({ silent: true });
