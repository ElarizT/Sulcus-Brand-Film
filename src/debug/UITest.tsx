import { AbsoluteFill, useCurrentFrame } from "remotion";
import { FPS } from "../film/timeline";
import { pulseVars, runDetailPage } from "../ui/pages";
import { RESEARCH, RESEARCH_ROWS } from "../ui/runs/research";
import { SulcusUI } from "../ui/SulcusUI";
import { useFonts } from "../theme/typography";

// Flat render of the research run's Run Detail at film time frame/FPS.
export const UITest: React.FC = () => {
  useFonts();
  const t = useCurrentFrame() / FPS;
  const p = runDetailPage({
    script: RESEARCH,
    t,
    expandedRow: t > 32.5 ? RESEARCH_ROWS.researcher : null,
    logOpen: t > 35.7 && t < 39.4,
    filter: "Tools",
    expanded: [],
    deciding: t >= 43.75 && t < 44.1 ? "apr_3c9e71d0" : null,
  });
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <SulcusUI html={p.page} width={1920} height={1080} vars={pulseVars(t)} />
    </AbsoluteFill>
  );
};
