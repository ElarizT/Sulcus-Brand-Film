import { easeIn, lerp, ramp, v3 } from "../engine/math";
import type { Renderer } from "../engine/renderer";
import { drawBoundary } from "../primitives/boundary";
import { drawCore, drawPlane } from "../primitives/plane";
import { drawDust } from "../primitives/particles";
import { drawField } from "../world/drawField";
import { connectTime, SYSTEMS } from "../world/field";
import { drawLattice } from "../world/lattice";
import { cameraAt, shakeAt } from "./camera";
import { FOLLOWED, T } from "./timeline";

// The world the Sulcus windows stand in, drawn behind them: the agents of the
// opening (frozen in the dark through the middle of the film), then the
// ground, the systems that connect to it, and the scale of everything.

export const worldScaleAt = (t: number) =>
  t >= T.collapse ? 1 - easeIn(ramp(t, T.collapse, T.dark)) * 0.985 : 1;

// Shared set-up for every canvas that looks into the world: the film's one
// camera and the atmosphere for that moment.
export const beginWorld = (r: Renderer, t: number) => {
  const cam = cameraAt(t);
  r.setCamera(cam, shakeAt(t));
  const focus = v3.dist(cam.eye, cam.target);
  // The air thins out as the camera climbs for the scale reveal.
  r.setFog(focus * 1.05, lerp(3000, 15000, ramp(t, T.scale - 1, T.scale + 3)));
  // Shallow focus up close; the wide shots of the whole system are sharp.
  r.dof = lerp(1, 0.18, ramp(t, T.land - 1, T.land + 1.5));
  r.worldScale = worldScaleAt(t);
  if (t >= T.collapse) {
    const c = ramp(t, T.collapse, T.dark);
    r.gain = (1 + 0.5 * c) * (1 - ramp(c, 0.8, 1));
  }
};

export const drawWorld = (r: Renderer, t: number, covered: boolean) => {
  beginWorld(r, t);
  // Dust carries no meaning; it makes the camera's movement through the dark
  // readable. It quiets in the freeze.
  drawDust(r, t, 1 - 0.45 * ramp(t, T.freeze, T.freeze + 0.1) * (1 - ramp(t, T.land, T.land + 1)));
  // Behind a window that fills the frame there is nothing to draw.
  if (covered) return;

  drawPlane(r, t, lerp(1, 1.5, ramp(t, T.scale, T.scale + 3)));
  drawCore(r, t);
  if (t >= T.scale) drawLattice(r, t);

  // While the interface is resolving, the rest of the tangle steps back.
  const back = 1 - 0.6 * ramp(t, T.online, T.uiFull) * (1 - ramp(t, T.limitHit + 2, T.many));
  const followedAt = connectTime(FOLLOWED);
  const detail = lerp(1, 0.35, ramp(t, T.land - 1, T.land + 2)) * (1 - ramp(t, T.scale, T.scale + 1.5));
  drawField(r, t, {
    // The followed system is drawn as light while it becomes the UI, and is
    // seen again as a tree when its stream connects.
    skip: (s) => s === FOLLOWED && t >= T.pulse1 && t < followedAt,
    gain: () => back,
    detail,
  });

  // Every connected system stands inside its boundary.
  SYSTEMS.forEach((S, i) => {
    const at = connectTime(i);
    if (t < at + 0.6) return;
    drawBoundary(
      r,
      S.frame,
      { u0: -S.hw - 58, u1: S.hw + 58, v0: 34, v1: S.top + 62, w: 48 },
      "signal",
      0.42 * (1 - 0.6 * ramp(t, T.scale + 1, T.scale + 3)),
      ramp(t, at + 0.6, at + 1.3),
    );
  });

  // The last light: everything arriving at one point.
  if (t >= T.collapse) {
    const c = ramp(t, T.collapse, T.dark);
    const o = r.project([0, 0, 0]);
    if (o) {
      const flare = Math.pow(Math.sin(Math.PI * Math.min(1, c * 1.08)), 2);
      r.gain = 1;
      r.glow(o.x, o.y, 520 * (1.1 - c), "hot", flare);
      r.glow(o.x, o.y, 120 * (1.2 - c), "signal", flare);
      r.haze(o.x, o.y, 1500 * (1.15 - c), 50, "hot", 0.8 * flare);
    }
  }
};
