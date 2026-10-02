import { AbsoluteFill } from "remotion";
import { useFonts } from "../theme/typography";

export const FontTest: React.FC = () => {
  useFonts();
  return (
    <AbsoluteFill style={{ background: "#000", color: "#fff", fontSize: 40, padding: 40 }}>
      <div style={{ fontFamily: '"JetBrains Mono"' }}>JetBrains Mono: retriever 00:12.481 ↳◇⌘⌁⌑＋</div>
      <div style={{ fontFamily: "Inter" }}>Inter: retriever 00:12.481 ↳◇⌘⌁⌑＋ ›</div>
      <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace" }}>ui-monospace stack 00:12.481 ↳◇⌘⌁⌑</div>
    </AbsoluteFill>
  );
};
