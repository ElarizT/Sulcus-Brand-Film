import { Img, staticFile } from "remotion";

// The official Sulcus mark (public/Sulcus-logo.png, 1254×1254 RGBA), used as
// supplied. The artwork occupies the middle 816 px of the file; `size` is the
// width of the visible mark, not of the file's canvas.
const ART = 816 / 1254;

export const SulcusMark: React.FC<{
  size: number;
  style?: React.CSSProperties;
}> = ({ size, style }) => {
  const img = Math.round(size / ART);
  return (
    <div style={{ position: "relative", width: size, height: size, ...style }}>
      <Img
        src={staticFile("Sulcus-logo.png")}
        style={{
          position: "absolute",
          left: Math.round((size - img) / 2),
          top: Math.round((size - img) / 2),
          width: img,
          height: img,
          display: "block",
        }}
      />
    </div>
  );
};
