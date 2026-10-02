import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Overlay } from "../components/Overlay";
import { UIPlane } from "../components/UIPlane";
import { v3, type Vec3 } from "../engine/math";
import { makePlane, onPlane, projector } from "../engine/project";
import { useFonts } from "../theme/typography";
import { pulseVars, runDetailPage } from "../ui/pages";
import { RESEARCH, RESEARCH_ROWS } from "../ui/runs/research";

// frame 0: head-on zoom 1; frame 1: zoom 2.2 tilted; frame 2: zoom 3.5 tilted.
export const PlaneTest: React.FC = () => {
  useFonts();
  const f = useCurrentFrame();
  const t = 41;
  const plane = makePlane([562, 219, 900], 1920, 1080);
  const zoom = [1, 2.2, 3.5][f] ?? 1;
  const focal = 1100;
  const target: Vec3 = onPlane(plane, [960, 1300, 1400][f] ?? 960, [540, 500, 560][f] ?? 540);
  const d = (focal * 1) / zoom;
  const yaw = [0, 10, 18][f] ?? 0;
  const dir: Vec3 = [Math.sin((yaw * Math.PI) / 180), 0.12 * (f > 0 ? 1 : 0), -Math.cos((yaw * Math.PI) / 180)];
  const eye = v3.add(target, v3.scale(v3.norm(dir), d));
  const project = projector({ eye, target, focal });
  const p = runDetailPage({ script: RESEARCH, t, expandedRow: RESEARCH_ROWS.researcher });
  return (
    <AbsoluteFill style={{ background: "#050506" }}>
      <Overlay>
        <UIPlane plane={plane} project={project} html={p.page} vars={pulseVars(t)}
          focus={f > 0 ? { x: [960, 1300, 1400][f], y: [540, 500, 560][f], r: 700, blur: 2.5 } : undefined}
          vignette={{ x: 1200, y: 450, r: 1400, strength: 0.5 }} />
      </Overlay>
    </AbsoluteFill>
  );
};
