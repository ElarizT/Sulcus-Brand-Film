import { Composition, Folder } from "remotion";
import { Atmosphere } from "./components/Atmosphere";
import { FontTest } from "./debug/FontTest";
import { UITest } from "./debug/UITest";
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
import { SCENE_LIST } from "./SulcusFilm";
import { SulcusFilm } from "./SulcusFilm";
import { useFonts } from "./theme/typography";

// A scene on its own, with the film's grain and vignette, for scrubbing.
const standalone = (Scene: React.FC) => {
  const Standalone: React.FC = () => {
    useFonts();
    return (
      <>
        <Scene />
        <Atmosphere />
      </>
    );
  };
  return Standalone;
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
      {SCENE_LIST.map(([id, Scene]: [SceneId, React.FC]) => (
        <Composition
          key={id}
          id={id}
          component={standalone(Scene)}
          durationInFrames={sceneFrames(id).durationInFrames}
          fps={FPS}
          width={LOGICAL_W}
          height={LOGICAL_H}
        />
      ))}
    </Folder>
    <Folder name="Debug">
      <Composition id="UITest" component={UITest} durationInFrames={FILM_FRAMES} fps={FPS} width={LOGICAL_W} height={LOGICAL_H} />
      <Composition id="FontTest" component={FontTest} durationInFrames={1} fps={FPS} width={LOGICAL_W} height={LOGICAL_H} />
    </Folder>
  </>
);
