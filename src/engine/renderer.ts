import { LOGICAL_H, LOGICAL_W } from "../film/timeline";
import { LIGHT, type LightName } from "../theme/colors";
import { clamp01, TAU, v3, type Vec3 } from "./math";

// A small additive light renderer on Canvas 2D.
//
// The whole film is light on black, so every mark is drawn with additive
// blending: draw order stops mattering, overlapping paths get brighter the
// way real light does, and a blurred copy of the frame added back on top is
// a physically plausible bloom. Scenes describe the world in 3D; this class
// projects it through a pinhole camera with depth fog and a cheap
// depth-of-field (out-of-focus marks get wider and dimmer).
//
// All 2D coordinates are in a 1920×1080 logical space regardless of the
// output resolution.

export type Camera = { eye: Vec3; target: Vec3; focal: number };
export type Projected = { x: number; y: number; z: number; s: number };

const NEAR = 40;
const NAMES = Object.keys(LIGHT) as LightName[];
const INDEX = Object.fromEntries(NAMES.map((n, i) => [n, i])) as Record<
  LightName,
  number
>;
const CSS = Object.fromEntries(
  NAMES.map((n) => [n, `rgb(${LIGHT[n].join(",")})`]),
) as Record<LightName, string>;

export type TextOpts = {
  align?: CanvasTextAlign;
  font?: "mono" | "sans";
  weight?: number;
  tracking?: number; // em
  baseline?: CanvasTextBaseline;
};

export const FONT = { mono: "JetBrains Mono", sans: "Inter" };

