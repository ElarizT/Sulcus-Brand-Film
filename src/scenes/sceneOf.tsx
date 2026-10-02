import { useCurrentFrame } from "remotion";
import { FilmFrame } from "../film/FilmFrame";
import { FPS, SCENES, type SceneId } from "../film/timeline";

// A scene is a stretch of the one continuous film: the same frame function,
// offset to where the scene starts.
export const sceneOf = (id: SceneId) => {
  const Scene: React.FC = () => <FilmFrame t={SCENES[id].from + useCurrentFrame() / FPS} />;
  Scene.displayName = id;
  return Scene;
};
