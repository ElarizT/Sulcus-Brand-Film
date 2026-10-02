import { v3 } from "../engine/math";
import { place, type Plane, type Projector } from "../engine/project";
import { SulcusUI, type AfterLayout, type Measured } from "../ui/SulcusUI";

// A Sulcus Cloud window standing in the film's world. Its four corners go
// through the same camera as the canvas, so the real interface and the light
// drawn around it stay registered as the camera moves.
//
// Lens and light, all in the plane's own pixels so they travel with it:
//   focus     depth of field: a blurred copy under a sharp copy whose mask
//             falls off away from the point of focus
//   vignette  light falloff away from where the shot is looking
//   reveal    a circular mask that opens from one point (the interface
//             resolving around the execution path that became it)

export type Focus = { x: number; y: number; r: number; blur: number };
export type Vignette = { x: number; y: number; r: number; strength: number };
export type Reveal = { x: number; y: number; r: number; soft: number };

type Props = {
  plane: Plane;
  project: Projector;
  html: string;
  vars?: Record<string, string | number>;
  after?: AfterLayout;
  sink?: { current: Measured };
  opacity?: number;
  focus?: Focus;
  vignette?: Vignette;
  reveal?: Reveal;
  blur?: number;
  brightness?: number;
  // Layout pixels per UI pixel. The interface is laid out at this density and
  // the plane's transform scales it back, so text is rasterised sharp enough
  // for the camera to come close (Chrome rasterises a 3D-transformed layer at
  // roughly its own size, not at the size it is projected to).
  density?: number;
};

const radialMask = (x: number, y: number, r: number, soft: number) =>
  `radial-gradient(circle at ${x.toFixed(1)}px ${y.toFixed(1)}px, #000 ${Math.max(0, r - soft).toFixed(1)}px, transparent ${Math.max(1, r).toFixed(1)}px)`;

export const UIPlane: React.FC<Props> = ({
  plane,
  project,
  html,
  vars,
  after,
  sink,
  opacity = 1,
  focus,
  vignette,
  reveal,
  blur = 0,
  brightness = 1,
  density = 2,
}) => {
  const { w, h } = plane;
  const D = density;
  // The same plane, measured in layout pixels.
  const dense: Plane = {
    ...plane,
    ax: v3.scale(plane.ax, 1 / D),
    ay: v3.scale(plane.ay, 1 / D),
    w: w * D,
    h: h * D,
  };
  const p = place(dense, project);
  const shown = p.visible && opacity > 0.002 && (!reveal || reveal.r > 1);
  const filters = [
    blur > 0.05 ? `blur(${(blur * D).toFixed(2)}px)` : "",
    Math.abs(brightness - 1) > 0.005
      ? `brightness(${brightness.toFixed(3)})`
      : "",
  ]
    .filter(Boolean)
    .join(" ");
  const revealMask = reveal
    ? radialMask(reveal.x * D, reveal.y * D, reveal.r * D, reveal.soft * D)
    : undefined;
  const dof = focus && focus.blur > 0.05;

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: w * D,
        height: h * D,
        transformOrigin: "0 0",
        transform: p.matrix || "none",
        opacity: shown ? opacity : 0,
        visibility: shown ? "visible" : "hidden",
        filter: filters || undefined,
        maskImage: revealMask,
        WebkitMaskImage: revealMask,
        // The window's edge catches a little light against the dark.
        boxShadow:
          "0 0 0 1px rgba(255,255,255,0.06), 0 40px 120px rgba(0,0,0,0.65)",
      }}
    >
      {/* Everything inside is in UI pixels; `zoom` lays it out at density D. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: w,
          height: h,
          zoom: D,
        }}
      >
        {dof ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              filter: `blur(${focus.blur.toFixed(2)}px)`,
            }}
          >
            <SulcusUI
              html={html}
              width={w}
              height={h}
              vars={vars}
              after={after}
            />
          </div>
        ) : null}
        <div
          style={{
            position: "absolute",
            inset: 0,
            ...(dof
              ? {
                  maskImage: radialMask(
                    focus.x,
                    focus.y,
                    focus.r,
                    focus.r * 0.55,
                  ),
                  WebkitMaskImage: radialMask(
                    focus.x,
                    focus.y,
                    focus.r,
                    focus.r * 0.55,
                  ),
                }
              : {}),
          }}
        >
          <SulcusUI
            html={html}
            width={w}
            height={h}
            vars={vars}
            after={after}
            sink={sink}
          />
        </div>
        {vignette && vignette.strength > 0.005 ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              background: `radial-gradient(circle at ${vignette.x}px ${vignette.y}px, rgba(0,0,0,0) ${(vignette.r * 0.35).toFixed(0)}px, rgba(0,0,0,${vignette.strength.toFixed(3)}) ${vignette.r.toFixed(0)}px)`,
            }}
          />
        ) : null}
      </div>
    </div>
  );
};