const sprites = new Map<LightName, HTMLCanvasElement>();
const sprite = (name: LightName) => {
  let c = sprites.get(name);
  if (!c) {
    c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    const [r, gg, b] = LIGHT[name];
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, `rgba(${r},${gg},${b},1)`);
    grad.addColorStop(0.12, `rgba(${r},${gg},${b},0.55)`);
    grad.addColorStop(0.35, `rgba(${r},${gg},${b},0.16)`);
    grad.addColorStop(0.7, `rgba(${r},${gg},${b},0.035)`);
    grad.addColorStop(1, `rgba(${r},${gg},${b},0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    sprites.set(name, c);
  }
  return c;
};

export class Renderer {
  readonly W = LOGICAL_W;
  readonly H = LOGICAL_H;
  readonly ctx: CanvasRenderingContext2D;
  private S: number;
  private bloomA: HTMLCanvasElement;
  private bloomB: HTMLCanvasElement;

  // Camera state.
  private eye: Vec3 = [0, 0, -1000];
  private f: Vec3 = [0, 0, 1];
  private r: Vec3 = [1, 0, 0];
  private u: Vec3 = [0, 1, 0];
  private focal = 1000;
  private focus = 1000;
  private cx = LOGICAL_W / 2;
  private cy = LOGICAL_H / 2;
  private fogNear = 1e9;
  private fogLen = 1;
  // Depth of field strength, 0 = everything sharp.
  dof = 1;
  // Uniform scale of the world about the origin (the final collapse).
  worldScale = 1;
  // Master brightness applied to every mark.
  gain = 1;

  private lines = new Map<number, number[]>();
  private dots = new Map<number, number[]>();
  private cuts: { quad: { x: number; y: number }[]; alpha: number }[] = [];
  private lastFont = "";

  constructor(
    private canvas: HTMLCanvasElement,
    width: number,
  ) {
    this.ctx = canvas.getContext("2d")!;
    this.S = width / LOGICAL_W;
    this.bloomA = document.createElement("canvas");
    this.bloomB = document.createElement("canvas");
    this.bloomA.width = Math.ceil(canvas.width / 4);
    this.bloomA.height = Math.ceil(canvas.height / 4);
    this.bloomB.width = Math.ceil(canvas.width / 8);
    this.bloomB.height = Math.ceil(canvas.height / 8);
  }

  begin(transparent = false) {
    const c = this.ctx;
    c.setTransform(this.S, 0, 0, this.S, 0, 0);
    c.globalCompositeOperation = "source-over";
    c.globalAlpha = 1;
    c.filter = "none";
    // Pure black under the light: the bloom then adds nothing to empty space.
    // A light layer over the Sulcus UI starts empty and is added on top of it.
    c.clearRect(0, 0, this.W, this.H);
    if (!transparent) {
      c.fillStyle = "#000";
      c.fillRect(0, 0, this.W, this.H);
    }
    c.globalCompositeOperation = "lighter";
    c.lineCap = "butt";
    c.lineJoin = "round";
    this.lines.clear();
    this.dots.clear();
    this.cuts = [];
    this.lastFont = "";
    this.worldScale = 1;
    this.gain = 1;
    this.dof = 1;
  }

  setCamera(cam: Camera, shake?: { x: number; y: number }) {
    this.eye = cam.eye;
    this.f = v3.norm(v3.sub(cam.target, cam.eye));
    this.r = v3.norm(v3.cross([0, 1, 0], this.f));
    this.u = v3.cross(this.f, this.r);
    this.focal = cam.focal;
    this.focus = v3.dist(cam.target, cam.eye);
    this.cx = this.W / 2 + (shake?.x ?? 0);
    this.cy = this.H / 2 + (shake?.y ?? 0);
  }

  // Marks fade exponentially with depth beyond `near`.
  setFog(near: number, length: number) {
    this.fogNear = near;
    this.fogLen = length;
  }

  fog(z: number) {
    return z <= this.fogNear ? 1 : Math.exp(-(z - this.fogNear) / this.fogLen);
  }

  // 0 in focus → 1 fully defocused. Relative to the focus distance, so a
  // close-up has a shallow field and a wide shot is sharp throughout.
  blur(z: number) {
    if (this.dof <= 0) return 0;
    const off = Math.abs(z - this.focus) / this.focus;
    return clamp01((off - 0.22) / 1.1) * this.dof;
  }

  private cam(p: Vec3): Vec3 {
    const ws = this.worldScale;
    const dx = p[0] * ws - this.eye[0];
    const dy = p[1] * ws - this.eye[1];
    const dz = p[2] * ws - this.eye[2];
    return [
      dx * this.r[0] + dy * this.r[1] + dz * this.r[2],
      dx * this.u[0] + dy * this.u[1] + dz * this.u[2],
      dx * this.f[0] + dy * this.f[1] + dz * this.f[2],
    ];
  }

  project(p: Vec3): Projected | null {
    const c = this.cam(p);
    if (c[2] < NEAR) return null;
    const s = this.focal / c[2];
    return { x: this.cx + c[0] * s, y: this.cy - c[1] * s, z: c[2], s };
  }

  onScreen(p: Projected, margin = 80) {
    return (
      p.x > -margin &&
      p.x < this.W + margin &&
      p.y > -margin &&
      p.y < this.H + margin
    );
  }

  // ── lines ─────────────────────────────────────────────────────────────

  line2(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: LightName,
    alpha: number,
    width = 1,
  ) {
    const a = Math.round(clamp01(alpha * this.gain) * 48);
    if (a <= 0) return;
    const w = Math.max(1, Math.min(96, Math.round(width * 4)));
    const key = INDEX[color] * 10000 + a * 100 + w;
    let b = this.lines.get(key);
    if (!b) this.lines.set(key, (b = []));
    b.push(x1, y1, x2, y2);
  }

  line3(
    a: Vec3,
    b: Vec3,
    color: LightName,
    alpha: number,
    width = 1,
    scaleWidth = false,
  ) {
    let A = this.cam(a);
    let B = this.cam(b);
    if (A[2] < NEAR && B[2] < NEAR) return;
    if (A[2] < NEAR) {
      const t = (NEAR - A[2]) / (B[2] - A[2]);
      A = [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, NEAR];
    } else if (B[2] < NEAR) {
      const t = (NEAR - B[2]) / (A[2] - B[2]);
      B = [B[0] + (A[0] - B[0]) * t, B[1] + (A[1] - B[1]) * t, NEAR];
    }
    const sa = this.focal / A[2];
    const sb = this.focal / B[2];
    const x1 = this.cx + A[0] * sa;
    const y1 = this.cy - A[1] * sa;
    const x2 = this.cx + B[0] * sb;
    const y2 = this.cy - B[1] * sb;
    const m = 200;
    if (
      (x1 < -m && x2 < -m) ||
      (x1 > this.W + m && x2 > this.W + m) ||
      (y1 < -m && y2 < -m) ||
      (y1 > this.H + m && y2 > this.H + m)
    )
      return;
    const z = (A[2] + B[2]) / 2;
    const bl = this.blur(z);
    let w = width * (1 + 1.6 * bl);
    if (scaleWidth) w *= Math.max(0.5, Math.min(2.6, this.focal / z));
    this.line2(x1, y1, x2, y2, color, alpha * this.fog(z) * (1 - 0.6 * bl), w);
  }

  // The stretch of a polyline between arc-length fractions t0 and t1.
  poly3(
    pts: Vec3[],
    color: LightName,
    alpha: number,
    width = 1,
    t0 = 0,
    t1 = 1,
    scaleWidth = false,
  ) {
    if (t1 <= t0) return;
    if (t0 <= 0 && t1 >= 1) {
      for (let i = 1; i < pts.length; i++)
        this.line3(pts[i - 1], pts[i], color, alpha, width, scaleWidth);
      return;
    }
    let total = 0;
    const lens: number[] = [];
    for (let i = 1; i < pts.length; i++) {
      const l = v3.dist(pts[i - 1], pts[i]);
      lens.push(l);
      total += l;
    }
    if (total <= 0) return;
    const d0 = t0 * total;
    const d1 = t1 * total;
    let acc = 0;
    for (let i = 0; i < lens.length; i++) {
      const s = acc;
      const e = acc + lens[i];
      acc = e;
      if (e <= d0 || s >= d1 || lens[i] <= 0) continue;
      const a = Math.max(d0, s);
      const b = Math.min(d1, e);
      this.line3(
        v3.lerp(pts[i], pts[i + 1], (a - s) / lens[i]),
        v3.lerp(pts[i], pts[i + 1], (b - s) / lens[i]),
        color,
        alpha,
        width,
        scaleWidth,
      );
    }
  }

  // A circle (or arc) lying in the ground plane, as a fogged polyline.
  circle3(
    center: Vec3,
    radius: number,
    color: LightName,
    alpha: number,
    width = 1,
    a0 = 0,
    a1 = TAU,
    segments = 96,
  ) {
    const n = Math.max(2, Math.ceil((segments * (a1 - a0)) / TAU));
    let prev: Vec3 | null = null;
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      const p: Vec3 = [
        center[0] + radius * Math.sin(a),
        center[1],
        center[2] + radius * Math.cos(a),
      ];
      if (prev) this.line3(prev, p, color, alpha, width);
      prev = p;
    }
  }

  // ── points ────────────────────────────────────────────────────────────

  dot(x: number, y: number, r: number, color: LightName, alpha: number) {
    const a = Math.round(clamp01(alpha * this.gain) * 48);
    if (a <= 0 || r <= 0) return;
    const key = INDEX[color] * 100 + a;
    let b = this.dots.get(key);
    if (!b) this.dots.set(key, (b = []));
    b.push(x, y, r);
  }

  glow(x: number, y: number, r: number, color: LightName, alpha: number) {
    const a = clamp01(alpha * this.gain);
    if (a < 0.004 || r <= 0) return;
    if (x < -r || x > this.W + r || y < -r || y > this.H + r) return;
    const c = this.ctx;
    c.globalAlpha = a;
    c.drawImage(sprite(color), x - r, y - r, r * 2, r * 2);
  }

  // A soft elliptical wash of light: haze, horizon glow, volumetrics.
  haze(
    x: number,
    y: number,
    rx: number,
    ry: number,
    color: LightName,
    alpha: number,
  ) {
    const a = clamp01(alpha * this.gain);
    if (a < 0.003) return;
    const c = this.ctx;
    c.globalAlpha = a;
    c.drawImage(sprite(color), x - rx, y - ry, rx * 2, ry * 2);
  }

  ring2(
    x: number,
    y: number,
    r: number,
    color: LightName,
    alpha: number,
    width = 1,
    a0 = 0,
    a1 = TAU,
  ) {
    const a = clamp01(alpha * this.gain);
    if (a < 0.01 || r <= 0) return;
    const c = this.ctx;
    c.globalAlpha = a;
    c.strokeStyle = CSS[color];
    c.lineWidth = width;
    c.beginPath();
    c.arc(x, y, r, a0, a1);
    c.stroke();
  }

  rect2(
    x: number,
    y: number,
    w: number,
    h: number,
    color: LightName,
    alpha: number,
  ) {
    const a = clamp01(alpha * this.gain);
    if (a < 0.01) return;
    const c = this.ctx;
    c.globalAlpha = a;
    c.fillStyle = CSS[color];
    c.fillRect(x, y, w, h);
  }

  // ── text ──────────────────────────────────────────────────────────────

  text(
    str: string,
    x: number,
    y: number,
    px: number,
    color: LightName,
    alpha: number,
    o: TextOpts = {},
  ) {
    const a = clamp01(alpha * this.gain);
    if (a < 0.015 || !str) return;
    const c = this.ctx;
    const font = `${o.weight ?? 400} ${px.toFixed(2)}px "${FONT[o.font ?? "mono"]}"`;
    if (font !== this.lastFont) {
      c.font = font;
      this.lastFont = font;
    }
    (c as unknown as { letterSpacing: string }).letterSpacing =
      `${((o.tracking ?? 0) * px).toFixed(2)}px`;
    c.textAlign = o.align ?? "left";
    c.textBaseline = o.baseline ?? "middle";
    c.globalAlpha = a;
    c.fillStyle = CSS[color];
    c.fillText(str, x, y);
  }

  measure(str: string, px: number, o: TextOpts = {}) {
    const c = this.ctx;
    const font = `${o.weight ?? 400} ${px.toFixed(2)}px "${FONT[o.font ?? "mono"]}"`;
    if (font !== this.lastFont) {
      c.font = font;
      this.lastFont = font;
    }
    (c as unknown as { letterSpacing: string }).letterSpacing =
      `${((o.tracking ?? 0) * px).toFixed(2)}px`;
    return c.measureText(str).width;
  }

  // The one thing here that is not light: a dark plate that clears a space
  // in whatever has been drawn so far, so a label on top of it stays legible.
  plate(x: number, y: number, w: number, h: number, alpha: number) {
    this.flush();
    const c = this.ctx;
    c.globalCompositeOperation = "source-over";
    c.globalAlpha = clamp01(alpha);
    c.fillStyle = "#000";
    c.fillRect(x, y, w, h);
    c.globalCompositeOperation = "lighter";
  }

  // ── frame ─────────────────────────────────────────────────────────────

  flush() {
    const c = this.ctx;
    for (const [key, pts] of this.lines) {
      c.globalAlpha = ((key / 100) | 0) % 100 / 48;
      c.strokeStyle = CSS[NAMES[(key / 10000) | 0]];
      c.lineWidth = (key % 100) / 4;
      c.beginPath();
      for (let i = 0; i < pts.length; i += 4) {
        c.moveTo(pts[i], pts[i + 1]);
        c.lineTo(pts[i + 2], pts[i + 3]);
      }
      c.stroke();
    }
    this.lines.clear();
    for (const [key, pts] of this.dots) {
      c.globalAlpha = (key % 100) / 48;
      c.fillStyle = CSS[NAMES[(key / 100) | 0]];
      c.beginPath();
      for (let i = 0; i < pts.length; i += 3) {
        c.moveTo(pts[i] + pts[i + 2], pts[i + 1]);
        c.arc(pts[i], pts[i + 1], pts[i + 2], 0, TAU);
      }
      c.fill();
    }
    this.dots.clear();
  }

  // Something opaque stands in front of the light here (a Sulcus window in
  // the world): whatever was drawn behind it, and its glow, is hidden.
  cut(quad: { x: number; y: number }[], alpha = 1) {
    if (alpha > 0.002 && quad.length > 2) this.cuts.push({ quad, alpha: Math.min(1, alpha) });
  }

  private applyCuts() {
    if (!this.cuts.length) return;
    const c = this.ctx;
    c.setTransform(this.S, 0, 0, this.S, 0, 0);
    c.globalCompositeOperation = "destination-out";
    c.fillStyle = "#000";
    for (const { quad, alpha } of this.cuts) {
      c.globalAlpha = alpha;
      c.beginPath();
      quad.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
      c.closePath();
      c.fill();
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = "lighter";
  }

  // Bloom: the frame, blurred at two radii, added back onto itself.
  end(bloom = 1) {
    this.flush();
    this.applyCuts();
    if (bloom <= 0) return;
    const c = this.ctx;
    const pass = (
      buf: HTMLCanvasElement,
      div: number,
      logicalBlur: number,
      amount: number,
    ) => {
      const b = buf.getContext("2d")!;
      b.globalCompositeOperation = "copy";
      b.filter = `blur(${((logicalBlur * this.S) / div).toFixed(2)}px)`;
      b.drawImage(this.canvas, 0, 0, buf.width, buf.height);
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalCompositeOperation = "lighter";
      c.globalAlpha = amount * bloom;
      c.imageSmoothingEnabled = true;
      c.imageSmoothingQuality = "high";
      c.drawImage(buf, 0, 0, this.canvas.width, this.canvas.height);
    };
    pass(this.bloomA, 4, 9, 0.55);
    pass(this.bloomB, 8, 44, 0.5);
    c.setTransform(this.S, 0, 0, this.S, 0, 0);
    this.applyCuts();
  }
}
