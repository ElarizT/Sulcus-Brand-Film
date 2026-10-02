import { LOGICAL_H, LOGICAL_W } from "../film/timeline";
import { v3, type Vec3 } from "./math";
import type { Camera } from "./renderer";

// The renderer's pinhole camera as a plain function, so the DOM layers can be
// placed in the same world the canvas draws: a Sulcus UI plane is a rectangle
// in world space, and its four projected corners give the CSS transform that
// puts the real interface exactly where the light around it is drawn.

export const NEAR = 40;

export type Projector = {
  (p: Vec3): { x: number; y: number; z: number; s: number } | null;
  depth: (p: Vec3) => number;
};

export const projector = (
  cam: Camera,
  shake?: { x: number; y: number },
  worldScale = 1,
): Projector => {
  const f = v3.norm(v3.sub(cam.target, cam.eye));
  const r = v3.norm(v3.cross([0, 1, 0], f));
  const u = v3.cross(f, r);
  const cx = LOGICAL_W / 2 + (shake?.x ?? 0);
  const cy = LOGICAL_H / 2 + (shake?.y ?? 0);
  const local = (p: Vec3): Vec3 => {
    const d: Vec3 = [p[0] * worldScale - cam.eye[0], p[1] * worldScale - cam.eye[1], p[2] * worldScale - cam.eye[2]];
    return [v3.dot(d, r), v3.dot(d, u), v3.dot(d, f)];
  };
  const project = ((p: Vec3) => {
    const c = local(p);
    if (c[2] < NEAR) return null;
    const s = cam.focal / c[2];
    return { x: cx + c[0] * s, y: cy - c[1] * s, z: c[2], s };
  }) as Projector;
  project.depth = (p: Vec3) => local(p)[2];
  return project;
};

// A flat rectangle in the world, W×H UI pixels: `origin` is the world point
// of its top-left corner, `ax` / `ay` the world step per UI pixel along x and
// down y.
export type Plane = { origin: Vec3; ax: Vec3; ay: Vec3; w: number; h: number };

export const onPlane = (pl: Plane, x: number, y: number): Vec3 =>
  v3.add(pl.origin, v3.add(v3.scale(pl.ax, x), v3.scale(pl.ay, y)));

export const planeCenter = (pl: Plane) => onPlane(pl, pl.w / 2, pl.h / 2);

// A plane of W×H UI px at `scale` world units per px, centred on `center`,
// turned `yaw` degrees about the vertical and tipped `pitch` degrees back
// (positive pitch lays the top away from the viewer, toward the ground).
export const makePlane = (
  center: Vec3,
  w: number,
  h: number,
  scale = 1,
  yaw = 0,
  pitch = 0,
): Plane => {
  const ya = (yaw * Math.PI) / 180;
  const pa = (pitch * Math.PI) / 180;
  // Facing −z (toward a camera that looks down +z) when yaw = pitch = 0.
  const ax: Vec3 = [Math.cos(ya) * scale, 0, -Math.sin(ya) * scale];
  // Down the plane: −y, tipped back toward +z by pitch, then yawed.
  const down: Vec3 = [0, -Math.cos(pa), -Math.sin(pa)];
  const ay: Vec3 = [
    (down[0] * Math.cos(ya) + down[2] * Math.sin(ya)) * scale,
    down[1] * scale,
    (-down[0] * Math.sin(ya) + down[2] * Math.cos(ya)) * scale,
  ];
  const origin = v3.sub(center, v3.add(v3.scale(ax, w / 2), v3.scale(ay, h / 2)));
  return { origin, ax, ay, w, h };
};

// The plane's outward normal (the side its UI faces).
export const planeNormal = (pl: Plane): Vec3 => v3.norm(v3.cross(pl.ax, pl.ay));

export type Placement = {
  matrix: string; // CSS matrix3d for a W×H element with transform-origin 0 0
  depth: number; // camera depth of the plane's centre
  scale: number; // projected size of one UI px at the centre, in screen px
  visible: boolean;
};

// The homography taking the rectangle (0,0)–(W,H) to four screen points, as a
// CSS matrix3d. (Heckbert's square-to-quad mapping, rescaled to W×H.)
const quadMatrix = (w: number, h: number, q: { x: number; y: number }[]) => {
  const [p0, p1, p2, p3] = q;
  const dx1 = p1.x - p2.x;
  const dx2 = p3.x - p2.x;
  const dx3 = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y;
  const dy2 = p3.y - p2.y;
  const dy3 = p0.y - p1.y + p2.y - p3.y;
  let g = 0;
  let hh = 0;
  if (Math.abs(dx3) > 1e-9 || Math.abs(dy3) > 1e-9) {
    const den = dx1 * dy2 - dx2 * dy1;
    g = (dx3 * dy2 - dx2 * dy3) / den;
    hh = (dx1 * dy3 - dx3 * dy1) / den;
  }
  const a = p1.x - p0.x + g * p1.x;
  const b = p3.x - p0.x + hh * p3.x;
  const c = p0.x;
  const d = p1.y - p0.y + g * p1.y;
  const e = p3.y - p0.y + hh * p3.y;
  const f = p0.y;
  // Column-major: x' = a/w·x + b/h·y + c, y' = d/w·x + e/h·y + f,
  // w' = g/w·x + h/h·y + 1.
  const m = [a / w, d / w, 0, g / w, b / h, e / h, 0, hh / h, 0, 0, 1, 0, c, f, 0, 1];
  return `matrix3d(${m.map((x) => (Math.abs(x) < 1e-12 ? 0 : x).toPrecision(10)).join(",")})`;
};

export const place = (pl: Plane, project: Projector): Placement => {
  const corners = [onPlane(pl, 0, 0), onPlane(pl, pl.w, 0), onPlane(pl, pl.w, pl.h), onPlane(pl, 0, pl.h)];
  const q = corners.map((c) => project(c));
  const center = planeCenter(pl);
  const depth = project.depth(center);
  if (q.some((p) => p === null)) return { matrix: "", depth, scale: 0, visible: false };
  const pts = q as { x: number; y: number; z: number; s: number }[];
  const c = project(center);
  // Facing away from the camera: not drawn.
  const area =
    (pts[1].x - pts[0].x) * (pts[3].y - pts[0].y) - (pts[1].y - pts[0].y) * (pts[3].x - pts[0].x);
  return {
    matrix: quadMatrix(pl.w, pl.h, pts),
    depth,
    scale: c ? c.s * v3.len(pl.ax) : 0,
    visible: area > 0,
  };
};
