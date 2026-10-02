import { easeIn, lerp, ramp, v3 } from "../engine/math";
import type { Renderer } from "../engine/renderer";
import { cameraAt, shakeAt } from "../film/camera";
import { T } from "../film/timeline";
import { drawDust } from "../primitives/particles";

// Shared set-up for every scene that looks into the world: the film's one
// camera, the atmosphere for that moment, and the dust that makes the camera
// move readable. Scenes then draw whichever layers belong to them.
export const beginWorld = (r: Renderer, t: number) => {
  const cam = cameraAt(t);
  r.setCamera(cam, shakeAt(t));
  const focus = v3.dist(cam.eye, cam.target);
  // The air thins out as the camera climbs for the scale reveal.
  r.setFog(focus * 1.05, lerp(3000, 15000, ramp(t, T.scale - 1, T.scale + 3)));
  // Shallow focus up close; a wide shot of the whole system is sharp.
  r.dof = lerp(1, 0.18, ramp(t, T.boundsOut, T.unify + 1.5));

  // The final collapse: the whole world falls into the core.
  if (t >= T.collapse) {
    const c = ramp(t, T.collapse, T.dark);
    r.worldScale = 1 - easeIn(c) * 0.985;
    r.gain = (1 + 0.5 * c) * (1 - ramp(c, 0.8, 1));
  }

  drawDust(r, t, 1 - 0.45 * ramp(t, T.freeze, T.freeze + 0.1) * (1 - ramp(t, T.online, T.online + 1)));
};
