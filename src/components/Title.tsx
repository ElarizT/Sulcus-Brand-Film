import { Easing, interpolate } from "remotion";
import { colors } from "../theme/colors";
import { sans } from "../theme/typography";

type Props = {
  text: string;
  // Film time in seconds, and when the line enters and leaves.
  t: number;
  from: number;
  to: number;
  // "hit" lands on a single frame; "rise" eases in.
  entrance?: "rise" | "hit";
  // Vertical centre, in logical px.
  y?: number;
  size?: number;
  // A soft pool of darkness behind the line, for when it sits over the world.
  scrim?: boolean;
};

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// The film's only typographic voice: wide-tracked capitals, set small against
// a lot of dark.
export const Title: React.FC<Props> = ({
  text,
  t,
  from,
  to,
  entrance = "rise",
  y = 540,
  size = 50,
  scrim = false,
}) => {
  if (t < from - 0.05 || t > to + 0.05) return null;
  const hit = entrance === "hit";
  const fadeIn = hit ? 0.001 : 0.9;
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: y,
        translate: "0 -50%",
        display: "flex",
        justifyContent: "center",
        opacity: interpolate(t, [from, from + fadeIn, to - 0.5, to], [0, 1, 1, 0], {
          ...clamp,
          easing: Easing.bezier(0.33, 0, 0.2, 1),
        }),
      }}
    >
      {scrim ? (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: size * 34,
            height: size * 8.4,
            translate: "-50% -50%",
            background:
              "radial-gradient(ellipse at center, rgba(5,5,6,0.82) 0%, rgba(5,5,6,0.6) 38%, rgba(5,5,6,0) 70%)",
          }}
        />
      ) : null}
      <div
        style={{
          position: "relative",
          fontFamily: sans,
          fontWeight: 500,
          fontSize: size,
          lineHeight: 1,
          color: colors.ink,
          whiteSpace: "nowrap",
          // Tracking opens very slightly over the hold: the line breathes.
          letterSpacing: `${interpolate(t, [from, to], [0.24, 0.27], clamp)}em`,
          marginRight: "-0.24em",
          scale: hit
            ? interpolate(t, [from, from + 0.5], [1.045, 1], {
                ...clamp,
                easing: Easing.bezier(0.16, 1, 0.3, 1),
              })
            : 1,
          translate: hit
            ? "0px 0px"
            : `0px ${interpolate(t, [from, from + 1.1], [10, 0], {
                ...clamp,
                easing: Easing.bezier(0.16, 1, 0.3, 1),
              })}px`,
        }}
      >
        {text}
      </div>
    </div>
  );
};
