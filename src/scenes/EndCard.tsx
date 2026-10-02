import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { Overlay } from "../components/Overlay";
import { SulcusMark } from "../components/SulcusLogo";
import { FPS, SCENES, T } from "../film/timeline";
import { colors } from "../theme/colors";
import { mono, sans } from "../theme/typography";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const settle = Easing.bezier(0.16, 1, 0.3, 1);

// 67.5–74 s. Black. The mark resolves out of the point the world collapsed
// into, then the name, then the line the whole film has been arriving at —
// "Control the agents." — and the address, and a long hold.
export const EndCard: React.FC = () => {
  const t = SCENES.EndCard.from + useCurrentFrame() / FPS;
  return (
    <AbsoluteFill style={{ backgroundColor: colors.void }}>
      <Overlay>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            opacity: interpolate(t, [T.endFade, T.endDark], [1, 0], clamp),
          }}
        >
          {/* The light the mark arrives in. */}
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: 392,
              width: 900,
              height: 900,
              translate: "-50% -50%",
              background:
                "radial-gradient(circle, rgba(255,122,40,0.5) 0%, rgba(255,122,40,0.14) 22%, rgba(255,122,40,0) 60%)",
              opacity: interpolate(
                t,
                [T.logo - 0.05, T.logo + 0.08, T.logo + 2.2],
                [0, 1, 0.16],
                clamp,
              ),
              scale: interpolate(t, [T.logo, T.logo + 2.2], [0.5, 1], {
                ...clamp,
                easing: settle,
              }),
            }}
          />
          <SulcusMark
            size={168}
            style={{
              opacity: interpolate(t, [T.logo, T.logo + 0.35], [0, 1], clamp),
              scale: interpolate(t, [T.logo, T.logo + 1.6], [0.86, 1], {
                ...clamp,
                easing: settle,
              }),
            }}
          />
          <div
            style={{
              marginTop: 54,
              fontFamily: sans,
              fontWeight: 600,
              fontSize: 76,
              lineHeight: 1,
              color: colors.ink,
              marginRight: "-0.34em",
              letterSpacing: `${interpolate(
                t,
                [T.wordmark, T.wordmark + 1.8],
                [0.5, 0.34],
                { ...clamp, easing: settle },
              )}em`,
              opacity: interpolate(
                t,
                [T.wordmark, T.wordmark + 0.9],
                [0, 1],
                clamp,
              ),
            }}
          >
            SULCUS
          </div>
          <div
            style={{
              marginTop: 38,
              fontFamily: sans,
              fontWeight: 400,
              fontSize: 36,
              lineHeight: 1,
              letterSpacing: "0.012em",
              color: colors.ink,
              opacity: interpolate(
                t,
                [T.tagline, T.tagline + 0.9],
                [0, 1],
                clamp,
              ),
              translate: `0px ${interpolate(
                t,
                [T.tagline, T.tagline + 1.1],
                [8, 0],
                { ...clamp, easing: settle },
              )}px`,
            }}
          >
            Control the agents.
          </div>
          <div
            style={{
              marginTop: 64,
              fontFamily: mono,
              fontWeight: 500,
              fontSize: 21,
              lineHeight: 1,
              letterSpacing: "0.14em",
              color: colors.signal,
              opacity: interpolate(t, [T.url, T.url + 0.9], [0, 1], clamp),
            }}
          >
            sulcus.dev
          </div>
        </div>
      </Overlay>
    </AbsoluteFill>
  );
};
