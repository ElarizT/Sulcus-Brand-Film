import { Composition, Folder } from "remotion";
import { Atmosphere } from "./components/Atmosphere";
import {
  FILM_FRAMES,
  FPS,
  HEIGHT,
  LOGICAL_H,
  LOGICAL_W,
  sceneFrames,
  type SceneId,
  WIDTH,
} from "./film/timeline";
import { Complexity } from "./scenes/Complexity";
import { EndCard } from "./scenes/EndCard";
import { IntroAgents } from "./scenes/IntroAgents";
import { ScaleSequence } from "./scenes/ScaleSequence";
import { SulcusReveal } from "./scenes/SulcusReveal";
import { UnifiedRuntime } from "./scenes/UnifiedRuntime";
import { SulcusFilm } from "./SulcusFilm";

// A scene on its own, with the film's grain and vignette, for scrubbing.
const standalone = (Scene: React.FC) => {
  const Standalone: React.FC = () => (
    <>
      <Scene />
      <Atmosphere />
    </>
  );
  return Standalone;
};

const SCENE_COMPONENTS: Record<SceneId, React.FC> = {
  IntroAgents: standalone(IntroAgents),
  Complexity: standalone(Complexity),
  SulcusReveal: standalone(SulcusReveal),
  UnifiedRuntime: standalone(UnifiedRuntime),
  ScaleSequence: standalone(ScaleSequence),
  EndCard: standalone(EndCard),
};

export const RemotionRoot: React.FC = () => (
  <>
    {/* The 4K master. */}
    <Composition
      id="SulcusFilm"
      component={SulcusFilm}
      durationInFrames={FILM_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
    {/* The same film at 1080p, for previews and fast review renders. */}
    <Composition
      id="SulcusFilm-1080p"
      component={SulcusFilm}
      durationInFrames={FILM_FRAMES}
      fps={FPS}
      width={LOGICAL_W}
      height={LOGICAL_H}
    />
    <Folder name="Scenes">
      {(Object.keys(SCENE_COMPONENTS) as SceneId[]).map((id) => (
        <Composition
          key={id}
          id={id}
          component={SCENE_COMPONENTS[id]}
          durationInFrames={sceneFrames(id).durationInFrames}
          fps={FPS}
          width={LOGICAL_W}
          height={LOGICAL_H}
        />
      ))}
    </Folder>
  </>
);
