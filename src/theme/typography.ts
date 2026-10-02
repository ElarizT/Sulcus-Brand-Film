import { useEffect, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";

// The film's type is bundled in public/fonts so a render never depends on the
// network or on the machine's installed fonts.
//
//   Inter           the Sulcus Cloud UI face and the film's titles
//   JetBrains Mono  the Run Detail control room's face (app.css lists it in
//                   the `.cr` stack) and all in-world canvas text
//
// Sulcus Cloud's other monospace stacks start with `ui-monospace,
// SFMono-Regular, Consolas`, which resolve to SF Mono on a Mac. SF Mono cannot
// be redistributed, so `SFMono-Regular` is registered here as an alias of
// JetBrains Mono: the UI CSS stays byte-for-byte the product's, and every
// monospace run in it renders in the face the control room already uses.
//
// Each family also gets the few symbol glyphs the UI takes from system
// fallback fonts (sidebar icons, "＋ New run"), from a small subset of DejaVu
// Sans Mono built by scripts/symbols-font.py.

export const sans = "Inter";
export const mono = "JetBrains Mono";

const SYMBOLS =
  "U+21B3, U+25C7, U+2318, U+2301, U+2311, U+2715, U+25CB, U+25A0, U+25B3, U+24D8, U+FF0B";

const face = (family: string, file: string, descriptors: FontFaceDescriptors) =>
  new FontFace(family, `url(${staticFile(`fonts/${file}`)}) format("woff2")`, descriptors);

// The symbol face must declare exactly the same weight range as the face it
// extends: Chrome only merges faces with identical ranges into one family.
const FAMILIES: [string, string, string][] = [
  ["Inter", "Inter.woff2", "100 900"],
  ["JetBrains Mono", "JetBrainsMono.woff2", "100 800"],
  ["SFMono-Regular", "JetBrainsMono.woff2", "100 800"],
];

const faces = (): FontFace[] =>
  FAMILIES.flatMap(([family, file, weight]) => [
    face(family, file, { weight }),
    face(family, "SulcusFilmSymbols.woff2", { unicodeRange: SYMBOLS, weight }),
  ]);

let ready: Promise<unknown> | null = null;

// Canvas text does not wait for web fonts the way DOM text does: a canvas
// drawn before the font arrives keeps its fallback glyphs. Everything that
// draws text waits on this.
export const fontsReady = (): Promise<unknown> => {
  if (!ready) {
    ready = Promise.all(
      faces().map((f) =>
        f.load().then((loaded) => {
          document.fonts.add(loaded);
        }),
      ),
    ).then(() =>
      Promise.all(
        [
          `400 12px "${mono}"`,
          `500 12px "${mono}"`,
          `400 12px "${sans}"`,
          `500 12px "${sans}"`,
          `600 12px "${sans}"`,
          `400 12px "SFMono-Regular"`,
        ].map((f) => document.fonts.load(f)),
      ),
    );
  }
  return ready;
};

// Holds the frame until the fonts are in, so DOM text is never captured in a
// fallback face. Returns whether they are.
export const useFonts = () => {
  const [loaded, setLoaded] = useState(false);
  const [handle] = useState(() => delayRender("Loading bundled fonts"));
  useEffect(() => {
    fontsReady().then(() => {
      setLoaded(true);
      continueRender(handle);
    });
  }, [handle]);
  return loaded;
};
